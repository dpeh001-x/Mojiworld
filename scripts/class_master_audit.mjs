#!/usr/bin/env node
// MASTER-TIER CLASS AUDIT at equalised ATK / DEF / HP.
//
// Per user: "necromancer class is too overpowered, do an extensive audit on
// the different classes and suggest the list of skills to nerf".
//
// Every master line in the game (enumerated at runtime from MASTERS/JOBS, so
// nothing is hand-mapped) fights the same normalised training dummy for the
// same window with getAtk/getDef/getMaxHp solved to identical values, rank-0
// skills, no gear, no boons. Reported per line: DPS, damage share per skill
// tag, healing received (sustain), and damage taken.
//
// Carries every hard-won lesson from class_damage_dummy_test.mjs:
//   * ONE FRESH PAGE PER LINE — single-page runs were order-dependent.
//   * CROSS-CLASS WARM-UP — the first class applied in a fresh page cannot
//     fire projectile skills at all (measured: 0 arrow hits direct, 37 after
//     a 6s warm-up as another class).
//   * Damage read off the dummy's per-frame HP drop OUTSIDE the hitMonster
//     hook (in-hook summing double-counts re-entrant effects), topped up per
//     frame; DPS per GAME-second; game.comboMult pinned; the dummy is not
//     position-pinned (that breaks projectile collision); mods cloned from
//     the game's own shape (a missing key NaN-poisons every crit).
//
//   node scripts/class_master_audit.mjs [file.html]
//   LX_SECS=35 LX_ONLY=necromancer,sage node scripts/class_master_audit.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const SECONDS = Number(process.env.LX_SECS || 35);
const ONLY = (process.env.LX_ONLY || '').split(',').filter(Boolean);
const CROWD = Number(process.env.LX_CROWD || 1);
const PORT0 = Number(process.env.LX_PORT || 10300);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT0)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });

// Enumerate the tree once from a throwaway page.
const boot = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT0}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Probe');
  await page.evaluate(() => {
    const m = document.getElementById('class-select-modal');
    for (const el of m.querySelectorAll('button,div,li')) {
      if (el.children.length > 3) continue;
      if (getComputedStyle(el).display === 'none') continue;
      if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
    }
  });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2000);
  return page;
};

const treePage = await boot();
const TREE = await treePage.evaluate(() => {
  const rows = [];
  for (const m in MASTERS) {
    const job = MASTERS[m].from;
    const cls = JOBS[job] && JOBS[job].cls;
    if (cls) rows.push({ master: m, job, cls });
  }
  return rows;
});
await treePage.close();

const lines = ONLY.length ? TREE.filter((t) => ONLY.includes(t.master)) : TREE;
console.log(`auditing ${lines.length} master lines, ${SECONDS}s each, equalised stats\n`);

