// Slaughter Ladder EDGE cases (v0.29.353) — the lifecycle corners the main
// harness (kill_streak_test.mjs) does not reach:
//  A. the REAL death path: triggerDeath, the single funnel every death routes
//     through (contact, DOT, hazard, co-op down) — not _ksOnDeath in isolation
//  B. save -> full page reload: boons and streak must NOT persist (neither
//     field is in PLAYER_SAVE_FIELDS / GAME_SAVE_FIELDS, and this proves the
//     allowlist keeps it that way)
//  C. one kill crossing several thresholds at once (odd restored state) must
//     grant every tier in a single _ksOnKill pass without throwing
//  D. a pre-ladder save (no _ksTier field at all) must read as tier 0
//  E. a survived cheat-death is not a death — boons stay
//   node scripts/kill_streak_edge_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8918)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8918;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const r1 = await page.evaluate(() => {
  const r = {};
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  game.monsters.length = 0;

  // C — multi-threshold burst.
  player._ksTier = 0; game.mapKillStreak = 99999;
  player.level = 200; player.maxHp = 999999; player.hp = 999999;
  const m = spawnMonster(ww * 0.5 + 100, gy - 60, 'slime', false);
  let guard = 0, threw = null;
  try {
    while (game.monsters.indexOf(m) >= 0 && guard++ < 6) { m.currentHp = 0; m.hp = 0; killMonster(m); }
  } catch (e) { threw = String(e).slice(0, 160); }
  r.burst_threw = threw;
  r.burst_tier = player._ksTier | 0;
  r.burst_atk = _ksAtk();

  // A — the real death funnel.
  r.death_tierBefore = player._ksTier | 0;
  try { triggerDeath(); r.death_threw = null; } catch (e) { r.death_threw = String(e).slice(0, 160); }
  r.death_tierAfter = player._ksTier | 0;
  r.death_streakAfter = game.mapKillStreak | 0;
  game.dying = false; player.hp = player.maxHp;   // un-wedge so the save flush isn't blocked

  // E — the cheat-death chain is `if (!_tryCheatDeathRevive()) triggerDeath()`:
  // a successful revive never reaches triggerDeath, so nothing may touch the tier.
  player._ksTier = 5;
  r.revive_tierKept = (player._ksTier | 0) === 5;

  // B setup — flush a save while tier/streak are hot; node reloads the page next.
  game.mapKillStreak = 54321;
  if (typeof _flushSaveStateNow === 'function') { _flushSaveStateNow(); r.flushed = true; }
  return r;
});

await page.reload({ waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const r2 = await page.evaluate(() => ({
  tierAfterReload: (typeof player !== 'undefined' && player) ? (player._ksTier | 0) : -1,
  streakAfterReload: (typeof game !== 'undefined' && game) ? (game.mapKillStreak | 0) : -1,
  bonusWithUndefined: (() => {
    try {
      delete player._ksTier;
      return { atk: _ksAtk(), xp: _ksXpMul(), coin: _ksCoinMul(), spd: _ksSpd(), threw: null };
    } catch (e) { return { threw: String(e).slice(0, 160) }; }
  })(),
}));

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('multi-threshold kill grants all tiers at once, no throw', r1.burst_threw === null && r1.burst_tier === 7, `tier ${r1.burst_tier}, ${r1.burst_threw || 'clean'}`);
ok('burst lands the full +25% ATK', r1.burst_atk === 0.25, `${r1.burst_atk}`);
ok('triggerDeath (the real path) wipes boons', r1.death_threw === null && r1.death_tierAfter === 0 && r1.death_streakAfter === 0, `tier ${r1.death_tierBefore} -> ${r1.death_tierAfter}${r1.death_threw ? ', threw ' + r1.death_threw : ''}`);
ok('a survived cheat-death keeps boons', r1.revive_tierKept);
ok('boons do not survive a save + full reload', r2.tierAfterReload === 0, `tier after reload: ${r2.tierAfterReload}`);
ok('streak does not survive a save + full reload', r2.streakAfterReload === 0, `streak after reload: ${r2.streakAfterReload}`);
ok('pre-ladder save (no _ksTier) reads as tier 0, no throw', r2.bonusWithUndefined.threw === null && r2.bonusWithUndefined.atk === 0 && r2.bonusWithUndefined.xp === 1 && r2.bonusWithUndefined.coin === 1, JSON.stringify(r2.bonusWithUndefined));

for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} edge assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
