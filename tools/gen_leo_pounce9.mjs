#!/usr/bin/env node
// REGULUS'S POUNCE — nine genuinely AIRBORNE frames.
// =============================================================================
// v0.30.170 tried this and kept only three: ludo returned a cycle that coiled,
// pounced and then SETTLED BACK TO STANDING, and the standing frames were
// rightly discarded. That is the failure this run has to avoid, so the motion
// prompt is written against it — the lion must be off the ground in every
// single frame, and the arc must not return to a stand.
//
// Candidates are staged, never installed. A bad roll must not overwrite the
// three good frames that ship today.
//
// STATUS: RUN, AND NOT INSTALLED. The v0.30.x roll came back with the SAME
// failure v0.30.170 hit, despite a motion prompt written explicitly against it
// ("never touches the ground, never stands on four legs, never lands"): all
// nine frames are the rearing pose with the hind legs planted, a rear-and-
// settle cycle rather than a leap. The model anchors hard to the base sprite's
// posture and the negative phrasing did not move it. Installing them would put
// the lion back to standing in mid-air, which is the exact thing the three
// shipped frames exist to avoid.
//
// The frames are also no longer what makes the pounce read: the ping-pong in
// the report was a wall-clock LOOP over a non-cyclic set, and that is fixed in
// the renderer (_lxPounceArcFrame picks by vertical velocity, so the arc plays
// once per jump). Three frames read cleanly under that. More frames would only
// make the arc smoother, so this is worth re-rolling — but only with art that
// is genuinely airborne. A better route than a text prompt is probably to
// author one airborne KEYFRAME per phase and animate between those.
//   node tools/gen_leo_pounce9.mjs                # dry-run, prints the prompt
//   node tools/gen_leo_pounce9.mjs --generate     # needs LUDO_API_KEY
//   node tools/gen_leo_pounce9.mjs --install      # copy staged -> Sprites/
// =============================================================================
import sharp from 'sharp';
import { writeFile, rename, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'Sprites', 'bosses', 'zodiac', 'pounce', 'leo_0.webp');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'leo_pounce9');
const DEST = join(ROOT, 'Sprites', 'bosses', 'zodiac', 'pounce');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const FRAMES = 9;

const MOTION =
  'A lion in a single continuous POUNCE through the air, seen from the side. ' +
  'He is COMPLETELY AIRBORNE in every frame: launching, soaring and beginning ' +
  'to reach down for the landing, forelegs stretched forward, claws spread, ' +
  'jaws open, mane and tail streaming behind, sun-fire trailing from his paws. ' +
  'His body angle rotates slowly through the leap and his legs extend further ' +
  'forward as he descends. He NEVER touches the ground, NEVER stands on four ' +
  'legs, NEVER crouches, NEVER lands, NEVER returns to a standing pose. No ' +
  'ground, no floor line, no shadow. Same size in every frame, stays centred, ' +
  'no zoom, no camera move.';

if (has('--install')) {
  let n = 0;
  for (let i = 0; i < FRAMES; i++) {
    const src = join(STAGE, `leo_${i}.webp`);
    if (!existsSync(src)) { console.error(`ABORT: ${src} missing — nothing installed`); process.exit(1); }
  }
  for (let i = 0; i < FRAMES; i++) {
    await copyFile(join(STAGE, `leo_${i}.webp`), join(DEST, `leo_${i}.webp`)); n++;
  }
  console.log(`installed ${n} frames -> Sprites/bosses/zodiac/pounce/`);
  process.exit(0);
}
if (!has('--generate')) {
  console.log('# Regulus pounce — nine airborne frames\n');
  console.log('## base\n' + SRC + '\n');
  console.log('## motion\n' + MOTION + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), then --install.');
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

await mkdir(STAGE, { recursive: true });
const base = await readFile(SRC);
const meta = await sharp(base).metadata();
const W = meta.width, H = meta.height;
// frame_size -9 ("True Size") is rejected above 1 megapixel, and leo_0 is
// 1361x1361 = 1.85MP: "True Size only works with source images under 1
// megapixel". The request is downscaled under the cap and every returned frame
// is resized back to the base canvas below, which the v0.30.170 test requires
// them to share.
const MP_CAP = 1000000;
const scale = (W * H > MP_CAP) ? Math.sqrt(MP_CAP / (W * H)) * 0.98 : 1;
const sendW = Math.floor(W * scale), sendH = Math.floor(H * scale);
const sendBuf = (scale < 1)
  ? await sharp(base).resize(sendW, sendH).webp({ quality: 94 }).toBuffer()
  : base;
console.log(`base ${W}x${H} (${((W * H) / 1e6).toFixed(2)}MP); sending ${sendW}x${sendH}; animating ${FRAMES} frames ...`);

const anim = await post('/assets/sprite/animate', {
  initial_image: `data:image/webp;base64,${sendBuf.toString('base64')}`,
  motion_prompt: MOTION, frames: FRAMES, frame_size: -9,
  model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
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

// The shipped frames must share the base's exact canvas — the v0.30.170 test
// asserts that, and a mismatched canvas silently rescales the lion mid-leap.
const rows = [];
for (let i = 0; i < bufs.length; i++) {
  const out = await sharp(bufs[i]).ensureAlpha()
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94 }).toBuffer();
  await writeFile(join(STAGE, `leo_${i}.webp.tmp`), out);
  await rename(join(STAGE, `leo_${i}.webp.tmp`), join(STAGE, `leo_${i}.webp`));
  // How low does the body sit? A STANDING frame plants feet at the bottom of
  // the canvas; an airborne one leaves clear space beneath. Reported so the
  // standing-frame failure of v0.30.170 is measurable, not just eyeballed.
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bot = -1;
  for (let y = info.height - 1; y >= 0 && bot < 0; y--)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 24) { bot = y; break; }
  rows.push({ i, bottomPct: +((bot / info.height) * 100).toFixed(1) });
}
console.log('\nframe  lowest opaque pixel (% down the canvas) — higher = feet nearer the floor');
for (const r of rows) console.log(`  ${r.i}    ${r.bottomPct}%`);

// Contact sheet for a single visual read of the whole cycle.
const TH = 220, TW = Math.round(W * (TH / H));
const tiles = [];
for (let i = 0; i < FRAMES; i++) {
  tiles.push({ input: await sharp(join(STAGE, `leo_${i}.webp`)).resize(TW, TH).png().toBuffer(),
               left: (i % 5) * TW, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TW * 5, height: TH * 2, channels: 4, background: { r: 24, g: 20, b: 30, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`\nstaged ${FRAMES} frames + contact_sheet.png in scripts/_style_pack/leo_pounce9/`);
console.log('Nothing shipped yet — review, then: node tools/gen_leo_pounce9.mjs --install');
