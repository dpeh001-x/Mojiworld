// Octobaby and all four tentacles: combat stats +20%.
// =============================================================================
// Per user: "Increase stats of octababy and its tentacles by 20%".
//
// Applied to the COMBAT line only - hp, atk, def, evasion - on the head and on
// each of the four octoLeg* types. Rounded to whole numbers, which is what the
// engine reads everywhere.
//
//   octobaby     hp 3,037,500 -> 3,645,000   atk 324 -> 389   def 27 -> 32   eva 126 -> 151
//   octoLeg* x4  hp   600,000 ->   720,000   atk 120 -> 144   def 160 -> 192  eva  90 -> 108
//
// NOT touched, and each for a reason worth stating rather than deciding
// silently:
//
//   exp / mojicoins - rewards, not stats. Krook's buff moved his payout with
//     him, but that was an unprompted judgement call; here the ask is precise
//     and says "stats", so this leaves the payout to an explicit decision.
//   speed / jump - Octobaby's 0.4 is deliberate: she is a near-stationary
//     centrepiece the arena is built around, and the tentacles sit at 0 because
//     they are anchored to her. +20% on either is a movement change dressed as
//     a stat change.
//   w / h - size, and already the subject of two explicit user tunings
//     ("humongous", then "reduce the size of the octababy tenctacles").
//
// The regrown generations follow automatically: _lxOctoSpawnArms sizes each
// generation off lt.hp * 0.7^gen, so gen1 rises 420,000 -> 504,000 with no
// second edit. That is the whole reason the arm HP lives on the TYPE.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('hp:3645000')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- head ------------------------------------------------------------------
sub('octobaby', "hp:3037500,  atk:324, def:27, evasion:126,",
                "hp:3645000,  atk:389, def:32, evasion:151,");

// ---- four tentacles, one shared stat line ----------------------------------
// All four rows carry byte-identical numbers, so one replace covers the set and
// the count guard proves none was missed.
sub('tentacles', "hp:600000,  atk:120, def:160, evasion:90,",
                 "hp:720000,  atk:144, def:192, evasion:108,", 4);

// Compare CHARACTERS to characters. The first version measured the tmp file's
// BYTE size against a character count and aborted on a 60KB "growth" that was
// really this file's multi-byte characters (emoji, em dashes) — the edit itself
// moves a handful of digits.
if (Math.abs(s.length - n0) > 200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars, expected a few`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: octobaby + 4 tentacles, combat stats x1.2 (${n0} -> ${s.length} chars)`);
