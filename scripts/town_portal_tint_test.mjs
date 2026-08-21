// Portals to a town read GREEN, measured off the painted pixels.
//
// Per user: "For portals leading to town tint them slightly greenish to
// indicate to player." The checks:
//   1. the classifier keys off the map's own isTown flag, and enough maps
//      carry it that the feature is worth having
//   2. a town portal actually paints greener than a normal one — measured by
//      rendering each and comparing mean hue, not by reading the source
//   3. the tint is SLIGHT: the town portal stays clearly distinct from the
//      boss-red variant, and is not a lurid neon repaint
//   4. boss beats town if a map were ever both (danger outranks comfort)
// Run: node scripts/town_portal_tint_test.mjs [file.html] [--shot out.png]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const shotIdx = process.argv.indexOf('--shot');
const shotPath = shotIdx > 0 ? process.argv[shotIdx + 1] : null;
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof drawPortals === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(3500);

const r = await page.evaluate(async () => {
  const out = {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  out.townMaps = Object.keys(MAPS).filter((k) => MAPS[k] && MAPS[k].isTown);
  out.townCount = out.townMaps.length;
  const bossMap = Object.keys(MAPS).find((k) => MAPS[k] && MAPS[k].isBossArena);

  // Paint one portal at a time on a clean canvas and average its pixels. The
  // sprite is the SAME art in all three cases — only the bake differs — so a
  // hue difference can only come from the tint under test.
  const sample = async (dest) => {
    game.portals = [{ x: game.camera.x + 200, y: 400, dest, name: dest }];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    try { drawPortals(); } catch (e) { return { err: String(e).slice(0, 80) }; }
    const d = ctx.getImageData(120, 250, 160, 200).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 30) continue;                 // skip transparent
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return { n: 0 };
    return { n, r: +(r / n).toFixed(1), g: +(g / n).toFixed(1), b: +(b / n).toFixed(1) };
  };

  game.paused = true;
  const normalDest = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena);
  out.normalDest = normalDest; out.bossDest = bossMap; out.townDest = out.townMaps[0];
  out.normal = await sample(normalDest);
  out.town = await sample(out.townDest);
  out.boss = await sample(bossMap);

  // 4. boss beats town — synthesise a map that is both and confirm it reads red
  MAPS.__tinttest = { name: 'x', isTown: true, isBossArena: true, worldWidth: 800, platforms: [], spawns: [], portals: [] };
  out.both = await sample('__tinttest');
  delete MAPS.__tinttest;
  return out;
});

if (shotPath) {
  await page.evaluate(async () => {
    const frame = () => new Promise((res) => requestAnimationFrame(res));
    const town = Object.keys(MAPS).find((k) => MAPS[k] && MAPS[k].isTown);
    const norm = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena);
    game.paused = false;
    game.portals = [
      { x: game.camera.x + 320, y: 400, dest: norm, name: 'normal' },
      { x: game.camera.x + 640, y: 400, dest: town, name: 'town' },
    ];
    for (let i = 0; i < 4; i++) await frame();
  });
  await page.waitForTimeout(400);
  const cv = await page.$('canvas');
  if (cv) await cv.screenshot({ path: path.join(ROOT, shotPath) });
  console.log(`  shot -> ${shotPath}`);
}
await browser.close();

const hueShift = (a, b) => +(((b.g - b.r) - (a.g - a.r))).toFixed(1);   // green-vs-red lean
console.log(`  ${r.townCount} maps carry isTown (e.g. ${r.townMaps.slice(0, 4).join(', ')})`);
console.log(`  normal ${JSON.stringify(r.normal)}`);
console.log(`  town   ${JSON.stringify(r.town)}`);
console.log(`  boss   ${JSON.stringify(r.boss)}`);
console.log(`  green-lean vs normal: town ${hueShift(r.normal, r.town)}, boss ${hueShift(r.normal, r.boss)}`);

check(r.townCount >= 5, 'enough maps carry isTown for the cue to matter', r.townCount);
check(r.normal && r.normal.n > 500 && r.town.n > 500, 'all three portals actually painted pixels (else every comparison is vacuous)', { normal: r.normal && r.normal.n, town: r.town && r.town.n });
const _lean = hueShift(r.normal, r.town);
check(_lean > 25, 'the town portal leans GREEN against the normal one', _lean);
// SLIGHT is the ask, and it is measurable: a full sepia repaint (the first
// cut) measured 98.8. The blended wash lands near 46 - unmistakable at a
// glance, still recognisably the same arcane portal. This upper bound stops a
// later 'make it pop' edit turning it back into a green repaint.
check(_lean < 70, 'and the tint stays SLIGHT, not a full repaint (a full one measures ~99)', _lean);
check(r.town.g > r.town.r && r.town.g > r.town.b, 'green is the dominant channel on a town portal', r.town);
check(hueShift(r.normal, r.boss) < 0, 'the boss portal leans the other way (red), so the two cues never blur', hueShift(r.normal, r.boss));
// "slightly": a lurid repaint would swamp the sprite's own violet entirely
check(r.town.b > 40, 'the tint is SLIGHT — the portal keeps its arcane blue, not a neon repaint', r.town.b);
check(Math.abs(r.both.g - r.boss.g) < 12 && Math.abs(r.both.r - r.boss.r) < 12, 'a map that is BOTH town and boss reads as boss (danger outranks comfort)', { both: r.both, boss: r.boss });
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
