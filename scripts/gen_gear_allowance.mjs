// GENERATOR for scripts/gear_allowance.json - the measured gear-power baseline.
// =============================================================================
// _refHpAtLv(lv) is meant to be "an at-level GEARED character's HP". v0.29.483
// replaced its flat 1.5 gear allowance with _GEAR_ALLOWANCE_TABLE, measured here:
//
//   allowance(L) = mean over the 4 classes of
//                    gearedHP(L, cls) / ((104 + 23.6L) * _CLASS_HP_REF[cls])
//
// where "geared" is the loadout the shop ladder would sell at that level. The
// same pass records the geared DEF, the damage-taken multiplier the live
// _defAbsorbMul gives that DEF at that level, and the absorb K it uses there.
// Sampled on the _DMG_BAND_TABLE grid so the tables share breakpoints.
//
// Writes scripts/gear_allowance.json, the baseline gear_allowance_test.mjs
// holds the live ladder to. Re-run it whenever gear, the tier ladder or the
// absorb curve is retuned ON PURPOSE, and commit the json with that change.
//
// It also prints a _GEAR_ALLOWANCE_TABLE block. Pasting that into the game is
// a BALANCE change of its own, not a refresh: boss ranged bands read the table
// through _refBarAtLv (mob touch / heavy bands divide it back out).
//
// bootGame and measureGearLadder are exported so the test measures with this
// exact code. Run: node scripts/gen_gear_allowance.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

