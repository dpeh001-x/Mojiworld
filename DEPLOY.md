# Deploying Mojiworld to moji-studios.com/mojiworld

The game auto-deploys to **GitHub Pages** under the custom domain
`moji-studios.com`, served at **`/mojiworld`**. Live multiplayer runs on a
separate Node host (the relay can't run on static Pages).

- **Automated for you:** `.github/workflows/deploy-pages.yml` builds and publishes
  the site on every push to `main` (and via *Actions -> Run workflow*). It puts
  the whole game (HTML + `Sprites/` + `audio/` + `backgrounds/` + JS) inside a
  `mojiworld/` folder so the clean URL `moji-studios.com/mojiworld/` loads it,
  writes the `CNAME`, and injects the live multiplayer URL.
- **You do once (can't be automated from the repo):** DNS, turning Pages on,
  and standing up the multiplayer server. Steps below.

---

## 1. Turn on Pages (GitHub web UI)

Repo **Settings -> Pages -> Build and deployment -> Source = "GitHub Actions"**.
(No branch picker — the workflow handles it.)

## 2. Point DNS at GitHub Pages (your domain registrar)

For the apex `moji-studios.com`, add four **A** records and (optional) four
**AAAA** records to GitHub's Pages IPs:

```
A     @   185.199.108.153
A     @   185.199.109.153
A     @   185.199.110.153
A     @   185.199.111.153
AAAA  @   2606:50c0:8000::153
AAAA  @   2606:50c0:8001::153
AAAA  @   2606:50c0:8002::153
AAAA  @   2606:50c0:8003::153
```

Optionally add `CNAME  www  dpeh001-x.github.io.` so `www` works too.

Then in **Settings -> Pages**, confirm the Custom domain shows `moji-studios.com`
(the workflow's `CNAME` sets it) and tick **Enforce HTTPS** once the cert issues
(can take a few minutes to an hour after DNS propagates).

> DNS propagation: usually minutes, up to 24-48h worst case.

## 3. Stand up the multiplayer server (Render)

The in-game Multi panel needs a `wss://` server (browsers block `ws://` from an
https page). `render.yaml` is a ready Blueprint:

1. Go to <https://dashboard.render.com> -> **New -> Blueprint** -> select this
   repo. It reads `render.yaml` and creates the `mojiworld-mp` web service from
   the `mp/` folder.
2. After it deploys, copy the URL: `https://mojiworld-mp.onrender.com`. The
   WebSocket URL is the same host with `wss://`:
   **`wss://mojiworld-mp.onrender.com`**.

(Any Node host works — Fly.io, Railway, a VPS. It just needs to run
`node mp/server.mjs` with TLS and respect `$PORT`. Free Render cold-starts after
~15 min idle; the first connect then takes ~30-60s.)

## 4. Tell the site about the MP server (GitHub Actions variable)

Repo **Settings -> Secrets and variables -> Actions -> Variables -> New variable**:

```
Name:  MP_WSS_URL
Value: wss://mojiworld-mp.onrender.com
```

The next deploy injects this as the Multi panel's default URL, so players just
click **Connect**. (Without it, the deployed game defaults to localhost and
multiplayer only works for local testing.)

## 5. Deploy

Push to `main`, or **Actions -> "Deploy game to moji-studios.com/mojiworld" ->
Run workflow**. When it's green:

- Game: <https://moji-studios.com/mojiworld/>
- Multiplayer: click **🌐 Multi -> Connect** (URL pre-filled).

---

## Notes

- **Re-running after setup:** any push to `main` redeploys automatically. Changing
  `MP_WSS_URL` requires a re-run to take effect (the URL is injected at build).
- **Players seeing each other:** they must be on the same **room** + **channel**
  (and, to render each other, the same in-game map). Defaults: room `lobby`,
  channel 1.
- **Server scale:** the relay is hardened for correctness/abuse but is a per-
  message relay; comfortable to ~20 concurrent players per room. See
  `mp/README.md` for the path to authoritative/persistent MMO-lite.
- **Local dev still works:** the committed game keeps `ws://localhost:8080`; only
  the deployed copy gets the production URL.
