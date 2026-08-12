// GUARD for the level-derived gear allowance (v0.29.481).
// =============================================================================
// Two jobs:
//   1. DRIFT Ã¢â‚¬â€ re-measure the real gear allowance from the live shop ladder and
//      fail if the baked _GEAR_ALLOWANCE_TABLE no longer matches. This is the
//      check that was missing when the old flat 1.5 silently went stale as gear
//      was buffed over many versions.
//   2. NEUTRALITY Ã¢â‚¬â€ assert the refactor changed NO landed damage. The old
//      anchor x old band must equal the new anchor x new band at every level
//      and class, algebraically AND through the live contact path.
// Run: node scripts/gear_allowance_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9022;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

// The pre-refactor band table. The old landed number is recomputed from these
// so neutrality is checked against real historical values, not a re-derivation.
const OLD_BAND = [[1,0.087],[5,0.112],[10,0.147],[15,0.179],[20,0.220],[30,0.265],
                  [40,0.338],[50,0.396],[60,0.578],[70,0.905],[80,1.041],
                  [90,1.281],[100,1.545]];
const OLD_ALLOWANCE = 1.5;
const DRIFT_TOLERANCE = 0.12;   // 12% Ã¢â‚¬â€ trips on a real gear retune, not on noise

const R = await page.evaluate(async ({ OLD_BAND, OLD_ALLOWANCE, DRIFT_TOLERANCE }) => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest'); game.paused = false;

  ok('_refGearAllowance exists', typeof _refGearAllowance === 'function');
  ok('_GEAR_ALLOWANCE_TABLE shares the band grid',
     _GEAR_ALLOWANCE_TABLE.length === _DMG_BAND_TABLE.length &&
     _GEAR_ALLOWANCE_TABLE.every((r, i) => r[0] === _DMG_BAND_TABLE[i][0]),
     _GEAR_ALLOWANCE_TABLE.map(r => r[0]).join(','));
  ok('_refLoAtLv still uses the flat constant (boss caps untouched)',
     _refLoAtLv(50) === Math.round((63 + 15.7 * 50) * _REF_GEAR_ALLOWANCE), _refLoAtLv(50));

  const oldBandAt = (lv) => {
    const L = Math.max(1, Math.min(100, lv | 0));
    for (let i = 0; i < OLD_BAND.length - 1; i++) {
      const a = OLD_BAND[i], b = OLD_BAND[i + 1];
      if (L >= a[0] && L <= b[0]) return a[1] + (b[1] - a[1]) * ((L - a[0]) / (b[0] - a[0]));
    }
    return OLD_BAND[OLD_BAND.length - 1][1];
  };
  void oldBandAt; void OLD_ALLOWANCE;   // kept for provenance; neutrality era ended in v0.29.543

  // Ã¢â€â‚¬Ã¢â€â‚¬ 1. NEUTRALITY, algebraic: anchor x band is unchanged at every level Ã¢â€â‚¬Ã¢â€â‚¬
  // v0.29.543 — the neutrality-identity check retired with the neutrality
  // factor itself: the band is now DELIBERATELY re-solved, so old==new no
  // longer holds. What must hold instead:
  //   (a) the raw touch anchor (ref x band) grows MONOTONICALLY with level —
  //       higher-level monsters are never absolutely weaker on touch;
  //   (b) the neutrality factor is really gone (band values are honest);
  //   (c) absorb sits at ~50% for a character carrying the expected
  //       at-level DEF, at every level (the STEP-2 design point).
  {
    player.cls = 'mage';
    let mono = true, worstStep = '';
    let prev = 0;
    for (let lv = 1; lv <= 100; lv++) {
      const prod = _refHpAtLv(lv) * _dmgBandPct(lv).tFloor;
      if (prod < prev * 0.999) { mono = false; worstStep = `Lv${lv}: ${prev.toFixed(1)} -> ${prod.toFixed(1)}`; break; }
      prev = prod;
    }
    ok('raw touch anchor is monotonic in level', mono, worstStep || `Lv100 anchor ${prev.toFixed(1)}`);
  }
  ok('neutrality factor is gone', typeof _refGearAllowance === 'function' &&
     Math.abs(_dmgBandPct(90).pFloor - _DMG_BAND_TABLE.find(r => r[0] === 90)[1]) < 1e-9,
     `pFloor(90)=${_dmgBandPct(90).pFloor}`);
  // (the 50%-absorb design point is guarded empirically by the DEF-drift
  //  check in the section below — measured geared DEF vs the baked K table)

  // Ã¢â€â‚¬Ã¢â€â‚¬ 2. DRIFT: does the baked table still match the real gear ladder? Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
    return { hp: getMaxHp(), def: getDef() };
  };
  let maxDrift = 0, driftAt = '';
  let maxDefDrift = 0, defDriftAt = '';
  for (const [lv, baked] of _GEAR_ALLOWANCE_TABLE) {
    const per = [], defs = [];
    for (const cls of ['warrior','archer','rogue','mage']) {
      const g = gearedHp(cls, lv);
      per.push(g.hp / ((104 + 23.6 * Math.min(99, lv)) * (_CLASS_HP_REF[cls] || 1)));
      defs.push(g.def);
    }
    const live = per.reduce((s, v) => s + v, 0) / per.length;
    const d = Math.abs(live - baked) / baked;
    if (d > maxDrift) { maxDrift = d; driftAt = `Lv ${lv}: baked ${baked} vs live ${live.toFixed(3)}`; }
    // v0.29.543 — the absorb K table is the same kind of measured constant:
    // if gear DEF is retuned and this table is not re-generated, the 50%
    // design point silently drifts. Guard it exactly like the HP allowance.
    const liveDef = defs.reduce((s, v) => s + v, 0) / defs.length;
    const bakedK = _defKAtLv(lv);
    const dd = Math.abs(liveDef - bakedK) / Math.max(1, bakedK);
    if (dd > maxDefDrift) { maxDefDrift = dd; defDriftAt = `Lv ${lv}: baked K ${Math.round(bakedK)} vs live DEF ${Math.round(liveDef)}`; }
  }
  ok(`baked allowance matches the live gear ladder (<${DRIFT_TOLERANCE * 100}%)`,
     maxDrift < DRIFT_TOLERANCE, `max drift ${(maxDrift * 100).toFixed(1)}%  ${driftAt}`);
  ok(`baked absorb K matches live expected DEF (<${DRIFT_TOLERANCE * 100}%) — 50% absorb design point holds`,
     maxDefDrift < DRIFT_TOLERANCE, `max drift ${(maxDefDrift * 100).toFixed(1)}%  ${defDriftAt}`);

  // Ã¢â€â‚¬Ã¢â€â‚¬ 3. the anchor now actually tracks a geared character Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const ratios = [];
  for (const lv of [20, 50, 80]) {
    const hp = gearedHp('mage', lv).hp;
    player.cls = 'mage';
    ratios.push({ lv, r: +(hp / _refHpAtLv(lv)).toFixed(2) });
  }
  ok('anchor is within 0.75-1.35x of a real geared bar (was up to 12x under)',
     ratios.every(x => {
       // gearedHp now returns {hp,def}; the mage ratio uses hp
       return x.r > 0.75 && x.r < 1.35;
     }), ratios.map(x => `Lv${x.lv}:${x.r}x`).join(' '));
  return res;
}, { OLD_BAND, OLD_ALLOWANCE, DRIFT_TOLERANCE });

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
