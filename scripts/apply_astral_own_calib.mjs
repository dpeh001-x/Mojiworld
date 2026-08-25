// Animator: CALIB follows the art set again, now that the game does too.
// =============================================================================
// The game's boss calib key chain gained m._aeAstralKey, so Astral Judgement
// reads LX_ANIM_CALIB['aetherionastral'] instead of borrowing
// LX_ANIM_CALIB['aetherion'].attack. That was the real fix: the two sets could
// not be sized apart, so tuning the spell grew Aetherion's ordinary swing.
//
// Which makes the animator's calib redirection WRONG in the other direction.
// v0.30.228 routed calib reads and writes through ownerOf() because the game
// resolved calib on the owner; it no longer does. Left as-is, the sliders would
// edit aetherion's numbers while the game reads aetherionastral's — the same
// "I can't edit this" symptom, mirrored.
//
// ART_OWNER is NOT removed. It still governs GEOMETRY and the content-norm
// reference, which really are Aetherion's: _bossDrawMul keys on m.type and the
// draw box is his, so the animator must keep previewing at his size (the
// 1024x819 stamp). Only CALIBRATION becomes self-keyed.
//
// So: geometry keeps ownerOf(), calib goes back to the selected set, and the
// patch is self-consistent again (type, calib and hitbox all describe the same
// entity) — which also closes the v0.30.230 hazard by construction rather than
// by remembering to keep two reads in step.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/monster_animator.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('calibOwn')) { console.log('already applied — nothing to do'); process.exit(0); }

// The ANCHOR needs the file's EOL too, not just the replacement. This file is
// CRLF, so a multi-line anchor written with '\n' matches zero times — the
// single-line subs below passed and the multi-line ones aborted, which is
// exactly how this failed the first time it ran.
const sub = (label, anchorRaw, afterRaw, expect) => {
  const anchor = anchorRaw.split('\n').join(EOL);
  const after = afterRaw.split('\n').join(EOL);
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the three module-level calib reads -> the set itself ---------------
// (geomFor's `const O = ownerOf(T)` at ~702 is GEOMETRY and is left alone.)
sub('read-cur', '    const c = (CALIB[ownerOf(cur)] && CALIB[ownerOf(cur)][st]) || { s: 1 };',
`    // v0.30.x — calib is the SET's own again: the game keys it on _aeAstralKey.
    const c = (CALIB[cur] && CALIB[cur][st]) || { s: 1 };`);
sub('read-T', '    const c = (CALIB[ownerOf(T)] && CALIB[ownerOf(T)][st]) || { s: 1, dx: 0, dy: 0 };',
`    const c = (CALIB[T] && CALIB[T][st]) || { s: 1, dx: 0, dy: 0 };`);
sub('read-t', '        const c = (CALIB[ownerOf(t)] && CALIB[ownerOf(t)][st]) || { s: 1 };',
`        const c = (CALIB[t] && CALIB[t][st]) || { s: 1 };`);

// ---- 2. controls layer: A.owner() -> A.cur ---------------------------------
// A.owner stays defined and returns the selected set, so every call site keeps
// working and the name still marks "the entity whose calib this edits".
sub('helper', `  // v0.30.x — the entity whose CALIB the current selection actually edits.
  // For an owned set (aetherionastral -> aetherion) that is the owner, because
  // the game resolves geometry and calibration on the owner's type.
  A.owner = () => A.ownerOf(A.cur);`,
`  // v0.30.x — the entity whose CALIB the current selection edits. Once the
  // game's boss calib chain learned _aeAstralKey, an owned art set resolves its
  // OWN calib in-game, so this is the selected set itself. Geometry still comes
  // from ownerOf() (see geomFor) because the draw box really is the owner's.
  A.owner = () => A.cur;`);

// ---- 3. the patch is self-consistent again ---------------------------------
sub('patch-read', `    // v0.30.x — an owned set's calib lives under its OWNER, and the baker
    // replaces an entity's calib block wholesale, so the patch has to carry the
    // owner's complete block under the owner's name. Emitting it under
    // 'aetherionastral' hardbaked a key the game never reads for calib.
    const owner = A.ownerOf(cur);`,
`    // v0.30.x — type, calib and hitbox all describe the SAME entity again, now
    // that the game reads an owned set's own calib. That is what makes the
    // patch safe: the v0.30.230 hazard (a patch naming one entity while
    // carrying another's blocks, so an absent hitbox block deleted the named
    // entity's) cannot arise when there is only one entity involved.
    const owner = cur;`);

// ---- 4. reset label: no longer redirects, so drop the "(owns …)" suffix ----
sub('reset-label', `    // v0.30.x — on an owned set this resets the OWNER's calibration, so the
    // label has to say so rather than name the set you have selected.
    const _rsTarget = A.ownerOf(cur);`,
`    // v0.30.x — resets the selected set's own calibration now, so the plain
    // name is accurate again.
    const _rsTarget = cur;`);

// ---- 5. the panel note was describing the old behaviour --------------------
sub('note', 'NOTE: the game draws these frames with AETHERION\u2019s geometry and calibration, not this set\u2019s \u2014 so the sliders here move his attack calib, and the size shown is his.',
`NOTE: the game draws these frames at AETHERION\u2019s geometry, so the size shown is his \u2014 but since v0.30.x the CALIBRATION is this set\u2019s own, so the sliders here size the spell without touching his ordinary attack pose.`);

// ---- 6. build badge --------------------------------------------------------
const OLDV = (s.match(/build (v0\.30\.\d+)/) || [])[1];
if (!OLDV) { console.error('ABORT: build badge not found'); process.exit(1); }
const NEXTV = 'v0.30.' + (Number(OLDV.split('.')[2]) + 1);
if ((s.split('build ' + OLDV).length - 1) !== 1) { console.error('ABORT: badge not unique'); process.exit(1); }
s = s.replace('build ' + OLDV, 'build ' + NEXTV);

writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < n0 * 0.9) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars`);
console.log(`  calib reads/writes now key on the SET; geometry still on the owner`);
console.log(`  build badge ${OLDV} -> ${NEXTV}`);
