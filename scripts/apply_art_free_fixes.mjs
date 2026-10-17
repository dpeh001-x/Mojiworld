// Free art clean-up: compression blocks and soft edges removed from effects, backdrops, the world map and menu plates (2026-10-17).
// ============================================================================
// An art audit measured leftover WebP compression blocks (a faint 4x4 grid and blotchy flat patches) and soft edges across the
// skill / projectile / hazard effects, several full-size map backdrops, the world-map plate and a few menu plates. The fix is ART
// ONLY, made with no credits and shipped by the LX_APPLY2 half (scripts/apply_art_free_fixes_assets.mjs): every file is replaced
// under its own name at its own canvas size.
//   - effects (player skills, generic, and the bosses' / monsters' own shots and swings) and the world map: deblocked, then the
//     luminance shock-filter sharpen the Tower Arbiter got in v0.30.1815; lossy WebP with LOSSLESS alpha, so every outline is
//     byte-identical (no sprite_edges / sprite_bbox row moves, hit boxes and placement untouched);
//   - map backdrops: deblocked, kept only where an affordable encode actually removed the grid;
//   - menu plates: deblocked; the three the user approved go near-lossless (the only encode that keeps the grid out).
// This script only leaves the version marker in the game file (the pipeline needs a game change to version the ship).
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('ART CLEANED OF COMPRESSION BLOCKS')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

{
  const A = 'function spawnSpriteBurst(x, y, spriteKey, opts) {';
  once(A, J(
    '// v0.30.1835 art-free-fixes - ART CLEANED OF COMPRESSION BLOCKS (art only, no credits). The skill, projectile and hazard effects',
    '// this draws (and the bosses\' and monsters\' own shots and swings), several map backdrops, the world-map plate and some menu',
    '// plates were re-saved under their own names at their own canvas sizes: deblocked, the effects and the map sharpened with the',
    '// v0.30.1815 shock filter. Every effect\'s alpha is byte-identical, so sizes, outlines and the edge / bbox tables still hold.',
    '// The list and the before/after hashes live in scripts/apply_art_free_fixes_assets.mjs.',
    A), 'spawnSpriteBurst');
}

const grew = s.length - n0;
if (grew < 400 || grew > 1500) die('size moved ' + grew);
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
console.log('applied: art-free-fixes (+' + grew + ' chars)');
