#!/usr/bin/env node
// Regulus's SUN POUNCE landing shockwave (ludo.ai):
//   1) NEW static burst  -> staged fx_leo_slam.webp
//   2) 9-frame one-shot detonation from it -> staged fx_leo_slam_0..8.webp
//
//   node scripts/gen_leo_slam_fx.mjs              # dry run, prints prompts
//   node scripts/gen_leo_slam_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_leo_slam_fx.mjs --install    # staged -> Sprites/
//
// v0.30.x — per user (screenshot of the landing): "This shockwave sprite does
// not suit the game very well, regenerate with ludo.ai then animate it". The
// pounce landing borrowed fx_taurus_gore — Taurus's charge-connect impact, a
// brown ROCK-SHARD burst. Right for a bull ramming you; wrong twice for the
// sun lion: wrong element (stone, on a boss whose whole identity is sun-fire)
// and wrong style read at pounce-ring size. Taurus keeps his gore; Regulus
// gets his own burst, in the fire-mane palette.
//
// The spawn site stretches the 9 frames ONCE across the burst's 42-frame life
// (no frameGap), so this is authored as a one-shot detonation — ignite, peak,
// dissipate — not a seamless loop.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'leo_slam');
const FRAMES = 9, SIZE = 768;
const has = (f) => process.argv.includes(f);

const BASE_PROMPT =
  'A SUN-FIRE GROUND SLAM SHOCKWAVE burst for a 2D fantasy game: a white-hot ' +
  'golden core low in the centre, bold stylised flame petals and fire tongues ' +
  'erupting radially outward and upward from it, a thin curved golden shock ' +
  'arc sweeping wide to the left and right at the base like a wave rushing ' +
  'along the ground, bright orange embers and small sun sparks thrown ' +
  'outward. Palette: saturated golds and oranges with a white-hot centre, ' +
  'like a lion\'s blazing fire mane. Flat 2D cartoon game sprite, bold clean ' +
  'shapes, crisp cel shading, thick dark outline. NO rocks, NO stones, NO ' +
  'debris, NO dust, NO smoke clouds — pure fire and light only. Fully ' +
  'TRANSPARENT background (alpha only). NO face, NO character, NO text, NO ' +
  'ground line, NO background.';

const MOTION =
  'A one-shot detonation played start to finish across the nine frames, with ' +
  'visible change in every frame and NO looping back: it IGNITES small and ' +
  'white-hot, FLARES to its peak — flame petals surging outward, the golden ' +
  'shock arcs racing wide along the base, embers bursting free — then the ' +
  'fire THINS and breaks into drifting embers and faint sparks, so the final ' +
  'frame is almost gone: only a few fading embers and a dim glow. ' +
  'CRITICAL — LOCKED FRAMING: the burst stays centred at the same position ' +
  'and scale in every frame; no zoom, pan, crop, drift, mirror or flip. The ' +
  'EXPANSION is drawn within the frame, the camera never moves. ' +
  'Keep the exact same art style, palette (gold, orange, white-hot core), ' +
  'thick dark outline and fully transparent background in every frame. ' +
  'NO rocks, NO debris, NO smoke, NO character, NO background.';

if (has('--install')) {
  const fxDir = join(ROOT, 'Sprites', 'fx');
  const animDir = join(fxDir, 'anim');
  if (!existsSync(join(STAGE, 'fx_leo_slam.webp'))) { console.error('ABORT: nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'fx_leo_slam.webp'), join(fxDir, 'fx_leo_slam.webp'));
  let n = 0;
  while (existsSync(join(STAGE, `fx_leo_slam_${n}.webp`))) {
    await copyFile(join(STAGE, `fx_leo_slam_${n}.webp`), join(animDir, `fx_leo_slam_${n}.webp`));
    n++;
  }
  console.log(`installed base + ${n} frames -> Sprites/fx/(anim/)`);
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs  (the loader asks the index how many frames exist)');
  process.exit(0);
}
if (!has('--generate')) {
  console.log('# Regulus slam FX — base, then nine one-shot frames\n');
  console.log('## base\n' + BASE_PROMPT + '\n');
  console.log('## motion\n' + MOTION + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), review the contact sheet, then --install.');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

await mkdir(STAGE, { recursive: true });

// ---- 1. the static base -----------------------------------------------------
const data = await post('/assets/image', {
  image_type: 'sprite', prompt: BASE_PROMPT, art_style: 'Anime/Manga',
  aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false,
});
const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
if (!url) throw new Error('no url');
const base = await sharp(await fetchBuf(url)).ensureAlpha()
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 94 }).toBuffer();
await writeFile(join(STAGE, 'fx_leo_slam.webp'), base);
console.log('base -> fx_leo_slam.webp');

// ---- 2. nine one-shot frames ------------------------------------------------
const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${base.toString('base64')}`,
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
for (let i = 0; i < FRAMES; i++) {
  await writeFile(join(STAGE, `fx_leo_slam_${i}.webp`),
    await sharp(bufs[i]).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 94 }).toBuffer());
}
console.log(`${FRAMES} frames staged`);

// contact sheet
const TH = 200;
const tiles = [];
const all = ['fx_leo_slam.webp'];
for (let i = 0; i < FRAMES; i++) all.push(`fx_leo_slam_${i}.webp`);
for (let i = 0; i < all.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, all[i])).resize(TH, TH, { fit: 'contain', background: { r: 30, g: 26, b: 40, alpha: 255 } }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(all.length / 5), channels: 4, background: { r: 30, g: 26, b: 40, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log('staged in scripts/_style_pack/leo_slam/ — review contact_sheet.png, then --install');
