#!/usr/bin/env node
// LIBRA'S SCALE PROJECTILE — regenerated with ludo.ai.
// ============================================================================
// Per user: "regenerate a better sprite using ludo.ai for the libra's scale,
// it looks weird at present". The old set was an UPRIGHT balance scale on a
// square canvas, drawn into a wide 45x18 beam hitbox and rotated to the flight
// angle — so a leftward shot flew upside-down. The new design is a golden
// scale SIGIL: the balance emblem inside a glowing ring with light streaking
// both ways along the flight axis — symmetric about its centre, so no angle
// the renderer picks can make it look wrong.
//
//   node scripts/gen_libra_scale_ludo.mjs --candidates     ask ludo for N stills -> STAGE/cand_*.png
//   node scripts/gen_libra_scale_ludo.mjs --animate=K      animate candidate K into 9 frames -> STAGE/frames/
//   node scripts/gen_libra_scale_ludo.mjs --bake            frames -> OUT/scale_0..8.webp (656) + p_scale.webp (512)
// OUT defaults to the scratch stage; the ship step copies into Sprites/projectiles/.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k) => { const a = argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : null; };
const has = (k) => argv.includes(k);
const STAGE = process.env.LIBRA_STAGE || join(root, 'scripts', '_style_pack', 'libra_scale_ludo');
const OUT = process.env.LIBRA_OUT || join(STAGE, 'out');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const key = process.env.LUDO_API_KEY;
const N = Number(arg('--n') || 4);
const FRAMES = 9, CANVAS = 656, STILL = 512, FILL = 0.62;   // the old frames' emblem filled ~55-60% of the canvas

const PROMPT =
  'Game projectile sprite, anime style, on a TRANSPARENT background, centered, nothing cropped. ' +
  'A radiant GOLDEN SIGIL OF LIBRA: a small polished gold balance scale emblem (crossbar with two hanging pans, ' +
  'perfectly level) set inside a thin glowing golden ring, with soft warm light streaks trailing to BOTH the left and ' +
  'the right along the horizontal axis so the whole object reads as a wide horizontal beam of golden light. ' +
  'Symmetric left-to-right and top-to-bottom, crisp clean shapes, thick dark outlines, warm gold (#ffcc66) with white ' +
  'highlights, faint sparkles. No text, no letters, no character, no background, no floor.';
const MOTION =
  'The golden sigil stays in the EXACT same position and size. Across the sequence its ring and light streaks PULSE ' +
  'brighter and dimmer once, sparkles drift outward along the streaks, and the two little pans swing very gently. ' +
  'No rotation of the whole object, no zoom, no camera move, nothing cropped, seamless loop.';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const urlsOf = (d) => { const out = []; const walk = (v) => { if (typeof v === 'string' && /^https?:\/\//.test(v) && /\.(png|webp|jpg|jpeg)(\?|$)/i.test(v)) out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(d); return [...new Set(out)]; };

// alpha bbox of a buffer
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[(y * info.width + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; } }
  return r < 0 ? null : { l, t, w: r - l + 1, h: b - t + 1 };
}
// a still that came back opaque: key out the flat corner colour
async function ensureAlpha(buf) {
  const meta = await sharp(buf).metadata();
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaMin = data.filter((_, i) => i % 4 === 3).reduce((m, v) => Math.min(m, v), 255);
  if (meta.hasAlpha && alphaMin < 250) return buf;                     // real transparency already
  const c = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += 4) { const d = Math.abs(data[i] - c[0]) + Math.abs(data[i + 1] - c[1]) + Math.abs(data[i + 2] - c[2]); if (d < 40) data[i + 3] = 0; else if (d < 90) data[i + 3] = Math.round(255 * (d - 40) / 50); }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
// centre the alpha content on a square canvas, scaled so its longer side is FILL of the canvas
async function plant(buf, size, fill) {
  const b = await bbox(buf); if (!b) throw new Error('empty frame');
  const scale = (size * fill) / Math.max(b.w, b.h);
  const w = Math.max(1, Math.round(b.w * scale)), h = Math.max(1, Math.round(b.h * scale));
  const cut = await sharp(buf).extract({ left: b.l, top: b.t, width: b.w, height: b.h }).resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cut, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }]).png().toBuffer();
}

await mkdir(STAGE, { recursive: true });
if (has('--candidates')) {
  if (!key) { console.error('LUDO_API_KEY is not set'); process.exit(2); }
  console.log('asking ludo for ' + N + ' Libra sigil stills ...');
  const data = await post('/assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: N, augment_prompt: false, prompt: PROMPT });
  const urls = urlsOf(data);
  if (!urls.length) { console.error('no image urls in response: ' + JSON.stringify(data).slice(0, 400)); process.exit(1); }
  let i = 0;
  for (const u of urls) { const buf = await ensureAlpha(await fetchBuf(u)); const b = await bbox(buf); await writeFile(join(STAGE, `cand_${i}.png`), buf); console.log(`  cand_${i}.png  ${b ? b.w + 'x' + b.h : 'empty'} content`); i++; }
  console.log('candidates -> ' + STAGE);
}
if (arg('--animate') != null) {
  if (!key) { console.error('LUDO_API_KEY is not set'); process.exit(2); }
  const k = Number(arg('--animate'));
  const still = await readFile(join(STAGE, `cand_${k}.png`));
  const small = await sharp(still).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  console.log('animating cand_' + k + ' into ' + FRAMES + ' frames ...');
  const data = await post('/assets/sprite/animate', { initial_image: 'data:image/png;base64,' + small.toString('base64'), motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' });
  const bufs = [];
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows);
    for (let r = 0; r < data.num_rows && bufs.length < FRAMES; r++) for (let c = 0; c < data.num_cols && bufs.length < FRAMES; c++) bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
  } else { for (const u of urlsOf(data).slice(0, FRAMES)) bufs.push(await fetchBuf(u)); }
  if (bufs.length < FRAMES) { console.error('ludo returned ' + bufs.length + ' frames: ' + JSON.stringify(data).slice(0, 300)); process.exit(1); }
  await mkdir(join(STAGE, 'frames'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(STAGE, 'frames', `f_${i}.png`), await ensureAlpha(bufs[i]));
  console.log('frames -> ' + join(STAGE, 'frames'));
}
if (has('--bake')) {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(join(STAGE, 'frames'))).filter((f) => /^f_\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  if (files.length < FRAMES) { console.error('need ' + FRAMES + ' frames, have ' + files.length); process.exit(1); }
  for (let i = 0; i < FRAMES; i++) {
    const planted = await plant(await readFile(join(STAGE, 'frames', files[i])), CANVAS, FILL);
    await writeFile(join(OUT, `scale_${i}.webp`), await sharp(planted).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  }
  const still = await plant(await readFile(join(STAGE, 'frames', files[0])), STILL, FILL);
  await writeFile(join(OUT, 'p_scale.webp'), await sharp(still).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
  console.log('baked ' + FRAMES + ' frames + still -> ' + OUT);
}
