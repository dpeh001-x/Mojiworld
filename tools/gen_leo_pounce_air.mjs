#!/usr/bin/env node
// REGULUS'S POUNCE — nine frames that are actually in the air.
// =============================================================================
// Two previous attempts (v0.30.170, and the v0.30.210 re-roll) both animated
// FROM leo_0.webp and both came back with the lion rearing on planted hind
// legs. leo_0 is itself a rear, and sprite-animate anchors hard to the posture
// of the image it is given: no amount of "never stands, never lands" in the
// motion prompt moved it, because the base kept pulling it back.
//
// So the base is the fix. Step 1 generates a NEW keyframe that is unambiguously
// airborne — body horizontal, all four legs clear of the ground, no floor line
// at all — and step 2 animates from that. Now the anchoring works FOR us.
//
// The airborne gate is measured, not eyeballed: a leaping cat's silhouette is
// WIDER than it is tall, a rearing one is taller than wide. leo_0 measures
// about 1.0; a real leap should come back well above that. A roll that fails
// the gate is re-rolled rather than shipped, which is exactly the check the two
// earlier attempts lacked.
//
//   node tools/gen_leo_pounce_air.mjs                # dry-run, prints prompts
//   node tools/gen_leo_pounce_air.mjs --generate     # needs LUDO_API_KEY
//   node tools/gen_leo_pounce_air.mjs --install      # staged -> Sprites/
//   flags: --tries N (default 4)
// =============================================================================
import sharp from 'sharp';
import { writeFile, rename, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = join(ROOT, 'Sprites', 'bosses', 'zodiac', 'pounce', 'leo_0.webp');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'leo_pounce_air');
const DEST = join(ROOT, 'Sprites', 'bosses', 'zodiac', 'pounce');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TRIES = Math.max(1, Number(arg('--tries') || 4));
const FRAMES = 9;

const BASE_PROMPT =
  'A majestic golden LION IN MID-LEAP, seen from the side, flying LEFT TO ' +
  'RIGHT through empty air. His body is stretched out HORIZONTALLY like a big ' +
  'cat at full extension, forelegs reaching far forward with claws spread, ' +
  'hind legs trailing straight out behind him. ALL FOUR PAWS ARE HIGH OFF THE ' +
  'GROUND. Jaws open in a roar, blazing orange-and-red flame mane streaming ' +
  'backward, golden fur with soft amber rosette spots, a fire-tipped tail ' +
  'trailing behind, small sun-fire embers streaming off his paws and tail. ' +
  'Bold black keyline, cel-shaded painterly fantasy game sprite, vibrant ' +
  'saturated golds and oranges. ' +
  'He is FLYING THROUGH THE AIR. There is NO GROUND, NO FLOOR, NO GROUND LINE, ' +
  'NO SHADOW beneath him, and he is NOT standing, NOT sitting, NOT rearing up ' +
  'on his hind legs, NOT crouching. Fully transparent background, single ' +
  'character centred, no text, no UI.';

const MOTION =
  'the leaping lion sails through the air in one continuous pounce: his body ' +
  'rotates slowly, forelegs reaching further forward and claws spreading wider ' +
  'as he begins to descend toward the end of the arc, mane and tail streaming, ' +
  'embers trailing. He stays FULLY AIRBORNE the entire time and never touches ' +
  'anything. He never stands, never rears, never lands, never crouches. No ' +
  'ground appears at any point. He stays the same size, centred in frame, no ' +
  'zoom and no camera move.';

if (has('--install')) {
  // Install however many CONTIGUOUS frames are staged, not a hardcoded 9: the
  // normalise pass drops frames that come back reared, so the surviving count
  // is decided there. The loader stops at the first gap, so contiguity is the
  // thing that actually has to hold.
  let n = 0;
  while (existsSync(join(STAGE, `leo_${n}.webp`))) n++;
  if (n === 0) { console.error('ABORT: nothing staged'); process.exit(1); }
  for (let i = 0; i < n; i++) await copyFile(join(STAGE, `leo_${i}.webp`), join(DEST, `leo_${i}.webp`));
  console.log(`installed ${n} frames -> Sprites/bosses/zodiac/pounce/`);
  console.log('NOW REGENERATE THE FRAME INDEX, or the loader still only asks for 3:');
  console.log('  node scripts/gen_sprite_frame_index.mjs');
  process.exit(0);
}
if (!has('--generate')) {
  console.log('# Regulus pounce — airborne base, then nine frames\n');
  console.log('## base\n' + BASE_PROMPT + '\n');
  console.log('## motion\n' + MOTION + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), review, then --install.');
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
    throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}
