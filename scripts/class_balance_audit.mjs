#!/usr/bin/env node
// CLASS BALANCE AUDIT — growth + equipment, strict trade-off rules.
//
//   node scripts/class_balance_audit.mjs [port]
//
// Rules enforced (per user, v0.29.438):
//   1. Endgame (Lv100, best-in-slot T10 ★10, class-matched) HP spread across
//      classes ≤ 3×, ATK spread ≤ 3×.
//   2. Strict trade-offs: a class that tops one axis pays elsewhere —
//      WARRIOR: highest HP → speed must be the LOWEST, ATK must be AVERAGE
//      (within ±30% of the class mean, and not the top value).
//      MAGE: top ATK → lowest HP band. ROGUE/ARCHER: speed/utility carry.
//   3. Naked growth (no gear) at Lv50 and Lv100 also stays ≤3× on HP and ATK —
//      so the rule holds while levelling, not only at the gear cap.
//
// Warlock is deliberately absent: it is a mage JOB (CLASSES.warlock carries
// job bonus stats, cls:'mage'), not a base class — measuring applyClass on a
// job block is how an earlier sim produced a phantom 34× spread.
//
// Everything runs through the real engine in a booted client: applyClass +
// _maybeLevelUp for growth (stats ACCUMULATE per level; assigning player.level
// is meaningless), getAtk / getMaxHp / getSpeed for the reads, ITEM_POOL
// enumerated for true BIS.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = process.env.MOJI_PW_EXE || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = process.argv[2] || '8080';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof getAtk === 'function' && typeof applyClass === 'function' && typeof ITEM_POOL === 'object'; } catch { return false; } }, null, { timeout: 90000 });

const data = await page.evaluate(() => {
  const CLASSES_UT = ['warrior', 'rogue', 'mage', 'archer'];
  const bestGear = (cls) => {
    const best = {};
    const cats = { weapons: 'weapon', armors: 'armor', accessories: 'accessory' };
    for (const cat in cats) {
      let pool = ITEM_POOL[cat].filter((it) => (it.tier | 0) === 10);
      if (!pool.length) pool = ITEM_POOL[cat];
      let top = null, topSc = -Infinity;
      for (const base of pool) {
        if (base.cls && base.cls !== 'any' && base.cls !== cls) continue;
        const it = Object.assign({}, base, { tier: 10, stars: 10 });
        const sc = itemScore(it);
        if (sc > topSc) { topSc = sc; top = it; }
      }
      if (top) best[cats[cat]] = top;
    }
    return best;
  };
  const build = (cls, lvl) => {
    player.buffs = {}; player.inRage = false;
    player.mods = player.mods || {};
    player.equipped.weapon = player.equipped.armor = player.equipped.accessory = null;
    player._equipBonusCache = null;
    applyClass(cls);
    player.level = 1; player.job = null; player.master = null;
    player._advNudge20 = true; player._advNudge40 = true;
    let g = 0;
    while (player.level < lvl && g++ < 400) { player.exp = 1e12; _maybeLevelUp(); }
    player.exp = 0; player._equipBonusCache = null;
  };
  const read = () => ({
    atk: Math.round(getAtk()), hp: Math.round(getMaxHp()), spd: +getSpeed().toFixed(2),
    def: Math.round((typeof getDef === 'function') ? getDef() : 0),
    mp: Math.round((typeof getMaxMp === 'function') ? getMaxMp() : (player.maxMp || 0)),
    crit: Math.round((typeof getCrit === 'function') ? getCrit() : (player.baseCrit || 0)),
    jump: +(((typeof getJump === 'function') ? getJump() : (player.baseJump || 0))).toFixed(1),
  });
  const out = { naked50: {}, naked100: {}, bis100: {} };
  for (const cls of CLASSES_UT) {
    build(cls, 50);  out.naked50[cls] = read();
    build(cls, 100); out.naked100[cls] = read();
    const gear = bestGear(cls);
    player.equipped.weapon = gear.weapon || null;
    player.equipped.armor = gear.armor || null;
    player.equipped.accessory = gear.accessory || null;
    player._equipBonusCache = null;
    out.bis100[cls] = read();
    out.bis100[cls].gear = Object.fromEntries(Object.entries(gear).map(([s, i]) => [s, i.name]));
  }
  return out;
});

