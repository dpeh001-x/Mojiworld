// Mojiworld asset cache — v0.29.473
// Stale-while-revalidate for same-origin game assets (sprites, backgrounds,
// audio). Serves the cached copy instantly for fast repeat loads, while
// refreshing it in the background so sprite redos still propagate on the
// next visit. The game HTML itself is NOT cached (always network) so code
// updates are never stale.
//
// v0.29.473 — the cache key had never been bumped since v0.26.949, so the
// activate sweep below ("drop old cache generations on version bumps") had
// been a no-op for every release since. Bumping it forces one clean
// generation change, which is what finally evicts art a returning player has
// been stuck on. Bump this whenever shipped art changes and you need every
// existing browser to drop its copy.
//
// v0.29.630 — bumped again, and this is exactly the failure the note above
// predicted. Two players on the SAME map and the SAME version saw DIFFERENT
// backgrounds in Everdawn Central: one the new wooden-village plate, the other
// the old pink-storefront one. Nothing was desynced — 280bae14 replaced
// backgrounds/bg_v3_everdawn_central.webp (236 KB -> 3.5 MB, a completely
// different painting) without bumping this key, so a returning browser kept
// serving its cached copy.
//
// Stale-while-revalidate makes this quiet rather than loud: the stale art is
// served instantly and the refresh lands in the background, so the player sees
// the OLD plate for the whole session and a correct one next time — which reads
// as "it's different for me" rather than "it's out of date". Any art swap that
// REPLACES a filename (rather than adding one) needs this bump; a new filename
// is safe because nothing is cached under it yet.
//
// v0.30.73 - v5 -> v6. The Sage "Meteor Sigil" art drop REPLACES eleven filenames
// (Sprites/projectiles/p_ult_sage.webp, Sprites/fx/sage_ult.webp and
// Sprites/fx/anim/sage_ult_0..8.webp), so without this bump every returning
// browser keeps serving the old meteor and the old sigil indefinitely.
//
// v0.30.52 - v4 -> v5. Six background filenames were REPLACED with different
// paintings (forest, azureAcademia, emeraldVillage, tidepoolShoals,
// abyssalTrench, worldmap_bg). That is precisely the "REPLACES a filename"
// case above, so without this bump every returning browser keeps serving the
// old art indefinitely - silently, because SWR serves stale first.
// v0.30.311 - v6 -> v7. This week's drops REPLACED many filenames without a
// bump: the Regulus pounce re-roll (leo_0..8), Virga's idle redraw, the
// star-beam redraw, the Caprikor ice shot - so returning browsers served
// stale (or MIXED stale/new) frames until a hard refresh, which is exactly
// what the user hit. The bump is now ENFORCED at push time by
// .claude/hooks/push-clobber-gate.js: a push that modifies existing art
// bytes without changing this line is blocked.
// v0.30.316 - v7 -> v8. gravitos_laserring.webp was REPLACED (regenerated at
// 768 with real margin), so returning browsers would serve the old 513 crop
// from the v7 generation. This is the enforced rule, not a courtesy: the push
// gate blocks a commit that modifies art bytes without bumping this line.
// v0.30.348 - v8 -> v9. The QTE shackle sigil was REPLACED: the 768 static
// AND all nine 952px animated frames (Sprites/fx/anim/qte_chains_0..8), which
// are what actually render during a shackle QTE. Without the bump a returning
// browser mixes the new static with the old frames.
// v0.30.426 - v9 -> v10. The smith golem's 28 assets were REPLACED under their
// own names (re-canvased to one scale / one foot line); returning browsers would
// serve the old frames from the v9 generation.
// v0.30.428 - v10 -> v11. gravitos2punch_0..8 REPLACED (regenerated punch set); returning
// browsers would otherwise serve the old frames from the v10 generation.
// v0.30.429 - v11 -> v12. Boss attack art drop REPLACED under existing names
// (gravitos2soul_2..8, gravitos2punch_4, towerSovereign_6); returning browsers would
// otherwise serve the old frames from the v11 generation.
// v0.30.435 - v12 -> v13. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v12 generation with the new tables.
// v0.30.436 - v13 -> v14. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v13 generation with the new tables.
// v0.30.440 - v14 -> v15. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v14 generation with the new tables.
// v0.30.441 - v15 -> v16. smithgolem idle/walk/attack_0..8 REPLACED under their own names
// (cut-out rig of the static sprite, 1280x1024); returning browsers would otherwise mix
// the old 1024px frames from the v15 generation with the new tables.
// v0.30.442 - v16 -> v17. 28 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v16 generation.
const CACHE = 'mojiworld-assets-v17';
const ASSET_RE = /\.(png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Drop old cache generations on version bumps.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('mojiworld-assets-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // v0.29.473 — never serve a ranged media request from the cache. cache.match
  // ignores the Range header, so a byte-range request was being answered with a
  // full 200; that is the classic service-worker/media pitfall and it can stall
  // or fail to restart audio elements. Let the network handle these.
  if (req.headers && req.headers.get('range')) return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin || !ASSET_RE.test(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const refresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    // v0.29.473 — keep the worker alive until the background refresh has
    // actually written. Without this the SW returns the cached hit, goes idle,
    // and the browser is free to terminate it before cache.put lands — so the
    // "refreshes for the next visit" contract silently never happened and a
    // player could sit on stale art indefinitely, not just for one session.
    e.waitUntil(refresh);
    if (hit) return hit;                       // instant cached copy; refresh continues in bg
    const net = await refresh;
    return net || new Response('', { status: 504, statusText: 'offline asset miss' });
  })());
});
