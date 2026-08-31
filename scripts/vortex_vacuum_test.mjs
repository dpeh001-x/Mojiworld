// The vortex vacuums what the player can see, and nothing else.
// ============================================================================
// Four mobs, four zones, two live pools:
//
//   A  grounded, ON screen, in the suck ring   -> must converge on the pool
//   B  flier,    ON screen, in the suck ring   -> must converge on the pool
//   C  OFF screen (past the camera + margin), inside the ring of a pool at
//      the screen edge                         -> must NOT move at all
//   D  ON screen but outside every ellipse     -> must NOT move (control:
//                                                 proves the gate is the
//                                                 ellipse, not the fix
//                                                 suppressing all pulls)
//
// C and D have speed 0, so the only thing that could move them is the vortex.
// A and B keep their live AI on purpose — the ring has to beat it.
//
// Geometry lessons this harness learned the hard way, all load-bearing:
//   * the world must be SCROLLED first: forest starts with the camera at
//     world x 0, so "off-screen left" did not exist and a mob placed there was
//     shoved back in by world bounds — 425px of movement that was not the
//     vortex.
//   * the pool must sit at GROUND level like the real cast (feet + 40): hung
//     mid-screen, grounded mobs fall below it and the pool's deliberate
//     never-through-the-floor rule excludes them, testing placement not pull.
//   * "freeze" means speed 0 ONLY. Also setting _noGravity made C exempt from
//     the inner pool on EVERY build (it skips _noGravity mobs), so the
//     off-screen row could not discriminate.
//   * D must stand on the ground; airborne it simply falls and the control
//     fails on every build.
//   * the two pools must be far apart, or pool 2's 430px ring reaches A and
//     drags it outward — two pools fighting over one mob, the harness's doing.
// Run: node scripts/vortex_vacuum_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11221);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);

const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
// loop() parks until the loading overlay carries .fade — without this the sim
// clock never advances and every "live" scenario is a frozen picture.
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1500);
  // Scroll so off-screen space exists to the left of the camera.
  // Wait for the camera to SETTLE, do not assume. It lerps toward the player,
  // so a fixed 12-frame wait left camX anywhere from ~280 to ~415 between runs:
  // C landed at negative world x (clamped by world bounds, 18px of movement
  // that was not the vortex) and D drifted inside the ring at sn 0.907.
  player.x = Math.min((game.mapData.worldWidth || 2000) - 400, 1400);
  let _lastCam = -1;
  for (let w = 0; w < 90; w++) {
    game.paused = false; await sleep(35);
    const c = game.camera.x || 0;
    if (w > 8 && Math.abs(c - _lastCam) < 0.5 && c > 480) break;
    _lastCam = c;
  }
  game.monsters.length = 0; game.hazards.length = 0;

  const camX = game.camera.x || 0, camY = (game.camera && game.camera.y) || 0;
  const cy = player.y + player.h / 2 + 40;          // ground level, as the cast places it
  const mkPool = (px) => game.hazards.push({
    type: 'soul_vortex', cx: px, x: px - LX_VORTEX_RX, y: cy - LX_VORTEX_RY,
    w: LX_VORTEX_RX * 2, h: LX_VORTEX_RY * 2, life: 1800, maxLife: 1800, atk: 1, tick: 0,
  });
  const cx = camX + 300;      // pool 1: left-of-centre, leaving a wide clean band on the right for D
  const cx2 = camX + 40;      // pool 2: left edge, its ring reaching off-screen
  mkPool(cx); mkPool(cx2);

  const mk = (x, y, opts) => {
    const m = spawnMonster(x, y, 'snail', false);
    if (!m || m._suppressed) return null;
    m.x = x; m.y = y; m.vx = 0; m.vy = 0;
    if (opts && opts.freeze) m.speed = 0;            // speed only — see header
    if (opts && opts.fly) { m.flies = true; m._noGravity = true; }
    return m;
  };
  const A = mk(cx + 350, player.y, {});                       // ring of pool 1
  const B = mk(cx - 300, cy - 180, { fly: true });            // ring of pool 1, airborne
  const C = mk(camX - 200, player.y, { freeze: true });       // off-screen left (160px past the 40px margin), inside pool 2's ring
  const D = mk(camX + W - 60, player.y, { freeze: true });    // on screen right, ~920px from pool 1: outside every ring
  if (!A || !B || !C || !D) return { err: 'spawn failed' };

  const dist = (m, px) => Math.hypot(m.x + m.w / 2 - px, m.y + m.h / 2 - cy);
  // Diagnose D: compute the ring coordinate the engine itself uses.
  const snOf = (m, px) => {
    const hy = cy;
    const vdx = px - Math.max(m.x, Math.min(px, m.x + m.w));
    const vdy = hy - Math.max(m.y, Math.min(hy, m.y + m.h));
    return Math.hypot(vdx / LX_VORTEX_SUCK_RX, vdy / LX_VORTEX_SUCK_RY);
  };
  const dSn = { pool1: +snOf(D, cx).toFixed(3), pool2: +snOf(D, cx2).toFixed(3), speed: D.speed, flies: !!D.flies };
  // Preconditions: if the scene is not what the rows assume, say so instead
  // of reporting a pass/fail about the fix.
  const pre = {
    camX,
    cOffScreen: (C.x + C.w) < (camX - 40) && C.x > 0,
    cInRing: snOf(C, cx2) < 1,
    dOutside: snOf(D, cx) >= 1 && snOf(D, cx2) >= 1,
    aInRing: snOf(A, cx) < 1,
  };
  const d0 = { A: dist(A, cx), B: dist(B, cx), Cx: C.x, Dx: D.x, Dy: D.y };
  // PIN the camera: it follows the player, and during the measurement it
  // drifted left, bringing C back on screen — C was then pulled legitimately
  // and the row read as a gate failure. Hold the player still and confirm
  // the view did not move.
  const _pinX = player.x, _camStart = game.camera.x || 0;
  for (let i = 0; i < 100; i++) {
    game.paused = false; player._god = true;
    player.x = _pinX; player.vx = 0;
    await sleep(35);
  }
  const _camEnd = game.camera.x || 0;
  // What matters is not that the camera was perfectly still, but that C was
  // OFF SCREEN for the whole window — drift only invalidates the row if it
  // brought C into view, where a pull would be correct.
  const _cEndOff = (C.x + C.w) < (_camEnd - 40);
  const d1 = { A: dist(A, cx), B: dist(B, cx), Cx: C.x, Dx: D.x, Dy: D.y };
  game.monsters.length = 0; game.hazards.length = 0;
  return { d0, d1, dSn, pre, camDrift: +Math.abs(_camEnd - _camStart).toFixed(1), cEndOff: _cEndOff };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
