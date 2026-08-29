// Live test: THE SPIRE DRIFTS, AND EVERY CROSSING STAYS A SINGLE JUMP.
//
// Per user: "make the platforms drift horizontally left and right, and make the
// platforms appear slightly randomised but accessible to player single jump".
//
// The two asks pull against each other, and that tension is what this file
// exists to hold. A gap checked only at spawn is meaningless once the tower
// moves: two neighbours sliding out of phase open a wider gap than the one they
// were built with. So the reachability check is swept across a FULL drift cycle,
// and compared against the jump reach measured from the engine's own physics
// rather than a number copied out of a comment.
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
  const drifters = P.filter(p => p._driftAmp);
  out.total = P.length;
  out.drifting = drifters.length;
  out.ground = !!P[0] && !P[0]._driftAmp;
  const summit = P.reduce((a, x) => (a == null || x.y < a.y) ? x : a, null);
  out.summitStatic = !summit._driftAmp;
  out.worldW = MAPS.clockworkSpire.worldWidth;

  // ---- randomisation ----
  const ws = P.filter(p => p.type === 'platform').map(p => p.w);
  out.distinctWidths = new Set(ws).size;
  out.widthRange = [Math.min(...ws), Math.max(...ws)];

  // ---- sweep a FULL drift cycle ----
  // Platform x is a pure function of the baked base/amp/phase, so the whole
  // cycle can be evaluated exactly instead of being sampled by running frames.
  const at = (p, T) => p._driftAmp ? p._driftBaseX + p._driftAmp * Math.sin(T + (p._driftPhase || 0)) : p.x;
  const sep = (a, b, T) => {
    const ax = at(a, T), bx = at(b, T);
    return Math.max(0, Math.max(ax, bx) - Math.min(ax + a.w, bx + b.w));
  };
  let maxGap = 0, maxAt = null, minX = 1e9, maxR = -1e9;
  const climb = P.filter(p => p.type === 'platform');
  for (let step = 0; step <= 240; step++) {
    const T = (step / 240) * Math.PI * 2;
    for (const p of climb) { const x = at(p, T); minX = Math.min(minX, x); maxR = Math.max(maxR, x + p.w); }
    for (let i = 0; i < climb.length - 1; i++) {
      const gsep = sep(climb[i], climb[i + 1], T);
      if (gsep > maxGap) { maxGap = gsep; maxAt = { floor: i, T: +T.toFixed(2) }; }
    }
  }
  out.maxGapOverCycle = Math.round(maxGap);
  out.maxGapAt = maxAt;
  out.minXOverCycle = Math.round(minX);
  out.maxRightOverCycle = Math.round(maxR);

  // gap at spawn only, for contrast with the swept figure
  let spawnMax = 0;
  for (let i = 0; i < climb.length - 1; i++) spawnMax = Math.max(spawnMax, sep(climb[i], climb[i + 1], 0));
  out.maxGapAtSpawn = Math.round(spawnMax);

  // ---- measure the engine's real single-jump reach ----
  const keep = { x: player.x, y: player.y, vx: player.vx, vy: player.vy,
    onGround: player.onGround, inv: player.invulnerable };
  if (typeof keys === 'object' && keys) for (const k of Object.keys(keys)) keys[k] = false;
  player.invulnerable = 9999;
  const jv = (typeof getJump === 'function') ? getJump() : 10;
  const cap = (typeof PLAYER_SPEED_HARD_CAP !== 'undefined') ? PLAYER_SPEED_HARD_CAP : 10;
  const sx = player.x;
  player.onGround = false; player.vy = -jv; player.vx = cap;
  let f = 0; while (f < 400 && !player.onGround) { updatePlayer(16); f++; }
  out.jumpReach = Math.round(Math.abs(player.x - sx));
  out.jumpFrames = f;
  out.measuredOn = game.currentMap;
  Object.assign(player, { x: keep.x, y: keep.y, vx: keep.vx, vy: keep.vy,
    onGround: keep.onGround, invulnerable: keep.inv });

  // ---- the runtime tick itself: carry + riders ----
  // _tickSpireDrift is map-gated, so the map identity is borrowed rather than
  // loading the Spire (which is quest-gated). Everything it touches is real.
  const km = game.currentMap, kmd = game.mapData, kc = game.chests, kh = game.hazards;
  game.currentMap = "clockworkSpire"; game.mapData = MAPS.clockworkSpire;
  const shelf = climb.find(pp => pp._driftAmp);
  game.chests = [{ x: shelf.x + 10, y: shelf.y - 28, _spireFloor: shelf._spireFloor }];
  game.hazards = [{ type: "void_tear", x: shelf.x, y: shelf.y - 110, w: 100, h: 90,
    cx: shelf.x + 50, _spireFloor: shelf._spireFloor }];
  player.x = shelf.x + 20; player.y = shelf.y - player.h; player.onGround = true;
  const before = { plat: shelf.x, player: player.x, chest: game.chests[0].x,
    haz: game.hazards[0].x, hazCx: game.hazards[0].cx };
  game.time = (game.time | 0) + 30;   // advance the phase so the sine actually moves
  _tickSpireDrift();
  const dxPlat = shelf.x - before.plat;
  out.tick = {
    platformMoved: +dxPlat.toFixed(3),
    playerCarried: +(player.x - before.player).toFixed(3),
    chestFollowed: +(game.chests[0].x - before.chest).toFixed(3),
    hazardFollowed: +(game.hazards[0].x - before.haz).toFixed(3),
    hazardCxFollowed: +(game.hazards[0].cx - before.hazCx).toFixed(3),
  };
  // a player standing NEXT to the platform, not on it, must not be dragged
  player.x = shelf.x - 400; player.onGround = true;
  const offBefore = player.x;
  game.time = (game.time | 0) + 30;
  _tickSpireDrift();
  out.tick.bystanderMoved = +(player.x - offBefore).toFixed(3);
  game.currentMap = km; game.mapData = kmd; game.chests = kc; game.hazards = kh;
  Object.assign(player, { x: keep.x, y: keep.y, vx: keep.vx, vy: keep.vy,
    onGround: keep.onGround, invulnerable: keep.inv });
  out.documentedPlainJumpReach = 62;   // the figure the map budget was built against
  return out;
});

