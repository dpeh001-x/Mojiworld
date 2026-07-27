# Shipping Mojiworld on Steam (casual co-op)

This is the desktop-build + launch guide for the **casual co-op action-RPG**
pivot. The game itself is unchanged web tech (one `mojiworld_game.html` + assets);
`steam/` wraps it as a native app and multiplayer runs over a hosted relay.

---

## 1. What changed for the pivot

| Area | Before (MMO-Lite) | Now (casual co-op) |
| --- | --- | --- |
| Entry | Username + password accounts (local/cloud) | **Name your hero** only — no accounts |
| Friends | Room string + ws:// URL + channels | **Party Code** (share a code) + shipped relay baked in |
| Monsters | Each client spawned its own | **Shared, host-authoritative** — same monsters, HP, kills |
| Progression | Per-client | Shared kill XP/coins on the same map |

The multiplayer is **host-authoritative among friends** (the lowest-id player in
a party hosts). This is the right trust model for co-op with people you know —
no server-side anti-cheat needed. It is *not* a public-server MMO.

---

## 2. Host the relay (required before shipping)

Multiplayer needs one small public WebSocket relay. Two shipped options:

**A. Cloudflare Workers (recommended — free tier, global, no server to babysit).**
```
cd mp-cf
npm install
npx wrangler deploy
# -> https://<name>.<subdomain>.workers.dev  ->  relay URL is wss://<name>.<subdomain>.workers.dev
```

**B. Node relay on Fly.io / Railway / any VPS.**
```
cd server        # or mp/  (see their READMEs)
npm install && npm start
# expose it behind TLS -> wss://your-host
```

Then set the relay URL for the desktop build (see step 3). The relay is a dumb
presence/message forwarder; it does **not** simulate the game, so it stays cheap
even with many parties.

---

## 3. Build the desktop app

```
cd steam
npm install
# point at the relay you deployed (wss://, NOT ws://, for a shipped build):
MOJI_RELAY_URL="wss://<your-relay>"  npm start          # run locally
MOJI_RELAY_URL="wss://<your-relay>"  npm run dist:win    # package Windows (nsis)
#                                     npm run dist:mac / dist:linux
```

`main.js` serves the bundle over loopback HTTP (so the service worker + audio
fetches behave like the web) and injects `MOJI_RELAY_URL` via `preload.js` →
the game's `MP_DEFAULT_URL` uses it, so players **never type a ws:// URL**.
`window.MOJI_RELAY_URL` (set by the wrapper) overrides the in-file default.

> Baking the URL: edit the `RELAY_URL` fallback in `steam/main.js` if you prefer
> a hardcoded default over the env var.

### 3b. Steam-store install & launch — `Mojiworld.exe` (v0.29)

Steam **is** the installer: you upload the *unpacked* build as a depot and
Steam places those files on the player's disk; the launch option then runs
the executable from the depot root. No NSIS installer is involved.

**Build the depot payloads** — easiest via CI: run the **"Build Steam depots
(Mojiworld.exe)"** GitHub Actions workflow (`.github/workflows/steam-build.yml`,
manual `workflow_dispatch` or push a `steam-v*` tag). It builds on real
Windows/Linux runners and uploads two artifacts:

- `mojiworld-windows-depot` → contents of `win-unpacked/`, with **`Mojiworld.exe`**
  at the root (`productName` drives the exe name).
- `mojiworld-linux-depot` → `linux-unpacked/` with the `mojiworld` binary
  (Steam Deck native).

Set repo Actions **variables** first: `STEAM_APP_ID` (falls back to 480 for QA)
and `MOJI_RELAY_URL`. The workflow bakes both into the build (`steam_appid.txt`
ships with your real App ID — the wrapper reads it at runtime).
Local equivalent: `npm run dist:steamwin` (Windows box) / `npm run dist:steamdeck`.

