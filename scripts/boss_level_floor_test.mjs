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
    return m ? { maxHp: m.maxHp, atk: m.atk, exp: m.exp, coins: m.mojicoins,
                 mul: m._lvFloorMul || 1, ease: m._lvEaseMul || 1 } : null;
  };

  const out = {};
  out.atLevel  = spawnAt(10, 'king');    // at-level: EASED, not floored
  out.at86     = spawnAt(86, 'king');    // the user's report
  out.at200    = spawnAt(200, 'king');   // prestige: the sub-40 cap
  out.mooma16  = spawnAt(16, 'mooma');   // graded ease partway up the ramp
  out.krook86  = spawnAt(86, 'kingKrook');   // Lv-50 boss: full-rate floor
  out.krook50  = spawnAt(50, 'kingKrook');   // at-level: untouched, no ease
  // scripted + self-scaling content must stay outside both mechanisms
  out.mirror86 = spawnAt(86, 'mirrorSelf');
  g.tower = { floor: 5 };
  out.towerBoss = spawnAt(86, 'towerArbiter');
  g.tower = null;
  // normal mobs must be unaffected by the floor entirely
  p.level = 86; g.monsters = [];
  eval('spawnMonster')(800, 400, 'snail', false, false);
  out.snail86 = { mul: g.monsters[0] && (g.monsters[0]._lvFloorMul || 1) };
  return out;
});

// --- the at-level EASE (v0.29.NEW, per user: first encounters too hard) ----
ok('EASE: at-level Gloopaloo is cut to 35% (178,500 -> 62,475 HP)',
   r.atLevel.ease === 0.35 && r.atLevel.maxHp === 62475, r.atLevel);
// Ratio, not the exact integer: the post-spawn difficulty and level-curve
// blocks re-multiply and re-floor ATK after the ease (same story as the
// floored-ATK check below), so 36 -> 29 rather than the formula's 28.
ok('EASE: his ATK is cut to ~80% at Lv 10',
   Math.abs(r.atLevel.atk / 36 - 0.80) < 0.03, { atk: r.atLevel.atk, was: 36, ratio: +(r.atLevel.atk / 36).toFixed(3) });
ok('EASE: graded — Mooma (Lv 16) sits partway up the ramp at 48%',
   Math.abs(r.mooma16.ease - 0.48) < 0.01, { ease: r.mooma16.ease, hp: r.mooma16.maxHp });
ok('EASE: rewards stay authored (the fight was retuned, not its pay)',
   r.atLevel.exp === 195 && r.atLevel.coins === 1170, { exp: r.atLevel.exp, coins: r.atLevel.coins });
ok('EASE: at-level fight is not floored (mul 1)', r.atLevel.mul === 1, { mul: r.atLevel.mul });
ok('EASE: Lv-40+ bosses are untouched by it', r.krook50.ease === 1, { ease: r.krook50.ease });

// --- the overlevel FLOOR, now from the eased base ---------------------------
ok('Lv 86 vs Gloopaloo: the floor engages', r.at86.mul > 1, { mul: r.at86.mul });
ok('half rate below 40: gap 76 lands ~4.8x of the EASED base',
   Math.abs(r.at86.mul - 4.8) < 0.05 && r.at86.maxHp === Math.floor(62475 * r.at86.mul),
   { mul: r.at86.mul, hp: r.at86.maxHp });
ok('the one-shot is gone: ~300k HP is far past any single hit',
   r.at86.maxHp > 250000, { hp: r.at86.maxHp, preFloorBase: 62475 });
ok('capped at 6x even for a prestige character',
   r.at200.mul === 6 && r.at200.maxHp === 62475 * 6, { mul: r.at200.mul, hp: r.at200.maxHp });
ok('a Lv-40+ boss floors at FULL rate (Krook, gap 36 -> ~4.6x)',
   Math.abs(r.krook86.mul - 4.6) < 0.05, { mul: r.krook86.mul });
ok('at-level Krook untouched', r.krook50.mul === 1, r.krook50);

// --- exclusions -------------------------------------------------------------
ok('the scripted Mirror fight is outside both mechanisms',
   r.mirror86.mul === 1 && r.mirror86.ease === 1, r.mirror86);
ok('tower bosses are outside both (they scale per-floor already)',
   r.towerBoss.mul === 1 && r.towerBoss.ease === 1, r.towerBoss);
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
ok('FARM-NEUTRAL: floored EXP scales by the same factor as HP',
   Math.abs(r.at86.exp / r.atLevel.exp - r.at86.mul) < 0.02,
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
