// CLOCKWORK SPIRE REACHABILITY — regression guard.
// ============================================================================
// Reported as "3rd piece of the puzzle platform is fake. if I try to jump on it
// I fall right through". The platform is solid — every one of the 40 holds a
// clean drop — but it sat behind a 177 px horizontal crossing, and the player
// cannot jump that far while also gaining a floor. A jump that falls short
// reaches the ledge's x-range while still BELOW its top surface, and the
// landing test only resolves from above (prevBottom <= p.y + 2), so the player
// passes straight through: indistinguishable from a fake platform.
//
// This does NOT hardcode a jump distance. It MEASURES the reach from the live
// engine (holding the jump key, because the engine cuts vy on release for
// variable jump height — a short-hop measures ~22 px and proves nothing), then
// asserts the generated level respects it. So if jump physics or map gravity
// ever change, the test re-derives the budget instead of going stale.
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
  loadMap('clockworkSpire', 300);
  await new Promise(r => setTimeout(r, 1600));
  game.paused = false;

  const live = (game.mapData.platforms || []).slice();
  const climb = live.filter(p => p.type !== 'ground').slice().sort((a, b) => b.y - a.y);

  // ---- 1. drop test: is every platform actually solid? --------------------
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

  // ---- 2. measure the real jump reach on a flat slab ----------------------
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

  // ---- 3. every crossing must be within that reach ------------------------
  const gaps = [];
  for (let n = 1; n < climb.length; n++) {
    const p = climb[n], q = climb[n - 1];
    gaps.push({ n, y: p.y,
      dx: (p.x > q.x + q.w) ? p.x - (q.x + q.w) : (q.x > p.x + p.w) ? q.x - (p.x + p.w) : 0 });
  }
  const pieceYs = MAPS.clockworkSpire._pqChestPieces.map(c => c.y + 28);
  return {
    total: climb.length, solid, reachSingle, reachAir,
    maxGap: Math.max(...gaps.map(g => g.dx)),
    overReach: gaps.filter(g => g.dx > reachAir).map(g => ({ y: g.y, dx: g.dx })),
    pieceGaps: pieceYs.map((y, i) => {
      const g = gaps.find(o => o.y === y);
      return { piece: i + 1, y, dx: g ? g.dx : 0 };
    }),
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 110) });
ok('every climbing platform is solid', R.solid === R.total, `${R.solid}/${R.total}`);
ok('measured jump reach is sane (not a short-hop)', R.reachAir > 60, `single=${R.reachSingle} air=${R.reachAir}`);
ok('no crossing exceeds the measured air-jump reach', R.overReach.length === 0,
   R.overReach.length ? `${R.overReach.length} over: ` + R.overReach.map(o => `y${o.y}:${o.dx}px`).join(' ') : `maxGap=${R.maxGap}`);
for (const p of R.pieceGaps) {
  ok(`puzzle piece #${p.piece} is reachable`, p.dx <= R.reachAir, `gap=${p.dx}px vs reach=${R.reachAir}px`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
