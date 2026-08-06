#!/usr/bin/env node
// POWER-CURVE AUDIT — hunt overpowered anomalies across the whole levelling
// arc, with advancements applied (they land at Lv20/40, so the endgame-only
// audit cannot see mid-game spikes).
//
//   node scripts/power_curve_audit.mjs [port]
//
// For every advancement path (9 jobs, each with its first master) at levels
// 20/40/60/80/100: level through the real _maybeLevelUp, applyJob/applyMaster
// through the real functions, equip enumerated best-in-slot of the tier the
// game actually allows at that level (T5@30+, T6@45+, T7@55+, T8@65+, T9@75+,
// T10@85+; stars = level/10), then fight a REAL monster: loadMap to the map
// whose levelReq is nearest, spawnMonster from its own roster, and swing the
// real hitMonster pipeline.
//
// Anomaly flags:
//   OHKO      — a normal mob dies in 1 swing (content trivialised)
//   TANK      — the mob needs >60 hits to down the player (near-unkillable)
//   GLASS     — player dies in <3 hits (underpowered anomaly, the other tail)
//   SLOG      — mob takes >150 swings (damage curve broken the other way)

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const EXE = process.env.MOJI_PW_EXE || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const PORT = process.argv[2] || '8080';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', String(e).slice(0, 140)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => { try { return typeof spawnMonster === 'function' && typeof applyJob === 'function' && typeof loadMap === 'function'; } catch { return false; } }, null, { timeout: 90000 });

const rows = await page.evaluate(async () => {
  const LEVELS = [20, 40, 60, 80, 100];
  const paths = Object.keys(JOBS).filter((j) => JOBS[j].cls && CLASSES[JOBS[j].cls]);
  const masterOf = (job) => Object.keys(MASTERS).find((m) => MASTERS[m].from === job) || null;
  const tierCap = (lv) => lv >= 85 ? 10 : lv >= 75 ? 9 : lv >= 65 ? 8 : lv >= 55 ? 7 : lv >= 45 ? 6 : lv >= 30 ? 5 : 4;

  const mapFor = (lv) => {
    let best = null, bd = 1e9;
    for (const id in MAPS) {
      const req = +MAPS[id].levelReq || 0;
      if (!req || MAPS[id].isTown || MAPS[id].isBossArena || !((MAPS[id].spawns || []).some((s) => s.type && !s.boss))) continue;
      const d = Math.abs(req - lv);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  };
  const bestGear = (cls, cap, stars) => {
    const best = {};
    const cats = { weapons: 'weapon', armors: 'armor', accessories: 'accessory' };
    for (const cat in cats) {
      let top = null, sc = -Infinity;
      for (const base of ITEM_POOL[cat]) {
        if ((base.tier | 0) > cap) continue;
        if (base.cls && base.cls !== 'any' && base.cls !== cls) continue;
        const it = Object.assign({}, base, { stars });
        const v = itemScore(it);
        if (v > sc) { sc = v; top = it; }
      }
      if (top) best[cats[cat]] = top;
    }
    return best;
  };

  const out = [];
  for (const job of paths) {
    const cls = JOBS[job].cls;
    const master = masterOf(job);
    for (const lv of LEVELS) {
      // build the character through the real paths
      player.buffs = {}; player.inRage = false; player.mods = player.mods || {};
      player.equipped.weapon = player.equipped.armor = player.equipped.accessory = null;
      player._equipBonusCache = null;
      applyClass(cls);
      player.level = 1; player.job = null; player.master = null;
      player._advNudge20 = true; player._advNudge40 = true;
      let g = 0;
      while (player.level < lv && g++ < 400) { player.exp = 1e12; _maybeLevelUp(); }
      player.exp = 0;
      if (lv >= 20) { try { applyJob(job); } catch (e) {} }
      if (lv >= 40 && master) { try { applyMaster(master); } catch (e) {} }
      const gear = bestGear(cls, tierCap(lv), Math.min(10, Math.floor(lv / 10)));
      player.equipped.weapon = gear.weapon || null;
      player.equipped.armor = gear.armor || null;
      player.equipped.accessory = gear.accessory || null;
      player._equipBonusCache = null;

      // real monster on its real map
      const mapId = mapFor(lv);
      try { loadMap(mapId); } catch (e) {}
      game.paused = false;
      game.monsters.length = 0;
      const sp = (MAPS[mapId].spawns || []).find((x) => x.type && !x.boss);
      try { spawnMonster(300, 300, sp.type, false, false); } catch (e) {}
      const m = game.monsters[game.monsters.length - 1];
      if (!m) { out.push({ job, cls, lv, err: 'no spawn on ' + mapId }); continue; }
      if (m.traits) { delete m.traits.parryChance; delete m.traits.phantomDodge; }
      m.evasion = 0;   // isolate raw damage; accuracy gate already measured elsewhere

      const atk = Math.round(getAtk());
      const hp = Math.round(getMaxHp());
      const mobHp0 = m.currentHp;
      let swings = 0;
      while (m.currentHp > 0 && swings < 400) { swings++; try { hitMonster(m, Math.floor(atk), rollCrit(), 'slash'); } catch (e) { break; } }
      const killed = m.currentHp <= 0;
      const gapMul = (typeof _lvGapDmgMul === 'function') ? _lvGapDmgMul(m) : 1;
      let hit = (m.atk || 0) * gapMul;
      try { hit = _diffDmg(hit, _mobLevel(m)); } catch (e) {}
      const hitsToDie = hit > 0 ? Math.ceil(hp / hit) : Infinity;
      out.push({ job, cls, master, lv, map: mapId, mob: m.type, mobLv: _mobLevel(m), mobHp: Math.round(mobHp0),
        atk, hp, swings: killed ? swings : Infinity, hitsToDie });
      game.monsters.length = 0;
    }
  }
  return out;
});

let anomalies = 0;
const flag = (r) => {
  const f = [];
  if (r.swings !== Infinity && r.swings <= 1) f.push('OHKO');
  if (r.hitsToDie !== Infinity && r.hitsToDie > 60) f.push('TANK');
  if (r.hitsToDie !== Infinity && r.hitsToDie < 3) f.push('GLASS');
  if (r.swings === Infinity || r.swings > 150) f.push('SLOG');
  return f;
};
console.log('\nPOWER CURVE — advancement paths vs level-appropriate real monsters\n');
console.log('  path                    lv   mob             mobLv   playerATK  playerHP  swings  hits2die  flags');
for (const r of rows) {
  if (r.err) { console.log(`  ${(r.job + '/' + r.cls).padEnd(22)} ${String(r.lv).padStart(3)}  ERR ${r.err}`); continue; }
  const f = flag(r);
  if (f.length) anomalies++;
  console.log('  ' + `${r.job}${r.master && r.lv >= 40 ? '+' + r.master : ''}`.padEnd(24) + String(r.lv).padStart(3)
    + '  ' + String(r.mob).padEnd(16) + String(r.mobLv).padStart(4)
    + String(r.atk).padStart(11) + String(r.hp).padStart(10)
    + String(r.swings === Infinity ? '∞' : r.swings).padStart(8) + String(r.hitsToDie === Infinity ? '∞' : r.hitsToDie).padStart(9)
    + '  ' + (f.join(',') || '-'));
}
console.log(`\n${anomalies ? 'ANOMALIES: ' + anomalies + ' row(s) flagged' : 'CLEAN — no rows flagged'}`);
await browser.close();
process.exit(0);   // reporting audit — exit code reserved until thresholds are agreed
