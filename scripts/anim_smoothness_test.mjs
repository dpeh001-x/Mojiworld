// ANIM SMOOTHNESS TEST — pins the v0.29.416 monster-animation behaviours in
// the live game:
//   1. TRANSITION  entering a state starts its cycle at frame 0 (the attack
//                  windup actually plays; walk starts on its first stride) —
//                  previously the global wall clock landed on a random frame.
//   2. HYSTERESIS  _mobWalking latches: vx oscillating in the 0.35–0.6 band
//                  no longer flips walk↔idle every few frames.
//   3. DESYNC      two idle mobs with different seeds show different frames —
//                  packs no longer animate in lockstep.
//   4. LEGACY      the boss getters without `m` still work (probe call sites).
// Run: node scripts/anim_smoothness_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mobWalking === 'function' && typeof _mobAnimPhase === 'function' && typeof _bossLoopFrame === 'function', { timeout: 60000 });

const out = await page.evaluate(() => {
  const R = [];
  const ok = (name, cond, detail) => R.push({ name, pass: !!cond, detail: detail || '' });
  // duck-typed decoded frames (the readiness probe checks complete+naturalWidth;
  // tiny naturalWidth keeps _lxShrinkFrames from trying to bake them)
  const mkFrames = (n) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ complete: true, naturalWidth: 8, naturalHeight: 8, _i: i });
    return a;
  };

  // 1 — TRANSITION: a fresh state must begin at frame 0, and advance in order.
  {
    const frames = mkFrames(9);
    const m = {};
    const f0 = _bossLoopFrame(frames, 48, 480, _mobAnimPhase(m, 'attack', false));
    ok('attack enters at frame 0', f0 && f0._i === 0, 'got frame ' + (f0 && f0._i));
    // rewind the epoch 100ms to simulate 100ms elapsing (2 × 48ms → frame 2)
    m._animStAt -= 100;
    const f2 = _bossLoopFrame(frames, 48, 480, _mobAnimPhase(m, 'attack', false));
    ok('advances in order (100ms → frame 2)', f2 && f2._i === 2, 'got frame ' + (f2 && f2._i));
    // change state → epoch restamps → frame 0 again
    const g0 = _bossLoopFrame(frames, 80, 480, _mobAnimPhase(m, 'walk', false));
    ok('state change restarts at frame 0', g0 && g0._i === 0, 'got frame ' + (g0 && g0._i));
  }

  // 2 — HYSTERESIS: vx oscillating 0.55↔0.65 (the band) must not flip states.
  {
    const m = { vx: 0, _animXV: 0 };
    let flips = 0, prev = _mobWalking(m);
    for (let i = 0; i < 120; i++) {
      m.vx = (i % 2) ? 0.65 : 0.55;          // crosses the old 0.6 gate every frame
      const w = _mobWalking(m);
      if (w !== prev) flips++;
      prev = w;
    }
    ok('band oscillation causes ≤1 flip (was ~120)', flips <= 1, flips + ' flips');
    m.vx = 0.1; m._animXV = 0;               // clearly stopped → must release
    ok('release below the low gate', _mobWalking(m) === false);
    m.vx = 0.7;                               // clearly moving → must latch
    ok('latch above the high gate', _mobWalking(m) === true);
  }

  // 3 — DESYNC: same instant, different seeds → different idle frames.
  {
    const frames = mkFrames(9);
    const a = {}, b = {};
    _mobAnimPhase(a, 'idle', true); _mobAnimPhase(b, 'idle', true);
    a._animSeed = 0; b._animSeed = 400;       // fix seeds: 400ms ≈ 3 idle frames apart
    a._animStAt = b._animStAt = performance.now() - 5000;   // both mid-cycle
    const fa = _bossPingPongFrame(frames, 130, 480, _mobAnimPhase(a, 'idle', true));
    const fb = _bossPingPongFrame(frames, 130, 480, _mobAnimPhase(b, 'idle', true));
    ok('seeded mobs show different idle frames', fa && fb && fa._i !== fb._i, `a=${fa && fa._i} b=${fb && fb._i}`);
  }

  // 4 — LEGACY: getters without m must not throw and must not touch state.
  {
    let threw = null;
    try { _bossIdleFrame('king'); _bossWalkFrame('king'); _bossAttackFrame('king'); } catch (e) { threw = e.message; }
    ok('boss getters without m still work', !threw, threw || '');
  }
  return R;
});
await browser.close();

let bad = 0;
for (const r of out) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`); }
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(`${out.length - bad}/${out.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
