// Live test: A BOSS SPAWNS AT THE NUMBER WRITTEN IN THE TABLE, EVERY TIME.
//
// Reported from expedition-difficulty testing: four towerArbiter spawns at one level returned
// 17,305 / 18,037 / 17,385 / 17,478 HP while LX_MONSTER_STATS.towerArbiter.hp sat at 17,199.
// The cause was LX_MONSTER_JITTER, a +/-5% per-spawn roll whose documented purpose is "so a pack
// is not clones" - applied to bosses because _lxApplyStatTable took an isBoss flag and never
// read it.
//
// What this pins, and why each half matters:
//   BOSSES    repeated spawns are byte-identical AND equal to the authored row. Identical alone
//             would pass if the jitter were merely seeded; equal-to-the-table is the real claim.
//   MOBS      still roll. The fix must not flatten the roster into clones, which is the thing
//             the jitter exists to prevent - so this asserts mobs DO vary, which is the check
//             that would catch an over-broad fix.
//   PAYOUT    LX_REWARD_JITTER still varies boss exp/coin. Left deliberately: a payout that
//             varies does not change how a fight goes.
//   node scripts/boss_stat_determinism_test.mjs      (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    const c = document.querySelector('.cls-card'); if (c) c.click();
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i >= n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {}
  await frames(20);
  player.level = 60;
  game.expedition = { active: false, floor: 0 };
  const rows = (type, isBoss, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      game.monsters = [];
      const m = spawnMonster(600, 380, type, isBoss, false);
      if (m) out.push({ hp: m.maxHp, atk: m.atk, def: m.def, exp: m.exp, coin: m.mojicoins,
                        elite: !!m.isElite, mini: !!m.isMiniBoss });
    }
    game.monsters = [];
    return out;
  };
  const out = { table: {} };
  for (const k of ['towerArbiter', 'towerSovereign', 'king', 'snail', 'slime']) {
    out.table[k] = LX_MONSTER_STATS[k] ? { hp: LX_MONSTER_STATS[k].hp, atk: LX_MONSTER_STATS[k].atk, def: LX_MONSTER_STATS[k].def } : null;
  }
  out.jitter = (typeof LX_MONSTER_JITTER === 'number') ? LX_MONSTER_JITTER : null;
  out.rewardJitter = (typeof LX_REWARD_JITTER === 'number') ? LX_REWARD_JITTER : null;
  out.arbiter = rows('towerArbiter', true, 6);
  out.sovereign = rows('towerSovereign', true, 6);
  out.king = rows('king', true, 6);
  // mobs: spawn plenty and drop elite/elder promotions, whose variant multipliers are a
  // different mechanism and would muddy "did the jitter roll?"
  out.snail = rows('snail', false, 24).filter((r) => !r.elite && !r.mini);
  return out;
});

const uniq = (rows, k) => [...new Set(rows.map((r) => r[k]))];
for (const [name, key] of [['the B5 Arbiter', 'arbiter'], ['the B10 Sovereign', 'sovereign'], ['King Krook', 'king']]) {
  const rows = R[key], t = R.table[key === 'arbiter' ? 'towerArbiter' : key === 'sovereign' ? 'towerSovereign' : 'king'];
  ok(`${name} spawns the same statline every time`,
    rows.length >= 6 && uniq(rows, 'hp').length === 1 && uniq(rows, 'atk').length === 1 && uniq(rows, 'def').length === 1,
    `hp ${uniq(rows, 'hp').join('/')} · atk ${uniq(rows, 'atk').join('/')} · def ${uniq(rows, 'def').join('/')} over ${rows.length} spawns`);
  ok(`...and it is exactly the number written in the table`,
    !!t && rows[0] && rows[0].hp === t.hp && rows[0].atk === t.atk && rows[0].def === t.def,
    t ? `spawned ${rows[0] && rows[0].hp}/${rows[0] && rows[0].atk}/${rows[0] && rows[0].def} vs table ${t.hp}/${t.atk}/${t.def}` : 'no table row');
}
ok('the jitter is still switched on, so the boss result is an exemption and not a global zero',
  R.jitter > 0, `LX_MONSTER_JITTER = ${R.jitter}`);
ok('MOBS still roll, so the fix did not flatten the roster into clones',
  R.snail.length >= 8 && uniq(R.snail, 'hp').length > 1,
  `${uniq(R.snail, 'hp').length} distinct HP over ${R.snail.length} plain snails (table ${R.table.snail && R.table.snail.hp})`);
ok('a boss payout still varies - the reward roll was deliberately left alone',
  R.rewardJitter > 0 && uniq(R.arbiter, 'exp').length > 1,
  `LX_REWARD_JITTER = ${R.rewardJitter}, ${uniq(R.arbiter, 'exp').length} distinct exp values over ${R.arbiter.length} spawns`);
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
