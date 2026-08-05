---
name: steam-update
description: Ship the current game to the Steam store as a depot update. Use when the user says "update steam", "push to steam", "upload to steam", "ship a steam build", "release to steam", or invokes /steam-update. Covers pre-flight gates, the CI depot build, the steamcmd upload, and setting the build live.
---

# Shipping a Mojiworld update to Steam

Mojiworld is a single-file HTML game wrapped in Electron. Steam ships the
**unpacked** electron-builder output verbatim; SteamPipe handles patching.

## Facts you need (verify, don't assume — they can change)

| Thing | Value |
|---|---|
| App ID | `4842650` |
| Windows depot | `4842651` |
| Linux / Deck depot | `4842652` |
| Build script | `steam/steam_upload/app_build.vdf` (ContentRoot `..\release\`) |
| CI workflow | `.github/workflows/steam-build.yml` |
| CI artifacts | `mojiworld-windows-depot`, `mojiworld-linux-depot` |
| Payload filter | `steam/package.json` → `build.extraResources` |

`SetLive` in `app_build.vdf` is intentionally empty — uploading never
auto-publishes. Someone sets the build live in Steamworks afterwards.

## Step 0 — Pre-flight (always run; each exits non-zero on a real problem)

```bash
node tools/set_steam_appid.mjs          # bare = report. Non-zero if still 480 (Spacewar)
node tools/sync_steam_version.mjs       # non-zero if the wrapper version drifted
```

Then the two live suites. **On this Windows machine Playwright's bundled
Chromium is not installed** — pass Edge explicitly or they fail with a
misleading "executable doesn't exist":

```bash
export MOJI_PW_EXE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
node scripts/steam_depot_boot_test.mjs        # expect 6/6
```

`steam_depot_boot_test.mjs` is the important one: it serves the game while
404-ing every path **not** covered by the depot filter, so anything the game
requests at runtime but the build would not ship fails there instead of on a
player's machine. It also case-audits ~7k asset paths, because the Steam Deck's
ext4 is case-sensitive where Windows is not.

For a release (not a hotfix), also run the full integration suite — it needs a
server on 8080:

```bash
node serve.js 8080 &
MOJI_GAME_URL="http://localhost:8080/mojiworld_game.html" node scripts/steam_integration_test.mjs   # expect 49/49
```

## Step 1 — Get the depots built

**Prefer CI.** Pushing to `main` triggers `steam-build.yml` for any change under
the payload paths (the game, `Sprites/`, `audio/`, `backgrounds/`, `data/`,
`steam/`). It syncs the version, bakes the App ID and relay URL from repo
variables, and builds Windows + Linux. Also triggerable by hand
(`workflow_dispatch`) or by pushing a `steam-v*` tag.

Download both artifacts and unzip to exactly:

```
steam/release/win-unpacked/
steam/release/linux-unpacked/
```

**Local Windows build (fallback only).** `steam/release/` is gitignored, so a
local build is never committed.

```bash
cd steam && npm run dist:steamwin
```

If that dies with **"Cannot create symbolic link : A required privilege is not
held by the client"**, the box lacks symlink privilege: electron-builder
extracts its winCodeSign bundle to a *fresh random cache dir every run* and that
bundle holds macOS `.dylib` symlinks. Pre-populating the cache does not help —
the directory name changes. Enabling Developer Mode is the real fix. Otherwise:

```bash
cd steam && npx electron-builder --win dir --config.win.signAndEditExecutable=false
cd .. && node tools/stamp_win_exe.mjs     # applies real name/version/icon via rcedit
```

Without that second command the exe identifies itself as *Electron 31.7.7*.

## Step 2 — Verify what you are about to upload

```bash
node -e "const v=require('./steam/package.json').version; console.log('wrapper',v)"
```

Confirm `steam/release/win-unpacked/Mojiworld.exe` exists, its ProductVersion is
Mojiworld's (not Electron's), and the bundled
`resources/app/mojiworld_game.html` carries the expected `GAME_VERSION`.

**Never build a store upload from a dirty working tree.** Parallel Claude
sessions edit this repo concurrently; `git status` routinely shows another
session's in-flight work. A store build must come from a clean checkout of the
commit being shipped, or it ships someone's half-finished changes.

## Step 3 — Upload (REQUIRES USER CONFIRMATION)

Uploading is outward-facing and irreversible-ish. **Show the user the version,
commit and depot IDs, and get an explicit yes before running it.**

```bash
steamcmd +login <builder_account> +run_app_build "C:\Users\dpeh0\Mojiworld\steam\steam_upload\app_build.vdf" +quit
```

**The user runs the login themselves.** Never ask for, type, or handle their
Steam password, and never touch Steam Guard codes. If credentials are not
cached, hand them the command to run.

## Step 4 — Set it live

Steamworks → the app → **Builds** → select the build → set live on `default`
(or a beta branch first). This is a browser action for the user; do not do it
on their behalf.

## After a change to the payload layout

If a new asset directory is added, it must go in **two** places or its updates
silently never ship:

1. `steam/package.json` → `build.extraResources` filter — or it is not packaged
2. `.github/workflows/steam-build.yml` → `paths:` — or changes never trigger CI

This exact gap once left the packaged build 42 versions behind the game, with
nothing failing. `scripts/steam_depot_boot_test.mjs` catches case 1.

## Patch size — set expectations correctly

The build is ~1.4 GB but SteamPipe diffs at chunk level. A gameplay change
(`mojiworld_game.html`, ~6.5 MB) plus some sprites is a few MB for players. The
~172 MB Electron runtime is byte-identical between builds and is not re-sent —
**unless** the Electron version is bumped, which re-sends all of it.

## Store art (only when the store page changes)

```bash
node tools/gen_steam_upload_assets.mjs   # -> steam/assets/upload/, exact Valve sizes
```

Upload from `steam/assets/upload/`, **not** `steam/assets/` — the latter holds
2x masters that Steamworks rejects for being off-spec.

## Known-unfinished (mention if relevant, do not silently "fix")

- `steam/relay.config.json` is empty → multiplayer off, solo unaffected. Set the
  `MOJI_RELAY_URL` repo variable and CI bakes it in.
- Screenshots (5+ at 1920x1080) and a trailer are not generated by any script.
- Code signing is wired but dormant until the six `AZURE_*` secrets exist.

Full background: `docs/guides/STEAM.md`.
