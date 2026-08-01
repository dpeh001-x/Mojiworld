// v0.29.388 verification — Gravitos phase-2 grading + hazard-pressure perf tier.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const lines = src.split('\n');
let pass = 0, fail = 0;
const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x != null ? '  ' + JSON.stringify(x) : '')); };

// 1. Every graded site is present with a real phase-2 branch.
const GRADED = [
  'const zones = phase === 3 ? 4 : phase === 2 ? 3 : 2;',
  'const _rainCd  = phase >= 3 ? 11000 : phase === 2 ? 15000 : 20000;',
  'const chargeTime = phase === 3 ? 350 : phase === 2 ? 420 : 500;',
  'const speed = phase === 3 ? 14 : phase === 2 ? 12.5 : 11;',
  'const laserDur = chargeTime + (phase === 3 ? 1100 : phase === 2 ? 900 : 700);',
  'm.patternTimer < 260 + (phase === 3 ? 520 : phase === 2 ? 620 : 720)',
  'const accel = phase === 3 ? 2.0 : phase === 2 ? 1.7 : 1.4;',
  'const vc = phase === 3 ? 22 : phase === 2 ? 19.5 : 17;',
  'const count = phase === 3 ? 7 : phase === 2 ? 5 : 3;',
  'const spd = phase === 3 ? 5.2 : phase === 2 ? 4.4 : 3.6;',
  'const count = phase === 3 ? 24 : phase === 2 ? 20 : 16;',
  'const spd = phase === 3 ? 7.5 : phase === 2 ? 6.75 : 6.0;',
];
for (const g of GRADED) {
  const n = src.split(g).length - 1;
  ok('graded exactly once: ' + g.slice(0, 46), n === 1, n === 1 ? null : { occurrences: n });
}

// 2. Monotonic P1 <= P2 <= P3 on every graded numeric triple (cooldowns and
//    telegraph windows invert: shorter = more lethal, so they read P3 <= P2 <= P1).
const TRIPLES = [
  ['zones',      2, 3, 4,      'up'],
  ['rainCd',     20000, 15000, 11000, 'down'],
  ['chargeTime', 500, 420, 350, 'down'],
  ['boltSpeed',  11, 12.5, 14,  'up'],
  ['laserTail',  700, 900, 1100, 'up'],
  ['zipWindow',  720, 620, 520, 'down'],
  ['zipAccel',   1.4, 1.7, 2.0, 'up'],
  ['zipVcap',    17, 19.5, 22,  'up'],
  ['cometN',     3, 5, 7,       'up'],
  ['cometSpd',   3.6, 4.4, 5.2, 'up'],
  ['ringN',      16, 20, 24,    'up'],
  ['ringSpd',    6.0, 6.75, 7.5, 'up'],
];
for (const [n, p1, p2, p3, dir] of TRIPLES) {
  const mono = dir === 'up' ? (p1 <= p2 && p2 <= p3) : (p1 >= p2 && p2 >= p3);
  const strict = p2 !== p1;   // phase 2 must no longer equal phase 1
  ok(`${n}: P2 is strictly between P1 and P3 (${p1} -> ${p2} -> ${p3})`, mono && strict);
}

// 3. No Gravitos pattern site is left inheriting phase 1 in phase 2.
//    Gravitos AI spans the boss block; locate it by its unique pattern states.
const lo = lines.findIndex(l => l.includes("m.patternState === 'chaseComets'"));
const hiSearch = lines.findIndex((l, i) => i > lo && l.includes("m.patternState === 'decay'"));
const hi = hiSearch > 0 ? hiSearch + 80 : lo + 400;
ok('located the Gravitos pattern block', lo > 0, { lo, hi });
const leftovers = [];
for (let i = Math.min(lo - 1400, lo); i < hi; i++) {
  const t = (lines[i] || '').trim();
  if (!/phase\s*(===|>=)\s*3\s*\?/.test(t)) continue;
  if (/phase\s*===\s*2\s*\?/.test(t)) continue;
  if (t.startsWith('//')) continue;                                        // prose, not code
  // Deliberate non-gradings:
  //   showToast / _awakened / spinBase — cosmetic only, no damage effect.
  //   _OHKO_GAP — the one-shot orb is already phase-gated by _instaCd.
  //   _soulCd — P1/P2's 12 s is ALREADY faster than P3's 14 s (P3 leans on
  //     the ring instead), so phase 2 is not inheriting a weaker value here.
  //   decayFloor count — spans only 4 -> 5 columns; there is no distinct
  //     middle value, and 5 in P2 would erase the P3 step entirely.
  if (/showToast|_awakened|spinBase|_OHKO_GAP|_soulCd/.test(t)) continue;
  if (/const count = phase === 3 \? 5 : 4;/.test(t)) continue;
  leftovers.push((i + 1) + ': ' + t.slice(0, 90));
}
ok('no ungraded Gravitos pattern ternaries remain', leftovers.length === 0, leftovers);

// 4. The hazard-pressure perf clause exists and reads a real collection.
ok('_perfVeryLowFx has the hazard-pressure clause',
   /_hazards\s*>=\s*40/.test(src) && /game\.projectiles && game\.projectiles\.length/.test(src));
ok('game.projectiles is a real array on the game object',
   /projectiles:\s*\[\]/.test(src));

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