const CL = ['warrior', 'rogue', 'mage', 'archer'];
const fails = [];
const spread = (set, key) => {
  const v = CL.map((c) => set[c][key]);
  return { max: Math.max(...v), min: Math.min(...v), ratio: Math.max(...v) / Math.max(1, Math.min(...v)) };
};
const show = (label, set) => {
  console.log(`\n${label}`);
  console.log('  class      ATK        HP     SPD    DEF     MP   CRIT   JUMP');
  for (const c of CL) {
    const r = set[c];
    console.log(`  ${c.padEnd(9)}${String(r.atk).padStart(7)}${String(r.hp).padStart(10)}${String(r.spd).padStart(8)}${String(r.def).padStart(7)}${String(r.mp).padStart(7)}${String(r.crit).padStart(7)}${String(r.jump).padStart(7)}`);
  }
  // v0.29.443 (per user) — the ≤3× rule now covers the whole sheet: DEF, MP,
  // CRIT and JUMP join HP and ATK. Speed is governed by its own fixed anchors.
  for (const k of ['hp', 'atk', 'def', 'mp', 'crit', 'jump']) {
    const s = spread(set, k);
    const ok = s.ratio <= 3.0;
    if (!ok) fails.push(`${label}: ${k.toUpperCase()} spread ${s.ratio.toFixed(2)}× > 3×`);
    console.log(`  ${k.toUpperCase().padEnd(4)} spread ${s.ratio.toFixed(2)}× ${ok ? 'OK' : '*** FAIL (>3×) ***'}`);
  }
};

show('NAKED Lv50 (growth only)', data.naked50);
show('NAKED Lv100 (growth only)', data.naked100);
show('BIS T10 ★10 Lv100 (growth + equipment)', data.bis100);

// strict trade-off rules on the endgame build
const b = data.bis100;
const atkMean = CL.reduce((a, c) => a + b[c].atk, 0) / CL.length;
const wAtkDev = Math.abs(b.warrior.atk - atkMean) / atkMean;
const wAtkTop = b.warrior.atk >= Math.max(...CL.map((c) => b[c].atk));
console.log(`\nSTRICT TRADE-OFFS (endgame build)`);
console.log(`  warrior HP is the highest        : ${b.warrior.hp >= Math.max(...CL.map((c) => b[c].hp)) ? 'yes' : 'no'}`);
console.log(`  warrior SPD is the lowest        : ${b.warrior.spd <= Math.min(...CL.map((c) => b[c].spd)) ? 'yes — pays for the HP' : '*** FAIL — tank must be slow ***'}`);
console.log(`  warrior ATK vs class mean        : ${(wAtkDev * 100).toFixed(0)}% off mean (${Math.round(atkMean)}), top=${wAtkTop}`);
if (b.warrior.spd > Math.min(...CL.map((c) => b[c].spd))) fails.push('warrior is not the slowest class');
if (wAtkTop) fails.push('warrior has the TOP endgame ATK — must be average');
if (wAtkDev > 0.30) fails.push(`warrior ATK is ${(wAtkDev * 100).toFixed(0)}% from the mean (limit 30%)`);
if (b.mage.atk < Math.max(...CL.map((c) => b[c].atk))) console.log(`  mage ATK is the highest          : no (informational — glass cannon identity)`);
else console.log(`  mage ATK is the highest          : yes — pays with the lowest HP band`);
// v0.29.440 (per user) — rogue and archer must carry MORE HP than mage (the
// glass cannon is the squishiest, full stop), and the speed anchors are fixed:
// warrior ~2.5 (was 1.56 — sluggish past the point of fun), mage ~3.5.
if (b.rogue.hp <= b.mage.hp) fails.push(`rogue HP (${b.rogue.hp}) must exceed mage HP (${b.mage.hp})`);
if (b.archer.hp <= b.mage.hp) fails.push(`archer HP (${b.archer.hp}) must exceed mage HP (${b.mage.hp})`);
console.log(`  rogue/archer HP above mage       : ${b.rogue.hp > b.mage.hp && b.archer.hp > b.mage.hp ? 'yes' : '*** FAIL ***'} (${b.rogue.hp} / ${b.archer.hp} vs ${b.mage.hp})`);
if (b.warrior.spd < 2.3 || b.warrior.spd > 2.7) fails.push(`warrior speed ${b.warrior.spd} outside the 2.5±0.2 anchor`);
if (b.mage.spd < 3.3 || b.mage.spd > 3.7) fails.push(`mage speed ${b.mage.spd} outside the 3.5±0.2 anchor`);
console.log(`  speed anchors (war 2.5, mage 3.5): ${b.warrior.spd} / ${b.mage.spd}`);
// v0.29.443 (per user) — identity assertions on the wider sheet: the tank owns
// DEF and pays for it (already: slowest + average ATK); the glass cannon is the
// least armored; MP belongs to the mage; the acrobat jumps highest.
if (b.warrior.def < Math.max(...CL.map((c) => b[c].def))) fails.push('warrior must have the highest DEF (tank)');
if (b.mage.def > Math.min(...CL.map((c) => b[c].def))) fails.push('mage must have the lowest DEF (glass cannon)');
if (b.mage.mp < Math.max(...CL.map((c) => b[c].mp))) fails.push('mage must have the highest MP');
if (b.rogue.jump < Math.max(...CL.map((c) => b[c].jump))) fails.push('rogue must have the highest JUMP (acrobat)');
if (b.rogue.crit < Math.max(...CL.map((c) => b[c].crit))) fails.push('rogue must have the highest CRIT');
console.log(`  DEF top/low = warrior/mage      : ${b.warrior.def >= Math.max(...CL.map((c) => b[c].def)) && b.mage.def <= Math.min(...CL.map((c) => b[c].def)) ? 'yes' : '*** FAIL ***'}`);
console.log(`  MP top = mage, JUMP top = rogue : ${b.mage.mp >= Math.max(...CL.map((c) => b[c].mp)) ? 'yes' : 'FAIL'} / ${b.rogue.jump >= Math.max(...CL.map((c) => b[c].jump)) ? 'yes' : 'FAIL'}`);
console.log(`  CRIT top = rogue                : ${b.rogue.crit >= Math.max(...CL.map((c) => b[c].crit)) ? 'yes' : '*** FAIL ***'}`);

