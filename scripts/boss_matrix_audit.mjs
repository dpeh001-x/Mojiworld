#!/usr/bin/env node
// BOSS MATRIX — every class (canonical advancement path applied) vs every
// story boss, four zodiac signs and Gravitos, at parity level with the gear
// tier the game allows at that level.
//
//   node scripts/boss_matrix_audit.mjs [port]
//
// Same discipline as power_curve_audit: real level-ups, real applyJob/
// applyMaster, enumerated best-in-slot of the LEVEL-GATED tier (not blanket
// T10), and bosses spawned through the real spawnMonster pipeline so their
// post-multiplier stats — not the authored table values — are what is
// measured. Boss evasion is NOT zeroed: dodging is a boss's core defense and
// the 45% floor is part of the real fight. mirrorSelf is skipped (it copies
// the player — self-referential). Player level is capped by the engine's own
// level-up ceiling; if a boss outlevels that cap the actual reached level is
// reported.

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = process.env.MOJI_PW_EXE || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = process.argv[2] || '8080';
const SWINGS = 400;

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 140)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof spawnMonster === 'function' && typeof applyJob === 'function'; } catch { return false; } }, null, { timeout: 90000 });

const rows = await page.evaluate(async ({ SWINGS }) => {
  const PATHS = {
    warrior: { job: 'berserker', master: 'warlord' },
    rogue:   { job: 'ninja',     master: 'shadowlord' },
    mage:    { job: 'archmage',  master: 'sage' },
    archer:  { job: 'sniper',    master: 'marksman' },
  };
  const BOSSES = ['king', 'mooma', 'young_confused_barnaby', 'sundered_smith', 'kingKrook', 'octobaby',
    'legosaurus', 'aetherion', 'zodiac_aries', 'zodiac_leo', 'zodiac_capricorn', 'zodiac_pisces', 'gravitos'];
  const tierCap = (lv) => lv >= 85 ? 10 : lv >= 75 ? 9 : lv >= 65 ? 8 : lv >= 55 ? 7 : lv >= 45 ? 6 : lv >= 30 ? 5 : 4;
  const bestGear = (cls, cap, stars) => {
    const best = {};
    for (const [cat, slot] of [['weapons', 'weapon'], ['armors', 'armor'], ['accessories', 'accessory']]) {
      let top = null, sc = -Infinity;
      for (const base of ITEM_POOL[cat]) {
        if ((base.tier | 0) > cap) continue;
        if (base.cls && base.cls !== 'any' && base.cls !== cls) continue;
        const it = Object.assign({}, base, { stars });
        const v = itemScore(it);
        if (v > sc) { sc = v; top = it; }
      }
      if (top) best[slot] = top;
    }
    return best;
  };
  const out = [];
  for (const cls in PATHS) {
    for (const type of BOSSES) {
      const def = monsterTypes[type];
      if (!def) { out.push({ cls, type, err: 'no def' }); continue; }
      const bossLv = def.level || 100;
      // build at parity through the real paths
      player.buffs = {}; player.inRage = false; player.mods = player.mods || {};
      player.equipped.weapon = player.equipped.armor = player.equipped.accessory = null;
      player._equipBonusCache = null;
      applyClass(cls);
      player.level = 1; player.job = null; player.master = null;
      player._advNudge20 = true; player._advNudge40 = true;
      let g = 0;
      while (player.level < bossLv && g++ < 400) { player.exp = 1e12; _maybeLevelUp(); }
      player.exp = 0;
      const lv = player.level;
      if (lv >= 20) { try { applyJob(PATHS[cls].job); } catch (e) {} }
      if (lv >= 40) { try { applyMaster(PATHS[cls].master); } catch (e) {} }
      const gear = bestGear(cls, tierCap(lv), Math.min(10, Math.floor(lv / 10)));
      player.equipped.weapon = gear.weapon || null;
      player.equipped.armor = gear.armor || null;
      player.equipped.accessory = gear.accessory || null;
      player._equipBonusCache = null;

      // real spawn (real multipliers); neutral map to keep arena mults constant
      try { loadMap('gravitosArena'); } catch (e) {}
      game.paused = false;
      game.monsters.length = 0;
      try { spawnMonster(300, 300, type, true, false); } catch (e) {}
      const m = game.monsters[game.monsters.length - 1];
      if (!m) { out.push({ cls, type, err: 'spawn failed' }); continue; }

      const atk = Math.round(getAtk());
      const hp = Math.round(getMaxHp());
      const bossHp = Math.round(m.maxHp || m.currentHp);
      const HUGE = 1e13;
      m.maxHp = HUGE; m.currentHp = HUGE;
      let landed = 0;
      for (let i = 0; i < SWINGS; i++) {
        const h0 = m.currentHp;
        try { hitMonster(m, Math.floor(atk), rollCrit(), 'slash'); } catch (e) { break; }
        if (m.currentHp < h0) landed++;
        if (m.currentHp < HUGE / 2) m.currentHp = HUGE;
      }
      const perSwing = (HUGE - m.currentHp) > 0 ? 0 : 0;   // recompute below
      const dealt = landed >= 0 ? (HUGE * Math.ceil(SWINGS / 1) - 0) : 0;   // placeholder
      out.push({ cls, type, bossLv, lv, atk, hp, bossHp,
        hitRate: +(landed / SWINGS).toFixed(2),
        dmgTotal: 0, m_atk: Math.round(m.atk || 0) });
      // measure damage properly on a fresh pass (separate accumulator)
      const r = out[out.length - 1];
      m.currentHp = HUGE;
      let total = 0;
      for (let i = 0; i < SWINGS; i++) {
        const h0 = m.currentHp;
        try { hitMonster(m, Math.floor(atk), rollCrit(), 'slash'); } catch (e) { break; }
        if (m.currentHp < h0) total += (h0 - m.currentHp);
        if (m.currentHp < HUGE / 2) m.currentHp = HUGE;
      }
      const per = total / SWINGS;
      r.swings = per > 0 ? Math.ceil(bossHp / per) : Infinity;
      const gapMul = (typeof _lvGapDmgMul === 'function') ? _lvGapDmgMul(m) : 1;
      let hitIn = (m.atk || 0) * gapMul;
      try { hitIn = _diffDmg(hitIn, bossLv); } catch (e) {}
      r.hitsToDie = hitIn > 0 ? Math.ceil(hp / hitIn) : Infinity;
      game.monsters.length = 0;
    }
  }
  return out;
}, { SWINGS });

