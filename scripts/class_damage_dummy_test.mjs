#!/usr/bin/env node
// Lv-20 CLASS *DAMAGE* COMPARISON against a normalised training dummy.
//
// Companion to class_balance_mirror_test.mjs, which measures the Mirror Self
// trial. That boss OVERWRITES damage with 1% of its maxHp per hit and disables
// crits, so it can only ever measure HITS PER SECOND -- it is useless for
// tuning a skill coefficient. This file exists to answer the other question:
// at equal ATK/DEF/HP, how much DAMAGE does each class actually deal?
//
// ONE FRESH PAGE PER CLASS. The single-page version of this measurement was
// order-dependent: rogue read 582 DPS when it ran first and 1,074 when it ran
// after warrior in the same page -- a 1.85x swing from state the per-run reset
// did not catch. Every class now gets its own page load, which removes that
// entire class of bug rather than chasing the leaks one at a time.
//
// THE DUMMY IS NORMALISED so the comparison isolates damage:
//   evasion 0   otherwise per-class accuracy (archer 130 vs mage 90) turns into
//               hit/miss RNG layered on top of the signal
//   traits {}   no armorShield / per-monster damage reduction
//   def pinned  every class faces the same armour curve
//   huge HP     survives the window; it is also topped up every frame
// Damage is the dummy's per-frame HP drop read OUTSIDE the hitMonster hook
// (summing inside it double-counts: effects re-enter hitMonster from within a
// hit). DPS is per GAME-second, and game.comboMult is pinned.
//
//   node scripts/class_damage_dummy_test.mjs [file.html]
//   LX_SECS=30 LX_TARGET=towerWarden LX_DEF=40 LX_CLASSES=rogue,mage
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');
const SECONDS = Number(process.env.LX_SECS || 30);
const TARGET_TYPE = process.env.LX_TARGET || 'towerWarden';
const DUMMY_DEF = Number(process.env.LX_DEF || 40);
const CLASSES = (process.env.LX_CLASSES || 'warrior,rogue,archer,mage').split(',');
const ONLY_SKILL = process.env.LX_SKILLS || '';
const ATK_T = Number(process.env.LX_ATK || 120);

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const rows = [];