// Silhouette aspect: leaping cats are wide, rearing ones are tall.
const aspect = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = -1, bot = -1, l = -1, r = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 24) {
      if (top < 0) top = y; bot = y;
      if (l < 0 || x < l) l = x; if (x > r) r = x;
    }
  }
  if (top < 0) return { ar: 0, w: 0, h: 0 };
  return { ar: (r - l + 1) / (bot - top + 1), w: r - l + 1, h: bot - top + 1 };
};
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

await mkdir(STAGE, { recursive: true });
const refMeta = await sharp(await readFile(REF)).metadata();
const W = refMeta.width, H = refMeta.height;
const refAr = await aspect(await readFile(REF));
console.log(`shipped leo_0 silhouette aspect ${refAr.ar.toFixed(2)} (${refAr.w}x${refAr.h}) — the rear we are replacing`);

// ---- 1. an airborne base ---------------------------------------------------
let base = null, bestAr = 0;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const data = await post('/assets/image', {
    image_type: 'sprite', prompt: BASE_PROMPT, art_style: 'Hand-Painted',
    perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
  });
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error('no url');
  const img = await sharp(await fetchBuf(url)).ensureAlpha()
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94 }).toBuffer();
  const a = await aspect(img);
  console.log(`  base roll ${attempt}: silhouette aspect ${a.ar.toFixed(2)}`);
  if (a.ar > bestAr) { bestAr = a.ar; base = img; }
  if (a.ar >= 1.25) break;                       // clearly a leap, not a rear
}
if (!base) { console.error('ABORT: no base produced'); process.exit(2); }
await atomicWrite(join(STAGE, '_base.webp'), base);
console.log(`kept base with aspect ${bestAr.toFixed(2)} -> _base.webp`);
if (bestAr < 1.15) console.log('  WARNING: still reads tall — review the contact sheet closely');

// ---- 2. nine frames from it ------------------------------------------------
// frame_size -9 is rejected above 1 megapixel; the reference canvas is 1.85MP.
const MP_CAP = 1000000;
const sc = (W * H > MP_CAP) ? Math.sqrt(MP_CAP / (W * H)) * 0.98 : 1;
const sendBuf = (sc < 1) ? await sharp(base).resize(Math.floor(W * sc), Math.floor(H * sc)).webp({ quality: 94 }).toBuffer() : base;
const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${sendBuf.toString('base64')}`,
  motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite',
});
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) { console.error(`ABORT: got ${bufs.length}/${FRAMES} frames`); process.exit(2); }

console.log('\nframe  silhouette aspect  (>1.15 reads airborne, ~1.0 reads reared)');
const ars = [];
for (let i = 0; i < FRAMES; i++) {
  const out = await sharp(bufs[i]).ensureAlpha()
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94 }).toBuffer();
  await atomicWrite(join(STAGE, `leo_${i}.webp`), out);
  const a = await aspect(out); ars.push(a.ar);
  console.log(`  ${i}    ${a.ar.toFixed(2)}`);
}
const grounded = ars.filter(a => a < 1.15).length;
console.log(`\n${FRAMES - grounded}/${FRAMES} frames read airborne`);

const TH = 220, TW = Math.round(W * (TH / H));
const tiles = [];
for (let i = 0; i < FRAMES; i++) {
  tiles.push({ input: await sharp(join(STAGE, `leo_${i}.webp`)).resize(TW, TH).png().toBuffer(),
               left: (i % 5) * TW, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TW * 5, height: TH * 2, channels: 4, background: { r: 24, g: 20, b: 30, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`staged in scripts/_style_pack/leo_pounce_air/ — review contact_sheet.png, then --install`);
