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
const boon = src.match(/const _boonRate = \(m\.isElite \|\| m\.isMiniBoss\) \? ([\d.]+) : ([\d.]+);/);
const boons = boon ? { elite: +(boon[1] * 100).toFixed(3), normal: +(boon[2] * 100).toFixed(3) } : null;

console.log(`  equipment (pre-luck): ${JSON.stringify(rates)}`);
console.log(`  boons     (pre-luck): ${JSON.stringify(boons)}`);

check(!!rates, 'the equipment drop formula is where the test expects it', !!gear);
check(!!boons, 'the boon rate is keyed on elite / elder', !!boon);
if (rates && boons) {
  // Came down, significantly. Elite equipment was 1.00% before this pass.
  check(rates.elite <= 0.40, 'elite / elder equipment chance is significantly reduced (was 1.00%)', rates.elite);
  check(boons.elite <= 0.20, 'elite / elder boon chance is significantly reduced (was 0.50%)', boons.elite);
  // The tiers the ask did not name must not have moved.
  check(rates.normal === 0.1, 'normal-mob equipment rate is untouched at 0.10%', rates.normal);
  check(rates.boss === 1.8, 'boss equipment main roll is untouched at 1.80%', rates.boss);
  check(boons.normal === 0.5, 'normal-mob boon trickle is untouched at 0.50%', boons.normal);
  // An elite must still be worth more than a snail for GEAR — the tier has to
  // keep meaning something even after a cut this size.
  check(rates.elite > rates.normal, 'an elite is still a better equipment kill than a normal mob',
        { elite: rates.elite, normal: rates.normal });
  // ...and still under a boss, the ordering v0.29.680 deliberately set.
  check(rates.elite < rates.boss, 'and still drops less equipment than a boss', { elite: rates.elite, boss: rates.boss });
}
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