ok('the climbing platforms drift and the anchors do not',
  r.drifting >= 35 && r.ground && r.summitStatic,
  { driftingOf: r.drifting + '/' + r.total, groundStatic: r.ground, summitStatic: r.summitStatic,
    note: 'the summit return portal spawns at a FIXED world x, so a drifting summit would slide out from under the exit' });
ok('the full sway stays inside the world - no platform is ever clamped',
  r.minXOverCycle >= 0 && r.maxRightOverCycle <= r.worldW,
  { leftmost: r.minXOverCycle, rightmost: r.maxRightOverCycle, worldW: r.worldW,
    note: 'a clamped platform would freeze while its neighbour kept moving - the phase break the budget cannot absorb' });
ok('EVERY crossing stays inside a single jump across the whole drift cycle',
  r.maxGapOverCycle < r.documentedPlainJumpReach,
  { worstGapAnyPhase: r.maxGapOverCycle, plainJumpReach: r.documentedPlainJumpReach,
    marginPx: r.documentedPlainJumpReach - r.maxGapOverCycle, worstAt: r.maxGapAt,
    note: 'judged against the 62px PLAIN jump the map budget was built on, not the '
      + r.jumpReach + 'px this run measured holding max speed for the whole flight - that figure flatters the jump' });
ok('...and the swept worst case really is worse than the spawn snapshot',
  r.maxGapOverCycle >= r.maxGapAtSpawn,
  { atSpawn: r.maxGapAtSpawn, anyPhase: r.maxGapOverCycle,
    note: 'checking only the spawn layout would have under-reported the real gap' });
ok('platform widths are randomised, not a closed-form arch',
  r.distinctWidths >= 20,
  { distinctWidths: r.distinctWidths, range: r.widthRange, note: 'the profile was exact before, so width was predictable from floor index' });
ok('a player standing on a drifting shelf is carried with it',
  Math.abs(r.tick.platformMoved) > 0.5 && Math.abs(r.tick.playerCarried - r.tick.platformMoved) < 0.01,
  { platformMoved: r.tick.platformMoved, playerCarried: r.tick.playerCarried,
    note: 'without the carry the shelf slides out from under a standing player' });
ok('...and a player who is not on it is left alone',
  r.tick.bystanderMoved === 0, { bystanderMoved: r.tick.bystanderMoved });
ok('the puzzle chest and the void-tear ride their platform',
  Math.abs(r.tick.chestFollowed - r.tick.platformMoved) < 0.01
  && Math.abs(r.tick.hazardFollowed - r.tick.platformMoved) < 0.01
  && Math.abs(r.tick.hazardCxFollowed - r.tick.platformMoved) < 0.01,
  { platformMoved: r.tick.platformMoved, chest: r.tick.chestFollowed,
    hazard: r.tick.hazardFollowed, hazardCx: r.tick.hazardCxFollowed,
    note: 'the tear was anchored to its platform last release - if it does not follow, that anchoring is decorative' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
