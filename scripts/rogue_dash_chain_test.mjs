// ROGUE TRIPLE-TAP DASH CHAIN - behaviour + "is it broken" bounds.
// =============================================================================
// Drives REAL KeyboardEvents through the game's own keydown handler, so the tap
// window, the class gate and the re-fire gate are all exercised as shipped.
//   1. CHAINS      a 3rd tap during an in-flight dash chains one extra dash
//   2. ROGUE ONLY  no other class chains
//   3. BOUNDED     one chain per sequence, same direction, lockout enforced
//   4. NOT BROKEN  no i-frames, and sustained traversal barely moves
// Run: node scripts/rogue_dash_chain_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9116;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog','area-title']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const tap = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  const reset = (cls) => {
    player.cls = cls; player.hp = 999; player.hitStun = 0; player.rushTimer = 0;
    player.quickDashTimer = 0; player.vx = 0; player.vy = 0;
    player.lastTapKey = null; player.lastTapTime = 0;
    player._dashTapKey = null; player._dashTapTime = 0;
    player._dashChained = 0; player._dashIsChain = 0; player._dashChainAt = 0;
    player.x = 600; player.y = 300;
    game.paused = false;
  };

  // -- 1. the chain fires ---------------------------------------------------
  reset('rogue');
  tap('ArrowRight'); await sleep(60); tap('ArrowRight');       // double-tap -> dash
  const dashedT = player.quickDashTimer;
  ok('double-tap still starts a dash', dashedT > 0, `quickDashTimer ${dashedT.toFixed(0)}`);
  await sleep(60); tap('ArrowRight');                          // third tap, mid-dash
  ok('a third tap chains the dash', (player._dashIsChain | 0) === 1, `_dashIsChain ${player._dashIsChain | 0}`);
  ok('the chain re-arms the dash window', player.quickDashTimer > 150, `${player.quickDashTimer.toFixed(0)} ms`);
  // -- 2. only ONE chain per sequence --------------------------------------
  // The dash timer only decays inside the update loop, which is not running
  // here, so "did the 4th tap re-chain?" cannot be read from the timer alone.
  // Park it on a sentinel: a chain would overwrite it with ROGUE_CHAIN_MS.
  player.quickDashTimer = 123;
  player._dashTapKey = 'arrowright'; player._dashTapTime = performance.now();
  await sleep(40); tap('ArrowRight');
  ok('a fourth tap does not chain again',
     (player._dashChained | 0) === 1 && Math.round(player.quickDashTimer) === 123,
     `chained ${player._dashChained | 0}, timer ${player.quickDashTimer.toFixed(0)} (sentinel 123)`);

  // -- 3. lockout ----------------------------------------------------------
  reset('rogue'); player._dashChainAt = performance.now();     // pretend we just chained
  tap('ArrowRight'); await sleep(60); tap('ArrowRight');
  await sleep(60); tap('ArrowRight');
  ok('a fresh chain is refused during the lockout', (player._dashIsChain | 0) === 0,
     `_dashIsChain ${player._dashIsChain | 0}`);

  // -- 4. same direction only ----------------------------------------------
  reset('rogue');
  tap('ArrowRight'); await sleep(60); tap('ArrowRight');
  await sleep(60); tap('ArrowLeft');                            // opposite arrow
  ok('the chain will not reverse direction', (player._dashIsChain | 0) === 0,
     `_dashIsChain ${player._dashIsChain | 0}`);

  // -- 5. rogue only -------------------------------------------------------
  for (const cls of ['warrior', 'archer']) {
    reset(cls);
    tap('ArrowRight'); await sleep(60); tap('ArrowRight');
    await sleep(60); tap('ArrowRight');
    ok(`${cls} does not get the chain`, (player._dashIsChain | 0) === 0, `_dashIsChain ${player._dashIsChain | 0}`);
  }

  // -- 6. no i-frames ------------------------------------------------------
  reset('rogue'); player.invulnerable = 0;
  tap('ArrowRight'); await sleep(60); tap('ArrowRight');
  await sleep(60); tap('ArrowRight');
  ok('chaining grants no invulnerability', (player.invulnerable | 0) <= 0, `invulnerable ${player.invulnerable | 0}`);

  // -- 7. THE BOUND: sustained traversal ------------------------------------
  // Integrate the dash sustain the same way updatePlayer does, over a fixed
  // wall-clock budget, spamming as fast as each mode allows. The chain must
  // buy burst continuity, not throughput.
  const travel = (useChain) => {
    let x = 0, vx = 0, t = 0, timer = 0, isChain = 0, chained = 0, lastChainAt = -1e9;
    const dt = 16.667, BUDGET = 3000;
    let sinceTap = 0;
    while (t < BUDGET) {
      if (timer <= 0) {                       // re-fire a fresh dash as soon as allowed
        timer = 240; isChain = 0; chained = 0; vx = 14; sinceTap = 0;
      } else if (useChain && !chained && sinceTap > 60 && (t - lastChainAt) > 900) {
        timer = 200; isChain = 1; chained = 1; lastChainAt = t; vx = 14;
      }
      const mul = isChain ? 1.15 : 1;
      vx = Math.max(9 * mul, Math.abs(vx) * 0.93);
      x += vx; timer -= dt; t += dt; sinceTap += dt;
    }
    return x;
  };
  const base = travel(false), chain = travel(true);
  const gain = chain / base;
  ok('the chain does not raise sustained traversal much (model)', gain < 1.15,
     `${gain.toFixed(3)}x over 3 s (${base.toFixed(0)} -> ${chain.toFixed(0)} px)`);

  // The model above is only as good as its copy of the sustain rule, so read
  // the REAL multiplier back out of the game: run one update frame in each
  // mode from an identical state and compare the vx the engine settles on.
  if (typeof updatePlayer === 'function') {
    const sustain = (isChain) => {
      reset('rogue');
      player.quickDashTimer = 200; player.quickDashDir = 1; player.vx = 1;
      player._dashIsChain = isChain;
      try { updatePlayer(16.667); } catch (e) {}
      return Math.abs(player.vx);
    };
    const vBase = sustain(0), vChain = sustain(1);
    const realMul = vBase > 0 ? vChain / vBase : 0;
    ok('the engine applies the chain sustain we configured, and only that',
       realMul > 1.05 && realMul < 1.25, `measured ${realMul.toFixed(3)}x (vx ${vBase.toFixed(2)} -> ${vChain.toFixed(2)})`);
  } else {
    ok('updatePlayer reachable for a real sustain measurement', false, 'not a global');
  }

  // -- 8. the chain is shorter than the base dash --------------------------
  ok('the chain window is shorter than a base dash',
     typeof ROGUE_CHAIN_MS === 'number' && ROGUE_CHAIN_MS < 240, `${typeof ROGUE_CHAIN_MS === 'number' ? ROGUE_CHAIN_MS : '?'} ms`);
  ok('a lockout is configured', typeof ROGUE_CHAIN_LOCKOUT === 'number' && ROGUE_CHAIN_LOCKOUT >= 600,
     `${typeof ROGUE_CHAIN_LOCKOUT === 'number' ? ROGUE_CHAIN_LOCKOUT : '?'} ms`);

  return res;
});

let pass = 0, failed = 0;
for (const r of R) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
