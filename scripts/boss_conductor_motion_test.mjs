// The Master Conductor moves like a conductor, not a strobe light.
//
// Per playtester (via user): "PQ final boss movement and animations commented
// to be erratic." Measured on the live AI over ~10 s with the player parked
// beside him, before the fix:
//   facing flips  101 /10s   (the sprite mirror-flopping ~10x a second)
//   airborne      52%        (jump:10, activeBoss 9%/frame roll, NO jumpCdMs)
//   jumps         9 /10s
// against Barnaby — same harness — at 0 flips, 0 jumps, 2% airborne.
//
// Two causes, two fixes, both measured here:
//   1. bossAI re-faced the player UNCONDITIONALLY every frame; the ordinary
//      chase AI has had a 28px deadband + 220ms hold for ages. bossAI now uses
//      the same grammar, so a boss that crosses the player commits to a side.
//   2. pqConductor gains jumpCdMs:1400 — the exact knob v0.29.645 built for
//      hop-stutter (Barnaby ships 1100).
// His animation frames were never the problem: 9-frame attack/idle/walk sets
// all exist and decode (asserted below), so no art was generated.
//   node scripts/boss_conductor_motion_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof spawnMonster === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.level = 40; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  // PAUSE THE LIVE LOOP. This suite drives updateMonsters synthetically; with
  // the rAF loop also running, every hold/cooldown drained twice per counted
  // tick and the flip counts were confounded (measured: the facing hold
  // 'failed' at 199ms remaining — it was the live loop flipping between
  // synthetic ticks). game.paused gates the loop's sim block only;
  // updateMonsters called directly still runs.
  game.paused = true;

  const run = (type) => {
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    player.x = 600; player.y = 400; player.hp = getMaxHp(); player._god = true;
    game.camera.x = 300; game.camera.y = 0;
    const m = spawnMonster(900, 300, type, true, false);
    if (!m || !m.type) return { err: 'no spawn' };
    m.aggroTarget = player;
    let jumps = 0, flips = 0, prevFacing = m.facing, prevOnGround = true, airTicks = 0;
    const N = 625;   // ~10s of 16ms ticks
    for (let i = 0; i < N; i++) {
      try { updateMonsters(16); } catch (e) {}
      if (prevOnGround && !m.onGround && m.vy < 0) jumps++;
      prevOnGround = !!m.onGround;
      if (!m.onGround) airTicks++;
      if (m.facing !== prevFacing) { flips++; prevFacing = m.facing; }
    }
    game.monsters.length = 0; game.projectiles.length = 0;
    return { jumps, flips, airPct: Math.round(100 * airTicks / N), jumpCdMs: m.jumpCdMs | 0 };
  };

  out.conductor = run('pqConductor');
  out.barnaby = run('young_confused_barnaby');

  // worst case for facing: the player CROSSES the boss every 120ms — the hold
  // must bound the flips even under deliberate side-switching.
  {
    game.monsters.length = 0;
    const m = spawnMonster(900, 300, 'pqConductor', true, false);
    m.aggroTarget = player;
    let flips = 0, prevFacing = m.facing;
    for (let i = 0; i < 625; i++) {
      if (i % 8 === 0) player.x = (player.x < m.x) ? m.x + m.w + 60 : m.x - 90;
      try { updateMonsters(16); } catch (e) {}
      if (m.facing !== prevFacing) { flips++; prevFacing = m.facing; }
    }
    out.crossing = { flips };
    game.monsters.length = 0;
  }

  // SMOOTHNESS, on a virtual clock (anim windows are wall-clock; the clock
  // advances 16ms per synthetic tick so every window moves in sim-time and
  // the counts are deterministic). Against a stationary target the pre-fix
  // catch-all sawed straight through: 7 side-crossings in 10s, each dragging
  // a facing flip and a walk-state churn. The arrival deadband parks him at
  // ~48px — INSIDE his 170px swing range, so standing off must not mean
  // standing down: the same window demands real swings and ticket storms.
  {
    game.monsters.length = 0; game.projectiles.length = 0;
    player.x = 600; player.y = 400; player._god = true;
    const m = spawnMonster(900, 300, 'pqConductor', true, false);
    m.aggroTarget = player;
    const realNow = performance.now.bind(performance);
    let simNow = realNow();
    performance.now = () => simNow;
    let crossings = 0, vxRev = 0, stateChanges = 0, swings = 0, storms = 0;
    let prevSide = 1, prevVxSign = 0, prevState = '';
    const seenProj = new Set();
    for (let i = 0; i < 625; i++) {
      simNow += 16;
      game.time = (game.time | 0) + 1;   // the storm/summon timers key on the frame counter, which only the paused loop advances
      player.x = 600; player.y = 400; player.vx = 0;
      try { updateMonsters(16); } catch (e) {}
      const side = Math.sign((m.x + m.w / 2) - (player.x + player.w / 2)) || prevSide;
      if (side !== prevSide) { crossings++; prevSide = side; }
      const vs = m.vx > 0.3 ? 1 : m.vx < -0.3 ? -1 : 0;
      if (vs !== 0 && prevVxSign !== 0 && vs !== prevVxSign) vxRev++;
      if (vs !== 0) prevVxSign = vs;
      const now = performance.now();
      const atk = (m.patternState && m.patternState !== 'idle') || (m.atkAnimUntil && now < m.atkAnimUntil);
      const st = !m.onGround ? 'air' : atk ? 'attack' : (_mobWalking(m) ? 'walk' : 'idle');
      if (st !== prevState) { if (prevState) stateChanges++; prevState = st; }
      for (const pr of game.projectiles) {
        if (pr.owner !== 'enemy' || seenProj.has(pr)) continue;
        seenProj.add(pr);
        if (pr.skill === 'swing') swings++;
        if (pr.skill === 'mticket') storms++;
      }
    }
    performance.now = realNow;
    out.smooth = { crossings, vxRev, stateChanges, swings, storms };
    game.monsters.length = 0; game.projectiles.length = 0;
  }

  // the animation sets were never missing — pin that so "erratic anims" cannot
  // be mis-diagnosed as absent art again.
  out.frames = (() => {
    const idx = (typeof LX_SPRITE_FRAME_INDEX !== 'undefined') ? LX_SPRITE_FRAME_INDEX
      : (window.LX_SPRITE_FRAME_INDEX || null);
    if (!idx || !idx.frames) return null;
    return {
      attack: (idx.frames['bosses/attack'] || {}).pqConductor | 0,
      idle: (idx.frames['bosses/idle'] || {}).pqConductor | 0,
      walk: (idx.frames['bosses/walk'] || {}).pqConductor | 0,
    };
  })();

  player._god = false; player.hp = getMaxHp();
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('conductor:', JSON.stringify(r.conductor));
console.log('barnaby  :', JSON.stringify(r.barnaby));
console.log('crossing :', JSON.stringify(r.crossing));
console.log('frames   :', JSON.stringify(r.frames));
console.log('smooth   :', JSON.stringify(r.smooth));

