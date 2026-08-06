#!/usr/bin/env node
// ENDGAME CLASS × BOSS MATRIX — how each class fares in max-tier gear against
// every zodiac sign at parity level, and against Gravitos.
//
//   node scripts/endgame_class_matrix.mjs [port]
//
// Everything is measured through the REAL engine in a booted client, not a
// re-derived formula: gear comes from the game's own loot roller at tier cap 10
// (then ★10'd), and outgoing damage is measured by actually calling hitMonster
// several hundred times per matchup, so the DEF curve, the crit roll, the
// level-gap accuracy gate, the 45% boss-evasion floor and every multiplier in
// the stack are all included by construction.
//
// "Same level" = the character is LEVELLED to the boss's own level through the
// real level-up path, per the request. Gravitos is Lv100 and reported separately.
//
// KNOWN LIMIT — READ BEFORE QUOTING THE TTK COLUMNS. Outgoing damage is measured
// on the BASIC ATTACK (getAtk()) only. Warrior/archer/rogue do most of their
// damage that way, but mage and warlock fight through skills, so their
// swings-to-kill is a floor, not their real clear speed — a warlock reading
// "2013 swings" means "its basic attack is nearly irrelevant", NOT "the class
// cannot kill this boss". Treat the hit-rate and hits-to-die tables as the solid
// findings here; TTK is only comparable within the melee-ish classes.
//
// Two harness bugs were found and fixed while building this, both of which had
// produced confident-looking nonsense:
//   1. setting player.level directly — base stats ACCUMULATE per level-up, so
//      every class kept the loaded save's stats (20× phantom ATK spread);
//   2. sampling gear with rollItemDrop on a fixed budget — class-locked pools
//      differ in size, so rogue got 278 candidates and warlock 77 (11× spread).
// Both are gone; if this script is extended, do not reintroduce either.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = process.env.MOJI_PW_EXE || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = process.argv[2] || '8080';
const SWINGS = 600;   // per matchup — enough to average out crit + miss rolls

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof hitMonster === 'function' && typeof getAtk === 'function' && typeof monsterTypes === 'object'; } catch { return false; } }, null, { timeout: 90000 });