**Upload the depots** with steamcmd + the scripts in `steam/steam_upload/`
(`app_build.vdf`, `depot_windows.vdf`, `depot_linux.vdf` — replace the
`1000000/1000001/1000002` placeholders with your App/Depot IDs, drop the
artifact contents into `steam/release/win-unpacked/` + `linux-unpacked/`):

```
steamcmd +login <builder_account> +run_app_build <abs-path>/steam/steam_upload/app_build.vdf +quit
```

**Steamworks App Admin → Installation → General Installation**, add launch options:

| Launch option | Executable | OS |
|---|---|---|
| Launch | `Mojiworld.exe` | Windows |
| Launch | `mojiworld` | Linux + SteamOS |

Then publish the build to a branch on **SteamPipe → Builds**, set it live on
`default`, and Install/Play in the Steam client installs the depot and starts
`Mojiworld.exe`.

---

## 4. Steamworks

1. **Steam Direct**: pay the $100 app deposit, get your AppID.
2. **Steam Play / Steamworks SDK**: for a v1 you can ship without deep SDK
   integration. If you want Rich Presence / Steam friend invites, add
   [`steamworks.js`](https://github.com/ceifa/steamworks.js) to `steam/` and call
   it from `main.js` (Steam overlay works out of the box for a normal app).
3. **Depot**: point your Steam depot at `steam/release/` (electron-builder output).
4. **Store page**: see positioning below.
5. **`steam_appid.txt`** in the run dir during dev if you integrate the SDK.

### Steam invites → party code
Simplest v1: the host shares the **Party Code** in Steam chat / Discord; the
friend types it in. For one-click Steam invites, have `main.js` read the
`+connect_lobby` launch arg (Steam friend-invite) and pre-fill the party code —
a follow-up once `steamworks.js` is wired.

---

## 5. Store positioning (honest = fewer refunds)

- **Genre**: "Casual co-op action-RPG." Do **not** call it an MMO — it sets
  expectations (persistent world, server authority) this game doesn't meet, and
  Steam refunds + reviews punish the mismatch hard.
- **Headline the co-op**: "Name your hero, share a code, fight bosses together."
- **Tags**: Action RPG, Co-op, Online Co-Op, Casual, Cute, Pixel Graphics.
- **Price**: $4.99 premium, one-time. Enough content (classes, tower, zodiac
  bosses, prestige) to avoid "too short"; no F2P grind-monetization needed.

---

## 6. Pre-launch checklist

- [ ] Relay deployed and reachable over `wss://` (test from two networks).
- [ ] `MOJI_RELAY_URL` set at build time (players never see ws://).
- [ ] **2-client co-op playtest**: both see the same monsters move, take shared
      damage, die once, and both gain XP/coins. Test host leaving (handoff) and a
      friend on a different map (falls back to solo cleanly).
- [ ] Death/boss/expedition flows verified in co-op (see COOP_NOTES.md caveats).
- [ ] Windowed + fullscreen + alt-tab (host keeps simulating — `backgroundThrottling:false`).
- [ ] Controller support if claimed on the store page.
- [ ] Age rating / content survey submitted.
- [ ] `steam_appid.txt` ships with your REAL App ID (the CI workflow bakes it; the wrapper reads it at runtime — 480 means you shipped the Spacewar placeholder).

See **COOP_NOTES.md** for the netcode design, known limitations, and the areas
that most need playtesting before you flip the store page live.

---

## 6b. Steam Deck (v0.29)

The wrapper is Deck-aware end to end; target **Steam Deck Verified**.

**What the build does on Deck**

- **Detection** — `steam.utils.isOnDeck()` (Steamworks `IsSteamRunningOnSteamDeck`)
  with an env fallback (`SteamDeck=1`, set by the gamescope session).
- **Fullscreen at 1280×800** — the window opens `fullscreen: true` on Deck
  (1280×800 is also the default windowed size, so the UI is authored for it).
- **On-screen keyboard** — when any text field takes focus (hero name, party
  code, chat), the preload pops Steam's **floating gamepad keyboard**
  (`ShowFloatingGamepadTextInput`) positioned off the field's rect. Steam types
  straight into the DOM input — the game needed zero changes.
- **Controller** — two independent layers: Steam Input digital actions (the
  `game_actions_<appid>.vdf` set, polled via `SteamAPI.input.snapshot()`), and
  the game's own browser **Gamepad API** support (`_LX_PAD_MAP`) as fallback, so
  the Deck controller works even under Proton with no Steam Input config.
- **Video/cinematics** — the loopback server (`static_server.js`) serves correct
  MIME for the mp4 story-beat cinematics and supports **HTTP Range** so seeking
  doesn't stall on Deck's slower storage. The 15 game-referenced clips are
  packaged (`extraResources`); the review-gallery clips are not.

**Shipping for Deck**

Preferred: ship the **Linux build** as its own depot —
`npm run dist:steamdeck` → `release/linux-unpacked/` → upload that directory as
the Linux depot; set the launch option to the `mojiworld` binary. Electron runs
natively on SteamOS (no Proton needed). Alternative: ship Windows-only and mark
Proton compatibility — the Gamepad API fallback still gives full controller play.

**Deck-verified checklist**

- [ ] Default controller config uploaded (Steam Input `.vdf`) + tested on Deck.
- [ ] All text entry pops the floating keyboard (name your hero, party code, chat).
- [ ] Text legible at 1280×800 from couch distance (in-game UI scale ≥ 100%).
- [ ] No launcher/DRM prompt before gameplay; single-instance lock verified.
- [ ] Suspend/resume: game state intact after Deck sleep (localStorage saves are
      synchronous — safe), relay reconnects after resume.
- [ ] Battery: `powerSaveBlocker` keeps the co-op host simulating; solo players
      can still let the Deck sleep normally.

---

## 7. Steamworks SDK integration (v0.28.0) — cloud saves, controller, achievements

All native Steam code lives in the Electron main process (`steam/`) and is
**fully defensive**: if Steam isn't running or the native module is missing, the
bridge returns a stub (`available:false`) and the game runs exactly as on the web.
The renderer talks to it only through `window.SteamAPI` (exposed by `preload.js`),
which is **absent entirely on the web build** — so every Steam feature in
`mojiworld_game.html` is a guaranteed no-op at play.moji-studios.com.

### Files
- `steam/steam_integration.js` — wraps [`steamworks.js`](https://github.com/ceifa/steamworks.js); `init()` → `{ available, cloud, achievement, input }` (or a safe stub).
- `steam/main.js` — inits the bridge, registers IPC (`steam:cloud-read/write`, `steam:ach-unlock`, `steam:input-snapshot`), passes `--moji-steam=1` to preload.
- `steam/preload.js` — exposes `window.SteamAPI` (cloud/achievement async over IPC; input snapshot sync).
- `steam/steam_appid.txt` — App ID the wrapper passes to `steamworks.init()` (**480 = Spacewar placeholder; the steam-build workflow overwrites it with `vars.STEAM_APP_ID` for shipped builds**).
- `steam/controller_config/game_actions_480.vdf` — Steam Input Game Actions File (rename to your App ID).

### Setup
1. `cd steam && npm install` — pulls `steamworks.js` (prebuilt native binaries).
2. Set your real App ID: `echo <APPID> > steam/steam_appid.txt` (or set the `STEAM_APP_ID` repo variable for CI builds) and rename the VDF to `game_actions_<APPID>.vdf`.
3. Build: `cd steam && npm run dist:win` (etc.). `package.json` bundles `steamworks.js` (asar-unpacked) + the controller config.

### Cloud saves (ISteamRemoteStorage)
The game mirrors its localStorage save to Steam Cloud on every flush and, on boot,
adopts the cloud save when it's newer / more advanced (newest-wins, same logic as
the account cloud). In Steamworks → **Cloud**, enable Steam Cloud and either use
Auto-Cloud (pattern `levelx_save_v1`) or the API quota — the game writes one file
keyed `levelx_save_v1`. Certified 2-client-independent: mirror on push, adopt a
newer cloud save, keep + push a more-advanced local save.

### Controller (Steam Input + Gamepad API)
The game polls the browser Gamepad API and maps a standard pad → synthetic key
events, reusing the full keyboard input pipeline (rebinds respected). **Steam
presents a Steam Controller as a virtual gamepad by default, so this works out of
the box.** For a custom Steam Input config, the native `ISteamInput` action states
(from `game_actions_<appid>.vdf`) are ORed in. Default layout: A jump · B dodge ·
X attack · Y interact · LB/RB/LT/RT + stick-clicks skills · Back character panel ·
Start pause · D-pad/left-stick move. Enable **Steam Input** for the app and upload
the Game Actions File under *Edit Steam Input Configuration*.

### Achievements
The game's existing in-game achievements are mirrored to Steam — **the Steam
achievement API name must equal the game achievement `id`** below. Create these 38
in Steamworks → **Achievements** (API Name column = the `id`). Unlocks fire live;
already-earned achievements sync up on load.

| API Name (id) | Display name | How to earn |
| --- | --- | --- |
| `firstBlood` | First Blood | Defeat 1 enemy |
| `slayer100` | Slayer | Defeat 100 enemies |
| `exterminator` | Exterminator | Defeat 1000 enemies |
| `bossHunter` | Boss Hunter | Defeat 3 different bosses |
| `lv10` | Adept | Reach level 10 |
| `lv20` | Apprentice | Reach level 20 |
| `lv50` | Master | Reach level 50 |
| `legendary` | Legendary Find | Possess a legendary item |
| `combo50` | Combo Striker | Reach a 50-hit combo |
| `combo100` | Centurion | Reach a 100-hit combo |
| `starforged` | Starforged | Enhance an item to ★5 |
| `ascendant` | Ascendant | Complete your first ascension |
| `firstCalling` | First Calling | Take your first class advancement |
| `truePath` | True Path | Reach a Master class |
| `lv30` | Veteran | Reach level 30 |
| `lv70` | Champion | Reach level 70 |
| `lv100` | Ascended | Reach level 100 |
| `lv150` | Mythic | Reach level 150 |
| `kill5000` | Annihilator | Defeat 5,000 enemies |
| `kill10000` | Worldbreaker | Defeat 10,000 enemies |
| `boss6` | Boss Slayer | Defeat 6 different bosses |
| `boss12` | Boss Conqueror | Defeat 12 different bosses |
| `aetherionDown` | Warden Undone | Vanquish Aetherion |
| `gravitosDown` | The Weight Lifted | Defeat Gravitos at the Singularity |
| `zodiac1` | Star-Toucher | Defeat your first Zodiac |
| `zodiacAll` | The Twelve Houses | Defeat all 12 Zodiac signs |
| `star8` | Master Smith | Enhance an item to ★8 |
| `star10` | Astral Forge | Enhance an item to ★10 |
| `coin50k` | Coin Hoarder | Hold 50,000 Mojicoins at once |
| `coin100k` | Mojibaron | Hold 100,000 Mojicoins at once |
| `bestiary20` | Field Researcher | Log 20 monster types |
| `bestiary40` | Naturalist | Log 40 monster types |
| `bestiary60` | Compendium Keeper | Log 60 monster types |
| `boonAttuned` | Attuned | Equip a full boon loadout |
| `boonHunter` | Boon Hunter | Collect 10 boons |
| `combo200` | Unstoppable | Reach a 200-hit combo |
| `prestige5` | Reborn | Ascend 5 times |
| `prestige20` | Apex Ascendant | Reach the prestige cap (20) |

> **Ship checklist additions:** enable Steam Cloud + Steam Input + create the 38
> achievements in Steamworks; set the real App ID (repo var `STEAM_APP_ID` / `steam_appid.txt`);
> `npm install` in `steam/` so `steamworks.js` binaries are bundled.
