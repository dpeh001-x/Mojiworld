// Every portal in the game must be (a) SNAPPED — standing on a real surface —
// and (b) ACCESSIBLE — on a surface the player can actually climb to.
//
// Those are different failures and only the first is obvious. A portal can sit
// pixel-perfect on a shelf that no jump chain reaches; it looks correct in a
// screenshot and is unusable in play. So this loads every map for real (so the
// v0.29.841 runtime anchor pass and the packed-blob override both apply, since
// the blob is what actually runs) and checks both.
//
// Reachability is a flood-fill from the ground over jump-connected platforms,
// deliberately GENEROUS: a rise budget well past a standing jump and a lateral
// budget past a running leap. Anything it still cannot reach is worth a human
// look rather than a false alarm — a portal failing a generous model is a real
// signal, one failing a tight model is usually the model's fault.
// Run: node scripts/portal_access_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  player.cls = 'warrior'; player.level = 60;
  const RISE = 140;    // generous: past a standing jump, allows for air-jumps
  const RUN  = 460;    // generous: past a running leap
  const res = { maps: 0, portals: 0, floating: [], buried: [], oob: [], unreachable: [], skipped: [] };

  for (const id of Object.keys(MAPS)) {
    let md;
    try { loadMap(id); md = game.mapData; } catch (e) { res.skipped.push({ id, why: 'load threw' }); continue; }
    if (!md || !Array.isArray(md.platforms) || !md.platforms.length) { res.skipped.push({ id, why: 'no platforms' }); continue; }
    const plats = md.platforms;
    // game.portals is the per-load CLONE that the v0.29.841 anchor pass snaps;
    // md.portals is the unsnapped source. Reading the source would report
    // every within-tolerance portal as floating.
    const portals = (game.portals && game.portals.length) ? game.portals : (md.portals || []);
    if (!portals.length) continue;
    res.maps++;

    // Use the GAME'S OWN resolver for y-less portals rather than
    // reimplementing it: _defaultPortalY() is what tryPortal and drawPortals
    // consult, and it reads the FIRST ground platform — not md.groundY, which
    // some maps declare differently. Measuring against a value the portal code
    // never reads is how a correct portal gets reported 6px out.
    const deepest = plats.reduce((m, p) => (p.type === 'ground' && (m == null || p.y > m)) ? p.y : m, null);

    // Flood-fill reachable surfaces from every ground slab.
    const reach = new Set();
    const q = [];
    plats.forEach((p, i) => { if (p.type === 'ground') { reach.add(i); q.push(i); } });
    while (q.length) {
      const a = plats[q.shift()];
      plats.forEach((b, j) => {
        if (reach.has(j)) return;
        const rise = a.y - b.y;                    // climbing up is positive
        if (rise > RISE) return;                   // too high to reach
        if (rise < -900) return;                   // a drop that deep is a fall, not a route
        const gap = (b.x > a.x + a.w) ? b.x - (a.x + a.w)
                  : (a.x > b.x + b.w) ? a.x - (b.x + b.w) : 0;
        if (gap > RUN) return;
        reach.add(j); q.push(j);
      });
    }

    for (const po of portals) {
      res.portals++;
      // Resolve PER PORTAL, passing its x: _defaultPortalY is x-aware as of
      // v0.29.996 because a stepped floor has no single ground line. Calling
      // it bare here would re-introduce the very bug this file guards.
      const groundY = (typeof _defaultPortalY === 'function') ? _defaultPortalY(po.x) : null;
      const py = (typeof po.y === 'number') ? po.y : groundY;
      if (py == null) continue;
      const info = { map: id, dest: po.dest, x: po.x, y: py };

      if (po.x < 0 || po.x > (md.worldWidth || 0)) { res.oob.push(info); continue; }
      // "Buried" means below the DEEPEST floor, not below _defaultPortalY().
      // Those are different numbers on multi-level maps: the underwater ones
      // list the water-surface slab first, so _defaultPortalY() returns y:80
      // and every seabed portal would read as 2000px underground.
      if (deepest != null && py > deepest + 2) { res.buried.push({ ...info, deepest }); continue; }

      // Which surface is it standing on?
      let onIdx = -1;
      plats.forEach((pl, i) => {
        if (Math.abs(pl.y - py) <= 2 && po.x >= pl.x - 6 && po.x <= pl.x + pl.w + 6) onIdx = i;
      });
      if (onIdx < 0) { res.floating.push(info); continue; }
      if (md.isUnderwater) continue;   // swimming: a jump-chain model does not describe this map
      if (!reach.has(onIdx)) res.unreachable.push({ ...info, plat: { x: plats[onIdx].x, y: plats[onIdx].y, w: plats[onIdx].w } });
    }
  }
  return res;
});

console.log(`\nAudited ${r.portals} portals across ${r.maps} maps (skipped ${r.skipped.length} without platforms)`);

console.log('\nSNAPPED — standing on a real surface');
check(r.floating.length === 0, 'no portal floating in mid-air', r.floating.slice(0, 8));
check(r.buried.length === 0, 'no portal below its map ground line', r.buried.slice(0, 8));
check(r.oob.length === 0, 'no portal outside the world box', r.oob.slice(0, 8));

console.log('\nACCESSIBLE — the surface can be climbed to');
check(r.unreachable.length === 0, 'every portal sits on a jump-reachable surface', r.unreachable.slice(0, 8));

console.log('\nHONEYCOMB HOLLOW (the map just resized)');
const hh = [...r.floating, ...r.buried, ...r.oob, ...r.unreachable].filter(p => p.map === 'honeycombHollow');
check(hh.length === 0, 'the resized hive has no portal problems', hh);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