for (const cls of CLASSES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof applyClass === 'function' && typeof hitMonster === 'function', { timeout: 90000 });

  const r = await page.evaluate(async ({ cls, SECONDS, TARGET_TYPE, DUMMY_DEF, ONLY_SKILL, ATK_T, RAW, WARM }) => {
    window._lxBootGateDone = true;
    try { document.getElementById('loading-overlay').remove(); } catch (e) {}
    try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const modal = document.getElementById('class-select-modal');
    if (modal) modal.style.display = 'none';

    // CROSS-CLASS WARM-UP -- required, not hygiene. The FIRST class applied in
    // a fresh page cannot fire projectile skills at all: archer's arrow, mage's
    // bolt and rogue's Shuriken were absent from the damage breakdown entirely
    // while every melee tag worked. Measured directly: going straight to archer
    // yields 0 arrow hits; running warrior for six seconds first and then
    // switching yields 37. This is why rogue read 582 DPS when it ran first and
    // 1,074 when it ran second -- it was missing its Shuriken, not gaining a
    // buff. A different class is run and discarded before the real setup.
    {
      const warmCls = (cls === 'warrior') ? 'rogue' : 'warrior';
      applyClass(warmCls);
      player.level = 20; game.paused = false;
      player.baseAtk = 110; player.baseDef = 40; player.maxHp = 1150;
      player.maxMp = 99999; player.mp = 99999; player.hp = getMaxHp();
      player.job = null; player.master = null; player._enh = null;
      loadMap('innerDimension'); game.paused = false;
      await wait(300);
      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0; game.projectiles.length = 0;
      spawnMonster(900, 300, TARGET_TYPE, false, false);
      const wm = game.monsters.find((q) => q && q.type === TARGET_TYPE);
      const wIds = Object.keys(SKILLS).filter((id) => {
        const s = SKILLS[id];
        return s && s.cls === warmCls && !s.job && !s.master && slotLevelReq(s.slot) <= 20;
      });
      let warm = true;
      const warmBot = () => {
        if (!warm) return;
        try {
          if (wm) {
            wm.maxHp = 5e7; wm.currentHp = wm.maxHp;
            if (!game.monsters.includes(wm)) game.monsters.push(wm);
            player.x = wm.x - 46; player.y = wm.y;
          }
          player.facing = 1; player.onGround = true;
          player.hp = getMaxHp(); player.mp = 99999;
          for (const id of wIds) {
            if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) <= 0) {
              try { castSkill(id); } catch (e) {}
            }
          }
        } catch (e) {}
        requestAnimationFrame(warmBot);
      };
      requestAnimationFrame(warmBot);
      await wait(WARM * 1000);
      warm = false;
      await wait(150);
    }

    applyClass(cls);
    if (modal) modal.style.display = 'none';
    game.paused = false;
    player.level = 20;

    const mods = JSON.parse(JSON.stringify(player.mods || {}));
    for (const k in mods) if (typeof mods[k] === 'number') mods[k] = 0;
    player.mods = mods;
    player.equipped = {}; player.buffs = {}; player.skillRanks = {};
    player.skillCooldowns = {}; player._levelUpSpent = {};
    player._trainerSpent = { atk: 0, def: 0, hp: 0 };
    player._activeSynergies = null; player._enh = null;
    game.dexPerm = { atk: 0, def: 0 };
    game.prestige = { hpBonus: 0, critBonus: 0 };
    player.inRage = false; player._god = false;
    player.job = null; player.master = null;
    player.tree = {}; player.treeUnlocked = {};

    const solve = (field, getter, target) => {
      let lo = 1, hi = target * 4;
      for (let i = 0; i < 44; i++) {
        const mid = Math.floor((lo + hi) / 2);
        player[field] = mid;
        if (getter() < target) lo = mid + 1; else hi = mid;
      }
      player[field] = lo;
    };
    solve('baseAtk', getAtk, ATK_T);
    solve('baseDef', getDef, 40);
    solve('maxHp', getMaxHp, 2000);
    player.maxMp = 99999; player.mp = 99999; player.hp = getMaxHp();

    loadMap('innerDimension');
    game.paused = false;
    await wait(500);
    if (game.currentMap !== 'innerDimension') return { cls, error: 'map ' + game.currentMap };

    for (const q of (game.monsters || [])) q.currentHp = 0;
    game.monsters.length = 0;
    game.projectiles.length = 0; game.hazards.length = 0;
    spawnMonster(900, 300, TARGET_TYPE, false, false);
    const m = game.monsters.find((q) => q && q.type === TARGET_TYPE);
    if (!m) return { cls, error: TARGET_TYPE + ' did not spawn' };
    if (!RAW) {
      m.def = DUMMY_DEF; m.evasion = 0; m.traits = {};
      m._defVar = 1; m._dmgTakenMul = 1; m.level = 20;
      m.maxHp = 5e7; m.currentHp = m.maxHp;
    }

    const stats = { atk: getAtk(), def: getDef(), hp: getMaxHp(), crit: getCrit() };

    let hits = 0, crits = 0;
    const byTag = {};
    const realHit = window.hitMonster;
    window.hitMonster = function (mm, dmg, isCrit, skill) {
      const before = mm ? mm.currentHp : 0;
      const r = realHit.apply(this, arguments);
      if (mm === m) {
        const d = before - mm.currentHp;
        if (d > 0) {
          hits++; if (isCrit) crits++;
          const t = skill || '(none)';
          const e = byTag[t] || (byTag[t] = { hits: 0, dmg: 0, crits: 0 });
          e.hits++; e.dmg += d; if (isCrit) e.crits++;
        }
      }
      return r;
    };

    let ids = Object.keys(SKILLS).filter((id) => {
      const s = SKILLS[id];
      return s && s.cls === cls && !s.job && !s.master && slotLevelReq(s.slot) <= 20;
    });
    if (ONLY_SKILL) ids = ids.filter((i) => ONLY_SKILL.split(',').includes(i));


    let dealt = 0, frames = 0, lastTargetHp = m.maxHp;
    const gt0 = game.time;
    let running = true;
    const bot = () => {
      if (!running) return;
      frames++;
      try {
        if (m.currentHp < lastTargetHp) dealt += (lastTargetHp - m.currentHp);
        m.currentHp = m.maxHp;
        lastTargetHp = m.maxHp;
        if (!game.monsters.includes(m)) game.monsters.push(m);
        // The dummy is NOT position-pinned. Forcing m.x/m.y every frame breaks
        // projectile collision -- archer's arrow, mage's bolt and rogue's
        // Shuriken all stopped registering entirely (archer fell to 7 DPS from
        // evade_blast alone), because the teleport invalidates the sweep the
        // projectile-vs-monster test relies on. The player is repositioned
        // relative to the dummy each frame instead, which keeps the engagement
        // constant without touching the target.
        player.x = m.x - 46; player.y = m.y;
        player.facing = 1; player.onGround = true;
        player.hp = getMaxHp(); player.mp = 99999;   // remove death/MP as variables
        try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
        for (const id of ids) {
          if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) <= 0) {
            try { castSkill(id); } catch (e) {}
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
    return {
      cls, ...stats, frames, gsec: +gsec.toFixed(1), dealt, hits, crits,
      dps: Math.round(dealt / gsec),
      perHit: hits ? Math.round(dealt / hits) : 0,
      hps: +(hits / gsec).toFixed(2),
      critRate: hits ? +(100 * crits / hits).toFixed(0) : 0,
      byTag,
    };
  }, { cls, SECONDS, TARGET_TYPE, DUMMY_DEF, ONLY_SKILL, ATK_T, RAW: !!process.env.LX_RAW, WARM: Number(process.env.LX_WARM || 6) });

  rows.push(r);
  await page.close();
}
await browser.close();

