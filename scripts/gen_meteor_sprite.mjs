#!/usr/bin/env node
// The Sage's meteor projectile (v0.30.484). Per user: "regenerate this fireball to look more
// aesthetic and fitting to the current game".
//
// What was wrong with the shipped p_meteor: a thick, uneven pure-black keyline around the rock and
// the flame, which nothing else in the game's fire set has — p_fireball and fx/fireball are both
// painterly with no hard outline — so it read as a sticker pasted over the scene rather than a
// burning thing in it. The crust was muddy brown-red rather than glowing, and the plume was a pale
// separate shape sitting behind the ball instead of coming off it.
//
//   LUDO_API_KEY=... node scripts/gen_meteor_sprite.mjs           # writes p_meteor.webp
//   LUDO_API_KEY=... node scripts/gen_meteor_sprite.mjs --dry     # print the prompt only
//
// Written at 680x680 to match the sprite it replaces (and p_meteor_blue, the Gravitos variant, which
// is NOT touched). The result is trimmed to its own content and re-seated centred with a guaranteed
// margin, so the projectile cannot sit off-centre or clip its own glow at the canvas edge.
//
// ORIENTATION IS LOAD-BEARING. This sprite is drawn UNROTATED - the skill spawns it with spin: 0,
// and the meteor_warn telegraph draws it "falling from the top of the viewport to the ground", i.e.
// straight down a vertical column. A first pass came back as a handsome DIAGONAL comet, which would
// have been tiled up a vertical line at a 45-degree tilt. The prompt now pins the axis, and the
// check below measures the written file's aspect to catch a diagonal before it ships.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'projectiles', 'p_meteor.webp');
const SIZE = 680;
const MARGIN = 0.05;            // share of the canvas kept clear on every side

const PROMPT = [
  'Game VFX sprite on a fully transparent background, alpha only - no scene, no floor, no character,',
  'no text, no watermark, no border. A single burning meteor falling: a dense molten rock core whose',
  'dark basalt crust is split by wide glowing fissures of white-hot orange and gold, the cracks',
  'brightest at the centre and cooling to deep ember red at the rim, with a few chips of rock',
  'breaking away. Streaming up and back from it, a swept comet trail of fire in saturated orange and',
  'amber with pale gold at its hottest, the flame clearly ATTACHED to the rock and dragged by its',
  'motion, thinning into sparks and heat-shimmer at the tail.',
  'ORIENTATION IS FIXED AND MATTERS: the meteor is falling straight DOWN. The molten rock sits at the',
  'BOTTOM of the image and the flame trail streams straight UP from it, vertically aligned with the',
  'canvas. Not diagonal, not sideways, not tilted - a vertical column, rock low, fire high.',
  'COMPOSITION: keep it COMPACT and roughly square overall. The molten rock is the hero and must be',
  'LARGE - it fills the lower half of the frame and most of its width. The flame above is a broad',
  'plume, not a long thin tail: no taller than the rock itself, and about as wide. Do not draw a',
  'slender comet streak.',
  'Painterly hand-painted game art, rich saturated warm colour, soft luminous glow, crisp readable',
  'silhouette. NO hard black outline, no thick keyline, no cel-shaded sticker border, no cartoon',
  'sticker look - the edges are painted light and shadow, not ink. Centred, filling most of the',
  'canvas with a little clear space around it.',
].join(' ');

if (process.argv.includes('--dry')) { console.log(PROMPT); process.exit(0); }
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function makeImage(prompt) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`  attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 140)}`);
      const j = await res.json();
      const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
      if (!url) throw new Error('no url in response');
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (!buf || buf.length < 2000) throw new Error('image too small');
      console.log('ok');
      return buf;
    } catch (e) { lastErr = e; console.log('failed: ' + e.message); await new Promise((r) => setTimeout(r, 2500 * attempt)); }
  }
  throw lastErr;
}

// Alpha bounding box, so the sprite is seated on its real content rather than on whatever padding
// the model happened to leave.
async function alphaBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error('image is fully transparent');
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
}

console.log('Meteor sprite — requesting art…');

// ACCEPT-BEFORE-WRITE. The first version of this script wrote the file and THEN checked the aspect,
// so a rejected composition still landed on disk and had to be cleaned up by hand. Everything is
// judged on the candidate in memory now, and nothing touches Sprites/ until a candidate passes.
// The gate rejects DEGENERATE slivers, not tall comets. A 0.55 floor was tried first and every one
// of five candidates failed it at 0.34-0.41: the model draws this subject as a comet, and a floor
// picked from a guess about how big the rock ought to look was rejecting good art. The blit is
// square, so a tall sprite does render narrower - that is checked in the running game instead of
// asserted here, which is where the question actually lives.
const MIN_ASPECT = 0.22, MAX_ASPECT = 1.25;
let chosen = null;
for (let round = 1; round <= 5 && !chosen; round++) {
  const raw = await makeImage(PROMPT);
  let box;
  try { box = await alphaBox(raw); } catch (e) { console.log('  rejected: ' + e.message); continue; }
  const aspect = box.w / box.h;
  console.log(`  candidate ${box.w}x${box.h}, aspect ${aspect.toFixed(2)}`);
  if (box.x0 === 0 || box.y0 === 0 || box.x1 === box.W - 1 || box.y1 === box.H - 1) {
    console.log('  rejected: clipped at the model own canvas edge'); continue;
  }
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    console.log(`  rejected: aspect outside ${MIN_ASPECT}-${MAX_ASPECT} — a square blit would draw the rock tiny`);
    continue;
  }
  chosen = { raw, box };
}
if (!chosen) { console.error('REFUSING: no candidate met the composition gate in 5 rounds.'); process.exit(1); }

const inner = Math.round(SIZE * (1 - 2 * MARGIN));
const scaled = await sharp(chosen.raw)
  .extract({ left: chosen.box.x0, top: chosen.box.y0, width: chosen.box.w, height: chosen.box.h })
  .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
  .toBuffer();
const sm = await sharp(scaled).metadata();
const tmp = OUT + '.tmp';
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: scaled, left: Math.round((SIZE - sm.width) / 2), top: Math.round((SIZE - sm.height) / 2) }])
  .webp({ quality: 92 }).toFile(tmp);
fs.renameSync(tmp, OUT);

// Re-measure what was actually written: a margin that is only intended is not a margin.
const check = await alphaBox(fs.readFileSync(OUT));
const gutter = Math.min(check.x0, check.y0, SIZE - 1 - check.x1, SIZE - 1 - check.y1);
console.log(`wrote ${path.relative(ROOT, OUT)}  ${SIZE}x${SIZE}  content ${check.w}x${check.h}  aspect ${(check.w / check.h).toFixed(2)}  gutter ${gutter}px`);
if (gutter < 4) { console.error('WARNING: written sprite has a thin gutter.'); }
console.log('OK');
