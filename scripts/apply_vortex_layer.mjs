// v0.30.290 — the warlock vortex pools render BEHIND monsters.
// =============================================================================
// Per user, with a screenshot of Scorpio all but invisible inside a green
// pool: "soul vortex vortex and necrotic ascendance vortex should be at a
// layer behind the monster".
//
// THE CAUSE. The render order in loop() is:
//     drawSmoothFx(true)   <- the existing "behind" pass, under the entities
//     for (const m of game.monsters) drawMonster(m)
//     drawProjectiles(); drawHazards();          <- hazards paint LAST
// Both vortex pools are hazards (soul_vortex, necro_maelstrom), so a 600x260
// swirling field painted over the boss you are trying to read. Every other
// hazard is a floor effect where painting on top is correct; these two are
// arena-sized fields the fight happens INSIDE.
//
// THE FIX. drawHazards takes a behind-pass flag, exactly like drawSmoothFx:
//   drawHazards(true)  drawn before the monster loop — ONLY the two pools
//   drawHazards()      drawn where it always was — every hazard EXCEPT those
// Each hazard is therefore visited exactly once per frame across the two
// passes, which is what keeps the four game.particles.push emitters and the
// h._dieAt expiry inside that function from firing twice.
//
// Nothing else moves: the pools keep their exact art, size, alpha and
// animation, and every other hazard keeps its current layer. Damage is
// untouched — it lives in the hazard resolver, not the draw pass.
//
// Guarded + atomic + idempotent + EOL-aware (this file is now entirely LF —
// a parallel session normalised it; the helper below reads it rather than
// assuming, since a wrong newline here would corrupt the render loop).
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;

if (s.includes('_vtxBehind')) { console.log('already applied'); process.exit(0); }

// Per-anchor newline, not a file-global guess: the file has been both CRLF
// and LF across sessions and could be mixed again.
const eolAt = (anchor) => {
  const i = s.indexOf(anchor);
  if (i < 0) return '\n';
  return s.substr(i + anchor.length, 2) === '\r\n' ? '\r\n' : '\n';
};
const sub = (label, anchor, lines) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(lines.join(eolAt(anchor)));
};

// ---- 1. the flag ------------------------------------------------------------
sub('drawHazards signature',
  'function drawHazards() {',
  ['function drawHazards(_behindPass) {']);

// ---- 2. split the two pools out of the main pass ----------------------------
sub('pool pass filter',
  '    const sx = h.cx - game.camera.x;',
  ['    const sx = h.cx - game.camera.x;',
   '    // v0.30.290 — the two warlock pools are arena-sized fields the fight',
   '    // happens INSIDE, not floor effects to paint over the fight. They draw',
   '    // in the behind-pass before the monster loop; everything else keeps its',
   '    // existing layer. The two passes partition the list, so each hazard is',
   '    // still visited exactly once per frame (the particle emitters and the',
   '    // _dieAt expiry below must not fire twice).',
   "    const _vtxBehind = (h.type === 'soul_vortex' || h.type === 'necro_maelstrom');",
   '    if (_behindPass ? !_vtxBehind : _vtxBehind) continue;']);

// ---- 3. call the behind pass before the monsters ----------------------------
sub('behind-pass call',
  "  if (typeof drawSmoothFx === 'function') drawSmoothFx(true);   // v0.29.790 — behind-tagged bursts, under the entities",
  ["  if (typeof drawSmoothFx === 'function') drawSmoothFx(true);   // v0.29.790 — behind-tagged bursts, under the entities",
   '  drawHazards(true);   // v0.30.290 — Soul Vortex + Necrotic Ascendance pools, UNDER the monsters they engulf']);

const grew = s.length - n0;
if (grew < 400 || grew > 1400) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew})`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: vortex pools render behind monsters (+${grew})`);
