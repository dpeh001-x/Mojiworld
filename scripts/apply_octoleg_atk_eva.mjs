// Tentacle ATK 500, evasion 180.
// =============================================================================
// Per user: "octoleg atk should be 500, eva 180".
//
// Authored values, not derived ones. The previous pass took the tentacles to
// atk 144 / eva 108 as +20% of where they were; these two are set outright, so
// the +20% relationship no longer describes them and the test is updated to
// match rather than left asserting a ratio that is no longer the intent.
//
//   octoLeg* x4   atk 144 -> 500   evasion 108 -> 180
//
// HP (720,000) and DEF (192) are untouched.
//
// WORTH KNOWING ABOUT THE ATK NUMBER. Tentacle contact damage is summed across
// every overlapping arm and applied once a second (the _mnIncoming path), and
// the Eight Moods pulse scales its poison off leg.atk * 0.25. At 144 a caught
// player took 4x144 = 576 a second from a full ring; at 500 that is 4x500 =
// 2000, and the mood poison roughly triples with it. That is a 3.5x swing on
// the arm phase, which is a large step - flagged, not softened, because the
// number was given explicitly.
//
// All four rows carry a byte-identical stat line, so one replace covers the set
// and the count guard proves none was missed.
//
// Guarded + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('atk:500, def:192, evasion:180,')) { console.log('already applied'); process.exit(0); }

const OLD = 'hp:720000,  atk:144, def:192, evasion:108,';
const NEW = 'hp:720000,  atk:500, def:192, evasion:180,';
const hits = s.split(OLD).length - 1;
if (hits !== 4) { console.error(`ABORT: expected 4 tentacle rows, found ${hits}`); process.exit(1); }
s = s.split(OLD).join(NEW);

// Characters vs characters — a byte-size comparison here trips on this file's
// multi-byte content, which is how the last apply script aborted spuriously.
if (Math.abs(s.length - n0) > 200) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars, expected a few`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: 4 tentacle rows -> atk 500, evasion 180 (${n0} -> ${s.length} chars)`);
