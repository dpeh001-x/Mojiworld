// GENERATOR for _GEAR_ALLOWANCE_TABLE.
// =============================================================================
// _refHpAtLv(lv) is meant to be "an at-level GEARED character's HP". It was
//   (104 + 23.6L) * _REF_GEAR_ALLOWANCE * _classHpRef()
// with a FLAT 1.5 gear allowance. Real gear (the shop tier ladder) multiplies
// HP ~1.8x at Lv 20 but ~10x at Lv 90, so the anchor fell progressively behind
// the player and higher-level monsters got relatively weaker. This measures the
// true allowance from the live game so the anchor can track it.
//
//   allowance(L) = mean over the 4 classes of
//                    gearedHP(L, cls) / ((104 + 23.6L) * _classHpRef(cls))
//
// Sampled on the SAME level grid as _DMG_BAND_TABLE so the two interpolate on
// one shared set of breakpoints. Re-run this whenever gear or the tier ladder
// is retuned; scripts/gear_allowance_test.mjs fails if the baked table drifts.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9021;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const OUT = await page.evaluate(() => {
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;
  const shopTier = (lv) => lv >= 90 ? 10 : lv >= 80 ? 9 : lv >= 70 ? 8 : lv >= 60 ? 7
                         : lv >= 50 ? 6 : lv >= 30 ? 4 : lv >= 10 ? 3 : lv >= 6 ? 2 : 1;
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
  const gearedHp = (cls, lv) => {
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
    return getMaxHp();
  };
  // the band table's own grid, so both interpolate on identical breakpoints
  const GRID = _DMG_BAND_TABLE.map(r => r[0]);
  const CLS = ['warrior', 'archer', 'rogue', 'mage'];
  const rows = [];
  for (const lv of GRID) {
    // devSetLevel caps at 99; Lv 100 shares the Lv 99 stat block + T10 gear,
    // so measuring at 99 and reporting it for 100 is exact, not extrapolated.
    const per = [];
    for (const cls of CLS) {
      const hp = gearedHp(cls, lv);
      const base = (104 + 23.6 * Math.min(99, lv)) * (_CLASS_HP_REF[cls] || 1);
      per.push({ cls, hp, a: hp / base });
    }
    const mean = per.reduce((s, p) => s + p.a, 0) / per.length;
    rows.push({ lv, allowance: +mean.toFixed(3),
                spread: `${Math.min(...per.map(p=>p.a)).toFixed(2)}-${Math.max(...per.map(p=>p.a)).toFixed(2)}`,
                per: per.map(p => `${p.cls}:${p.a.toFixed(2)}`).join(' ') });
  }
  return { rows, band: _DMG_BAND_TABLE.map(r => [r[0], r[1]]), oldAllowance: _REF_GEAR_ALLOWANCE };
});

writeFileSync(path.join(ROOT, 'scripts', 'gear_allowance.json'), JSON.stringify(OUT, null, 1));
console.log('lv   allowance   (was 1.5)   per-class spread');
for (const r of OUT.rows) {
  console.log(`${String(r.lv).padStart(3)}   ${String(r.allowance).padStart(9)}   ` +
    `${(r.allowance / OUT.oldAllowance).toFixed(2)}x        ${r.spread}   ${r.per}`);
}
console.log('\n// paste into mojiworld_game.html');
console.log('const _GEAR_ALLOWANCE_TABLE = [');
const L = OUT.rows.map(r => `[${r.lv}, ${r.allowance}]`);
for (let i = 0; i < L.length; i += 6) console.log('  ' + L.slice(i, i + 6).join(', ') + ',');
console.log('];');
console.log('\ncompensated band values (old_p * 1.5 / allowance) — for step 3 reference:');
console.log(OUT.band.map(([lv, p], i) => `[${lv}, ${+(p * 1.5 / OUT.rows[i].allowance).toFixed(4)}]`).join(', '));
console.log('\npageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
