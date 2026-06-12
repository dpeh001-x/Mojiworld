// Mojiworld asset cache — v0.26.949
// Stale-while-revalidate for same-origin game assets (sprites, backgrounds,
// audio). Serves the cached copy instantly for fast repeat loads, while
// refreshing it in the background so sprite redos still propagate on the
// next visit. The game HTML itself is NOT cached (always network) so code
// updates are never stale.
const CACHE = 'mojiworld-assets-v1';
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
    if (hit) return hit;                       // instant cached copy; refresh continues in bg
    const net = await refresh;
    return net || new Response('', { status: 504, statusText: 'offline asset miss' });
  })());
});
