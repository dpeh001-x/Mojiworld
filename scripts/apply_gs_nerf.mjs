// Ground Slam: every line of damage -25%.
// ============================================================================
// Per user: "Reduce ground slam per line of damage by 25%".
//
// Ground Slam deals damage in three kinds of line, all through performAround (ATK x multiplier on
// every foe in the radius):
//   the somersault  4 ticks   0.55  -> 0.4125
//   the landing     1 hit     2.7   -> 2.025
//   the rings       3 pulses  1.2   -> 0.9     (4 with the rank bonus)
// Each is exactly x0.75, so a full cast on one foe goes 8.5 -> 6.375 ATK (9.7 -> 7.275 with the extra ring).
// performAround's +0..8 flat noise is shared by every skill that uses it and is left alone.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gs-nerf/.test(s)) { console.log('already applied'); process.exit(0); }
const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};

sub('somersault',
  "        performAround(120, 0.55, { color:'#ffdd88', kb:2, burst:4 });   // v0.30.618 warrior-tune - 0.7 -> 0.55 (per user: nerf)",
  "        performAround(120, 0.4125, { color:'#ffdd88', kb:2, burst:4 });   // v0.30.618 warrior-tune - 0.7 -> 0.55 (per user: nerf) · v0.30.768 gs-nerf - 0.55 -> 0.4125 (per user: -25% per line)");

sub('landing',
  "      performAround(190, 2.7, { color:'#ffcc55', kb:8, noShock: true });",
  "      performAround(190, 2.025, { color:'#ffcc55', kb:8, noShock: true });   // v0.30.768 gs-nerf - 2.7 -> 2.025 (per user: -25% per line)");

sub('rings',
  "        performAround(radius, 1.2, { color:'#ffdd88', kb:4, noShock: true });   // v0.30.618 warrior-tune - 1.5 -> 1.2 (per user: nerf)",
  "        performAround(radius, 0.9, { color:'#ffdd88', kb:4, noShock: true });   // v0.30.618 warrior-tune - 1.5 -> 1.2 (per user: nerf) · v0.30.768 gs-nerf - 1.2 -> 0.9 (per user: -25% per line)");

const grew = s.length - n0;
if (grew < 150 || grew > 700) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: Ground Slam lines 0.55/2.7/1.2 -> 0.4125/2.025/0.9 (+${grew})`);
