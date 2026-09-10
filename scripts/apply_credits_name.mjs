// End credits: "Dr. Daryl Peh" -> "DADPEH" (per user).
// =============================================================================
// Per user: "change Dr Daryl Peh at the end credits to DADPEH".
//
// Three occurrences, all inside _showGameComplete()'s credit roll:
//   Created & Directed by        -> the name line
//   Design / Story / Art / Code  -> the name line
//   the closing "— Moji-Studios · <name> —" small line
//
// The honorific goes with it: the user named the whole current string and gave
// the whole replacement, so "Dr. Daryl Peh" becomes "DADPEH" rather than
// "Dr. DADPEH". Moji-Studios is untouched.
//
// Scope checked before writing: grep for "Peh" across the whole 8.5MB file
// returns only these three lines, so there is no About screen, meta tag or
// splash copy left holding the old name.
//
// Guarded (expects exactly 3) + atomic + idempotent.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;

const OLD = 'Dr. Daryl Peh';
const NEW = 'DADPEH';
if (!s.includes(OLD) && s.includes(NEW)) { console.log('already applied'); process.exit(0); }

const c = s.split(OLD).length - 1;
if (c !== 3) { console.error(`ABORT: "${OLD}" matched ${c}, expected 3`); process.exit(1); }
s = s.split(OLD).join(NEW);

if (s.includes('Daryl')) { console.error('ABORT: "Daryl" still present after the replace'); process.exit(1); }
const shrank = n0 - s.length;
if (shrank !== (OLD.length - NEW.length) * 3) {
  console.error(`ABORT: file shrank ${shrank}, expected ${(OLD.length - NEW.length) * 3}`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: credits name -> ${NEW} (3 lines, -${shrank} chars)`);
