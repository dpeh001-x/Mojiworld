#!/usr/bin/env node
// Lv-20 CLASS BALANCE vs MIRROR SELF, with ATK / DEF / HP held equal.
//
// WHY THE EQUALISATION IS NOT JUST "SET baseAtk". Three class multipliers sit
// between the base fields and the values combat actually uses:
//   getAtk()    mage 1.22 · rogue 1.15 · archer 1.10 · warrior 1.10
//   getDef()    warrior 1.25
//   getMaxHp()  warrior 1.30 · rogue 1.20 · archer 1.16 · mage 1.12, then x1.5
// Pinning the base fields leaves ATK at 132/138/132/146 and warrior DEF 25%
// clear of everyone, so two runs are reported:
//   EQUALISED  getAtk/getDef/getMaxHp solved IDENTICAL. Isolates the kit.
//   NATURAL    the same stat POINTS with the multipliers left on.
//
// MIRROR SELF SCALES OFF THE PLAYER (maxHp = getMaxHp() x 50 before boss
// scaling, atk = getAtk() x 0.4, player hitbox, class-matched projectile), so
// under EQUALISED every class faces a numerically identical boss.
//
// ============================ MEASUREMENT ==================================
// Three things had to be fixed before any number here meant anything, and each
// produced a CONFIDENT WRONG ANSWER first:
//
//  1. DAMAGE IS THE BOSS'S PER-FRAME HP DROP, read outside the hook.
//     Summing (before - after) inside a hitMonster wrapper DOUBLE-COUNTS,
//     because several effects re-enter hitMonster from inside a hit, so an
//     outer call's delta already contains the nested ones. That read a
//     76-damage input as 1,508 "applied" and made the totals almost
//     independent of the skill coefficients -- a deliberate 34% cut to rogue's
//     two main skills measured as NO CHANGE AT ALL. (Inflating maxHp to a huge
//     pool instead is also wrong: it breaks every percent-of-max-HP effect and
//     produced 2.4e10 damage from a 120-ATK character.)
//
//  2. DPS IS PER GAME-SECOND, NOT PER REAL SECOND. Headless rAF runs uncapped
//     and unevenly -- 7,000-9,500 frames in the same 30 s wall-clock window.
//     Cooldowns tick on game frames, so a fast run fires ~50% more rotations
//     per real second and rogue DPS scattered +/-20% for reasons unrelated to
//     its damage. game.time advances one unit per frame.
//
//  3. COMBO IS PINNED. game.comboMult climbs across consecutive hits and
//     multiplies applied damage several-fold. Uncontrolled, `flurry` -- whose
//     coefficient was never touched -- landed 1402 applied in one run and 389
//     in another.
//
// Other traps already paid for: the game boots to the title with class-select
// open and the map set to 'void' (flagged isTown), so updateMonsters' sanctuary
// sweep deletes the boss every frame unless play is started the way the class
// card does it; there is no update(dt) (the loop is _lxFrame, rAF-driven);
// player.mods must be cloned from the game's own shape, because getCritDmg does
// `1.5 + player.mods.critDmg` and a missing key makes EVERY CRIT deal NaN;
// getEvasion() returns a forced 0.5 during a rogue dash window.
//
// ============ READ THIS BEFORE TUNING ANY SKILL AGAINST THIS BOSS ==========
// MIRROR SELF IGNORES SKILL DAMAGE ENTIRELY. hitMonster contains:
//     if (m.isMirror || m.type === 'mirrorSelf') {
//       dmg = Math.max(1, Math.floor(m.maxHp * 0.01));   // exactly 1% of maxHp
//       isCrit = false;
//     }
// Damage is OVERWRITTEN, not scaled -- so ATK, crit, gear and every skill
// coefficient are irrelevant here. Verified: cutting rogue's stab 0.68 -> 0.02
// and Shuriken 0.6 -> 0.02 (a 97% cut) left its DPS unchanged, and raising ATK
// 120 -> 1200 also left it unchanged. This is deliberate (v0.25.781: "CAP
// re-tuned 39% -> 1% per hit ... 100 successful hits to kill").
// CONSEQUENCE: against Mirror Self, class DPS is purely HITS PER SECOND. The
// crit% column below reports the crit ARGUMENT rolled by the caller, which this
// boss then discards -- do not read it as applied crits. To compare skill
// DAMAGE, point this harness at an ordinary monster instead.
//
// No job advancement: the Mirror trial IS the Lv-20 advancement, so slots
// d/s/a/e/w only. Rank-0 skills, no gear, no boons.
//
//   node scripts/class_balance_mirror_test.mjs [file.html]
//   LX_SECS=30 LX_EQ_ONLY=1 LX_CLASSES=rogue,mage node scripts/...
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');
const SECONDS = Number(process.env.LX_SECS || 30);

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof applyClass === 'function' && typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async ({ SECONDS, EQ_ONLY, ONLY, NOATK, ONLYSK, ATKT }) => {
  window._lxBootGateDone = true;
  try { document.getElementById('loading-overlay').remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise((r) => setTimeout(r, 20000))]); } catch (e) {}
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const TARGET = { atk: ATKT || 120, def: 40, hp: 2000 };
  const CLASSES = ONLY ? ONLY.split(',') : ['warrior', 'rogue', 'archer', 'mage'];
  const results = [];
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

  for (const equalised of (EQ_ONLY ? [true] : [true, false])) {
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
        results.push({ cls, equalised, error: 'map did not load (' + game.currentMap + ')' }); continue;
      }
      for (const q of (game.monsters || [])) q.currentHp = 0;
      game.monsters.length = 0;
      game.projectiles.length = 0; game.hazards.length = 0;
      spawnMonster(900, 300, 'mirrorSelf', true, false);
      const m = game.monsters.find((q) => q && q.type === 'mirrorSelf');
      if (!m) { results.push({ cls, equalised, error: 'mirror did not spawn' }); continue; }

      const stats = { atk: getAtk(), def: getDef(), hp: getMaxHp(), crit: getCrit(), eva: +(getEvasion() * 100).toFixed(1) };
      const bossHp = m.maxHp, bossAtk = m.atk;

      // Hook counts HITS and crits only. Damage totals come from the frame
      // delta below -- see note 1 in the header.
      let hits = 0, crits = 0, nanHits = 0;
      const byTag = {};
      const realHit = window.hitMonster;
      window.hitMonster = function (mm, dmg, isCrit, skill) {
        const before = mm ? mm.currentHp : 0;
        const r = realHit.apply(this, arguments);
        if (mm === m) {
          const d = before - mm.currentHp;
          if (Number.isNaN(d)) nanHits++;
          else if (d > 0) {
            hits++; if (isCrit) crits++;
            const t = skill || '(none)';
            const e = byTag[t] || (byTag[t] = { hits: 0, dmg: 0, crits: 0 });
            e.hits++; e.dmg += d; if (isCrit) e.crits++;
          }
        }
        return r;
      };

      let dealt = 0, taken = 0, deaths = 0, frames = 0;
      let lastHp = player.hp, lastBossHp = m.maxHp;
      let ids = skillsFor(cls);
      if (ONLYSK) ids = ids.filter((i) => ONLYSK.split(",").includes(i));
      const gt0 = game.time;
      let running = true;
      const bot = () => {
        if (!running) return;
        frames++;
        try {
          // Read the boss's drop ONCE, then top it back up at its real maxHp.
          if (m.currentHp < lastBossHp) dealt += (lastBossHp - m.currentHp);
          m.currentHp = m.maxHp;
          lastBossHp = m.maxHp;
          if (!game.monsters.includes(m)) game.monsters.push(m);
          player.x = m.x - 46; player.y = m.y;
          player.facing = 1; player.onGround = true;
          player.mp = 99999;
          try { game.comboMult = 1; game.combo = 0; game.comboTimer = 0; } catch (e) {}
          if (!NOATK) for (const id of ids) {
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

      const gsec = Math.max(0.001, (game.time - gt0) / 60);
      results.push({
        cls, equalised, ...stats, bossHp, bossAtk,
        frames, gsec: +gsec.toFixed(1),
        dealt, hits, crits, nanHits, byTag,
        critRate: hits ? +(100 * crits / hits).toFixed(0) : 0,
        dps: Math.round(dealt / gsec),
        ttk: dealt > 0 ? Math.round(bossHp / (dealt / gsec)) : null,
        taken, tps: +(taken / gsec).toFixed(1), deaths,
      });
    }
  }
  return results;
}, { SECONDS, EQ_ONLY: !!process.env.LX_EQ_ONLY, ONLY: process.env.LX_CLASSES || '', NOATK: !!process.env.LX_NOATTACK, ONLYSK: process.env.LX_SKILLS || '', ATKT: Number(process.env.LX_ATK || 0) });
await browser.close();

