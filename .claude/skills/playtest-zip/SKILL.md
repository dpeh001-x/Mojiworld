---
name: playtest-zip
description: Package Mojiworld as a self-contained zip for a playtester (Google Drive / direct send). Use when the user says "zip the game", "package for the tester", "build a playtest build", "send this to my tester", "compress the game to send", or invokes /playtest-zip. Covers what ships, the commit-not-working-copy rule, the boot verification, and handing it over.
---

# Packaging a Mojiworld playtest zip

A tester gets: **download → unzip → double-click `Mojiworld.cmd` → play.**
Nothing installed, no Node, no git, no internet.

## Which packager — there are two, and they are not interchangeable

| Script | Ships | Use when |
|---|---|---|
| `scripts/package_playtest_build.mjs` | **From the commit**, allowlist of runtime files + `README.txt` | A **playtester** build. This skill. |
| `scripts/build_portable_zip.mjs` | From the **working copy**, list read from `steam/package.json` `extraResources` | The **player-facing** portable release, kept in lockstep with the Steam depot. |

Don't "improve" one by copying the other's file list. The playtest packager
excludes `steam/` (cinematics, ~2.5 GB of Electron/store material); the portable
build needs it.

## The rule that bites — it packages the COMMIT, not your working copy

`package_playtest_build.mjs` reads code out of `git show <ref>:<path>` and
skips anything untracked. That is deliberate — an early build shipped a stale
working copy and the version in the corner disagreed with the fix the tester
was asked to check — but it means **uncommitted edits do not ship, silently**.

So: **commit first.** Then confirm what you are about to package:

```bash
node scripts/package_playtest_build.mjs --dry
```

The last lines print `build: vX.Y.Z from HEAD (<sha>)`. If that version is not
the one you intend to send, stop. Parallel sessions move `HEAD` in this repo,
so re-read it right before packaging rather than trusting an earlier reading.

Package a specific commit instead of `HEAD` with `--ref <sha>`.

## Step 1 — Build it

```bash
node scripts/package_playtest_build.mjs --with-node --zip
```

- `--with-node` bundles the signed `node.exe` (~88 MB) so the tester installs
  nothing. Without it, `Mojiworld.cmd` falls back to a PATH `node`, and if there
  is none it opens the hosted build instead — the tester then silently plays
  `main`, not your build. **Always pass it** unless the tester has Node.
- `--zip` writes `Mojiworld-playtest-<packaged version>.zip` at the repo root,
  with a matching top-level folder inside. The name comes from the version
  actually staged, not from `HEAD` — those drifted apart once and the filename
  advertised a build the zip did not contain.
- `--out DIR` to stage elsewhere (default `_playtest`), `--dry` to preview.

Expect roughly **800 MB staged / 830 MB zipped**, ~7,100 files.

## Step 2 — Verify by booting the package, not the repo

```bash
node scripts/verify_playtest_build.mjs _playtest 8766
```

It launches the staged build with **its own bundled node and its own
`serve.js`**, then asserts: the packaged version equals the commit's, floor and
platform tiles load, no 404s anywhere in boot, no page errors, the launcher and
bundled node are present, and the README both states the packaged version and
teaches the keys this build actually binds.

**Expect 14/14. Do not send a zip on a red check.** A 404 here is an asset the
game asks for that the allowlist does not ship — fix the list, not the test.

## Step 3 — Hand it over

Give the user the **path and the size**, and let them upload. Don't attempt the
Drive upload.

Then say which version it is and what changed since the tester's last build —
they need it for bug reports, and the README asks them to quote it.

## Facts worth not rediscovering

- **`file://` is broken by design.** Opening `mojiworld_game.html` by
  double-click taints the canvas and blocks tile loads: floors and platforms go
  missing. The README says this twice. If a tester reports missing ground, ask
  how they launched it before debugging anything.
- **Server port is 8765**, hardcoded in `Mojiworld.cmd`. It reuses a listener
  already on that port, so a stale console window makes a new build appear not
  to update.
- **The README is generated**, from `docs/guides/playtest_README.txt` with
  `{{VERSION}}` substituted. Edit the template — the packager wipes the output
  directory on every run, so a README authored straight into `_playtest/`
  survives exactly one packaging and then vanishes.
- **Saves live in browser localStorage**, per browser. A tester who switches
  browsers looks like they lost their save.
- **Never commit the zip or `_playtest/`.** Both are build output.
- Ship-list changes go in `ROOT_FILES` / `ASSET_DIRS` at the top of the
  packager. A new asset directory that is not listed simply never ships, and
  only the 404 check in step 2 will tell you.
