// The Gravitos safe zone draws no rectangle border or outline — and nothing
// outside the rect that decides whether the player lives.
//
// Per user: "For the gravitos safe zone, remove the rectangle border and
// outline."
//
// The reason this is a test and not a diff read: the safe rect is the EXACT
// lethal boundary. At Event Horizon the resolve check is the player's centre
// inside the rect, with no edge forgiveness. Two of the three old cues painted
// outside it — the glow band by 6 px, the sprite by 12 — so the brightest
// "safe here" pixels sat past the line that kills. With the outline gone those
// overhangs would have become the edge players read, so this asserts every
// remaining cue is inside the true footprint, not just that the stroke is gone.
// Run: node scripts/gravitos_safezone_draw_test.mjs [file.html]
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
await page.waitForFunction(() => typeof drawHazards === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  loadMap('gravitosArena');
  game.camera.x = 0; if (game.camera) game.camera.y = 0;
  const Z = { x: 300, y: 380, w: 220, h: 40 };
  game.hazards = [{
    type: 'gravitos_singularity', x: 0, y: 0, cy: 300,
    life: 60, maxLife: 120, safeZones: [Z],
  }];

  const strokeRects = [], fillRects = [], blits = [];
  const oSR = ctx.strokeRect, oFR = ctx.fillRect, oDI = ctx.drawImage;
  ctx.strokeRect = function (x, y, w, h) { strokeRects.push({ x, y, w, h }); return oSR.apply(this, arguments); };
  ctx.fillRect   = function (x, y, w, h) { fillRects.push({ x, y, w, h });   return oFR.apply(this, arguments); };
  ctx.drawImage  = function (img, ...a) { if (a.length >= 4) blits.push({ x: a[0], y: a[1], w: a[2], h: a[3] }); return oDI.apply(this, [img, ...a]); };
  try { drawHazards(); } catch (e) { return { err: String(e).slice(0, 160) }; }
  finally { ctx.strokeRect = oSR; ctx.fillRect = oFR; ctx.drawImage = oDI; }

  // Anything drawn on/around the zone: within a generous window of it, but not
  // the full-screen veil (which is deliberately arena-wide).
  const near = (o) => o.w < 900 && Math.abs(o.x - Z.x) < 200 && Math.abs(o.y - Z.y) < 200;
  const outside = (o) => (o.x < Z.x - 0.5) || (o.y < Z.y - 0.5) ||
                         (o.x + o.w > Z.x + Z.w + 0.5) || (o.y + o.h > Z.y + Z.h + 0.5);

  const zoneStrokes = strokeRects.filter(near);
  const zoneFills   = fillRects.filter(near);
  const zoneBlits   = blits.filter(near);
  return {
    zone: Z,
    zoneStrokes, zoneFills, zoneBlits,
    fillsOutside: zoneFills.filter(outside),
    blitsOutside: zoneBlits.filter(outside),
    coversZone: zoneFills.some(o => Math.abs(o.x - Z.x) < 0.5 && Math.abs(o.y - Z.y) < 0.5 &&
                                    Math.abs(o.w - Z.w) < 0.5 && Math.abs(o.h - Z.h) < 0.5),
  };
});

if (r.err) { console.log('FAILED — ' + r.err); await browser.close(); process.exit(1); }
console.log(`\nzone ${JSON.stringify(r.zone)}`);
console.log(`strokeRects on the zone: ${r.zoneStrokes.length}   fillRects: ${r.zoneFills.length}   blits: ${r.zoneBlits.length}`);

console.log('\nNO RECTANGLE BORDER OR OUTLINE');
check(r.zoneStrokes.length === 0, 'no strokeRect is drawn on the safe zone', r.zoneStrokes);

console.log('\nTHE ZONE IS STILL READABLE');
check(r.zoneFills.length > 0, 'something still fills the zone (guards a vacuous pass)', r.zoneFills.length);
check(r.coversZone, 'a fill covers the zone rect exactly', r.zoneFills);

console.log('\nNOTHING PAINTS OUTSIDE THE LETHAL BOUNDARY');
check(r.fillsOutside.length === 0, 'no fill extends past the safe rect', r.fillsOutside);
check(r.blitsOutside.length === 0, 'no sprite blit extends past the safe rect', r.blitsOutside);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