const data = await page.evaluate(({ SWINGS }) => {
  const CLASSES = ['warrior', 'mage', 'archer', 'rogue', 'warlock'];
  const bosses = Object.keys(monsterTypes).filter((k) => k.startsWith('zodiac_')).sort();
  const targets = bosses.concat(['gravitos']);

  // --- BIS gear: ENUMERATE the pool, do not sample it ----------------------
  // Rolling rollItemDrop 400× per class looked reasonable and was badly unfair:
  // the classes have very different numbers of class-locked entries, so a fixed
  // roll budget gave rogue 278 usable candidates (best weapon 1650 atk) and
  // warlock 77 (best weapon 205). That sampling gap — not the game — produced an
  // 11× ATK spread on the first two runs. Walking ITEM_POOL directly gives every
  // class its true best-in-slot, deterministically.
  function bestGear(cls) {
    const best = {};
    const cats = { weapons: 'weapon', armors: 'armor', accessories: 'accessory' };
    for (const cat in cats) {
      const all = (typeof ITEM_POOL === 'object' && ITEM_POOL[cat]) ? ITEM_POOL[cat] : [];
      let pool = all.filter((it) => (it.tier | 0) === 10);
      if (!pool.length) pool = all;                       // fall back if no T10 in this slot
      let top = null, topSc = -Infinity;
      for (const base of pool) {
        if (base.cls && base.cls !== 'any' && base.cls !== cls) continue;
        const it = Object.assign({}, base, { tier: 10, stars: 10 });
        const sc = (typeof itemScore === 'function') ? itemScore(it) : 0;
        if (sc > topSc) { topSc = sc; top = it; }
      }
      if (top) best[cats[cat]] = top;
    }
    return best;
  }

  const out = [];
  const savedCls = player.cls, savedLvl = player.level;

  for (const cls of CLASSES) {
    for (const type of targets) {
      const def = monsterTypes[type];
      if (!def) continue;
      const bossLv = def.level || 100;

      // Parity level — built through the REAL level-up path. Setting
      // player.level directly is wrong: baseAtk / maxHp / baseDef ACCUMULATE per
      // level-up (warrior +3 atk & +30 hp per level, mage +2 & +15, …), they are
      // not derived from player.level. Assigning the number alone left every
      // class carrying whatever the loaded save happened to have, which is what
      // produced a nonsense 20× ATK spread on the first run of this script.
      // applyClass resets to the class's base block; _maybeLevelUp then grants
      // each level's real gains, so no growth table is duplicated here.
      player.cls = cls;
      player.buffs = {};
      player.inRage = false;
      player.mods = player.mods || {};
      player.equipped.weapon = player.equipped.armor = player.equipped.accessory = null;
      player._equipBonusCache = null;
      try { applyClass(cls); } catch (e) {}
      player.level = 1;
      player.job = null; player.master = null;
      player._advNudge20 = true; player._advNudge40 = true;   // suppress advancement prompts
      let _guard = 0;
      while (player.level < bossLv && _guard++ < 400) {
        player.exp = 1e12;
        try { _maybeLevelUp(); } catch (e) { break; }
      }
      player.exp = 0;
      player._equipBonusCache = null;
      const gear = bestGear(cls);
      player.equipped.weapon = gear.weapon || null;
      player.equipped.armor = gear.armor || null;
      player.equipped.accessory = gear.accessory || null;
      player._equipBonusCache = null;

      const atk = (typeof getAtk === 'function') ? getAtk() : 0;
      const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : (player.maxHp || 1);

      // --- OUTGOING: swing the real pipeline -------------------------------
      const m = {
        ...JSON.parse(JSON.stringify(def)),
        type, x: 0, y: 0, w: def.w || 100, h: def.h || 100,
        maxHp: def.hp, currentHp: def.hp, level: bossLv,
        isBoss: true, boss: true, uid: null, traits: def.traits || null,
      };
      const HUGE = 1e12;
      m.maxHp = HUGE; m.currentHp = HUGE;
      let landed = 0;
      const before = m.currentHp;
      for (let i = 0; i < SWINGS; i++) {
        const hp0 = m.currentHp;
        try { hitMonster(m, Math.floor(atk), (typeof rollCrit === 'function') ? rollCrit() : false, 'slash'); } catch (e) {}
        if (m.currentHp < hp0) landed++;
        if (m.currentHp < HUGE * 0.5) { m.currentHp = HUGE; }   // never let it die mid-sample
      }
      const totalDealt = (before - m.currentHp) + 0;
      const dealt = totalDealt < 0 ? 0 : totalDealt;
      const perSwing = dealt / SWINGS;
      const hitRate = landed / SWINGS;
      const swingsToKill = perSwing > 0 ? Math.ceil(def.hp / perSwing) : Infinity;

      // --- INCOMING: one contact hit through the real amplifier + difficulty
      const gapMul = (typeof _lvGapDmgMul === 'function') ? _lvGapDmgMul({ ...m, isBoss: true, level: bossLv }) : 1;
      let hit = (def.atk || 0) * gapMul;
      if (typeof _diffDmg === 'function') { try { hit = _diffDmg(hit, bossLv); } catch (e) {} }
      const hitsToDie = hit > 0 ? Math.ceil(maxHp / hit) : Infinity;

      out.push({
        cls, type, bossLv, atk: Math.round(atk), maxHp: Math.round(maxHp),
        bossHp: def.hp, bossAtk: def.atk, bossDef: def.def, bossEva: def.evasion,
        hitRate: +hitRate.toFixed(3), perSwing: Math.round(perSwing),
        swingsToKill, incoming: Math.round(hit), hitsToDie,
      });
    }
  }
  player.cls = savedCls; player.level = savedLvl;
  return out;
}, { SWINGS });

// ---------------------------------------------------------------------------
const zod = data.filter((r) => r.type.startsWith('zodiac_'));
const grav = data.filter((r) => r.type === 'gravitos');
const CLASSES = [...new Set(data.map((r) => r.cls))];
const sign = (t) => t.replace('zodiac_', '');