const c = r.conductor || {}, bb = r.barnaby || {}, x = r.crossing || {};
ok('the Conductor declares a jump cooldown (the v0.29.645 knob)', c.jumpCdMs >= 1000, { jumpCdMs: c.jumpCdMs });
// 38% measured post-fix = 6 leaps x his authored big arc (~0.63s each). The
// erratic half was CADENCE (a hop roll every ~11 frames) and the strobe, both
// gone; the arc height is his arena-reach identity and stays. Threshold
// encodes the design: leap-cadence airtime, no longer pogo airtime.
ok('airtime is leap-cadence now, not pogo (was 52% at a 0ms hop floor)', c.airPct <= 42, { airPct: c.airPct });
ok('hops are strides now, not a pogo (was 9/10s at 0ms floor)', c.jumps <= 6, { jumps: c.jumps });
ok('facing flips are bounded (was 101/10s — ten per second)', c.flips <= 20, { flips: c.flips });
ok('even a player deliberately crossing him every 120ms cannot strobe him',
   x.flips <= 48, { flips: x.flips, holdCapPer10s: 45 });
ok('Barnaby is untouched by the shared fix', bb.flips <= 6 && bb.airPct <= 10, bb);
const sm = r.smooth || {};
ok('he no longer saws through a stationary player (was 7 crossings/10s)',
   sm.crossings <= 1, { crossings: sm.crossings });
ok('...with no velocity dither at arrival (was 6 reversals)', sm.vxRev <= 2, { vxRev: sm.vxRev });
ok('...and animation states settle (was 22 changes/10s)', sm.stateChanges <= 16, { stateChanges: sm.stateChanges });
ok('standing off is not standing down: he still swings from the deadband',
   sm.swings >= 1, { swings: sm.swings });
ok('...and still throws ticket storms', sm.storms >= 8, { storms: sm.storms });
ok('his 9-frame animation sets were never missing — no art needed generating',
   r.frames && r.frames.attack === 9 && r.frames.idle === 9 && r.frames.walk === 9, r.frames);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x2 of results) { (x2.pass ? pass++ : fail++); console.log((x2.pass ? 'PASS  ' : 'FAIL  ') + x2.n + '  ' + JSON.stringify(x2.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
