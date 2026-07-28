# Deploying Mojiworld

The studio site at **moji-studios.com stays exactly as-is** (Cloudflare Pages).
The game goes live on its **own subdomain — `play.moji-studios.com`** — hosted on
this repo's **GitHub Pages**. A subdomain keeps the game and the studio site
completely independent (no risk to the apex site).

- **Automated for you:** `.github/workflows/deploy-pages.yml` builds + publishes on
  every push to `main`. The subdomain root serves the game directly
  (`https://play.moji-studios.com/`), the heavy art streams from a CDN, and the
  live multiplayer URL is injected.
- **Heavy art on a CDN (no 1 GB Pages limit):** ~1.3 GB of `Sprites/`, `audio/`,
  `backgrounds/` is **not** bundled — the build rewrites every asset reference to
  **jsDelivr** serving this repo, pinned to the deploy's commit SHA
  (`cdn.jsdelivr.net/gh/dpeh001-x/Mojiworld@<sha>/...`): immutable, cached, zero
  upload, no quality loss. Artifact stays ~30 MB. **Repo must stay public.**

> Want a different name (e.g. `mojiworld.moji-studios.com`)? Just use that value
> everywhere `play.moji-studios.com` appears below — it's a single variable.

---

## 1. Cloudflare DNS — add the subdomain (your Cloudflare dashboard)

In the `moji-studios.com` zone → **DNS → Records → Add record**:

```
Type:   CNAME
Name:   play
Target: dpeh001-x.github.io
Proxy:  DNS only  (grey cloud)   <-- important: lets GitHub issue the TLS cert
TTL:    Auto
```

> Grey-cloud (DNS only) is the reliable setup — GitHub Pages issues its own
> Let's Encrypt cert for `play.moji-studios.com`. (Orange-cloud/proxied also works
> but needs Cloudflare SSL mode = Full and you rely on Cloudflare's edge cert.)

This does **not** touch your apex `moji-studios.com` Cloudflare Pages site.

## 2. Enable Pages "GitHub Actions" source

Repo **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.
(Or let me flip it for you via the API once DNS is in — see below.)

> This switches Pages off the old legacy branch build. The current
> `dpeh001-x.github.io/Mojiworld/` URL will then redirect to the new subdomain.

## 3. Turn on the custom domain (one Actions variable)

Repo **Settings → Secrets and variables → Actions → Variables → New variable**:

```
Name:  GAME_DOMAIN
Value: play.moji-studios.com
```

The next deploy writes the `CNAME` and GitHub binds the subdomain. (Until this is
set, the build claims no domain — safe to run anytime.)

## 4. Stand up multiplayer (Render) — optional but you asked for it

`render.yaml` is a ready Blueprint:

1. <https://dashboard.render.com> → **New → Blueprint** → select this repo →
   creates the `mojiworld-mp` service from `mp/`.
2. Copy the URL; the WebSocket endpoint is `wss://mojiworld-mp.onrender.com`.
3. Add Actions variable **`MP_WSS_URL` = `wss://mojiworld-mp.onrender.com`**.

(Free Render cold-starts after ~15 min idle; first connect ~30-60 s.)

## 5. Deploy

Push to `main` or **Actions → Run workflow**. Live at
**`https://play.moji-studios.com/`**, multiplayer via **🌐 Multi → Connect**.

---

## What I can do for you from here (just say go)

- **Set the Actions variables** `GAME_DOMAIN` and `MP_WSS_URL` (`gh variable set`).
- **Flip Pages to the GitHub Actions source** (`gh api ... build_type=workflow`).
- **Trigger the deploy** and verify it's green + the subdomain serves.

What needs **you** (account access I don't have): the **Cloudflare DNS record**
(step 1) and **creating the Render service** (step 4). Tell me when the DNS record
is in and I'll do the rest.

## Path form — `moji-studios.com/mojiworld` (instead of the subdomain)

The subdomain (`play.moji-studios.com`) is already live and is the actual host.
To *also* expose the game at the apex path **`moji-studios.com/mojiworld`**, put a
small Cloudflare Worker on the apex zone that transparently proxies `/mojiworld*`
to the subdomain origin and strips the prefix. The apex Cloudflare Pages studio
site is untouched — the Worker only runs on the `/mojiworld*` route.

Worker script: [`mp-cf/cf-worker-mojiworld.js`](mp-cf/cf-worker-mojiworld.js)
(no HTML rewriting needed — every game asset is a relative path or an absolute
CDN/wss URL, so under the trailing-slash subpath it just works).

Steps (your Cloudflare dashboard — account access I don't have):

1. **Workers & Pages → Create → Worker** → name it `mojiworld-proxy` → replace the
   starter code with the contents of `mp-cf/cf-worker-mojiworld.js` → **Deploy**.
2. **The Worker → Settings → Domains & Routes → Add → Route**:
   ```
   Route:  moji-studios.com/mojiworld*
   Zone:   moji-studios.com
   ```
   (The trailing `*` is required so sub-resources like
   `/mojiworld/data/anim_calib.js` also hit the Worker.)
3. Visit **`https://moji-studios.com/mojiworld`** — it 301s to `/mojiworld/` and
   serves the game while the address bar stays on the apex path.

> The subdomain stays the real origin; `/mojiworld` is a friendly alias in front
> of it.

## Notes

- **Sequencing:** add the Cloudflare DNS record *before* I flip Pages + set
  `GAME_DOMAIN`, so the github.io→subdomain redirect lands on a working address.
- **Players seeing each other:** same room + channel (and same in-game map to
  render). Defaults: room `lobby`, channel 1.
- **Local dev unaffected:** the committed game keeps relative asset paths +
  `ws://localhost:8080`; only the published copy is rewritten.
