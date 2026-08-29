// v0.30.283 — Necromancer / Hexmaster damage nerf (G, B, and summons).
// =============================================================================
// Per user: "necromancer and hexmaster G and B skills deal way too much
// damage, summons also seem to deal alot of damage please nerf them".
//
// WHAT WAS FOUND (all named knobs, no scattered magic):
//
//   SUMMONS   raiseMinion gave every undead atk = getAtk() x 1.0 — each
//             skeleton/zombie hit at FULL player ATK, and Dark Pulse raises
//             three of them for 30s: +300% of the player's own baseline,
//             passively. The engine's own reference point (the mojimon
//             design note) pegs pet damage at 50% atk.
//   HEX G     Grand Hex burst 1.5x (raised from 1.2 in a buff pass), rupture
//             5.5x (raised from 4.0) with 55% splash — and rupture stacks
//             CHAIN on kills via the hex-spread in killMonster, so packs
//             cascade.
//   NECRO G   Soul Vortex ticks its hazard at 2.20x ATK for a full 30s (its
//             own comment records the 2.01x-multiplier buff history).
//   NECRO B   Necrotic Ascendance drains at 3.0x ATK (1.5x per drain after
//             the tick cadence) while dragging foes in.
//   HEX B     Pandemic Hex chains 50% of damage to 4 targets on top of the
//             full-stack contagion spread.
//
// THE NERF — roughly a third off every offender, summons cut to the pet
// reference point:
//
//   summon atk mul                1.0  -> 0.55   (-45%, at the mojimon bar)
//   GRANDHEX_BURST_MUL            1.5  -> 1.0    (-33%, below the 1.2 it was buffed from)
//   GRANDHEX_RUPTURE_MUL          5.5  -> 3.5    (-36%, below the 4.0 it was buffed from)
//   GRANDHEX_RUPTURE_SPLASH       0.55 -> 0.40   (-27%, tempers the cascade)
//   Soul Vortex hazard atk        2.20 -> 1.40   (-36%)
//   Necrotic Ascendance atk       3.0  -> 2.0    (-33%)
//   Pandemic chain frac (hi/lo)   0.50 -> 0.35 / 0.35 -> 0.25
//
// The grandhex ECHO burst (0.8 x BURST_MUL) and rupture splash ride their
// parents automatically. Freeze, weaken, lifesteal windows, stack counts and
// cooldowns are untouched — the KIT is intact, the numbers are tamed.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;

if (s.includes('getAtk() * 0.55')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};

sub('summon atk',
  "    atk: Math.max(14, Math.floor(getAtk() * 1.0)),",
  "    atk: Math.max(14, Math.floor(getAtk() * 0.55)),   // v0.30.283 — was 1.0: each undead hit at FULL player atk, and Dark Pulse raises three. 0.55 sits at the engine's own pet reference (mojimon: '50% atk')");

sub('grandhex rupture',
  'const LX_GRANDHEX_RUPTURE_MUL = 5.5;    // ...and its "massive damage" (was 4.0)',
  'const LX_GRANDHEX_RUPTURE_MUL = 3.5;    // v0.30.283 nerf per user — was 5.5 (and 4.0 before that); ruptures chain on kills via the hex spread, so the cascade multiplied every point here');

sub('grandhex burst',
  'const LX_GRANDHEX_BURST_MUL = 1.5;      // instant burst (was 1.2)',
  'const LX_GRANDHEX_BURST_MUL = 1.0;      // v0.30.283 nerf per user — was 1.5 (and 1.2 before that); the echo burst (x0.8) rides this automatically');

sub('grandhex splash',
  'const LX_GRANDHEX_RUPTURE_SPLASH = 0.55;',
  'const LX_GRANDHEX_RUPTURE_SPLASH = 0.40;   // v0.30.283 nerf per user — was 0.55');

sub('vortex atk',
  '      atk: getAtk() * 2.20,',
  '      atk: getAtk() * 1.40,   // v0.30.283 nerf per user — was 2.20 over a full 30s pool');

sub('necro ult atk',
  '      atk: getAtk() * 3.0,   // halved per tick by the shared TICK/60 cadence -> 1.5x per drain',
  '      atk: getAtk() * 2.0,   // v0.30.283 nerf per user — was 3.0; halved per tick by the shared TICK/60 cadence -> 1.0x per drain');

sub('pandemic chain hi',
  'chain: { n: 4, frac: 0.50 }',
  'chain: { n: 4, frac: 0.35 }');

sub('pandemic chain lo',
  'chain: { n: 2, frac: 0.35 }',
  'chain: { n: 2, frac: 0.25 }');

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.282'", "GAME_VERSION = 'v0.30.283'");

const grew = s.length - n0;
if (grew < 200 || grew > 1400) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew})`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: warlock nerf — summons 0.55x, grandhex 1.0/3.5/0.40, vortex 1.40, ult 2.0, pandemic 0.35/0.25 (+${grew})`);
