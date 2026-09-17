// Elite / Elder drop rates, per user: "elite and elder monster reduce boon and
// equipment drop chance significantly" (context: "players are facing equipment
// clog issue").
//
// The rates are pure constants inside the kill handler, so this reads them off
// the SHIPPED file and computes the player-facing percentages — the number a
// player could actually observe — rather than trusting a literal. A behavioural
// count is not an option at these odds: at 0.30% you would need tens of
// thousands of kills per tier to separate the new rate from the old one.
// Run: node scripts/elite_drop_rate_test.mjs [file.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = path.join(ROOT, args[0] || 'mojiworld_game.html');
const src = fs.readFileSync(FILE, 'utf8');
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

// ---- equipment ---------------------------------------------------------------
const gear = src.match(/let dropChance = \(tier === 2 \? ([\d.]+) : tier === 1 \? ([\d.]+) : ([\d.]+)\) \* \(1 \+ luck\) \* ([\d.]+)/);
const rates = gear ? {
  boss:   +(gear[1] * gear[4] * 100).toFixed(3),
  elite:  +(gear[2] * gear[4] * 100).toFixed(3),
  normal: +(gear[3] * gear[4] * 100).toFixed(3),
} : null;

// ---- boons -------------------------------------------------------------------
// v0.30.638 - per user: "boon drop rate 0.05% for low level monsters to 0.2% for
// high level monsters". The normal-mob arm is no longer a literal: it is
// _lxBoonRateForLevel(monster level), a straight ramp between two constants.
// The elite / elder arm is still the literal this test exists to hold down.
const boon = src.match(/const _boonRate = \(m\.isElite \|\| m\.isMiniBoss\) \? ([\d.]+) : _lxBoonRateForLevel\(/);
const ramp = src.match(/const LX_BOON_RATE_LO = ([\d.]+), LX_BOON_RATE_LO_LV = \d+;\s*const LX_BOON_RATE_HI = ([\d.]+),\s*LX_BOON_RATE_HI_LV = \d+;/);
const boons = (boon && ramp) ? { elite: +(boon[1] * 100).toFixed(3), normalLo: +(ramp[1] * 100).toFixed(3), normalHi: +(ramp[2] * 100).toFixed(3) } : null;

console.log(`  equipment (pre-luck): ${JSON.stringify(rates)}`);
console.log(`  boons     (pre-luck): ${JSON.stringify(boons)}`);

check(!!rates, 'the equipment drop formula is where the test expects it', !!gear);
check(!!boons, 'the boon rate is keyed on elite / elder', { eliteArm: !!boon, normalRamp: !!ramp });
if (rates && boons) {
  // Came down, significantly. Elite equipment was 1.00% before this pass.
  check(rates.elite <= 0.40, 'elite / elder equipment chance is significantly reduced (was 1.00%)', rates.elite);
  check(boons.elite <= 0.20, 'elite / elder boon chance is significantly reduced (was 0.50%)', boons.elite);
  // The tiers the ask did not name must not have moved.
  // v0.30.756 - per user: "reduce the chance of getting equipment from quests,
  // monsters". The 0.02 global went to 0.015, taking EVERY tier down 25% together
  // (normal 0.10 -> 0.075, elite 0.30 -> 0.225, boss 1.80 -> 1.35) and leaving the
  // ordering alone. Pinned again so the next move is a decision, not an accident.
  check(rates.normal === 0.075, 'normal-mob equipment rate is 0.075% (v0.30.756: 0.10% less 25%)', rates.normal);
  check(rates.boss === 1.35, 'boss equipment main roll is 1.35% (v0.30.756: 1.80% less 25%)', rates.boss);
  check(boons.normalLo === 0.05 && boons.normalHi === 0.2, 'normal-mob boon roll is the v0.30.638 ramp: 0.05% (Lv10-) to 0.20% (Lv70+)', boons);
  // An elite must still be worth more than a snail for GEAR — the tier has to
  // keep meaning something even after a cut this size.
  check(rates.elite > rates.normal, 'an elite is still a better equipment kill than a normal mob',
        { elite: rates.elite, normal: rates.normal });
  // ...and still under a boss, the ordering v0.29.680 deliberately set.
  check(rates.elite < rates.boss, 'and still drops less equipment than a boss', { elite: rates.elite, boss: rates.boss });
}
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