const rows = [];
for (const line of lines) {
  const page = await boot();
  const r = await page.evaluate(async ({ line, SECONDS, CROWD }) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const strip = () => {
      const mods = JSON.parse(JSON.stringify(player.mods || {}));
      for (const k in mods) if (typeof mods[k] === 'number') mods[k] = 0;
      player.mods = mods;
      player.equipped = {}; player.buffs = {}; player.skillRanks = {};
      player.skillCooldowns = {}; player._activeSynergies = null; player._enh = null;
      game.dexPerm = { atk: 0, def: 0 }; game.prestige = { hpBonus: 0, critBonus: 0 };
      player.inRage = false; player._god = false;
      player.tree = {}; player.treeUnlocked = {};
    };
    const solve = (field, getter, target) => {
      let lo = 1, hi = target * 4;
      for (let i = 0; i < 44; i++) {
        const mid = Math.floor((lo + hi) / 2);
        player[field] = mid;
        if (getter() < target) lo = mid + 1; else hi = mid;
      }
      player[field] = lo;
    };
    const modal = document.getElementById('class-select-modal');
    if (modal) modal.style.display = 'none';

    // Cross-class warm-up (projectiles dead for the first class in a page).
    {
      const warmCls = (line.cls === 'warrior') ? 'rogue' : 'warrior';
      applyClass(warmCls); player.level = 60; game.paused = false;
      player.baseAtk = 110; player.maxMp = 99999; player.mp = 99999; player.hp = getMaxHp();
      loadMap('innerDimension'); game.paused = false;
      await wait(300);
      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0; game.projectiles.length = 0;
      spawnMonster(900, 300, 'towerWarden', false, false);
      const wm = game.monsters.find((q) => q && q.type === 'towerWarden');
      const wIds = Object.keys(SKILLS).filter((id) => {
        const s = SKILLS[id];
        return s && s.cls === warmCls && !s.job && !s.master && slotLevelReq(s.slot) <= 20;
      });
      let warm = true;
      const wb = () => {
        if (!warm) return;
        try {
          if (wm) { wm.maxHp = 5e7; wm.currentHp = wm.maxHp; if (!game.monsters.includes(wm)) game.monsters.push(wm); player.x = wm.x - 46; player.y = wm.y; }
          player.facing = 1; player.onGround = true; player.hp = getMaxHp(); player.mp = 99999;
          for (const id of wIds) if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) <= 0) { try { castSkill(id); } catch (e) {} }
        } catch (e) {}
        requestAnimationFrame(wb);
      };
      requestAnimationFrame(wb);
      await wait(6000);
      warm = false; await wait(150);
    }

    // The line under test.
    if (typeof resetJobAndMaster === 'function') { try { resetJobAndMaster(); } catch (e) {} }
    applyClass(line.cls);
    player.level = 60;
    try { applyJob(line.job); } catch (e) { return { line, error: 'applyJob: ' + e }; }
    try { applyMaster(line.master); } catch (e) { return { line, error: 'applyMaster: ' + e }; }
    if (player.job !== line.job || player.master !== line.master) {
      return { line, error: 'advancement did not stick (job ' + player.job + ', master ' + player.master + ')' };
    }
    // applyJob/applyMaster fire advancement story beats that PAUSE the game.
    // castSkill does not check pause, so melee skills still landed while the
    // whole projectile/hazard sim was frozen - which made every projectile
    // line and the necromancer vortex measure ZERO. Dismiss the beats, then
    // force-unpause (and keep forcing it in the bot: closing a beat can
    // re-pause on its closing frame).
    for (let i = 0; i < 10; i++) {
      const ov = document.getElementById('story-beat-overlay');
      if (ov && ov.classList.contains('on')) { ov.click(); await wait(200); } else break;
    }
    game.paused = false;
    strip();
    solve('baseAtk', getAtk, 300);
    solve('baseDef', getDef, 80);
    solve('maxHp', getMaxHp, 6000);
    player.maxMp = 99999; player.mp = 99999; player.hp = getMaxHp();

    loadMap('innerDimension'); game.paused = false;
    await wait(500);
    for (const q of (game.monsters || [])) q.currentHp = 0;
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    if (game.minions) game.minions.length = 0;
    const N = Math.max(1, CROWD | 0);
    for (let i = 0; i < N; i++) spawnMonster(860 + (i % 4) * 70, 300 - Math.floor(i / 4) * 60, 'towerWarden', false, false);
    const dummies = game.monsters.filter((q) => q && q.type === 'towerWarden');
    if (!dummies.length) return { line, error: 'dummy did not spawn' };
    for (const d of dummies) { d.def = 80; d.evasion = 0; d.traits = {}; d._defVar = 1; d._dmgTakenMul = 1; d.level = 60; d.maxHp = 5e8; d.currentHp = d.maxHp; }
    const m = dummies[0];

    const byTag = {};
    const realHit = window.hitMonster;
    window.hitMonster = function (mm, dmg, isCrit, skill) {
      const before = mm ? mm.currentHp : 0;
      const r = realHit.apply(this, arguments);
      if (mm && mm.type === 'towerWarden') {
        const d = before - mm.currentHp;
        if (d > 0) {
          const t = skill || '(none)';
          const e = byTag[t] || (byTag[t] = { hits: 0, dmg: 0 });
          e.hits++; e.dmg += d;
        }
      }
      return r;
    };

    const ids = Object.keys(SKILLS).filter((id) => {
      const s = SKILLS[id];
      return s && s.cls === line.cls && (!s.job || s.job === line.job) && (!s.master || s.master === line.master);
    });

    // cast diagnostics: which skills ever set a cooldown (proxy for a
    // successful cast) vs never fired at all
    const castTried = {}, castOk = {};
    let dealt = 0, healed = 0, taken = 0, lastTargetHp = m.maxHp, lastHp = player.hp;
    const gt0 = game.time;
    let running = true;
    const bot = () => {
      if (!running) return;
      try {
        game.paused = false;   // beats re-pause on their closing frame
        for (const d of dummies) {
          if (d.currentHp < d.maxHp) dealt += (d.maxHp - d.currentHp);
          d.currentHp = d.maxHp;
          if (!game.monsters.includes(d)) game.monsters.push(d);
        }
        player.x = m.x - 60; player.y = m.y;
        player.facing = 1; player.onGround = true; player.mp = 99999;
        if (player.hp > lastHp) healed += (player.hp - lastHp);
        if (player.hp < lastHp) taken += (lastHp - player.hp);
        if (player.hp <= 0) player.hp = getMaxHp();
        lastHp = player.hp;
        try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
        for (const id of ids) {
          if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) <= 0) {
            castTried[id] = (castTried[id] || 0) + 1;
            try { castSkill(id); } catch (e) { castOk[id] = 'THREW ' + String(e).slice(0, 60); continue; }
            if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) > 0 && castOk[id] === undefined) castOk[id] = true;
          }
        }
      } catch (e) {}
      requestAnimationFrame(bot);
    };
    requestAnimationFrame(bot);
    await wait(SECONDS * 1000);
    running = false;
    window.hitMonster = realHit;

    const gsec = Math.max(0.001, (game.time - gt0) / 60);
    const tags = Object.entries(byTag).sort((a, b) => b[1].dmg - a[1].dmg)
      .map(([t, e]) => ({ t, dmg: Math.round(e.dmg), hits: e.hits }));
    return {
      line, gsec: +gsec.toFixed(1),
      dps: Math.round(dealt / gsec),
      hps: Math.round(healed / gsec),
      tps: Math.round(taken / gsec),
      atk: getAtk(), def: getDef(), hp: getMaxHp(),
      skills: ids.length, tags, castTried, castOk,
      maxHexStacks: Math.max(0, ...game.monsters.filter((q)=>q&&q.type==='towerWarden').map((q)=>q._hexStacks|0)),
    };
  }, { line, SECONDS, CROWD });
  rows.push(r);
  await page.close();
  const tag = r.error ? ('ERROR ' + r.error) : (`DPS ${String(r.dps).padStart(6)}  heal/s ${String(r.hps).padStart(5)}  ATK ${r.atk}`);
  console.log(`  ${r.line.cls.padEnd(8)} ${r.line.job.padEnd(10)} ${r.line.master.padEnd(13)} ${tag}`);
}
await browser.close(); server.kill();

