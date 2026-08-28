#!/usr/bin/env node
// Lv-20 CLASS BALANCE vs MIRROR SELF, with ATK / DEF / HP held equal.
//
// WHY THE EQUALISATION IS NOT JUST "SET baseAtk". Three separate class
// multipliers sit between the base fields and the values combat actually uses:
//   getAtk()    mage 1.22 · rogue 1.15 · archer 1.10 · warrior 1.10
//   getDef()    warrior 1.25
//   getMaxHp()  warrior 1.30 · rogue 1.20 · archer 1.16 · mage 1.12, then x1.5
// Pinning the base fields leaves ATK at 132/138/132/146 and warrior DEF 25%
// clear of everyone, so both runs are reported:
//   EQUALISED  getAtk/getDef/getMaxHp solved to be IDENTICAL. Isolates the kit.
//   NATURAL    the same stat POINTS, class multipliers left on -- what a real
//              Lv-20 character of each class actually walks in with.
//
// MIRROR SELF SCALES OFF THE PLAYER (maxHp = getMaxHp() x 50 before the boss
// multipliers, atk = getAtk() x 0.4, hitbox = player hitbox), so under
// EQUALISED every class faces a numerically identical boss. Its final HP is
// MEASURED, not assumed -- the post-spawn boss scaling takes it to ~150x.
//
// HARNESS NOTES, all of which cost a wrong answer first:
//  * The game boots to the title with class-select open and the map set to
//    'void', which is flagged isTown -- so updateMonsters' SANCTUARY SWEEP
//    deleted the mirror every frame and every measurement read zero. Play must
//    be started the way the class card does it before loadMap will stick.
//  * There is no update(dt) to call. The real loop is _lxFrame, rAF-driven,
//    so this lets REAL TIME pass and drives inputs from a parallel rAF loop.
//  * getEvasion() returns a forced 0.5 during a rogue dash window; sampling it
//    without clearing _dashEvadeUntil reported every class at the 50% cap.
//
// No job advancement: the Mirror trial IS the Lv-20 advancement, so slots
// d/s/a/e/w only. Rank-0 skills, no gear, no boons.
//
//   node scripts/class_balance_mirror_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, 'mojiworld_game.html').split(path.sep).join('/');
const SECONDS = Number(process.env.LX_SECS || 30);

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof applyClass === 'function' && typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async ({ SECONDS }) => {
  window._lxBootGateDone = true;
  try { document.getElementById('loading-overlay').remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const TARGET = { atk: 120, def: 40, hp: 2000 };
  const CLASSES = ['warrior', 'rogue', 'archer', 'mage'];
  const results = [];

  // The game's OWN mods shape, captured before anything is touched. Replacing
  // player.mods with a hand-written {} is what poisoned the first run: many
  // getters read a key arithmetically (getCritDmg does `1.5 +
  // player.mods.critDmg`), so a missing key silently becomes NaN. Every crit
  // in the game then dealt NaN damage and the `d > 0` counter below discarded
  // it -- which is why the crit column read a flat 0% for all four classes.
  const PRISTINE_MODS = JSON.parse(JSON.stringify(player.mods || {}));

  const strip = () => {
    player.mods = JSON.parse(JSON.stringify(PRISTINE_MODS));
    for (const k in player.mods) if (typeof player.mods[k] === 'number') player.mods[k] = 0;
    player.equipped = {}; player.buffs = {}; player.skillRanks = {};
    player.skillCooldowns = {}; player._levelUpSpent = {};
    player._trainerSpent = { atk: 0, def: 0, hp: 0 };
    player._activeSynergies = null;
    game.dexPerm = { atk: 0, def: 0 };
    game.prestige = { hpBonus: 0, critBonus: 0 };
    player.inRage = false; player._god = false;
    player.job = null; player.master = null;
    // Cross-run leaks. _dashEvadeUntil forces getEvasion() to the 0.5 cap and
    // survived into the next class's sample before this line existed.
    player._dashEvadeUntil = 0; player._steady = 0; player._rampN = 0;
    player._bloodRitualUntil = 0; player._rampUntil = 0;
    player.invulnerable = 0; player._skillLockTimer = 0; player._downed = false;
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

  // Exactly what the class-select card's onclick does. Without this the game
  // stays at the title, the map stays 'void' (isTown), and the sanctuary sweep
  // eats the boss.
  const beginPlay = (cls) => {
    applyClass(cls);
    const modal = document.getElementById('class-select-modal');
    if (modal) modal.style.display = 'none';
    game.paused = false;
  };

  const skillsFor = (cls) => Object.keys(SKILLS).filter((id) => {
    const s = SKILLS[id];
    return s && s.cls === cls && !s.job && !s.master && slotLevelReq(s.slot) <= 20;
  });

  for (const equalised of [true, false]) {
    for (const cls of CLASSES) {
      beginPlay(cls);
      player.level = 20;
      strip();
      if (equalised) {
        solve('baseAtk', getAtk, TARGET.atk);
        solve('baseDef', getDef, TARGET.def);
        solve('maxHp', getMaxHp, TARGET.hp);
      } else {
        player.baseAtk = TARGET.atk; player.baseDef = TARGET.def; player.maxHp = TARGET.hp;
      }
      player.maxMp = 99999; player.mp = 99999;
      player.hp = getMaxHp();

      loadMap('innerDimension');
      game.paused = false;
      await wait(400);
      if (game.currentMap !== 'innerDimension') {
        results.push({ cls, equalised, error: 'map did not load (got ' + game.currentMap + ')' });
        continue;
      }

      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0;
      game.projectiles.length = 0; game.hazards.length = 0;
      spawnMonster(900, 300, 'mirrorSelf', true, false);
      const m = game.monsters.find((q) => q && q.type === 'mirrorSelf');
      if (!m) { results.push({ cls, equalised, error: 'mirror did not spawn' }); continue; }

      const stats = { atk: getAtk(), def: getDef(), hp: getMaxHp(), crit: getCrit(), eva: +(getEvasion() * 100).toFixed(1) };
      const bossHp = m.maxHp, bossAtk = m.atk;

      let dealt = 0, hits = 0, crits = 0, nanHits = 0, nanCrits = 0;
      const byTag = {};
      const realHit = window.hitMonster;
      window.hitMonster = function (mm, dmg, isCrit, skill) {
        const before = mm ? mm.currentHp : 0;
        const r = realHit.apply(this, arguments);
        if (mm === m) {
          const d = before - mm.currentHp;
          // NaN is REPORTED, never filtered. A silent `if (d > 0)` is exactly
          // how the NaN-crit bug hid: every crit vanished from the totals and
          // the table looked merely boring rather than broken.
          if (Number.isNaN(d)) { nanHits++; if (isCrit) nanCrits++; }
          else if (d > 0) {
            dealt += d; hits++; if (isCrit) crits++;
            const t = skill || '(none)';
            const e = byTag[t] || (byTag[t] = { hits: 0, dmg: 0, crits: 0 });
            e.hits++; e.dmg += d; if (isCrit) e.crits++;
          }
        }
        return r;
      };

      let taken = 0, deaths = 0, lastHp = player.hp, frames = 0;
      const ids = skillsFor(cls);
      let running = true;
      const bot = () => {
        if (!running) return;
        frames++;
        try {
          // Boss stays alive: this is a clean DPS window, not a race that ends
          // early for whoever kills fastest.
          m.currentHp = m.maxHp;
          if (!game.monsters.includes(m)) game.monsters.push(m);
          // Melee band, facing the boss. Every class can fight here and the
          // mirror closes distance anyway (speed 3.5, and it mirrors you).
          player.x = m.x - 46; player.y = m.y;
          player.facing = 1; player.onGround = true;
          player.mp = 99999;
          for (const id of ids) {
            if (((player.skillCooldowns && player.skillCooldowns[id]) || 0) <= 0) {
              try { castSkill(id); } catch (e) {}
            }
          }
          if (player.hp < lastHp) taken += (lastHp - player.hp);
          if (player.hp <= 0) { deaths++; player.hp = getMaxHp(); }
          lastHp = player.hp;
        } catch (e) {}
        requestAnimationFrame(bot);
      };
      requestAnimationFrame(bot);
      await wait(SECONDS * 1000);
      running = false;
      window.hitMonster = realHit;

      results.push({
        cls, equalised, ...stats, bossHp, bossAtk, frames,
        dealt, hits, crits, byTag, nanHits, nanCrits,
        critRate: hits ? +(100 * crits / hits).toFixed(0) : 0,
        dps: Math.round(dealt / SECONDS),
        ttk: dealt > 0 ? +(bossHp / (dealt / SECONDS)).toFixed(0) : null,
        taken, tps: +(taken / SECONDS).toFixed(1), deaths,
        skills: ids.length,
      });
    }
  }
  return results;
}, { SECONDS });
await browser.close();

const fmt = (rows, title) => {
  console.log('\n  ' + title);
  console.log('  class     ATK  DEF   HP  crit% eva% |  boss HP  bATK |    DPS  hits crit%   TTK  | taken/s deaths');
  for (const r of rows) {
    if (r.error) { console.log(`  ${r.cls.padEnd(8)} ${r.error}`); continue; }
    console.log(
      `  ${r.cls.padEnd(8)} ${String(r.atk).padStart(4)} ${String(r.def).padStart(4)} ${String(r.hp).padStart(4)} ${String(r.crit).padStart(5)} ${String(r.eva).padStart(4)} | ${String(r.bossHp).padStart(8)} ${String(r.bossAtk).padStart(5)} | ${String(r.dps).padStart(6)} ${String(r.hits).padStart(5)} ${String(r.critRate).padStart(5)} ${String(r.ttk === null ? 'n/a' : r.ttk + 's').padStart(6)} | ${String(r.tps).padStart(7)} ${String(r.deaths).padStart(6)} ${r.nanHits ? " NaN:"+r.nanHits : ""}`
    );
  }
};
console.log(`\n  Mirror Self @ Lv 20 — ${SECONDS}s window, rank-0 skills, no gear/boons/job, melee band`);
fmt(out.filter((r) => r.equalised), 'EQUALISED — getAtk/getDef/getMaxHp identical (isolates the kit)');
fmt(out.filter((r) => !r.equalised), 'NATURAL — same stat POINTS, class multipliers left on');
console.log('\n  damage by skill tag (equalised run):');
for (const r of out.filter((x) => x.equalised && x.byTag)) {
  const parts = Object.entries(r.byTag).sort((a,b)=>b[1].dmg-a[1].dmg)
    .map(([t,e]) => t+' '+Math.round(100*e.dmg/r.dealt)+'% ('+e.hits+'h '+e.crits+'c)');
  console.log('  '+r.cls.padEnd(8)+parts.join('  '));
}
console.log('');
