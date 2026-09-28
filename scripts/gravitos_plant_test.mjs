// GRAVITOS PLANTS DURING ATTACKS (v0.29.548).
//
// The hover-drift block in his AI used to run in EVERY pattern, so the boss
// glided sideways and bobbed while his attack sprites played (per user). It
// now runs only in 'idle' — where the renderer plays the walk loop — and every
// other pattern re-zeroes velocity each frame, EXCEPT:
//   • 'zip' — the comet dive IS the attack; its handler owns velocity.
//   • 'slam' — its lift/plummet writes vy every frame AFTER the plant, so the
//     handler wins its windows; the plant only kills the between-window drift.
// (v0.29.774 retired the slam lift/plummet: the slam is planted throughout and
// repositions by its lock - see section 4. v0.29.938 added idle's recovery beat.)
// This drives bossAI directly (the function that owns the plant) with seeded
// stale velocity, and asserts what survives.
// Run: node scripts/gravitos_plant_test.mjs [game-file]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || (process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, FILE).replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof bossAI === 'function' && typeof monsterTypes !== 'undefined' && game.mapData, { timeout: 60000 });

const out = await page.evaluate(() => {
  const t = monsterTypes.gravitos;
  const mk = (state, timer) => ({
    type: 'gravitos', name: t.name, isBoss: true,
    x: 600, y: 200, w: t.w, h: t.h, facing: 1,
    hp: t.hp, maxHp: t.hp, currentHp: t.hp, atk: t.atk, def: t.def,
    vx: 2.5, vy: 1.3,                       // seeded STALE drift — the bug's fuel
    // phase must be pre-stamped: the AI's phase-jump guard treats a missing
    // m.phase as a fresh transition and resets patternState to 'idle', which
    // made the first draft of this test measure the idle drift for every
    // state and report 16 false FAILs against correct code.
    phase: 1,
    patternState: state, patternTimer: timer,
    _soulTimer: 99999, _instaTimer: 99999, _rainTimer: 99999, _warpTimer: 99999,
    _lastSkillAt: 0, _lastOhkoAt: 0,
  });
  player.x = 640; player.y = 400; player.hp = player.maxHp || 1000;
  const res = { attack: {}, idle: {}, zip: {}, slam: {} };

  // 1. every stationary attack pattern must hold him at exactly zero
  for (const s of ['crush', 'laser', 'soulDrain', 'singularity', 'collapseRain',
                   'wave', 'pull', 'blackhole', 'chaseComets', 'crushTendrils',
                   'decayFloor', 'orbitalRing']) {
    const m = mk(s, 600);
    try { bossAI(m, 16.7, 300); } catch (e) { res.attack[s] = 'threw: ' + String(e.message).slice(0, 60); continue; }
    res.attack[s] = { vx: m.vx, vy: m.vy };
  }

  // 2. idle must drift (and engage the walk latch that picks the walk sprite)
  // v0.29.938 added a RECOVERY BEAT: for the first 600 ms of idle after every
  // pattern the drift is bled (vx *= 0.4) so the idle set gets a visible
  // standstill. The drift therefore lives in idle's 600 ms..cycleBase window
  // (1100 ms at phase 1) - pin the timer there, and check the beat separately.
  {
    const m = mk('idle', 700);
    m.vx = 0; m.vy = 0;
    let maxVx = 0, walked = false;
    for (let i = 0; i < 60; i++) {
      try { bossAI(m, 16.7, 300); } catch (e) { res.idle.err = String(e.message).slice(0, 60); break; }
      m.patternTimer = 700;                  // pin inside idle's drift window so the chooser never fires a pattern
      maxVx = Math.max(maxVx, Math.abs(m.vx));
      if (typeof _mobWalking === 'function' && _mobWalking(m)) walked = true;
    }
    res.idle.maxVx = +maxVx.toFixed(2);
    res.idle.walkLatch = walked;
    res.idle.stateStillIdle = m.patternState === 'idle';
    // the recovery beat: a drifting boss that re-enters idle's first 600 ms settles
    for (let i = 0; i < 30; i++) { try { bossAI(m, 16.7, 300); } catch (e) { break; } m.patternTimer = 100; }
    res.idle.beatVx = +Math.abs(m.vx).toFixed(3);
  }

  // 3. zip's dive keeps its velocity (the exception)
  {
    const m = mk('zip', 400);
    m._zipPrep = true; m.vx = 0; m.vy = 0;
    for (let i = 0; i < 10; i++) { try { bossAI(m, 16.7, 300); } catch (e) { res.zip.err = String(e.message).slice(0, 60); break; } m.patternTimer = 400 + i * 16; }
    res.zip.speed = +Math.hypot(m.vx, m.vy).toFixed(2);
  }

  // 4. slam. v0.29.774 (GROUNDED SLAM TELEGRAPH, after v0.29.772 pinned him to
  // the floor) retired the rise (vy=-6) and the plummet: the slam is now a
  // gather at his feet, a LOCK that moves him over the player's column, a warn
  // band, and the stomp. Its motion is the lock's reposition, not velocity, so
  // every window stays planted and the lock must land him on the player.
  {
    const gather = mk('slam', 200);
    try { bossAI(gather, 16.7, 300); } catch (e) { res.slam.err = String(e.message).slice(0, 60); }
    res.slam.gatherVy = gather.vy; res.slam.gatherVx = gather.vx;
    const lock = mk('slam', 460);
    lock.x = 1400;                          // far from the player, so the lock has to move him
    lock._tpWarn = { kind: 'slam', el: 0, ms: 0, x: 0, y: 0, hold: 0, go: true }; lock._tpWindMs = 0;   // the teleport warning has run
    try { bossAI(lock, 16.7, 300); } catch (e) { res.slam.err2 = String(e.message).slice(0, 60); }
    res.slam.lockDx = Math.round((lock.x + lock.w / 2) - (player.x + player.w / 2));
    res.slam.lockVy = lock.vy; res.slam.lockVx = lock.vx; res.slam.lockPrep = !!lock._slamPrep;
    const strike = mk('slam', 700);
    strike._slamPrep = true;
    try { bossAI(strike, 16.7, 300); } catch (e) { res.slam.err3 = String(e.message).slice(0, 60); }
    res.slam.strikeVy = strike.vy; res.slam.strikeVx = strike.vx;
  }
  return res;
});
await browser.close();

