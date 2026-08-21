// The quest compass points at objectives that are on the map you are standing
// on, per the tester: "the red quest pin is not accurate ... see the quest ball?
// but no portal?"
//
// _qnavHeading and the on-canvas marker both scanned a bare global `monsters`
// for a same-map target. No such global exists — the array is game.monsters —
// and the `typeof` guard turned that into a silent empty list rather than an
// error, so the loop never ran once. The compass therefore never resolved an
// objective standing on the current map: it reported "somewhere on this map"
// and pinned nothing, while an off-map objective (which uses a different branch,
// via the route's next portal) still worked. That asymmetry is what reads as
// "there's a quest ball but no portal".
//
// This drives the real resolver against a real mob on a real map, so it fails
// on the old build rather than passing vacuously.
// Run: node scripts/quest_pin_heading_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 34;
  const out = {};

  // The map the tester reported from, and a second one so this is not a
  // one-map coincidence.
  for (const mapId of ['honeycombHollow', 'forest']) {
    loadMap(mapId);
    await new Promise((res) => setTimeout(res, 900));
    const live = (game.monsters || []).filter((m) => m && !m.dead && m.type);
    if (!live.length) { out[mapId] = { noMobs: true }; continue; }
    const target = live[0];
    const d = { map: mapId, who: target.type, kind: 'kill' };
    const h = (typeof _qnavHeading === 'function') ? _qnavHeading(d) : null;
    // The nearest instance of that type is what the compass should choose.
    let nearest = null, nd = Infinity;
    for (const m of live) {
      if (m.type !== target.type) continue;
      const dist = Math.abs((m.x || 0) - (player.x || 0));
      if (dist < nd) { nd = dist; nearest = m; }
    }
    out[mapId] = {
      type: target.type, mobs: live.length,
      heading: h ? { x: Math.round(h.x), y: Math.round(h.y) } : null,
      nearestAt: nearest ? { x: Math.round(nearest.x), y: Math.round(nearest.y) } : null,
      matchesNearest: !!(h && nearest && Math.abs(h.x - nearest.x) < 1),
      yIsFinite: !!(h && Number.isFinite(h.y)),
    };
  }

  // The off-map branch must still work — it was never broken, and a fix that
  // traded one for the other would be no fix at all.
  loadMap('honeycombHollow');
  await new Promise((res) => setTimeout(res, 500));
  const far = { map: 'bubblegumSwamp', who: 'tubsalamander', kind: 'kill' };
  const fh = (typeof _qnavHeading === 'function') ? _qnavHeading(far) : null;
  const ports = (game.mapData.portals || []).map((p) => p.x);
  out.offMap = { heading: fh ? Math.round(fh.x) : null, portalXs: ports,
                 landsOnAPortal: !!(fh && ports.some((x) => Math.abs(x - fh.x) < 1)) };
  return out;
});
await browser.close();

for (const k of ['honeycombHollow', 'forest']) console.log(`  ${k}: ${JSON.stringify(r[k])}`);
console.log(`  off-map: ${JSON.stringify(r.offMap)}`);

for (const k of ['honeycombHollow', 'forest']) {
  const x = r[k] || {};
  check(!x.noMobs && x.mobs > 0, `${k}: the map has live mobs to point at`, x);
  check(x.heading !== null, `${k}: the compass resolves an objective on THIS map (was null)`, x);
  check(x.matchesNearest === true, `${k}: and it points at the nearest one, not just any`, x);
  check(x.yIsFinite === true, `${k}: with a real height, so the pin sits on the target`, x);
}
check(r.offMap.landsOnAPortal === true,
      'an off-map objective still points at the exit portal', r.offMap);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
