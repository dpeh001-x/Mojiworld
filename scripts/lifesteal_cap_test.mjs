#!/usr/bin/env node
// Per user: "nerf max limit of combined lifesteal to only 10% of damage dealt".
//
// Four independent paths heal off one hit — gear/mods, the job-talent basic
// steal, the temp-fx ult window, and weapon enhancements. This drives a hit
// with ALL of them stacked high and measures healing against damage actually
// dealt (the monster's hp delta, not the requested dmg, since hitMonster
// applies its own multipliers).
//
// Run it against the OLD build too: it must fail there, or it is not testing
// anything.
//
//   node scripts/lifesteal_cap_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 20000))]); } catch (e) {}
  loadMap('forest');
  player.cls = 'warrior'; player.level = 60; player._god = true; game.paused = false;

  // Stack every lifesteal source well past the cap.
  player.mods = player.mods || {};
  const _origEq = window.getEquipBonus;
  const _origTfx = window.talentFx;
  let SRC = {};
  window.getEquipBonus = (k) => (k === 'lifesteal' ? (SRC.gear || 0) : _origEq(k));
  window.talentFx = () => Object.assign({}, _origTfx ? _origTfx() : {}, { basicLifesteal: SRC.basic || 0 });
  const setSources = (o) => { SRC = o; player.mods.lifesteal = o.mods || 0; };

  // Healing must never be clipped by the hp ceiling or the ratio is
  // meaningless: a first attempt used the real pool and both builds simply
  // healed to full, measuring nothing. Give the player an enormous pool.
  const BIGHP = 1e9;
  const _origMax = window.getMaxHp;
  window.getMaxHp = () => BIGHP;

  // A punching bag that cannot die, so damage is never clamped by remaining hp.
  const results = [];
  const run = (label, withSynergy, opts) => {
    opts = opts || {};
    if (!game.monsters.length) {
      const t = (game.mapData.spawns || []).map((s) => s.type).filter(Boolean)[0];
      try { spawnMonster(600, 300, t, false, false); } catch (e) {}
    }
    const m = game.monsters[0];
    if (!m) return;
    m.maxHp = m.currentHp = 5e9;
    // A high-DEF target makes finalDmg a small fraction of the incoming dmg
    // (the K/(DEF+K) armour curve). Two of the four lifesteal sites see only
    // the PRE-reduction number, so this is where a rate-based cap leaks.
    m.def = opts.def || 0;
    m.burnTimer = withSynergy ? 600 : 0;
    player._activeSynergies = withSynergy ? { sanguineFlame: true } : {};

    const maxHp = getMaxHp();
    player.maxHp = maxHp;
    player.hp = 1000;                                   // far below the ceiling
    game._mxT = -1;                                     // force the cached max-hp refresh
    const hp0 = player.hp, mhp0 = m.currentHp;

    // 'melee' is in hitMonster's _basicSkill list, so the basic-attack talent
    // steal is live for this hit as well.
    hitMonster(m, 100000, false, 'melee');
    if (SRC.enh && typeof applyEnhOnHit === 'function') applyEnhOnHit(m, 100000, { lifesteal: SRC.enh });

    const dealt = mhp0 - m.currentHp;
    const healed = player.hp - hp0;
    results.push({ label, dealt, healed, ratio: dealt > 0 ? healed / dealt : null,
                   clippedAtFull: player.hp >= maxHp });
  };
  const ALL = { mods: 0.30, gear: 0.25, basic: 0.20, enh: 0.20 };
  setSources(ALL); run('all four sources stacked', false);
  setSources(ALL); run('all four + Sanguine Flame (burning)', true);
  setSources(ALL); run('all four vs high-DEF target', false, { def: 4000 });
  // A build carrying ONLY the deferred basic-attack steal must still heal:
  // the deferral must not silently drop it when no other source is present.
  setSources({ basic: 0.04 }); run('basic-attack steal only (must still heal)', false);
  window.getMaxHp = _origMax;
  window.getEquipBonus = _origEq;
  if (_origTfx) window.talentFx = _origTfx;
  return results;
});
await browser.close();

console.log('\n  ' + FILE + '\n');
console.log('  scenario'.padEnd(46) + 'damage'.padStart(12) + 'healed'.padStart(12) + 'ratio'.padStart(9));
let fail = 0, checked = 0;
for (const r of out) {
  if (r.ratio === null) { console.log('  ' + r.label.padEnd(46) + '   no damage dealt — INCONCLUSIVE'); fail++; continue; }
  if (r.clippedAtFull) { console.log('  ' + r.label.padEnd(46) + '   healed to full — INCONCLUSIVE'); fail++; continue; }
  checked++;
  const bad = r.ratio > 0.1005                     // small epsilon for integer rounding
           || (/must still heal/.test(r.label) && r.healed <= 0);
  if (bad) fail++;
  console.log('  ' + r.label.padEnd(46) + String(r.dealt).padStart(12) + String(r.healed).padStart(12) +
              (r.ratio * 100).toFixed(2).padStart(8) + '%' + (bad ? '   <-- OVER 10%' : ''));
}
if (!checked) { console.error('\nFAIL — nothing was actually measured.'); process.exit(1); }
if (fail) { console.error('\nFAIL — combined lifesteal exceeds 10% of damage dealt.'); process.exit(1); }
console.log('\nPASS — combined lifesteal is capped at 10% of damage dealt.');