const fmt = (rows, title) => {
  if (!rows.length) return;
  console.log('\n  ' + title);
  console.log('  class     ATK  DEF   HP  crit% eva% |  boss HP |    DPS  hits crit%   TTK  | game-s');
  for (const r of rows) {
    if (r.error) { console.log(`  ${r.cls.padEnd(8)} ${r.error}`); continue; }
    console.log(
      `  ${r.cls.padEnd(8)} ${String(r.atk).padStart(4)} ${String(r.def).padStart(4)} ${String(r.hp).padStart(4)} ${String(r.crit).padStart(5)} ${String(r.eva).padStart(4)} | ${String(r.bossHp).padStart(8)} | ${String(r.dps).padStart(6)} ${String(r.hits).padStart(5)} ${String(r.critRate).padStart(5)} ${String(r.ttk === null ? 'n/a' : r.ttk + 's').padStart(6)} | ${String(r.gsec).padStart(6)}${r.nanHits ? '  NaN:' + r.nanHits : ''}`
    );
  }
};
console.log(`\n  Mirror Self @ Lv 20 — ${SECONDS}s window (${FILE}), rank-0 skills, no gear/boons/job`);
fmt(out.filter((r) => r.equalised), 'EQUALISED — getAtk/getDef/getMaxHp identical (isolates the kit)');
fmt(out.filter((r) => !r.equalised), 'NATURAL — same stat POINTS, class multipliers left on');

const eqRows = out.filter((r) => r.equalised && r.byTag);
if (eqRows.length) {
  console.log('\n  damage by skill tag (equalised):');
  for (const r of eqRows) {
    const tot = Object.values(r.byTag).reduce((a, e) => a + e.dmg, 0) || 1;
    console.log('  ' + r.cls.padEnd(8) + Object.entries(r.byTag).sort((a, b) => b[1].dmg - a[1].dmg)
      .map(([t, e]) => `${t} ${Math.round(100 * e.dmg / tot)}% (${e.hits}h ${e.crits}c)`).join('  '));
  }
}
{
  const eq = {};
  for (const r of out.filter((x) => x.equalised && !x.error)) eq[r.cls] = r.dps;
  const ratio = (eq.rogue && eq.mage) ? +(eq.rogue / eq.mage).toFixed(2) : null;
  console.log('\nSUMMARY ' + JSON.stringify({ ...eq, rogue_over_mage: ratio }));
}
