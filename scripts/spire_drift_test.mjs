// Live test: THE SPIRE SCATTERS - EVERY PLATFORM ON ITS OWN AXIS - AND EVERY
// CROSSING STAYS A SINGLE JUMP AT EVERY PHASE.
//
// Per user (v0.30.289): "make the platforms drift horizontally left and right,
// and make the platforms appear slightly randomised but accessible to player
// single jump". Then (v0.30.30x): "the platforms need to move more randomly in
// different directions and then oscillate back".
//
// The second ask multiplies the danger of the first. A single wave kept
// neighbours nearly in phase, so 36px of sway cost only 8px of gap. Random
// axes and random phases mean a pair can move in ANTIPHASE - the worst
// crossing is the static gap plus the pair's full relative amplitude. The
// generator therefore budgets each crossing against the pair's ANALYTIC
// relative amplitude (same frequency everywhere, so relative motion is itself
// a sinusoid), and this file's job is to check that arithmetic against a swept
// full cycle - horizontal AND vertical - rather than trusting it.
//   node scripts/spire_drift_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8941; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && MAPS.clockworkSpire
  && typeof _tickSpireDrift === 'function' && typeof updatePlayer === 'function', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const P = MAPS.clockworkSpire.platforms;
  const drifters = P.filter(p => p._driftAx != null);
  out.total = P.length;
  out.drifting = drifters.length;
  out.ground = !!P[0] && P[0]._driftAx == null;
  const summit = P.reduce((a, x) => (a == null || x.y < a.y) ? x : a, null);
  out.summitStatic = summit._driftAx == null;
  out.worldW = MAPS.clockworkSpire.worldWidth;

  // ---- direction diversity: the point of the rework ----
  const angles = drifters.map(p => Math.atan2(p._driftAy || 0, p._driftAx || 0));
  const buckets = new Set(angles.map(a => Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8));
  out.axisBuckets = buckets.size;
  out.movingVertically = drifters.filter(p => Math.abs(p._driftAy || 0) > 2).length;
  out.movingLeftPhase = drifters.filter(p => (p._driftAx || 0) < -2).length;
  out.movingRightPhase = drifters.filter(p => (p._driftAx || 0) > 2).length;

  // ---- sweep a FULL cycle on BOTH axes ----
  const at = (p, T) => {
    if (p._driftAx == null) return { x: p.x, y: p.y };
    const s = Math.sin(T + (p._driftPhase || 0));
    return { x: p._driftBaseX + (p._driftAx || 0) * s,
             y: (p._driftBaseY != null ? p._driftBaseY : p.y) + (p._driftAy || 0) * s };
  };
  const climb = P.filter(p => p.type === 'platform');
  let maxGap = 0, maxAt = null, minX = 1e9, maxR = -1e9, maxClimb = 0;
  for (let step = 0; step <= 240; step++) {
    const T = (step / 240) * Math.PI * 2;
    for (const p of climb) { const q = at(p, T); minX = Math.min(minX, q.x); maxR = Math.max(maxR, q.x + p.w); }
    for (let i = 0; i < climb.length - 1; i++) {
      const a = at(climb[i], T), b2 = at(climb[i + 1], T);
      const sep = Math.max(0, Math.max(a.x, b2.x) - Math.min(a.x + climb[i].w, b2.x + climb[i + 1].w));
      if (sep > maxGap) { maxGap = sep; maxAt = { floor: i, T: +T.toFixed(2) }; }
      maxClimb = Math.max(maxClimb, a.y - b2.y);   // vertical rise of this crossing at this phase
    }
  }
  out.maxGapOverCycle = Math.round(maxGap);
  out.maxGapAt = maxAt;
  out.minXOverCycle = Math.round(minX);
  out.maxRightOverCycle = Math.round(maxR);
  out.maxClimbOverCycle = Math.round(maxClimb);
  out.documentedPlainJumpReach = 62;   // the figure the gap budget was built against
  out.floorDy = 80;

  // ---- oscillate back: strict periodicity ----
  let periodErr = 0;
  for (const p of climb) {
    const a = at(p, 0), b2 = at(p, Math.PI * 2);
    periodErr = Math.max(periodErr, Math.abs(a.x - b2.x), Math.abs(a.y - b2.y));
  }
  out.periodErr = periodErr;

  // ---- the runtime tick: carry on BOTH axes, riders follow ----
  const km = game.currentMap, kmd = game.mapData, kc = game.chests, kh = game.hazards;
  game.currentMap = 'clockworkSpire'; game.mapData = MAPS.clockworkSpire;
  const shelf = climb.find(p => Math.abs(p._driftAx || 0) > 4 && Math.abs(p._driftAy || 0) > 2)
    || climb.find(p => p._driftAx != null);
  game.chests = [{ x: shelf.x + 10, y: shelf.y - 28, _spireFloor: shelf._spireFloor }];
  game.hazards = [{ type: 'void_tear', x: shelf.x, y: shelf.y - 110, w: 100, h: 90,
    cx: shelf.x + 50, _spireFloor: shelf._spireFloor }];
  const keep = { x: player.x, y: player.y, onGround: player.onGround, hp: player.hp };
  player.x = shelf.x + 20; player.y = shelf.y - player.h; player.onGround = true; player.hp = Math.max(1, player.hp);
  const before = { px: player.x, py: player.y, plx: shelf.x, ply: shelf.y,
    cx: game.chests[0].x, cy: game.chests[0].y, hx: game.hazards[0].x, hy: game.hazards[0].y };
  game.time = (game.time | 0) + 45;
  _tickSpireDrift();
  out.tick = {
    platDx: +(shelf.x - before.plx).toFixed(3), platDy: +(shelf.y - before.ply).toFixed(3),
    playerDx: +(player.x - before.px).toFixed(3), playerDy: +(player.y - before.py).toFixed(3),
    chestDx: +(game.chests[0].x - before.cx).toFixed(3), chestDy: +(game.chests[0].y - before.cy).toFixed(3),
    hazDx: +(game.hazards[0].x - before.hx).toFixed(3), hazDy: +(game.hazards[0].y - before.hy).toFixed(3),
  };
  player.x = shelf.x - 400; player.y = shelf.y - player.h; player.onGround = true;
  const offX = player.x, offY = player.y;
  game.time = (game.time | 0) + 45;
  _tickSpireDrift();
  out.tick.bystanderDx = +(player.x - offX).toFixed(3);
  out.tick.bystanderDy = +(player.y - offY).toFixed(3);
  game.currentMap = km; game.mapData = kmd; game.chests = kc; game.hazards = kh;
  Object.assign(player, keep);
  return out;
});
await b.close(); srv.kill();

