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
- [ ] `steam_appid.txt` present only in dev, not shipped.

See **COOP_NOTES.md** for the netcode design, known limitations, and the areas
that most need playtesting before you flip the store page live.