console.log(`\nENDGAME MATRIX — max-tier (T10 ★10) gear, player at each boss's own level`);
console.log(`measured over ${SWINGS} real hitMonster swings per matchup\n`);

console.log('SWINGS TO KILL  (lower = better; ∞ = cannot damage)');
const signs = [...new Set(zod.map((r) => sign(r.type)))];
console.log('  ' + 'sign'.padEnd(13) + CLASSES.map((c) => c.slice(0, 7).padStart(9)).join(''));
for (const s of signs) {
  const row = CLASSES.map((c) => {
    const r = zod.find((x) => x.cls === c && sign(x.type) === s);
    return String(r ? (r.swingsToKill === Infinity ? '∞' : r.swingsToKill) : '-').padStart(9);
  }).join('');
  const lv = zod.find((x) => sign(x.type) === s).bossLv;
  console.log('  ' + `${s} (L${lv})`.padEnd(13) + row);
}

console.log('\nHIT RATE  (accuracy gate + boss evasion floor)');
console.log('  ' + 'sign'.padEnd(13) + CLASSES.map((c) => c.slice(0, 7).padStart(9)).join(''));
for (const s of signs) {
  console.log('  ' + s.padEnd(13) + CLASSES.map((c) => {
    const r = zod.find((x) => x.cls === c && sign(x.type) === s);
    return String(r ? (r.hitRate * 100).toFixed(0) + '%' : '-').padStart(9);
  }).join(''));
}

console.log('\nHITS TO DIE  (boss contact damage vs your max HP; 1 = one-shot)');
console.log('  ' + 'sign'.padEnd(13) + CLASSES.map((c) => c.slice(0, 7).padStart(9)).join(''));
for (const s of signs) {
  console.log('  ' + s.padEnd(13) + CLASSES.map((c) => {
    const r = zod.find((x) => x.cls === c && sign(x.type) === s);
    return String(r ? r.hitsToDie : '-').padStart(9);
  }).join(''));
}

console.log('\nGRAVITOS (Lv100)');
console.log('  ' + 'class'.padEnd(10) + 'ATK'.padStart(9) + 'maxHP'.padStart(9) + 'hit%'.padStart(7) + 'dmg/swing'.padStart(11) + 'swings'.padStart(9) + 'incoming'.padStart(10) + 'hits2die'.padStart(10));
for (const r of grav) {
  console.log('  ' + r.cls.padEnd(10) + String(r.atk).padStart(9) + String(r.maxHp).padStart(9)
    + ((r.hitRate * 100).toFixed(0) + '%').padStart(7) + String(r.perSwing).padStart(11)
    + String(r.swingsToKill === Infinity ? '∞' : r.swingsToKill).padStart(9)
    + String(r.incoming).padStart(10) + String(r.hitsToDie).padStart(10));
}

const spread = (rows, key) => {
  const v = rows.map((r) => r[key]).filter((x) => Number.isFinite(x));
  return v.length ? (Math.max(...v) / Math.min(...v)).toFixed(2) + '×' : 'n/a';
};
console.log(`\nCLASS SPREAD (max/min across classes)`);
for (const s of signs.slice(0, 3).concat(['—'])) { /* summary below instead */ break; }
for (const c of CLASSES) {
  const rows = zod.filter((r) => r.cls === c);
  const avg = rows.reduce((a, r) => a + (Number.isFinite(r.swingsToKill) ? r.swingsToKill : 0), 0) / rows.length;
  const avgHit = rows.reduce((a, r) => a + r.hitRate, 0) / rows.length;
  console.log(`  ${c.padEnd(10)} avg swings-to-kill ${String(Math.round(avg)).padStart(7)}   avg hit rate ${(avgHit * 100).toFixed(0)}%`);
}
console.log(`  zodiac swings-to-kill spread across classes: ${spread(zod, 'swingsToKill')}`);
console.log(`  gravitos swings-to-kill spread across classes: ${spread(grav, 'swingsToKill')}`);

await browser.close();
