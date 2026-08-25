// Animator: calib EDITS must follow ART_OWNER, not just calib reads.
// =============================================================================
// Per user, on the aetherionastral entry: "I cant seem to edit this".
//
// aetherionastral is an owned set: ART_OWNER maps it to 'aetherion' because the
// game takes the FRAMES from _aetherionAstralKey but draws them through
// _drawBossSprite with m.type === 'aetherion', so geometry and calibration are
// his. The animator's own panel note says exactly that — "the sliders here move
// his attack calib".
//
// They did not. Every READ went through ownerOf():
//     const c = (CALIB[ownerOf(cur)] && CALIB[ownerOf(cur)][st]) || ...
// while every WRITE went to the selected entity:
//     A.CALIB()[A.cur][st][k] = ...
// So dragging a slider on aetherionastral stored the value under
// 'aetherionastral', which nothing reads, and the preview never moved. The
// control was not disabled — it was writing to a key with no readers.
//
// Fix: expose ownerOf, and route every calib read/write in the controls layer
// through it. 11 call sites, all of the form A.CALIB()[A.cur].
//
// Also:
//   • the Copy-patch button emitted `type: cur`, which would have hardbaked a
//     patch under 'aetherionastral' — a key the game never consults for calib.
//     It now emits the owner, and reads the owner's block, so the patch carries
//     Aetherion's COMPLETE calib rather than a partial one (the baker replaces
//     an entity's calib block, so a partial patch under his name would drop his
//     other states).
//   • the reset button is relabelled on an owned set, because "Reset
//     aetherionastral to defaults" in fact resets AETHERION's calibration and
//     that should not be a surprise.
//
// HITBOXES ARE DELIBERATELY NOT REDIRECTED. The ART_OWNER note claims geometry,
// calibration and the content-norm reference; it does not claim hitboxes, and
// redirecting them on a guess could silently overwrite Aetherion's. Left alone
// and flagged.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/monster_animator.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('ownerOf,')) { console.log('already applied — nothing to do'); process.exit(0); }

const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c} times, expected 1`); process.exit(1); }
  s = s.replace(anchor, after.split('\n').join(EOL));
};

// ---- 1. expose ownerOf on the app ------------------------------------------
sub('export', '    CALIB: () => CALIB, HBX: () => HBX,',
`    CALIB: () => CALIB, HBX: () => HBX,
    // v0.30.x — the controls layer needs this to EDIT the right entity. Reads
    // already resolved through ownerOf(); writes did not, so an owned set's
    // sliders wrote to a key nothing reads. See scripts/apply_animator_owner_fix.mjs.
    ownerOf,`);

// ---- 2. route every controls-layer calib access through the owner ----------
const OLD = 'A.CALIB()[A.cur]';
const NEW = 'A.CALIB()[A.owner()]';
const hits = s.split(OLD).length - 1;
if (hits !== 11) { console.error(`ABORT calib sites: found ${hits}, expected 11`); process.exit(1); }
s = s.split(OLD).join(NEW);

// A.owner() helper next to the other controls-layer helpers. Anchored on the
// setVal definition so it lands in the same scope as its callers.
sub('helper', '  function setVal(st, k, raw) {',
`  // v0.30.x — the entity whose CALIB the current selection actually edits.
  // For an owned set (aetherionastral -> aetherion) that is the owner, because
  // the game resolves geometry and calibration on the owner's type.
  A.owner = () => A.ownerOf(A.cur);
  function setVal(st, k, raw) {`);

// ---- 3. copy-patch targets the owner ---------------------------------------
sub('patch-read', '    const C = A.CALIB()[cur] || {}, H = A.HBX()[cur] || {};',
`    // v0.30.x — an owned set's calib lives under its OWNER, and the baker
    // replaces an entity's calib block wholesale, so the patch has to carry the
    // owner's complete block under the owner's name. Emitting it under
    // 'aetherionastral' hardbaked a key the game never reads for calib.
    const owner = A.ownerOf(cur);
    const C = A.CALIB()[owner] || {}, H = A.HBX()[cur] || {};`);

sub('patch-key', '    const patch = { LX_ANIM_PATCH: 1, type: cur, calib };',
`    const patch = { LX_ANIM_PATCH: 1, type: owner, calib };`);

sub('patch-calibkey', '        const k = A.calibKey(cur, st);   // zodiac states store as \'zodiac/<state>\'',
`        const k = A.calibKey(owner, st);   // zodiac states store as 'zodiac/<state>'`);

// ---- 4. say what the reset button will actually reset ----------------------
sub('reset-label', '    html += `<button class="warn reset" id="resetAll" style="width:100%;margin-top:2px">Reset ${cur} to defaults</button>`;',
`    // v0.30.x — on an owned set this resets the OWNER's calibration, so the
    // label has to say so rather than name the set you have selected.
    const _rsTarget = A.ownerOf(cur);
    html += \`<button class="warn reset" id="resetAll" style="width:100%;margin-top:2px">Reset \${_rsTarget}\${_rsTarget !== cur ? ' (owns ' + cur + ')' : ''} to defaults</button>\`;`);

// (The resetAll body needed no separate edit: it reads A.CALIB()[A.cur][s],
// which the global replace in step 2 already routed to the owner. A dedicated
// anchor for it matched 0 times for exactly that reason.)

// ---- 5. build badge, per the project rule -----------------------------------
const OLDV = 'build v0.30.226', NEWV = 'build v0.30.227';
const bv = s.split(OLDV).length - 1;
if (bv < 1) { console.error('ABORT: build badge not found'); process.exit(1); }
s = s.split(OLDV).join(NEWV);

writeFileSync(F + '.tmp', s, 'utf8');
const n = statSync(F + '.tmp').size;
if (n <= n0) { console.error(`ABORT: tmp ${n}B not larger than ${n0}B`); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars (+${s.length - n0})`);
console.log(`  ${hits} calib sites routed through the owner`);
console.log(`  build badge ${OLDV} -> ${NEWV} (${bv} occurrence(s))`);
