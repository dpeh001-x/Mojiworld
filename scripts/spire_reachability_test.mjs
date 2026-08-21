// CLOCKWORK SPIRE — layout stability, reachability and RNG-variance guard.
// ============================================================================
// Two user reports, one map:
//   1. "3rd piece of the puzzle platform is fake. if I try to jump on it I
//      fall right through."  -> the platform was solid but 177 px away, past
//      the player's reach. A jump that falls short still enters the ledge's
//      x-range while BELOW its top, and the landing test only resolves from
//      above (prevBottom <= p.y + 2), so the player passes through it.
//   2. "ensure that the platform are fixed, also prevent crazy RNG for making
//      the floors hard to reach or varying too widely."
//
// This does NOT hardcode a jump distance. It MEASURES the reach from the live
// engine (holding the jump key — the engine cuts vy on release for variable
// jump height, so a short-hop measures ~22 px and proves nothing), then asserts
// the generated level respects it. If jump physics or map gravity ever change,
// the budget re-derives instead of going stale.
// Run: node scripts/spire_reachability_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9306;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'SpireTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 60; player._god = true;
  const sig = () => (game.mapData.platforms || [])
    .map(p => `${p.x},${p.y},${p.w},${p.h},${p.type}`).join('|');

  // ---- LAYOUT STABILITY: same geometry on every entry ---------------------
  const sigs = [];
  for (let n = 0; n < 3; n++) {
    loadMap('clockworkSpire', 300);
    await new Promise(r => setTimeout(r, 900));
    sigs.push(sig());
    loadMap('forest', 300);                 // leave and come back
    await new Promise(r => setTimeout(r, 500));
  }
  loadMap('clockworkSpire', 300);
  await new Promise(r => setTimeout(r, 1400));
  game.paused = false;
  const stable = sigs.every(s => s === sigs[0]);

  // The authored source array must not be mutated by loading, and the
  // per-load jitter pass must not touch this map (isVerticalTower skips it).
  const authored = MAPS.clockworkSpire.platforms
    .map(p => `${p.x},${p.y},${p.w},${p.h},${p.type}`).join('|');
  const varied = _variedMapData('clockworkSpire').platforms
    .map(p => `${p.x},${p.y},${p.w},${p.h},${p.type}`).join('|');
  const unjittered = varied === authored;

  const live = (game.mapData.platforms || []).slice();
  const climb = live.filter(p => p.type !== 'ground').slice().sort((a, b) => b.y - a.y);

  // ---- every platform must actually be solid ------------------------------
  let solid = 0;
  for (const p of climb) {
    player.x = p.x + p.w / 2 - player.w / 2;
    player.y = p.y - player.h - 30;
    player.vy = 0; player.vx = 0; player.onGround = false;
    player.dropThrough = false; player.dropTimer = 0; player.hp = getMaxHp();
    for (let f = 0; f < 90; f++) {
      game.time += 16.667; updatePlayer(16.667);
      if (player.onGround) break;
    }
    if (player.onGround && Math.abs((player.y + player.h) - p.y) < 3) solid++;
  }

  // ---- measure the real jump reach on a flat slab --------------------------
  const savedPlats = game.mapData.platforms;
  const Y = 3000;
  game.mapData.platforms = [{ x: -4000, y: Y, w: 9000, h: 20, type: 'platform' }];
  game.hazards = []; game.monsters = [];
  const reach = (airJump) => {
    player.x = 0; player.y = Y - player.h;
    player.vx = 0; player.vy = 0; player.onGround = true;
    player.airJumps = 0; player.doubleJumpUsed = false;
    game.keys = game.keys || {};
    for (const k in game.keys) game.keys[k] = false;
    game.keys['arrowright'] = true;
    for (let f = 0; f < 60; f++) { game.time += 16.667; updatePlayer(16.667); }
    const x0 = player.x, y0 = player.y;
    game.keys[' '] = true; player._jumpHeld = true;   // HOLD: release cuts vy
    player.vy = -getJump(); player.onGround = false;
    let best = 0, used = false;
    for (let f = 0; f < 200; f++) {
      game.time += 16.667;
      if (player.vy > 0) game.keys[' '] = false;
      if (airJump && !used && player.vy > 0) { player.vy = -getJump() * 0.92; player.airJumps = 1; used = true; }
      updatePlayer(16.667);
      if (y0 - player.y >= 80) best = Math.max(best, player.x - x0);   // one floor up
      if (player.onGround && f > 3) break;
    }
    for (const k in game.keys) game.keys[k] = false;
    return Math.round(best) - player.w;
  };
  const reachSingle = reach(false), reachAir = reach(true);
  game.mapData.platforms = savedPlats;

  // ---- crossing geometry ---------------------------------------------------
  const gaps = [], steps = [];
  for (let n = 1; n < climb.length; n++) {
    const p = climb[n], q = climb[n - 1];
    gaps.push({ n, y: p.y,
      dx: (p.x > q.x + q.w) ? p.x - (q.x + q.w) : (q.x > p.x + p.w) ? q.x - (p.x + p.w) : 0 });
    steps.push(Math.abs((p.x + p.w / 2) - (q.x + q.w / 2)));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
  const dxs = gaps.map(g => g.dx);
  const pieceYs = MAPS.clockworkSpire._pqChestPieces.map(c => c.y + 28);
  return {
    total: climb.length, solid, reachSingle, reachAir, stable, unjittered,
    maxGap: Math.max(...dxs), gapSd: +sd(dxs).toFixed(1), stepSd: +sd(steps).toFixed(1),
    overReach: gaps.filter(g => g.dx > reachAir).map(g => ({ y: g.y, dx: g.dx })),
    pieceGaps: pieceYs.map((y, i) => {
      const g = gaps.find(o => o.y === y);
      return { piece: i + 1, y, dx: g ? g.dx : 0 };
    }),
  };
});
await browser.close(); server.kill();

// Budgets. The map builds to SP_GAP_MAX = 80; these guard the *properties*
// that matter so a future generator change cannot quietly re-widen the climb.
const GAP_BUDGET = 80;     // no crossing wider than the authored budget
const GAP_SD_MAX = 25;     // crossings stay consistent (pre-fix: 44)
const STEP_SD_MAX = 60;    // floors don't swing across the tower (pre-fix: 115)

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 115) });

ok('layout is FIXED across repeated entries', R.stable);
ok('per-load jitter never touches this map', R.unjittered);
ok('every climbing platform is solid', R.solid === R.total, `${R.solid}/${R.total}`);
ok('measured jump reach is sane (not a short-hop)', R.reachAir > 60, `single=${R.reachSingle} air=${R.reachAir}`);
ok('no crossing exceeds the measured air-jump reach', R.overReach.length === 0,
   R.overReach.length ? `${R.overReach.length} over: ` + R.overReach.map(o => `y${o.y}:${o.dx}px`).join(' ') : `maxGap=${R.maxGap}`);
ok('no crossing exceeds the authored gap budget', R.maxGap <= GAP_BUDGET, `maxGap=${R.maxGap} budget=${GAP_BUDGET}`);
ok('crossing widths stay consistent', R.gapSd <= GAP_SD_MAX, `gap sd=${R.gapSd} max=${GAP_SD_MAX}`);
ok('floors do not swing across the tower', R.stepSd <= STEP_SD_MAX, `centre-step sd=${R.stepSd} max=${STEP_SD_MAX}`);
for (const p of R.pieceGaps) {
  ok(`puzzle piece #${p.piece} is reachable`, p.dx <= R.reachAir, `gap=${p.dx}px vs reach=${R.reachAir}px`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
