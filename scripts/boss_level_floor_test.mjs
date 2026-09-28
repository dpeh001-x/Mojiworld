// Boss level floor (RETIRED v0.29.762 - see the note above the probe): an outleveled boss scaled up so it could not be one-shot,
// early bosses (< Lv 40) stay EASY (half rate, half ceiling), at-level fights
// are untouched, and rewards scale with the fight so it is farm-neutral.
//
//   node serve.js 8892 && node scripts/boss_level_floor_test.mjs 8892 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const PORT = process.argv[2] || process.env.PORT || '8892';
const PAGE = process.argv[3] || FILE;
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('spawnMonster') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

// v0.29.762 (644fe6fa, per user "remove all modifiers"): data/monster_stats.js
// became the single source of truth and _lxApplyStatTable runs LAST in
// spawnMonster, so the v0.29.536/538 level floor and early-boss ease no longer
// reach a boss's stats (they still compute, and are then overwritten). The
// protected promise is now the table's own: "Edit a number, reload, and that
// is exactly what you fight" - at ANY player level, with no hidden floor, and
// bosses exempt from the stat jitter (v0.30.490). This pins that contract.
const r = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  const S = eval('LX_MONSTER_STATS');
  const RJ = (typeof LX_REWARD_JITTER === 'number') ? LX_REWARD_JITTER : 0;
  const MJ = (typeof LX_MONSTER_JITTER === 'number') ? LX_MONSTER_JITTER : 0;
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  const spawnAt = (lvl, type, boss = true) => {
    p.cls = p.cls || 'warrior'; p.level = lvl;
    g.monsters = [];
    eval('spawnMonster')(800, 400, type, boss, false);
    const m = g.monsters[0];
    return m ? { maxHp: m.maxHp, atk: m.atk, exp: m.exp, coins: m.mojicoins } : null;
  };
  const row = (type) => S[type] && { hp: S[type].hp, atk: S[type].atk, exp: S[type].exp, coin: S[type].coin };
  const out = { RJ, MJ, rows: {} };
  for (const t of ['king', 'mooma', 'kingKrook', 'mirrorSelf', 'towerArbiter', 'snail']) out.rows[t] = row(t);
  out.king10   = spawnAt(10, 'king');      // at-level
  out.king86   = spawnAt(86, 'king');      // the old floor case
  out.king200  = spawnAt(200, 'king');     // prestige
  out.mooma16  = spawnAt(16, 'mooma');
  out.krook86  = spawnAt(86, 'kingKrook');
  out.krook50  = spawnAt(50, 'kingKrook');
  out.mirror86 = spawnAt(86, 'mirrorSelf');
  g.tower = { floor: 5 };
  out.towerBoss = spawnAt(86, 'towerArbiter');
  g.tower = null;
  // the boot map is a sanctuary, where spawnMonster suppresses non-boss spawns - use a field map
  try { eval('loadMap')('forest'); } catch (e) {}
  out.snail86 = spawnAt(86, 'snail', false);
  return out;
});

const R = r.rows;
const exact = (m, t) => !!m && !!t && m.maxHp === t.hp && m.atk === t.atk;
const payOk = (m, t) => !!m && !!t && Math.abs(m.exp - t.exp) <= Math.ceil(t.exp * r.RJ) + 1 && Math.abs(m.coins - t.coin) <= Math.ceil(t.coin * r.RJ) + 1;
ok('the stat table is loaded and holds the bosses under test', R.king && R.mooma && R.kingKrook && R.mirrorSelf && R.towerArbiter && R.snail, R);
ok('at-level Gloopaloo spawns EXACTLY his table HP/ATK (no hidden ease)', exact(r.king10, R.king), { got: r.king10, table: R.king });
ok('Lv 86 vs Gloopaloo: the same table numbers - no hidden level floor', exact(r.king86, R.king), { got: r.king86, table: R.king });
ok('Lv 200 prestige: still the table numbers', exact(r.king200, R.king), { got: r.king200, table: R.king });
ok('Mooma at Lv 16 spawns her table row', exact(r.mooma16, R.mooma), { got: r.mooma16, table: R.mooma });
ok('a Lv-50 boss is the table at level and overleveled alike (Krook 50 / 86)', exact(r.krook50, R.kingKrook) && exact(r.krook86, R.kingKrook), { at50: r.krook50, at86: r.krook86, table: R.kingKrook });
ok('the scripted Mirror fight is its table row', exact(r.mirror86, R.mirrorSelf), { got: r.mirror86, table: R.mirrorSelf });
ok('a tower boss spawns its table row (per-floor scaling lives in the expedition spawner)', exact(r.towerBoss, R.towerArbiter), { got: r.towerBoss, table: R.towerArbiter });
ok('boss rewards are the table pay within the reward jitter, at any level', payOk(r.king10, R.king) && payOk(r.king86, R.king) && payOk(r.krook86, R.kingKrook), { k10: r.king10, k86: r.king86, table: R.king, RJ: r.RJ });
ok('a normal mob is its table row within the stat jitter, at any level', !!r.snail86 && Math.abs(r.snail86.maxHp - R.snail.hp) <= Math.ceil(R.snail.hp * r.MJ) + 1, { got: r.snail86, table: R.snail });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
