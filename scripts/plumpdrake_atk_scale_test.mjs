// PLUMPDRAKE — the attack animation must not swell above the idle body size.
// ============================================================================
// Per user: "plumpdrake attack sprite animation pulses slightly bigger than
// base". Plumpdrake is `fatDragon` internally.
//
// A monster's draw box is targetH x _ATK_FRAME_SCALE[type], and NONE of those
// terms vary per frame -- so the rendered creature size is decided entirely by
// how much of its 640px canvas the body fills. fatDragon's 1.951 was calibrated
// on frame 0 alone (its own comment says "attack-frame body 310/640"; frame 0
// measures 311/640), so frame 0 matched the idle body exactly and every later
// frame overshot as the dragon reared through the swing:
//
//   rendered body height as a ratio of the idle body, at 1.951:
//   1.001  0.966  0.966  1.040  1.033  1.072  1.091  1.194  1.091
//                                                    ^^^^^ +19%
//
// This test is deliberately FILE-ONLY. Two renderer-side approaches were tried
// and both measured nothing:
//   * a per-frame scale table -- monsters blit from a baked cache keyed by
//     STATE ('attack'), not by frame, so the frame index is not available at
//     draw time and the applied scale never moved off entry 0;
//   * screenshot diffing -- returned ~50 changed pixels of background noise.
// The fix is therefore in the art, and the art is what gets checked.
// Run: node scripts/plumpdrake_atk_scale_test.mjs
//   MOJI_ATK_DIR=<dir> points the attack frames elsewhere (used to prove this
//   fails on the original art).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPE = 'fatDragon';

const bodyFrac = async (file) => {
  const img = sharp(file);
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = -1, bot = -1;
  for (let y = 0; y < info.height; y++) {
    let hit = false;
    for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 16) { hit = true; break; }
    if (hit) { if (top < 0) top = y; bot = y; }
  }
  return (bot - top + 1) / meta.height;
};

const idleFrac = await bodyFrac(path.join(ROOT, 'Sprites/monsters', TYPE + '.webp'));
const atkDir = process.env.MOJI_ATK_DIR
  ? path.resolve(ROOT, process.env.MOJI_ATK_DIR)
  : path.join(ROOT, 'Sprites/monsters/attack');
const files = (await readdir(atkDir)).filter(f => f.startsWith(TYPE + '_') && f.endsWith('.webp')).sort();
const fracs = [];
for (const f of files) fracs.push(await bodyFrac(path.join(atkDir, f)));

const src = await readFile(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const m = /_ATK_FRAME_SCALE = Object\.assign\(Object\.create\(null\), \{[\s\S]*?fatDragon:\s*([0-9.]+)/.exec(src);
const perType = m ? parseFloat(m[1]) : null;

const ratios = fracs.map(f => (f * perType) / idleFrac);
const worst = Math.max(...ratios), smallest = Math.min(...ratios);
const spread = Math.max(...fracs) - Math.min(...fracs);

console.log(`  source: ${path.relative(ROOT, atkDir)}   frames: ${files.length}`);
console.log(`  idle body/frame ${idleFrac.toFixed(4)}   _ATK_FRAME_SCALE.fatDragon ${perType}`);
console.log(`  attack body/frame: ${fracs.map(f => f.toFixed(4)).join(' ')}`);
console.log(`  rendered vs idle : ${ratios.map(r => r.toFixed(3)).join(' ')}`);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });

ok('all nine attack frames are present', files.length === 9, `${files.length} frames`);
ok('no attack frame renders BIGGER than the idle body', worst <= 1.01,
   `largest ${worst.toFixed(3)}x idle (the reported pulse peaked at 1.194x)`);
ok('...and none is shrunk to compensate', smallest >= 0.99,
   `smallest ${smallest.toFixed(3)}x idle`);
ok('the frames are padded consistently with each other', spread <= 0.004,
   `body-fraction spread ${spread.toFixed(4)} across the cycle (was 0.1109)`);
ok('the per-type constant did not have to move', perType === 1.951,
   `_ATK_FRAME_SCALE.fatDragon = ${perType} — the art was corrected, not the renderer`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
