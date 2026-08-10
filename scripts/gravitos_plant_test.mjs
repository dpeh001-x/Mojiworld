// GRAVITOS PLANTS DURING ATTACKS (v0.29.548).
//
// The hover-drift block in his AI used to run in EVERY pattern, so the boss
// glided sideways and bobbed while his attack sprites played (per user). It
// now runs only in 'idle' — where the renderer plays the walk loop — and every
// other pattern re-zeroes velocity each frame, EXCEPT:
//   • 'zip' — the comet dive IS the attack; its handler owns velocity.
//   • 'slam' — its lift/plummet writes vy every frame AFTER the plant, so the
//     handler wins its windows; the plant only kills the between-window drift.
// This drives bossAI directly (the function that owns the plant) with seeded
// stale velocity, and asserts what survives.
// Run: node scripts/gravitos_plant_test.mjs [game-file]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || 'mojiworld_game.html';
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
  {
    const m = mk('idle', 100);
    m.vx = 0; m.vy = 0;
    let maxVx = 0, walked = false;
    for (let i = 0; i < 60; i++) {
      try { bossAI(m, 16.7, 300); } catch (e) { res.idle.err = String(e.message).slice(0, 60); break; }
      m.patternTimer = 100;                  // pin inside idle so the chooser never fires a pattern
      maxVx = Math.max(maxVx, Math.abs(m.vx));
      if (typeof _mobWalking === 'function' && _mobWalking(m)) walked = true;
    }
    res.idle.maxVx = +maxVx.toFixed(2);
    res.idle.walkLatch = walked;
    res.idle.stateStillIdle = m.patternState === 'idle';
  }

  // 3. zip's dive keeps its velocity (the exception)
  {
    const m = mk('zip', 400);
    m._zipPrep = true; m.vx = 0; m.vy = 0;
    for (let i = 0; i < 10; i++) { try { bossAI(m, 16.7, 300); } catch (e) { res.zip.err = String(e.message).slice(0, 60); break; } m.patternTimer = 400 + i * 16; }
    res.zip.speed = +Math.hypot(m.vx, m.vy).toFixed(2);
  }

  // 4. slam: lift window keeps its handler-written vy; the reposition gap is planted
  {
    const lift = mk('slam', 200);
    try { bossAI(lift, 16.7, 300); } catch (e) { res.slam.err = String(e.message).slice(0, 60); }
    res.slam.liftVy = lift.vy;
    res.slam.liftVx = lift.vx;
    const gap = mk('slam', 460);
    gap._slamPrep = true;
    try { bossAI(gap, 16.7, 300); } catch (e) { res.slam.err2 = String(e.message).slice(0, 60); }
    res.slam.gapVy = gap.vy; res.slam.gapVx = gap.vx;
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
check(out.slam.liftVy === -6, 'slam lift still writes vy=-6 (handler wins after the plant)', out.slam);
check(out.slam.liftVx === 0, 'slam lift has NO horizontal drift', out.slam);
// timer 460 with prep done falls straight through slam's else-if chain to the
// plummet branch (vy = 16·√gravMul) — there IS no planted hover window in slam,
// so the right assertion is: dive speed intact, horizontal drift dead.
check(out.slam.gapVy >= 16 && out.slam.gapVx === 0, 'slam plummet keeps its dive with zero horizontal drift', out.slam);
console.log(errs.length ? '\npage errors: ' + errs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} check(s) failed` : '\nall good — planted while attacking, walking while idle, zip and slam keep their choreography');
process.exit(bad || errs.length ? 1 : 0);