ok('the climbing platforms scatter and the anchors do not',
  r.drifting >= 35 && r.ground && r.summitStatic,
  { driftingOf: r.drifting + '/' + r.total, groundStatic: r.ground, summitStatic: r.summitStatic });
ok('directions genuinely differ - axes spread around the circle, many bob vertically',
  r.axisBuckets >= 6 && r.movingVertically >= 10 && r.movingLeftPhase >= 5 && r.movingRightPhase >= 5,
  { axisBucketsOf8: r.axisBuckets, withVerticalMotion: r.movingVertically,
    leftPhase: r.movingLeftPhase, rightPhase: r.movingRightPhase,
    note: 'the old wave had ONE axis for all 39 - this is the ask' });
ok('the full sway stays inside the world - no platform is ever clamped',
  r.minXOverCycle >= 0 && r.maxRightOverCycle <= r.worldW,
  { leftmost: r.minXOverCycle, rightmost: r.maxRightOverCycle, worldW: r.worldW });
ok('EVERY crossing stays inside a single jump at EVERY phase - horizontally',
  r.maxGapOverCycle < r.documentedPlainJumpReach,
  { worstGapAnyPhase: r.maxGapOverCycle, plainJumpReach: r.documentedPlainJumpReach,
    marginPx: r.documentedPlainJumpReach - r.maxGapOverCycle, worstAt: r.maxGapAt });
ok('...and vertically: no crossing ever asks more climb than the budget',
  r.maxClimbOverCycle <= r.floorDy + 10,
  { worstClimbAnyPhase: r.maxClimbOverCycle, staticFloorDy: r.floorDy,
    verticalCap: 10, note: '~111px jump apex vs 90px worst asked' });
ok('every platform oscillates BACK - strictly periodic, returns exactly',
  r.periodErr < 1e-6, { maxPeriodError: r.periodErr });
ok('a rider is carried on BOTH axes, exactly with the shelf',
  Math.abs(r.tick.platDx) + Math.abs(r.tick.platDy) > 0.5
  && Math.abs(r.tick.playerDx - r.tick.platDx) < 0.01
  && Math.abs(r.tick.playerDy - r.tick.platDy) < 0.01,
  r.tick);
ok('...and a bystander is left alone',
  r.tick.bystanderDx === 0 && r.tick.bystanderDy === 0,
  { dx: r.tick.bystanderDx, dy: r.tick.bystanderDy });
ok('the puzzle chest and the void-tear ride their platform on both axes',
  Math.abs(r.tick.chestDx - r.tick.platDx) < 0.01 && Math.abs(r.tick.chestDy - r.tick.platDy) < 0.01
  && Math.abs(r.tick.hazDx - r.tick.platDx) < 0.01 && Math.abs(r.tick.hazDy - r.tick.platDy) < 0.01,
  { plat: [r.tick.platDx, r.tick.platDy], chest: [r.tick.chestDx, r.tick.chestDy], hazard: [r.tick.hazDx, r.tick.hazDy] });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
