// v0.29.x — entity ground shadows: local player + monsters cast the blob
// shadow co-op peers have had since v0.25.3. Verifies the ground finder, the
// airborne shrink/fade, both call sites, the perf gate and the kill switch.
//
//   node serve.js 8809 && node scripts/entity_shadow_test.mjs 8809
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8809';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_lxDrawBlobShadow') === 'function' && !!eval('game'); } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const g = eval('game'), P = eval('LX_PERF');
  const below = eval('_lxGroundBelow'), draw = eval('_lxDrawBlobShadow');
  const savedMap = g.mapData, savedVery = P.veryLowFx;

  // Synthetic map: ground at 480, a drop-through platform at 380 spanning
  // x 100-300, a second platform at 300 spanning the same range.
  g.mapData = { platforms: [
    { type: 'ground', x: 0, y: 480, w: 2000, h: 40 },
    { type: 'platform', x: 100, y: 380, w: 200, h: 12 },
    { type: 'platform', x: 100, y: 300, w: 200, h: 12 },
  ], worldWidth: 2000 };
  P.veryLowFx = false;

  const unit = {
    standingOnGround: below(500, 28, 480),      // feet exactly on ground
    airborneOverGround: below(500, 28, 400),    // 80px up, nothing between
    overPlatformStack: below(150, 28, 250),     // above both platforms -> 300 (topmost below)
    betweenPlatforms: below(150, 28, 350),      // between 300 and 380 -> 380
    offMapPit: below(-500, 28, 400),            // no horizontal overlap
  };

  // Spy the canvas calls.
  const CTX = eval('ctx');
  const calls = [];
  const oE = CTX.ellipse, oF = CTX.fill;
  let fillStyleAt = null;
  CTX.ellipse = function (cx, cy, rx, ry) { calls.push({ cx, cy, rx: +rx.toFixed(2), ry: +ry.toFixed(2), style: String(this.fillStyle) }); };
  const run = (label, fn) => { calls.length = 0; fn(); return calls.slice(); };

  // Airborne cases use wx=500 — clear of the 100-300 platform span. The first
  // cut used wx=286, which OVERLAPS the y=380 platform, so "airborne at 380"
  // was actually standing on it and the code (correctly) drew a grounded
  // shadow — the failures were the test's geometry, not the feature.
  const grounded = run('grounded', () => draw(300, 480, 480, 500, 28));
  const airborne = run('air100', () => draw(300, 380, 380, 500, 28));
  const tooHigh  = run('air260', () => draw(300, 220, 220, 500, 28));
  P.veryLowFx = true;
  const gated = run('verylow', () => draw(300, 480, 480, 500, 28));
  P.veryLowFx = false;
  eval('LX_ENTITY_SHADOWS = false');
  const killed = run('killed', () => draw(300, 480, 480, 500, 28));
  eval('LX_ENTITY_SHADOWS = true');

  CTX.ellipse = oE; CTX.fill = oF;
  g.mapData = savedMap; P.veryLowFx = savedVery;

  const src = { monster: eval('drawMonster').toString(), player: eval('drawPlayer').toString() };
  return { unit, grounded, airborne, tooHigh, gated, killed,
           monsterCallsIt: /_lxDrawBlobShadow\(/.test(src.monster),
           playerCallsIt: /_lxDrawBlobShadow\(/.test(src.player) };
});

ok('feet on ground resolves the ground platform', r.unit.standingOnGround === 480);
ok('airborne still resolves the ground below', r.unit.airborneOverGround === 480);
ok('above stacked platforms picks the TOPMOST below', r.unit.overPlatformStack === 300);
ok('between platforms picks the next one down', r.unit.betweenPlatforms === 380);
ok('no platform below -> null (no floating shadow over pits)', r.unit.offMapPit === null);
ok('grounded: one ellipse at the feet', r.grounded.length === 1 && r.grounded[0].cy === 480, r.grounded[0]);
ok('grounded: full-size, full-alpha', r.grounded.length === 1 && Math.abs(r.grounded[0].rx - 11.76) < 0.1 && /0\.26/.test(r.grounded[0].style), r.grounded[0]);
ok('airborne: shadow stays on the GROUND, not under the sprite', r.airborne.length === 1 && r.airborne[0].cy === 480, r.airborne[0]);
ok('airborne: smaller + fainter than grounded', r.airborne.length === 1 && r.airborne[0].rx < r.grounded[0].rx && parseFloat(r.airborne[0].style.match(/0\.\d+/)[0]) < 0.26, r.airborne[0]);
ok('too high (260px): fully faded, no draw', r.tooHigh.length === 0);
ok('veryLowFx skips the draw', r.gated.length === 0);
ok('LX_ENTITY_SHADOWS kill switch works', r.killed.length === 0);
ok('drawMonster calls the shadow', r.monsterCallsIt === true);
ok('drawPlayer calls the shadow', r.playerCallsIt === true);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