if (R.err) ok('scenario set up', false, R.err);
else if (!R.pre.cOffScreen || !R.pre.cInRing || !R.pre.dOutside || !R.pre.aInRing) {
  ok('PRECONDITION: the four mobs are in the zones the rows assume', false, JSON.stringify(R.pre));
}
else {
  console.log(`  A grounded ring: ${R.d0.A.toFixed(0)} -> ${R.d1.A.toFixed(0)}px    B flier ring: ${R.d0.B.toFixed(0)} -> ${R.d1.B.toFixed(0)}px`);
  console.log('  D ring coords: pool1 sn ' + R.dSn.pool1 + ', pool2 sn ' + R.dSn.pool2 + '  (>=1 = outside)  speed ' + R.dSn.speed + ' flies ' + R.dSn.flies);
  console.log(`  C off-screen x: ${R.d0.Cx.toFixed(1)} -> ${R.d1.Cx.toFixed(1)}    D control x/y: ${R.d0.Dx.toFixed(1)},${R.d0.Dy.toFixed(1)} -> ${R.d1.Dx.toFixed(1)},${R.d1.Dy.toFixed(1)}`);
  ok('a grounded mob in the ring is vacuumed toward the pool',
     R.d1.A < R.d0.A - 60, `${R.d0.A.toFixed(0)} -> ${R.d1.A.toFixed(0)}px (its own AI fights the pull; the ring must win)`);
  ok('a flier in the ring is vacuumed toward the pool',
     R.d1.B < R.d0.B - 60, `${R.d0.B.toFixed(0)} -> ${R.d1.B.toFixed(0)}px`);
  ok('CONTROL: C was off-screen for the whole window (drift only matters if it brought C into view)',
     R.cEndOff === true, 'camera drifted ' + R.camDrift + 'px; C still off-screen at the end: ' + R.cEndOff);
  ok('an OFF-SCREEN mob inside the suck ellipse is untouched',
     Math.abs(R.d1.Cx - R.d0.Cx) < 1,
     `moved ${Math.abs(R.d1.Cx - R.d0.Cx).toFixed(2)}px (speed 0: only the vortex could move it; unpatched drags it ~335px)`);
  ok('CONTROL: an on-screen mob outside every ellipse is untouched',
     Math.abs(R.d1.Dx - R.d0.Dx) < 1 && Math.abs(R.d1.Dy - R.d0.Dy) < 20,   // y: gravity settling onto the platform, ~12px
     'proves the gate is the ellipse, not the fix suppressing every pull');
}
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
