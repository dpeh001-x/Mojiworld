#!/usr/bin/env node
// v0.29.406 — verify that ascending KEEPS all items and mojicoins, and still
// resets everything ascension is supposed to reset.
//
// The reset lives inside offerPrestige()'s uiConfirm().then() callback, so it
// cannot be pulled out with the brace-matcher the other tests use. Instead the
// block is sliced verbatim between two stable anchors and run against a stub
// environment — no reimplementation, so a drifted copy certifies nothing.
//
//   node scripts/ascension_keep_test.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.error(`  FAIL  ${name}${extra ? ' — ' + extra : ''}`); }
};
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ---------------------------------------------------------------- extract
const START = '    p.count++; p.xpMult += 0.30;';
const END = "    _flushSaveStateNow();";
const a = src.indexOf(START);
if (a < 0) throw new Error('ascension reset block not found (start anchor moved)');
const b = src.indexOf(END, a);
if (b < 0) throw new Error('ascension reset block not found (end anchor moved)');
const occurrences = src.split(START).length - 1;
if (occurrences !== 1) throw new Error(`start anchor matched ${occurrences}x, expected 1`);
const RESET = src.slice(a, b);

// Guard: the block must not still be wiping the things the user asked to keep.
// Anchored to line-start-plus-whitespace so an UNCONDITIONAL wipe trips the
// guard while the conditional `if (broken) ... = default` repairs do not —
// the repairs assign the same literals, so a looser pattern flags itself.
ok('source: no unconditional inventory wipe', !/^\s*player\.inventory = \[\];/m.test(RESET));
ok('source: no equipped wholesale rebuild', !/player\.equipped = \{\s*\n\s*weapon:null/.test(RESET));
ok('source: no unconditional wallet reset', !/^\s*player\.mojicoins = 200;/m.test(RESET));
ok('source: no unconditional consumables reset', !/^\s*player\.consumables = \{ hp_s: 5, mp_s: 3 \};/m.test(RESET));
// ...and the repairs must genuinely be conditional, not just reformatted.
ok('source: inventory repair is guarded', /if \(!Array\.isArray\(player\.inventory\)\) player\.inventory = \[\];/.test(RESET));
ok('source: wallet repair is guarded', /!isFinite\(player\.mojicoins\)[\s\S]{0,60}player\.mojicoins = 200;/.test(RESET));
ok('source: setshards still reset', /player\.setshards = 0;/.test(RESET));
// The confirm copy is irreversible-action UI; it must not promise the old behaviour.
ok('copy: no longer claims gear resets', !src.includes('Your inventory, equipment, and bosses reset.'));
ok('copy: states items are kept', src.includes('You KEEP your inventory, equipment, consumables and mojicoins'));

// ---------------------------------------------------------------- harness
const SLOTS = ['weapon','armor','accessory','body_top','body_bottom','cape','gloves','boots','helmet'];

function run(player, game) {
  const stub = {
    getMaxHp: () => 100 + (player.prestigeHp || 0),
    getMaxMp: () => 50,
    _applyEquippedBoons: () => { player._boonsReapplied = true; },
    invalidateEquipBonusCache: () => { player._cacheInvalidated = true; },
    _refreshEqEmptyFlag: () => { player._eqFlagRefreshed = true; },
    refreshGearCache: () => { player._gearCacheRefreshed = true; },
    showToast: () => {}, flash: () => {}, addShake: () => {},
    audio: { play: () => {} },
    CLASSES: { warrior: { stats: { speed: 3.5, jump: 10 } } },
  };
  const p = game.prestige;
  const fn = new Function(
    'player', 'game', 'p', ...Object.keys(stub),
    `${RESET}\n return { player, game, p };`
  );
  return fn(player, game, p, ...Object.values(stub));
}

function fullPlayer(over = {}) {
  const inv = [
    { name: 'Dawnbreaker', slot: 'weapon', atk: 420, rarity: 'legendary' },
    { name: 'Aegis of Everdawn', slot: 'armor', def: 310, rarity: 'epic' },
    { name: 'Ring of Nine Suns', slot: 'accessory', atk: 55, rarity: 'legendary' },
  ];
  return Object.assign({
    cls: 'warrior', level: 50, exp: 9999, expToNext: 1,
    maxHp: 4200, maxMp: 1800, baseAtk: 380, baseDef: 260,
    baseAcc: 40, baseSpeed: 7.2, baseJump: 16,
    _levelUpSpent: { hp: 30, atk: 25 }, skillPoints: 4,
    milestonesUnlocked: { m50: true }, treeUnlocked: { a: true }, tree: { a: 3 },
    job: 'knight', master: 'warlord', talents: { t1: true },
    inventory: inv.slice(),
    equipped: {
      weapon: inv[0], armor: inv[1], accessory: inv[2],
      body_top: { name: 'Gilded Doublet' }, body_bottom: { name: 'Sun Greaves' },
      cape: { name: 'Auroral Mantle' }, gloves: { name: 'Emberweave' },
      boots: { name: 'Striders' }, helmet: { name: 'Dawncrown' },
    },
    mojicoins: 1_250_000, bankBalance: 8_400_000, bankLastTick: 12345,
    consumables: { hp_s: 99, mp_s: 74, hp_l: 12 },
    setshards: 640,
    boons: ['flame_dash', 'hyper_teleport'], boonsEquipped: ['flame_dash'],
    skillRanks: { slash: 5 }, skillRankPoints: 7,
    quests: { active: { q1: {} }, progress: { q1: 2 }, completed: { q0: true } },
    hp: 10, mp: 5,
  }, over);
}
const freshGame = () => ({ prestige: { count: 3, xpMult: 1.9, dmgMult: 1.9, bonusAP: 3, critBonus: 3, hpBonus: 36 },
                           bossDefeated: { gravitos: true } });

// ------------------------------------------------------- KEEP: items + money
{
  const before = fullPlayer();
  const invRef = before.inventory, eqRef = Object.assign({}, before.equipped);
  const { player } = run(before, freshGame());

  eq('inventory kept (contents)', player.inventory.map(i => i.name),
     ['Dawnbreaker', 'Aegis of Everdawn', 'Ring of Nine Suns']);
  ok('inventory kept (same array identity)', player.inventory === invRef);
  for (const s of SLOTS) ok(`equipped kept: ${s}`, player.equipped[s] === eqRef[s]);
  eq('wallet kept', player.mojicoins, 1_250_000);
  eq('bank kept', player.bankBalance, 8_400_000);
  eq('consumables kept', player.consumables, { hp_s: 99, mp_s: 74, hp_l: 12 });

  // derived caches must be rebuilt, since gear now outlives the stat reset
  ok('equip-bonus cache invalidated', player._cacheInvalidated === true);
  ok('eq-empty flag refreshed', player._eqFlagRefreshed === true);
  ok('gear cache refreshed', player._gearCacheRefreshed === true);
}

// ------------------------------------------------------ RESET: progression
{
  const { player, game, p } = run(fullPlayer(), freshGame());
  eq('level reset', player.level, 1);
  eq('exp reset', player.exp, 0);
  eq('expToNext reset', player.expToNext, 30);
  eq('maxHp reset', player.maxHp, 100);
  eq('maxMp reset', player.maxMp, 50);
  eq('baseAtk reset', player.baseAtk, 12);
  eq('baseDef reset', player.baseDef, 5);
  eq('baseAcc reset', player.baseAcc, 0);
  eq('baseSpeed reset', player.baseSpeed, 3.5);
  eq('baseJump reset', player.baseJump, 10);
  eq('invested-stat ledger cleared', player._levelUpSpent, {});
  eq('skillPoints = bonusAP', player.skillPoints, p.bonusAP);
  eq('milestones cleared', player.milestonesUnlocked, {});
  eq('tree cleared', player.tree, {});
  eq('treeUnlocked cleared', player.treeUnlocked, {});
  eq('job cleared', player.job, null);
  eq('master cleared', player.master, null);
  eq('talents cleared', player.talents, {});
  eq('boons cleared', player.boons, []);
  eq('boonsEquipped cleared', player.boonsEquipped, []);
  eq('skillRanks cleared', player.skillRanks, {});
  eq('skillRankPoints cleared', player.skillRankPoints, 0);
  eq('setshards reset', player.setshards, 0);
  eq('quests.active cleared', player.quests.active, {});
  eq('quests.progress cleared', player.quests.progress, {});
  eq('quests.completed KEPT', player.quests.completed, { q0: true });
  eq('bossDefeated cleared', game.bossDefeated, {});
  ok('boons re-derived', player._boonsReapplied === true);
  eq('ascension counted', p.count, 4);
  eq('class kept (gear stays equippable)', player.cls, 'warrior');
}

// ------------------------------------------------------------- edge cases
{
  const { player } = run(fullPlayer({ mojicoins: undefined }), freshGame());
  eq('undefined wallet repaired to 200', player.mojicoins, 200);
}
{
  const { player } = run(fullPlayer({ mojicoins: NaN }), freshGame());
  eq('NaN wallet repaired to 200', player.mojicoins, 200);
}
{
  const { player } = run(fullPlayer({ mojicoins: -50 }), freshGame());
  eq('negative wallet repaired to 200', player.mojicoins, 200);
}
{
  const { player } = run(fullPlayer({ mojicoins: 0 }), freshGame());
  eq('zero wallet is legitimate, not repaired', player.mojicoins, 0);
}
{
  const { player } = run(fullPlayer({ inventory: null }), freshGame());
  eq('non-array inventory repaired', player.inventory, []);
}
{
  // Legacy save from before the visual-equipment slots existed (v0.25.303).
  const { player } = run(fullPlayer({ equipped: { weapon: { name: 'Old Blade' }, armor: null, accessory: null } }), freshGame());
  // Null-safe: if a regression nulls the slot again this must report a FAIL,
  // not throw a stack trace over the remaining assertions.
  eq('legacy weapon kept', player.equipped.weapon && player.equipped.weapon.name, 'Old Blade');
  for (const s of SLOTS) ok(`legacy slot present: ${s}`, s in player.equipped);
  eq('legacy missing slot filled with null', player.equipped.cape, null);
}
{
  const { player } = run(fullPlayer({ equipped: undefined }), freshGame());
  for (const s of SLOTS) eq(`absent equipped -> ${s} null`, player.equipped[s], null);
}
{
  const { player } = run(fullPlayer({ consumables: null }), freshGame());
  eq('broken consumables repaired', player.consumables, { hp_s: 5, mp_s: 3 });
}
{
  // A kept item must not be mutated by the reset.
  const pl = fullPlayer();
  const w = pl.equipped.weapon;
  run(pl, freshGame());
  eq('kept item stats untouched', { atk: w.atk, rarity: w.rarity }, { atk: 420, rarity: 'legendary' });
}

console.log(`\nascension_keep_test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
