// WORLD-MAP NODE SPACING — no two map nodes may sit close enough to draw on
// top of each other.
//
// Checked against the LIVE MAPS object, not the source text: wmX/wmY are
// reassigned across many later blocks (last-write-wins, and the file says so),
// so reading the coordinates out of the source finds values that never reach
// the screen. hollowSepulchre alone is written 8 times.
//
// 46px is the collision floor (node discs plus label padding). Anything under
// that overlaps visibly; 46–60 is reported as tight so a near-miss shows up
// before a future nudge turns it into a real collision.
// Run: node scripts/worldmap_overlap_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOOR = 46, TIGHT = 60;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && Object.keys(MAPS).length > 10, { timeout: 60000 });

const out = await page.evaluate(({ FLOOR, TIGHT }) => {
  // Only nodes that actually DRAW can collide. _wmComputePositions skips any
  // map where _wmIsHidden(id) is true (18 of the 98 placed: void, tower, the
  // clockwork chain, innerDimension and all 12 zodiac arenas). Counting those
  // reported 8 "overlaps" on a map with none — every one of them was a pair
  // where at least one node never renders.
  const hidden = (id) => (typeof _wmIsHidden === 'function') ? _wmIsHidden(id) : !!(MAPS[id] && MAPS[id].wmHidden);
  const nodes = [], skipped = [];
  for (const id in MAPS) {
    const m = MAPS[id];
    if (!m || typeof m.wmX !== 'number' || typeof m.wmY !== 'number') continue;
    if (hidden(id)) { skipped.push(id); continue; }
    nodes.push({ id, x: m.wmX, y: m.wmY });
  }
  const over = [], tight = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const rec = { a: a.id, b: b.id, d: +d.toFixed(1), ax: a.x, ay: a.y, bx: b.x, by: b.y };
    if (d < FLOOR) over.push(rec);
    else if (d < TIGHT) tight.push(rec);
  }
  over.sort((x, y) => x.d - y.d); tight.sort((x, y) => x.d - y.d);
  return { count: nodes.length, skipped: skipped.length, over, tight };
}, { FLOOR, TIGHT });
await browser.close();

console.log(`${out.count} VISIBLE world-map nodes (${out.skipped} hidden excluded — they never draw)\n`);
if (out.over.length) {
  console.log(`OVERLAPPING (closer than ${FLOOR}px):`);
  for (const p of out.over) console.log(`  FAIL  d=${p.d}  ${p.a} (${p.ax},${p.ay})  <->  ${p.b} (${p.bx},${p.by})`);
} else console.log(`PASS  no pair closer than ${FLOOR}px`);
if (out.tight.length) {
  console.log(`\ntight but clear (${FLOOR}–${TIGHT}px) — watch these if you nudge nearby nodes:`);
  for (const p of out.tight) console.log(`   d=${p.d}  ${p.a}  <->  ${p.b}`);
}
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 2).join(' | ') : '\nno page errors');
process.exit(out.over.length || errs.length ? 1 : 0);
