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
const CACHE = 'mojiworld-assets-v3';
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
