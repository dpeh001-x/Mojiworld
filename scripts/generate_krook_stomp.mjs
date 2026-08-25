#!/usr/bin/env node
// King Krook — STOMP attack animation (ludo.ai).
// =============================================================================
// Per user: "using ludo.ai generate stomp attack animation for krook boss,
// eventually this will be wired in game as a new strong attack with huge stun".
//
// Output -> Sprites/bosses/attack/kingKrookstomp_0..8.webp
// That naming is the engine's convention for a per-attack set: an alternate
// boss attack lives at Sprites/bosses/attack/<boss><attack>_0..8.webp and is
// selected by a sprite key (gravitospunch, gravitossoul, towerSovereignvolley).
// Generating the art does NOT wire the attack; the key still has to be chosen
// at the attack site, which is deliberately left for when the move is built.
//
// WHY ANIMATE RATHER THAN GENERATE FROM SCRATCH. A text-to-image call cannot
// reproduce this specific character - crimson crocodile king, gold crown,
// purple cape with white fur trim, cream belly - and a stomp performed by a
// slightly different Krook is worse than no stomp. /assets/sprite/animate takes
// an initial_image, so the set is animated FROM Krook's own attack frame: same
// character by construction, only the motion is new.
//
// Frames are baked back onto the source's exact canvas at the source's content
// offset and FEET-ALIGNED to the bottom. The renderer anchors a boss by its
// content bbox, so a tight-cropped frame would rescale him mid-attack - and for
// a stomp specifically, a frame anchored by its centre would make the whole
// boss bob up and down instead of his leg moving.
//
//   node scripts/generate_krook_stomp.mjs              # dry-run
//   node scripts/generate_krook_stomp.mjs --generate   # write the 9 frames
//   flags: --frames N   --tries N
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATK_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const SRC = join(ATK_DIR, 'kingKrook_0.webp');
const KEY = 'kingKrookstomp';
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAMES = Number(arg('--frames') || 9);
const TRIES = Number(arg('--tries') || 3);

// Identity first, then motion. The identity clause is repeated because the
// model drops trailing detail: the sovereign generator learned that the hard
// way and the same wording discipline applies here.
const IDENTITY =
  'The character stays exactly the same crimson-red crocodile king in every frame: gold spiked crown, ' +
  'deep purple royal cape with white fur trim, cream-coloured belly, heavy stocky build, thick tail. ' +
  'Identical costume and colours throughout. ';
const FRAMING =
  'Centred, FULL BODY, nothing cropped: the crown, the tail and both feet stay well inside the frame with margin on all four sides. ' +
  'Do NOT zoom in and do NOT change the size of the character between frames. ' +
  'Side-on view, the same camera distance in every frame. No text, no UI, no background scenery. ';
// The stomp itself. One foot PLANTED is stated explicitly - "feet on the same
// line" is the usual anti-drift instruction but it contradicts a stomp, so the
// planted foot carries the anchor while the other leg does the work.
const MOTION =
  'He rears back and raises one massive hind leg high, then SLAMS it down onto the ground with all his weight. ' +
  'His other foot stays planted on the same ground line the whole time. ' +
  'On impact the ground cracks beneath him and a ring of dust and shockwave bursts outward along the floor, ' +
  'small rocks flying up. He roars with the effort. Heavy, weighty, earth-shaking - the wind-up is slow and the slam is sudden.';

console.log(`King Krook STOMP -> Sprites/bosses/attack/${KEY}_0..${FRAMES - 1}.webp`);
if (!has('--generate')) {
  console.log('\nsource : ' + SRC.replace(repoRoot, '.'));
  console.log('frames : ' + FRAMES + '   re-roll tries on a clipped set: ' + TRIES);
  console.log('\nmotion prompt:\n  ' + MOTION);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402 || /\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
    throw new Error(path + ' ' + res.status + ': ' + t.slice(0, 200));
  }
  return res.json();
}