const CL = ['warrior', 'rogue', 'mage', 'archer'];
const bosses = [...new Set(rows.map((r) => r.type))];
console.log('\nBOSS MATRIX — parity level, canonical path, level-gated gear\n');
console.log('SWINGS TO KILL (real spawned boss HP / measured per-swing damage)');
console.log('  boss                    Lv ' + CL.map((c) => c.slice(0, 7).padStart(9)).join(''));
for (const b of bosses) {
  const any = rows.find((r) => r.type === b && !r.err);
  if (!any) { console.log(`  ${b.padEnd(22)} spawn/def failed`); continue; }
  console.log('  ' + b.padEnd(22) + String(any.bossLv).padStart(4)
    + CL.map((c) => { const r = rows.find((x) => x.cls === c && x.type === b);
      return String(r && !r.err ? (r.swings === Infinity ? '∞' : r.swings) : '-').padStart(9); }).join(''));
}
console.log('\nHITS TO DIE (boss contact vs player max HP; 1 = one-shot)');
console.log('  boss                    Lv ' + CL.map((c) => c.slice(0, 7).padStart(9)).join(''));
for (const b of bosses) {
  const any = rows.find((r) => r.type === b && !r.err);
  if (!any) continue;
  console.log('  ' + b.padEnd(22) + String(any.bossLv).padStart(4)
    + CL.map((c) => { const r = rows.find((x) => x.cls === c && x.type === b);
      return String(r && !r.err ? (r.hitsToDie === Infinity ? '∞' : r.hitsToDie) : '-').padStart(9); }).join(''));
}
const flat = rows.filter((r) => !r.err && Number.isFinite(r.swings));
console.log('\nFLAGS');
let n = 0;
for (const r of rows) {
  if (r.err) continue;
  const f = [];
  if (r.swings !== Infinity && r.swings < 10) f.push('BOSS MELTS (<10 swings)');
  if (r.hitsToDie !== Infinity && r.hitsToDie > 60) f.push('PLAYER UNKILLABLE (>60)');
  if (r.hitsToDie === 1) f.push('ONE-SHOT');
  if (f.length) { n++; console.log(`  ${r.cls.padEnd(8)} vs ${r.type.padEnd(22)} ${f.join(' + ')}  (swings ${r.swings}, hits2die ${r.hitsToDie})`); }
}
console.log(n ? `\n${n} flagged` : '\nno flags');
await browser.close();
