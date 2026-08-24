#!/usr/bin/env node
// CANCER'S PINCER — static sprite + 9-frame animation, in Cancer's own palette.
// =============================================================================
// Per user: "Cancer zodiac boss pincer claw sprite projectiles should be the
// same colour as the cancer".
//
// Measured, the mismatch was plain. Dominant colours:
//   cancer.webp   #fbb3ac #fcd0cb #f8928e #f3716e   <- coral / salmon pink
//   p_pincer.webp #6e4888 #50306a #44285c #653e83   <- violet
// The projectile's own tint is already '#ff66aa' at the fire site, so the ART
// was the only thing still purple.
//
// SCOPE. p_pincer.webp was shared by three keys: 'pincer' and 'pincerSweep'
// (both fired ONLY by Cancer) and 'claw', a generic boss swipe tinted #ffaa55
// that belongs to a different boss entirely. Recolouring the shared file would
// have repainted that boss's claw pink. So 'claw' keeps the original violet art
// under its own name (p_claw.webp) and the Cancer keys get the new art. 'claw'
// has no entry in _PROJ_ANIM_KEYS, so it needs the static file only.
//
//   node tools/gen_cancer_pincer.mjs                 # dry-run, prints prompts
//   node tools/gen_cancer_pincer.mjs --generate      # needs LUDO_API_KEY
//   flags: --frames N (default 9) --tries N (default 3) --static-only
// =============================================================================
import sharp from 'sharp';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAMES = Number(arg('--frames') || 9);
const TRIES = Math.max(1, Number(arg('--tries') || 3));

// Cancer's own palette, read off cancer.webp rather than eyeballed.
const PROMPT =
  'A single crab PINCER CLAW projectile pointing right, snapped shut like a ' +
  'thrown weapon. CORAL PINK and SALMON shell (#f8928e, #fbb3ac) with soft ' +
  'cream-pink highlights (#fcd0cb) and a warm rose underside, a pale ivory ' +
  'inner edge along the closed grip, small pearl-white bubble flecks trailing ' +
  'behind it. Wet ocean sheen. Absolutely NO purple and NO violet anywhere. ' +
  'Cute painterly fantasy game projectile sprite, vibrant saturated colours, a ' +
  'bold uniform 3 pixel black outline (#0a0612) around the whole silhouette, ' +
  'crisp rim-light, fully transparent background, single object centred at ' +
  '~70% of a 768x768 square, no text, no UI, no background, no ground shadow. ' +
  'Clearly readable at very small size.';
const MOTION =
  'the crab claw snaps open and shut as it flies, pincer tips clacking ' +
  'together, small bubbles trailing behind. The claw stays centred and fully ' +
  'inside the frame at all times, same size in every frame, no zoom, no ' +
  'camera move, no drift toward any edge.';

if (!has('--generate')) {
  console.log('# Cancer pincer — static + animation\n');
  console.log('## static prompt\n' + PROMPT + '\n');
  console.log('## motion prompt\n' + MOTION + '\n');
  console.log(`# writes Sprites/projectiles/p_pincer.webp and anim/pincer_0..${FRAMES - 1}.webp`);
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
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
// How much of the outer 2px border is opaque — a clipped sprite is unusable and
// cheap to detect, so a clipped roll is re-rolled rather than shipped.
const edgeTouching = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  const at = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
  for (let x = 0; x < info.width; x++) { if (at(x, 0)) n++; if (at(x, info.height - 1)) n++; }
  for (let y = 0; y < info.height; y++) { if (at(0, y)) n++; if (at(info.width - 1, y)) n++; }
  return n;
};
// Reject a roll that is still mostly violet — the whole point of the change.
const violetShare = async (buf) => {
  const { data } = await sharp(buf).resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let vi = 0, tot = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    tot++;
    const R = data[i], G = data[i + 1], B = data[i + 2];
    if (B > R && B > G + 20) vi++;          // blue/violet dominant
  }
  return tot ? vi / tot : 0;
};
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

const PROJ = join(ROOT, 'Sprites', 'projectiles');
const ANIM = join(PROJ, 'anim');
await mkdir(ANIM, { recursive: true });

// ---- 1. static sprite ------------------------------------------------------
console.log('static sprite ...');
let base = null;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const data = await post('/assets/image', {
    image_type: 'sprite-vfx', prompt: PROMPT, art_style: 'Hand-Painted',
    perspective: 'Side-Scroll', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
  });
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error('no url');
  const raw = await fetchBuf(url);
  const png = await sharp(raw).ensureAlpha()
    .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
  const v = await violetShare(png);
  console.log(`  roll ${attempt}: violet ${(v * 100).toFixed(1)}%`);
  if (v < 0.12) { base = png; break; }
  if (attempt === TRIES) { base = png; console.log('  (keeping the last roll)'); }
}
await atomicWrite(join(PROJ, 'p_pincer.webp'), base);
console.log('wrote Sprites/projectiles/p_pincer.webp');

if (has('--static-only')) process.exit(0);

// ---- 2. animation ----------------------------------------------------------
console.log(`animating ${FRAMES} frames ...`);
let bufs = [], clipped = 0;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const anim = await post('/assets/sprite/animate', {
    initial_image: `data:image/webp;base64,${base.toString('base64')}`,
    motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
    model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
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
    bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
  }
  if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
  clipped = 0;
  for (const b of bufs) if (await edgeTouching(b) > 24) clipped++;
  if (!clipped) break;
  console.log(`  clipped ${clipped}/${FRAMES}; re-roll ${attempt}/${TRIES}`);
}
if (clipped) console.log(`  WARNING: ${clipped}/${FRAMES} frames still touch the edge`);

for (let i = 0; i < bufs.length; i++) {
  const out = await sharp(bufs[i]).ensureAlpha()
    .resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
  await atomicWrite(join(ANIM, `pincer_${i}.webp`), out);
}
console.log(`wrote ${bufs.length} frames to Sprites/projectiles/anim/pincer_*.webp`);
