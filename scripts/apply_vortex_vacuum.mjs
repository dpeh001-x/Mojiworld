// Soul Vortex / Necrotic Ascendance: the vacuum works, and only on screen.
// =============================================================================
// Per user: "soul vortex and necrotic ascendance occasionally buggy vacuum,
// ensure it vacuums the monster on the screen properly, do not affect
// monsters that are not seen on the screen".
//
// Two faults, both structural:
//
// 1. NO SCREEN GATE. The pull loop walks every monster on the map, and the
//    outer suck ellipse is 860x600px (LX_VORTEX_SUCK_RX/RY = 430/300) — cast
//    near a screen edge it reaches ~430px past it, dragging mobs the player
//    cannot see. Measured on the unpatched build: a mob 260px off the left
//    edge, with speed 0 so nothing but the vortex could touch it, was hauled
//    335px. That is the "buggy" read — things arriving from off-screen, or
//    dying inside a pull with nothing on screen to explain it. The loop now
//    skips any monster whose box lies fully outside the camera view, with a
//    40px margin so a half-visible mob at the edge still pulls.
//
// 2. THE OUTER RING NEVER CANCELLED THE MOB'S OWN MOTION. The v0.29 rework
//    fixed this for the INNER pool — grounded AI's per-frame
//    `m.vx = facing * speed` is undone with `m.x -= m.vx * 0.8` — but the
//    ring got nothing. A mob walking away fought the 2.8px/frame rim pull
//    with its whole walk speed, so it crawled, stalled, or jittered at the
//    rim depending on its speed: the "occasionally buggy" part, and why it
//    read worst underwater where every mob is a flier.
//    The counter is applied in POSITION space for both cases, deliberately:
//    a flier's AI rewrites vx/vy every frame BEFORE this hazard tick runs
//    (it lives in updateProjectiles), so damping velocity here is a no-op —
//    the frame's own motion has to be undone where it landed. Bosses keep
//    their lean-only 0.30 factor and are not counter-moved at all.
//
// Damage, drain, souls, the collapse and the drop-through plumbing are
// untouched: this changes who gets pulled, and whether the pull actually
// wins against the mob's own movement.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_vxViewL')) { console.log('already applied'); process.exit(0); }
const eolAt = (a) => { const i = s.indexOf(a); return (i >= 0 && s.substr(i + a.length, 2) === '\r\n') ? '\r\n' : '\n'; };
const sub = (label, anchor, lines) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(lines.join(eolAt(anchor)));
};

// ---- 1a. camera view, computed once per hazard tick -------------------------
sub('view bounds',
  '      const _vsc = game._vortexScratch || (game._vortexScratch = []);',
  ['      // v0.30.x — ON-SCREEN GATE (per user: "do not affect monsters that',
   '      // are not seen on the screen"). The suck ellipse is 860x600px, so a',
   '      // pool near a screen edge reached ~430px into off-screen territory;',
   '      // measured 335px of drag on an off-screen mob before this gate.',
   '      // 40px margin keeps a half-visible mob at the edge pulling.',
   '      const _vxViewL = (game.camera.x || 0) - 40;',
   '      const _vxViewR = (game.camera.x || 0) + W + 40;',
   '      const _vxViewT = ((game.camera && game.camera.y) || 0) - 40;',
   '      const _vxViewB = ((game.camera && game.camera.y) || 0) + H + 40;',
   '      const _vsc = game._vortexScratch || (game._vortexScratch = []);']);

// ---- 1b. the gate, per monster ----------------------------------------------
sub('per-monster gate',
  '        const _vdx = cx - Math.max(m.x, Math.min(cx, m.x + m.w));',
  ['        // v0.30.x — off-screen mobs are not vacuumed (see the gate above).',
   '        if (m.x + m.w < _vxViewL || m.x > _vxViewR || m.y + m.h < _vxViewT || m.y > _vxViewB) {',
   '          if (m._vxSuckDrop) { m.dropThrough = false; m._vxSuckDrop = false; }   // release: never strand a drop-through flag',
   '          continue;',
   '        }',
   '        const _vdx = cx - Math.max(m.x, Math.min(cx, m.x + m.w));']);

// ---- 2. the ring cancels the mob's own motion, like the pool does -----------
sub('ring motion cancel',
  "          if (_sIsBoss) _sstep *= 0.30;   // bosses lean, they don't get vacuumed",
  ["          if (_sIsBoss) _sstep *= 0.30;   // bosses lean, they don't get vacuumed",
   "          // v0.30.x — the ring now counters the mob's own motion the way the",
   "          // inner pool always has. Without it, grounded AI's per-frame",
   '          // `m.vx = facing * speed` fought the 2.8px/f rim pull with the whole',
   '          // walk speed and mobs crawled or stalled at the rim.',
   '          // POSITION space for both cases: a flier\'s AI rewrites vx/vy every',
   '          // frame BEFORE this tick runs, so damping velocity is a no-op — the',
   "          // frame's own motion must be undone where it landed.",
   '          if (!_sIsBoss) {',
   '            m.x -= (m.vx || 0) * 0.8;',
   '            if (m.flies) m.y -= (m.vy || 0) * 0.8;',
   '          }']);

const grew = s.length - n0;
if (grew < 900 || grew > 2600) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew})`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: vortex on-screen gate + ring motion-cancel (+${grew})`);