// v0.29.445 (per user) — ADVANCEMENT BUDGETS. Every job (Lv20) and master
// (Lv40) stat block is priced with the game's own ITEM_STAT_WEIGHTS and must
// land in a shared band: jobs 90±10%, masters 160±10% (v0.29.447 — scaled up per user: HP/MP ~3-4x, ATK/DEF ~2.5x, parity preserved). Before this rule the
// crit-heavy paths were silently richer — sniper's block priced at 60.0 vs
// ranger's 21.9 (2.74×), marksman 91.0 vs beastmaster 42.2. Static check —
// the stat blocks are data, so they are read straight from the game file
// (same verbatim-extraction discipline as tier_mul_test).
{
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const ROOT = pathMod.resolve(pathMod.dirname(fileURLToPath(import.meta.url)), '..');
  const src = fsMod.readFileSync(pathMod.join(ROOT, 'mojiworld_game.html'), 'utf8');
  const W = { atk: 3, def: 2, hp: 0.3, mp: 0.2, crit: 2.5, speed: 8, jump: 4 };
  const wm = src.match(/const ITEM_STAT_WEIGHTS = \{([\s\S]*?)\};/);
  if (wm) for (const k of Object.keys(W)) {
    const vm = wm[1].match(new RegExp(`\\b${k}:\\s*([\\d.]+)`));
    if (vm) W[k] = parseFloat(vm[1]);   // stay synced with the live weights
  }
  const price = (block) => {
    let t = 0;
    for (const [, k, v] of block.matchAll(/(\w+):\s*(-?[\d.]+)/g)) t += (W[k] || 0) * parseFloat(v);
    return +t.toFixed(1);
  };
  const grab = (re) => [...src.matchAll(re)].map((m) => ({ id: m[1], budget: price(m[2]) }));
  const jobs = grab(/^\s{2}(\w+): +\{ name:'[^']+', cls:'(?:warrior|mage|archer|rogue)'[\s\S]{0,2000}?stats:\{([^}]+)\}/gm);
  if (jobs.length !== 9) fails.push(`job scan found ${jobs.length} entries, expected 9 — the regex is missing blocks, fix it before trusting this section`);
  const masters = (() => {
    const at = src.indexOf('const MASTERS = {');
    const seg = src.slice(at, src.indexOf('\n};', at));
    return [...seg.matchAll(/^\s{2}(\w+):[\s\S]{0,900}?stats:\{([^}]+)\}/gm)].map((m) => ({ id: m[1], budget: price(m[2]) }));
  })();
  const band = (rows, lo, hi, label) => {
    console.log(`\n${label} (budget band ${lo}–${hi})`);
    for (const r of rows.sort((a, b) => a.budget - b.budget)) {
      const ok = r.budget >= lo && r.budget <= hi;
      if (!ok) fails.push(`${label}: ${r.id} budget ${r.budget} outside ${lo}–${hi}`);
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(14)} ${r.budget}`);
    }
  };
  band(jobs, 810, 990, `JOB advancement budgets (${jobs.length})`);
  band(masters, 1440, 1760, `MASTER advancement budgets (${masters.length})`);
}
console.log(`\n${fails.length ? 'FAIL' : 'PASS'} — ${fails.length} violation(s)`);
for (const f of fails) console.log('  ✗ ' + f);
await browser.close();
process.exit(fails.length);