export async function bootGame(port) {
  const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(port)], { stdio: 'ignore' });
  let browser = null;
  const close = async () => { try { if (browser) await browser.close(); } catch (_) {} server.kill(); };
  try {
    await new Promise(r => setTimeout(r, 1200));
    browser = await chromium.launch({
      channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
      executablePath: process.env.MOJI_PW_EXE || undefined,
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    // domcontentloaded + the globals this uses: a cold localhost 'load' can outlast 60 s
    await page.goto(`http://localhost:${port}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
                    { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof devSetLevel === 'function' &&
                                     typeof _defAbsorbMul === 'function', null, { timeout: 90000 });
    await page.waitForTimeout(10000);
    return { page, errs, close };
  } catch (e) { await close(); throw e; }
}

// Runs INSIDE the page (page.evaluate), so it must not close over anything here.
export function measureGearLadder() {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const shopTier = (lv) => lv >= 88 ? 10 : lv >= 78 ? 9 : lv >= 68 ? 8 : lv >= 55 ? 7
                         : lv >= 40 ? 6 : lv >= 20 ? 4 : lv >= 10 ? 3 : lv >= 6 ? 2 : 1;
  const pickGear = (cat, cls, lv) => {
    const cap = shopTier(lv);
    const pool = ITEM_POOL[cat].filter(it => !it.setId && (it.tier | 0) <= cap &&
                                             (!it.cls || it.cls === 'any' || it.cls === cls));
    if (!pool.length) return null;
    const top = Math.max(...pool.map(p => p.tier | 0));
    const best = pool.filter(it => (it.tier | 0) === top);
    const mine = best.filter(it => it.cls === cls);
    return { ...(mine.length ? mine : best).sort((a,b)=>itemScore(b)-itemScore(a))[0], slot: _catToSlot(cat) };
  };
  const modKeys = Object.keys(player.mods || {});
  const geared = (cls, lv) => {
    const S = CLASSES[cls].stats;
    player.cls = cls; player.level = 1;
    player.maxHp = S.hp; player.maxMp = S.mp; player.baseAtk = S.atk; player.baseDef = S.def;
    player.baseAcc = 0; player.job = null; player.master = null; player.milestones = [];
    player.talents = {}; player.skillPoints = 0; player.skillRanks = {};
    player.mods = {}; for (const k of modKeys) player.mods[k] = 0;
    player.buffs = {}; player.prestige = null;
    player.tree = player.tree || {}; for (const k in player.tree) player.tree[k] = 0;
    player.equipped = { weapon: null, armor: null, accessory: null };
    player._equipBonusCache = null;
    devSetLevel(Math.min(99, lv));
    for (const cat of ['weapons','armors','accessories']) {
      const g = pickGear(cat, cls, lv); if (g) player.equipped[g.slot] = g;
    }
    player._equipBonusCache = null;
    if (typeof refreshGearCache === 'function') refreshGearCache();
    return { hp: getMaxHp(), def: getDef(), mul: _defAbsorbMul() };
  };
  // The absorb K the live curve uses at a level: below its cap _defAbsorbMul() is
  // K / (DEF + K), so a small stand-in DEF inverts it exactly.
  const absorbK = (lv) => {
    const keepDef = window.getDef, keepLv = player.level;
    try { player.level = lv; window.getDef = () => 100; const m = _defAbsorbMul(); return 100 * m / (1 - m); }
    finally { window.getDef = keepDef; player.level = keepLv; }
  };
  const CLS = ['warrior', 'archer', 'rogue', 'mage'];
  const rows = [], clsHpSums = {};
  for (const [lv] of _DMG_BAND_TABLE) {
    // devSetLevel caps at 99; Lv 100 shares the Lv 99 stat block + T10 gear,
    // so measuring at 99 and reporting it for 100 is exact, not extrapolated.
    const per = {};
    for (const cls of CLS) {
      const g = geared(cls, lv);
      per[cls] = { ...g, a: g.hp / ((104 + 23.6 * Math.min(99, lv)) * (_CLASS_HP_REF[cls] || 1)) };
    }
    const mean = (k) => CLS.reduce((s, c) => s + per[c][k], 0) / CLS.length;
    for (const c of CLS) (clsHpSums[c] = clsHpSums[c] || []).push(per[c].hp / mean('hp'));
    rows.push({ lv, allowance: +mean('a').toFixed(3), defMean: Math.round(mean('def')),
                absorbMul: +mean('mul').toFixed(4), absorbK: Math.round(absorbK(Math.min(99, lv))),
                per: Object.fromEntries(CLS.map(c => [c, { hp: per[c].hp, def: per[c].def, a: +per[c].a.toFixed(3) }])) });
  }
  const clsRatio = Object.fromEntries(CLS.map(c =>
    [c, +(clsHpSums[c].reduce((s, x) => s + x, 0) / clsHpSums[c].length).toFixed(3)]));
  return { ver: (typeof GAME_VERSION === 'string') ? GAME_VERSION : null, rows,
           band: _DMG_BAND_TABLE.map(r => [r[0], r[1]]), oldAllowance: _REF_GEAR_ALLOWANCE, clsRatio };
}

const isMain = !!process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const { page, errs, close } = await bootGame(9021);
  let OUT;
  try { OUT = await page.evaluate(measureGearLadder); } finally { await close(); }
  writeFileSync(path.join(ROOT, 'scripts', 'gear_allowance.json'), JSON.stringify(OUT, null, 1) + '\n');
  console.log(`measured on ${OUT.ver} -> scripts/gear_allowance.json`);
  console.log(' lv  allowance  defMean  absorb K  taken x   per-class allowance');
  for (const r of OUT.rows) {
    console.log(`${String(r.lv).padStart(3)}  ${String(r.allowance).padStart(9)}  ${String(r.defMean).padStart(7)}  ` +
      `${String(r.absorbK).padStart(8)}  ${r.absorbMul.toFixed(3).padStart(7)}   ` +
      Object.entries(r.per).map(([c, p]) => `${c}:${p.a.toFixed(2)}`).join(' '));
  }
  console.log('\n// re-baking the game table is a BALANCE change (boss ranged bands read it):');
  console.log('const _GEAR_ALLOWANCE_TABLE = [');
  const L = OUT.rows.map(r => `[${r.lv}, ${r.allowance}]`);
  for (let i = 0; i < L.length; i += 6) console.log('  ' + L.slice(i, i + 6).join(', ') + ',');
  console.log('];');
  console.log('// geared per-class HP ratio vs 4-class mean (for _CLASS_HP_REF):');
  console.log(JSON.stringify(OUT.clsRatio));
  console.log('\ncompensated band values (old_p * 1.5 / allowance) - for a band re-solve:');
  console.log(OUT.band.map(([lv, p], i) => `[${lv}, ${+(p * 1.5 / OUT.rows[i].allowance).toFixed(4)}]`).join(', '));
  console.log('\npageerrors:', errs.length, errs.slice(0, 3));
}