const ALPHA = 16;
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return (x1 < 0) ? null : { x0, y0, x1, y1, W, H };
}
// Opaque pixels sitting on the outer border mean the model zoomed and sliced
// the character. Cheap to detect, impossible to repair afterwards - so re-roll.
async function edgeTouching(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let n = 0;
  for (let x = 0; x < W; x++) {
    if (data[(0 * W + x) * C + 3] > 40) n++;
    if (data[((H - 1) * W + x) * C + 3] > 40) n++;
  }
  for (let y = 0; y < H; y++) {
    if (data[(y * W + 0) * C + 3] > 40) n++;
    if (data[(y * W + (W - 1)) * C + 3] > 40) n++;
  }
  return n;
}

const srcMeta = await sharp(SRC).metadata();
const CANVAS_W = srcMeta.width, CANVAS_H = srcMeta.height;
const srcBox = await bbox(await sharp(SRC).toBuffer());
if (!srcBox) { console.error('source sprite is empty'); process.exit(1); }
const cropW = srcBox.x1 - srcBox.x0 + 1, cropH = srcBox.y1 - srcBox.y0 + 1;
console.log(`source ${CANVAS_W}x${CANVAS_H}, content ${cropW}x${cropH} at (${srcBox.x0},${srcBox.y0})`);

const initial = await sharp(SRC).resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 94 }).toBuffer();

let bufs = [], clipped = 0;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  process.stdout.write(`  attempt ${attempt}/${TRIES} ... `);
  const anim = await post('/assets/sprite/animate', {
    initial_image: 'data:image/webp;base64,' + initial.toString('base64'),
    motion_prompt: IDENTITY + FRAMING + MOTION,
    frames: FRAMES, frame_size: -9, model: 'eagle',
    individual_frames: true, loop: false, image_type: 'sprite',
  });
  bufs = [];
  if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
    const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
    const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
    for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
      for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
        bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
  }
  if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
    bufs = [];
    for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
  }
  if (bufs.length < FRAMES) { console.log(`got ${bufs.length}/${FRAMES} frames, re-rolling`); continue; }
  clipped = 0;
  for (const b of bufs) if (await edgeTouching(b) > 24) clipped++;
  if (!clipped) { console.log('clean'); break; }
  console.log(`clipped ${clipped}/${FRAMES}, re-rolling`);
}
if (!bufs.length) { console.error('no frames returned'); process.exit(1); }
if (clipped) console.log(`WARNING: shipping with ${clipped}/${FRAMES} clipped frames - inspect before committing`);

// Union box across the whole set, scaled to the SOURCE content box and
// FEET-ALIGNED. Per-frame cropping would make him breathe; centre-aligning
// would make the whole boss bob instead of his leg moving.
const boxes = [];
for (const b of bufs) { const bb = await bbox(b); if (bb) boxes.push(bb); }
if (!boxes.length) { console.error('every frame empty'); process.exit(1); }
const U = boxes.reduce((p, q) => ({
  x0: Math.min(p.x0, q.x0), y0: Math.min(p.y0, q.y0),
  x1: Math.max(p.x1, q.x1), y1: Math.max(p.y1, q.y1),
}));
const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;
const sc = Math.min(cropW / uw, cropH / uh);
const dw = Math.max(1, Math.round(uw * sc)), dh = Math.max(1, Math.round(uh * sc));
const offX = srcBox.x0 + Math.round((cropW - dw) / 2);
const offY = srcBox.y0 + (cropH - dh);

await mkdir(ATK_DIR, { recursive: true });
for (let i = 0; i < bufs.length; i++) {
  const cut = await sharp(bufs[i]).extract({ left: U.x0, top: U.y0, width: uw, height: uh })
    .resize(dw, dh, { fit: 'fill' }).png().toBuffer();
  const out = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cut, left: offX, top: offY }])
    .webp({ quality: 92 }).toBuffer();
  await writeFile(join(ATK_DIR, `${KEY}_${i}.webp`), out);
}
console.log(`wrote ${bufs.length} frames -> Sprites/bosses/attack/${KEY}_0..${bufs.length - 1}.webp`);