console.log('\n================ RANKED (equal ATK/DEF/HP) ================');
console.log('  master         line                 DPS   heal/s  taken/s');
const okRows = rows.filter((r) => !r.error).sort((a, b) => b.dps - a.dps);
for (const r of okRows) {
  console.log(`  ${r.line.master.padEnd(13)} ${(r.line.cls + '>' + r.line.job).padEnd(18)} ${String(r.dps).padStart(7)} ${String(r.hps).padStart(8)} ${String(r.tps).padStart(8)}`);
}
console.log('\n================ DAMAGE BY SKILL TAG (top lines) ================');
for (const r of okRows.slice(0, 8)) {
  const tot = r.tags.reduce((a, e) => a + e.dmg, 0) || 1;
  console.log(`  ${r.line.master.padEnd(13)} ` + r.tags.slice(0, 6).map((e) => `${e.t} ${Math.round(100 * e.dmg / tot)}%`).join('  '));
}
for (const r of okRows) {
  if (!r.castOk) continue;
  const dead = Object.keys(r.castTried || {}).filter((id) => r.castOk[id] === undefined);
  const threw = Object.entries(r.castOk).filter(([, v]) => typeof v === 'string');
  if (dead.length || threw.length) {
    console.log('  ' + r.line.master + '  never-cast: [' + dead.join(', ') + ']' + (threw.length ? '  threw: ' + JSON.stringify(threw) : ''));
  }
}
const med = okRows.length ? okRows[Math.floor(okRows.length / 2)].dps : 1;
console.log('\nSUMMARY ' + JSON.stringify({ median: med, top: okRows.slice(0, 5).map((r) => ({ m: r.line.master, dps: r.dps, x: +(r.dps / med).toFixed(2) })) }));
