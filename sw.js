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
// v0.30.443 - v17 -> v18. 9 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v17 generation.
// v0.30.446 - v18 -> v19. 7 monster attack frames REPLACED under their own names
// (user art drop: 11 sets, edge clean-ups + the smith golem impact frames re-anchored);
// returning browsers would otherwise serve the old frames from the v18 generation.
// v0.30.465 - v19 -> v20. dash_mage.webp and mstormorb.webp REPLACED under
// their own names (regenerated art); returning browsers would otherwise serve the old
// sprites from the v19 generation alongside the new animation frames.
// v0.30.469 - v20 -> v21. p_lightning.webp REPLACED under its own name
// (redrawn horizontal, tip right); returning browsers would otherwise keep serving the old
// vertical bolt from the v20 generation next to the new frames.
// v0.30.473 - v21 -> v22. dash_mage.webp and its nine anim frames REPLACED
// under their own names (violet -> light blue); a returning browser would otherwise mix the
// old violet still with the new blue frames from the v21 generation.
// v0.30.479 - v22 -> v23. qte_holy.webp and its nine anim frames
// REDRAWN under their own names (winged sunburst -> binding seal) and re-canvassed 768/952 -> 1024;
// dash_mage, dash_rogue and dash_warrior loops replaced the same way. A returning browser would
// otherwise mix old and new frames of the same sigil.
// v0.30.491 - v23 -> v24. Sprites/ui/edicts_bg.webp is NEW art
// referenced from CSS; a returning browser with the old manifest would render the Edicts panel
// on its fallback gradient and never fetch the plate.
// v0.30.495 - v24 -> v25. backgrounds/title_keyart_c.webp is NEW
// art referenced from CSS; a returning browser with the old manifest would show the character
// creation page on its old flat scrim and never fetch it.
// v0.30.498 - v25 -> v26. backgrounds/title_keyart.webp is REPLACED
// under its own name (new art, 1376x768 -> 2944x1632). Without a new generation a returning
// browser keeps serving the old painting from cache and never sees this one.
// v0.30.506 - v26 -> v27. Sprites/ui/cs_preview_bg.webp is NEW
// art referenced from CSS; a returning browser with the old manifest would keep the character
// preview box on its flat grey radial and never fetch the alcove.
// v0.30.507 - v27 -> v28. All ten Sprites/fx/block_mage*
// files are REPLACED under their own names (the ward redrawn as an incantation shard). This is
// the exact case the generation exists for: v0.30.487 replaced this same set without bumping,
// so a returning browser kept serving the old opaque ward out of cache.
// v0.30.533 - v28 -> v29. Both mspore files are REPLACED
// under their own names (the pod recoloured white/pink/red and turned to face right). Without a
// new generation a returning browser keeps firing the old mint pod out of cache.
// v0.30.538 - v29 -> v30. Sprites/ui/cs/ico_*.webp (five files) are NEW art referenced from the creator's markup; a returning browser with the old manifest would show the picker labels without their icons and never fetch them.
// v0.30.540 - v30 -> v31. Sprites/ui/cs_preview_bg.webp is REPLACED under its own name (violet niche -> pale grey alcove) and Sprites/ui/cs_preview_bg_floor.webp is NEW and is the one the CSS now draws; a returning browser would keep the violet plate out of cache and never fetch the grey one.
// v0.30.544 - v31 -> v32. Sprites/projectiles/mspore.webp is
// REPLACED under its own name again (the pod redrawn as a smooth white spore puff). The last
// bump was demonstrably load-bearing: the browser was still serving v28's copy.
// v0.30.546 - v32 -> v33. Sprites/projectiles/mspore.webp is
// REPLACED under its own name again (the pod redrawn as a smooth white spore puff). The last
// bump was demonstrably load-bearing: the browser was still serving v28's copy.
// v0.30.551 - v33 -> v34. Nine NEW frames at
// Sprites/projectiles/anim/mspore_0..8.webp. A returning browser with the old manifest would
// never fetch them and would keep drawing the static puff.
// v0.30.577 - v35 -> v36. Sprites/vfx/sovereign_drain_pillar.webp is REPLACED
// under its own name (the drain column redrawn cel-shaded). Without a new generation a returning
// browser keeps the painterly one out of cache.
// v0.30.x - v37 -> v38. Sprites/skills/marksman_oneshot.webp and marksman_ult.webp are REPLACED
// under their own names (the Deadeye revamp's icons), as are audio/skill/marksman_oneshot.mp3 and marksman_ult.mp3
// and - missed by v0.30.610 - Sprites/projectiles/p_ult_marksman.webp. Without a new generation a returning browser
// keeps the old icon, the old cast sounds and the old round out of cache.
const CACHE = 'mojiworld-assets-v38';   // v0.30.x - Deadeye revamp icons, cues and round replaced under their own names
const ASSET_RE = /\.(png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a|woff2)$/i;   // v0.30.558 - woff2: the bundled creator faces

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
