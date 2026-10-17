// SHARPER MAP BACKDROPS, DAWN GATE, DAWN CREST AND ARCANE SHOCKWAVE (esrgan-maps, 2026-10-17) - the game-file half (LX_APPLY).
// ============================================================================
// Per user: upscale the stretched map backgrounds, the town's Dawn Gate and two effects for free with a local AI upscaler
// (Real-ESRGAN), "drawn size and anchor stay identical".
// What players saw: 18 map backdrops were 1152-1456 px wide but drawn across a 1920-2880 px screen (a 1.3-2x stretch: soft, with
// 4x4 compression blocks); the Dawn Gate (760 px, drawn 1014 px at DPR 2), the Dawn's Favor crest (a soft source) and the Mage's
// Arcane Burst shockwave ring (768 px, drawn up to 1408 px) were the same story.
// What changes (all in LX_APPLY2, scripts/apply_esrgan_maps_bake.mjs - this file only carries the version marker and this note):
//   - ART: each file deblocked, upscaled x4 by Real-ESRGAN (four tile-shifted passes blended, so no tile seams), reduced ONCE
//     (lanczos3) to its new size, tone-matched to the original (local means: no crushed shadows, no colour cast) and lightly
//     sharpened; sprites keep the original outline (alpha resampled, never through the model) and ease back to the original
//     colour in their soft edge band (no sticker edge, no dark rim). Every new size keeps the old ASPECT exactly (or to 0.003%),
//     and every draw sizes from the aspect or a fixed width, so each lands in exactly the box it did.
//   - TABLES: data/sprite_bbox.js row for the gate (the table is size-guarded) and data/sprite_edges.js rows that moved; sw.js +1.
// No draw code moves. Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('SHARPER MAP BACKDROPS (esrgan-maps)')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
{
  const A = 'function _lxBgScaled(img, w, h) {';
  once(A, J(
    '// v0.30.1836 esrgan-maps - SHARPER MAP BACKDROPS (esrgan-maps). 18 plates that were 1152-1456 px wide (forest, meadow, misty, dungeon, the two',
    '// underwater cinematics, nine v4 1344x736 backdrops, Ossuary Sprawl, both Glasswind Steppes) are re-drawn by a local AI upscaler at the',
    '// 2912-class size at their EXACT old aspect (2912x1632, 2940x1610, 2912x1664, 2912x2184). Every box below sizes from W/H and the aspect',
    '// only (_lxWideCover, _lxNoMirrorSize, the >3% crop rule), so each plate lands where it did; it is now baked DOWN here instead of',
    '// stretched up. The Dawn Gate (x2, same aspect), the Dawn crest (1034x1089) and the arcane shockwave (x2) likewise. (v0.30.1836 esrgan-maps)',
    A), '_lxBgScaled');
}
const grew = s.length - n0;
if (grew < 600 || grew > 1400) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: esrgan-maps (+' + grew + ' chars)');