let bad = 0;
const check = (c, n, extra) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${!c && extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`); if (!c) bad++; };
console.log('stationary attack patterns (seeded vx=2.5, vy=1.3 — must all read 0,0):');
for (const [s, r] of Object.entries(out.attack)) {
  check(r && r.vx === 0 && r.vy === 0, `${s} plants at exactly zero`, r);
}
console.log('\nidle:');
check(out.idle.maxVx > 0.6, 'idle drift accelerates toward the player', out.idle);
check(out.idle.walkLatch, 'the walk latch engages while drifting (walk sprite plays)', out.idle);
console.log('\nthe two movement attacks keep their motion:');
check(out.zip.speed > 1, 'zip dive still accelerates', out.zip);
check(out.idle.beatVx < 0.2, 'the v0.29.938 recovery beat bleeds the drift in idle\'s first 600 ms', out.idle);
// v0.29.774: no lift, no plummet - the slam is planted and repositions by the lock
check(out.slam.gatherVy === 0 && out.slam.gatherVx === 0, 'slam gather is planted (no rise since v0.29.774)', out.slam);
// inside the stomp's own |dx| < 180 damage check (it lands a few px off centre after the lock's side effects)
check(out.slam.lockPrep && Math.abs(out.slam.lockDx) < 60, 'slam lock repositions him over the player column', out.slam);
check(out.slam.lockVx === 0 && out.slam.lockVy === 0, 'slam lock has NO drift (a reposition, not a glide)', out.slam);
check(out.slam.strikeVy === 0 && out.slam.strikeVx === 0, 'slam warn/strike window is planted', out.slam);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} check(s) failed` : '\nall good — planted while attacking, walking while idle, zip and slam keep their choreography');
process.exit(bad || errs.length ? 1 : 0);
