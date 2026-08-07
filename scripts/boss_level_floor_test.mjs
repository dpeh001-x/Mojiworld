// Boss level floor: an outleveled boss scales up so it cannot be one-shot,
// early bosses (< Lv 40) stay EASY (half rate, half ceiling), at-level fights
// are untouched, and rewards scale with the fight so it is farm-neutral.
//
//   node serve.js 8892 && node scripts/boss_level_floor_test.mjs 8892 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8892';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('spawnMonster') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  const spawnAt = (lvl, type) => {
    p.cls = p.cls || 'warrior'; p.level = lvl;
    g.monsters = [];
    eval('spawnMonster')(800, 400, type, true, false);
    const m = g.monsters[0];
    return m ? { maxHp: m.maxHp, atk: m.atk, exp: m.exp, coins: m.mojicoins, mul: m._lvFloorMul || 1 } : null;
  };

  const out = {};
  out.atLevel  = spawnAt(10, 'king');    // at-level: untouched
  out.at86     = spawnAt(86, 'king');    // the user's report
  out.at200    = spawnAt(200, 'king');   // prestige: the sub-40 cap
  out.krook86  = spawnAt(86, 'kingKrook');   // Lv-50 boss: full-rate floor
  out.krook50  = spawnAt(50, 'kingKrook');   // at-level: untouched
  // normal mobs must be unaffected by the floor entirely
  p.level = 86; g.monsters = [];
  eval('spawnMonster')(800, 400, 'snail', false, false);
  out.snail86 = { mul: g.monsters[0] && (g.monsters[0]._lvFloorMul || 1) };
  return out;
});

ok('at-level: the authored fight is untouched (mul 1)', r.atLevel.mul === 1, r.atLevel);
ok('Lv 86 vs Gloopaloo: the floor engages', r.at86.mul > 1, { mul: r.at86.mul });
ok('EASY below 40: half rate — gap 76 lands ~4.8x, not ~8.6x',
   Math.abs(r.at86.mul - 4.8) < 0.05, { mul: r.at86.mul, hp: r.at86.maxHp });
ok('the one-shot is gone: ~860k HP, an order of magnitude past any single hit',
   r.at86.maxHp > 700000, { hp: r.at86.maxHp, was: 178500 });
ok('EASY below 40: capped at 6x even for a prestige character',
   r.at200.mul === 6, { mul: r.at200.mul, hp: r.at200.maxHp });
ok('a Lv-40+ boss floors at FULL rate (Krook, gap 36 -> ~4.6x)',
   Math.abs(r.krook86.mul - 4.6) < 0.05, { mul: r.krook86.mul });
ok('at-level Krook untouched', r.krook50.mul === 1, r.krook50);
// Compare RATIOS, not the exact rounding path: two post-spawn blocks
// (BOSS_DIFFICULTY_ATK_MUL and the v0.29.224 level-curve parity) re-multiply
// boss ATK after the floor, so integer flooring at each stage shifts the final
// value by a point or two. The intent is quarter-rate growth: at mul 4.8, ATK
// ~1.95x while HP is 4.8x.
const _atkRatio = r.at86.atk / r.atLevel.atk;
const _want = 1 + (r.at86.mul - 1) * 0.25;
ok('ATK grows at a quarter rate — a nudge, not a wall',
   Math.abs(_atkRatio - _want) < 0.12 && _atkRatio < r.at86.mul / 2,
   { atkRatio: +_atkRatio.toFixed(3), intended: +_want.toFixed(3), hpMul: r.at86.mul });
ok('FARM-NEUTRAL: EXP scales by the same factor as HP',
   r.at86.exp === Math.floor(r.atLevel.exp * r.at86.mul) || Math.abs(r.at86.exp / r.atLevel.exp - r.at86.mul) < 0.02,
   { atLevel: r.atLevel.exp, floored: r.at86.exp, mul: r.at86.mul });
ok('coins scale with it', Math.abs(r.at86.coins / r.atLevel.coins - r.at86.mul) < 0.02,
   { atLevel: r.atLevel.coins, floored: r.at86.coins });
ok('normal mobs are untouched by the floor', r.snail86.mul === 1, r.snail86);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
