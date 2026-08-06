// BACKDROP WIRING (v0.29.463). Every map's `bg` key must resolve to a
// background that actually DECODES — a typo'd key or a missing file leaves the
// map drawing its flat sky gradient with no error anywhere, which is easy to
// miss and hard to attribute later.
//
// Two parts: the Block-land bindings specifically (the three plates the user
// supplied), then a sweep of the whole registry, since art drops that replace
// a .webp with a .png delete the file the loader asks for and nothing warns.
// Run: node scripts/blockland_bg_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [], failed404 = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
page.on('response', (r) => { if (r.status() >= 400 && /backgrounds\//.test(r.url())) failed404.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof BG_IMAGES !== 'undefined', { timeout: 60000 }).catch(() => {});

const out = await page.evaluate(async () => {
  const EXPECT = {
    blockland_meadow: 'blockland1', blockland_grove: 'blockland1',
    blockland_dunes: 'blockland', blockland_quarry: 'blockland',
    blockland_outpost: 'blockland', blockland_citadel: 'blockland',
    blockland_apex: 'blocklandLegosaurus',
  };
  // find the background registry regardless of its identifier
  let REG = null;
  for (const n of ['BG_IMAGES', 'BACKGROUNDS', 'BG', 'LX_BG']) { try { if (typeof eval(n) === 'object') { REG = eval(n); break; } } catch (_) {} }
  const rows = [];
  for (const [id, want] of Object.entries(EXPECT)) {
    const m = MAPS[id];
    rows.push({ id, want, got: m && m.bg, ok: !!(m && m.bg === want) });
  }
  // wait for the three blockland plates to decode
  const keys = ['blockland', 'blockland1', 'blocklandLegosaurus'];
  const t0 = Date.now();
  while (REG && Date.now() - t0 < 20000) {
    if (keys.every((k) => REG[k] && REG[k].complete && REG[k].naturalWidth > 0)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const imgs = keys.map((k) => {
    const im = REG && REG[k];
    return { k, present: !!im, decoded: !!(im && im.complete && im.naturalWidth > 0), w: im && im.naturalWidth, h: im && im.naturalHeight, src: im && im.src ? im.src.split('/').pop() : null };
  });
  // whole-registry sweep: wait for every plate to settle, then report any that
  // never produced pixels. `voidBlack` is deliberately unregistered — the void
  // and boss-rush maps use it to fall through to the flat sky gradient, and the
  // map table says so inline, so it is whitelisted rather than reported.
  const INTENTIONAL_ORPHANS = new Set(['voidBlack']);
  const all = Object.keys(REG || {});
  const t1 = Date.now();
  while (REG && Date.now() - t1 < 45000) {
    if (all.every((k) => !REG[k] || REG[k].complete)) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  const undecoded = all.filter((k) => { const i = REG[k]; return !i || !i.complete || !i.naturalWidth; })
    .map((k) => k + ' (' + ((REG[k] && REG[k].src) ? REG[k].src.split('/').pop() : 'no image') + ')');
  const orphan = [];
  for (const id in MAPS) {
    const b = MAPS[id] && MAPS[id].bg;
    if (b && REG && !(b in REG) && !INTENTIONAL_ORPHANS.has(b)) orphan.push(id + ' -> ' + b);
  }
  return { rows, imgs, regFound: !!REG, total: all.length, undecoded, orphan };
});
await browser.close();

let bad = 0;
console.log('map -> bg key:');
for (const r of out.rows) { if (!r.ok) bad++; console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(20)} ${r.got}${r.ok ? '' : '  (expected ' + r.want + ')'}`); }
console.log(`\nbackground images (registry ${out.regFound ? 'found' : 'NOT FOUND'}):`);
for (const i of out.imgs) {
  const ok = i.decoded && i.w === 2912 && i.h === 1632;
  if (!ok) bad++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${i.k.padEnd(20)} ${i.decoded ? i.w + 'x' + i.h : 'NOT DECODED'}  ${i.src || ''}`);
}
console.log(`\nwhole registry (${out.total} keys):`);
if (out.undecoded.length) { bad++; console.log('  FAIL  did not decode:\n    ' + out.undecoded.join('\n    ')); }
else console.log('  PASS  every registered background decoded');
if (out.orphan.length) { bad++; console.log('  FAIL  map points at an unregistered bg key:\n    ' + out.orphan.join('\n    ')); }
else console.log('  PASS  no map points at an unregistered bg key');

if (failed404.length) { bad++; console.log('\nbackground requests that FAILED:'); failed404.forEach((f) => console.log('  ' + f)); }
else console.log('\nno failed background requests');
console.log(errs.length ? 'page errors: ' + errs.slice(0, 2).join(' | ') : 'no page errors');
console.log(bad ? `\n${bad} problem(s)` : '\nall good');
process.exit(bad || errs.length ? 1 : 0);