console.log(`\n  Lv 20 damage vs ${TARGET_TYPE} dummy (DEF ${DUMMY_DEF}, no evasion/traits) — ${SECONDS}s, ${FILE}`);
console.log('  ATK/DEF/HP equalised · rank-0 skills · no gear/boons/job · fresh page per class\n');
console.log('  class     ATK  crit% |    DPS   hits/s  dmg/hit  crit%obs');
for (const r of rows) {
  if (r.error) { console.log(`  ${r.cls.padEnd(8)} ${r.error}`); continue; }
  console.log(`  ${r.cls.padEnd(8)} ${String(r.atk).padStart(4)} ${String(r.crit).padStart(6)} | ${String(r.dps).padStart(6)} ${String(r.hps).padStart(8)} ${String(r.perHit).padStart(8)} ${String(r.critRate).padStart(9)}`);
}
console.log('\n  damage by skill tag:');
for (const r of rows) {
  if (r.error || !r.byTag) continue;
  const tot = Object.values(r.byTag).reduce((a, e) => a + e.dmg, 0) || 1;
  console.log('  ' + r.cls.padEnd(8) + Object.entries(r.byTag).sort((a, b) => b[1].dmg - a[1].dmg)
    .map(([t, e]) => `${t} ${Math.round(100 * e.dmg / tot)}%`).join('  '));
}
{
  const d = {};
  for (const r of rows) if (!r.error) d[r.cls] = r.dps;
  const ratio = (d.rogue && d.mage) ? +(d.rogue / d.mage).toFixed(2) : null;
  console.log('\nSUMMARY ' + JSON.stringify({ ...d, rogue_over_mage: ratio }));
}
