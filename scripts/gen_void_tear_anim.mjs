#!/usr/bin/env node
// Void tear (Spire hazard + Phantom "Dimensional Tear" cast) - a 9-frame LOOP of
// the rift art itself, driven from the still the game already ships.
//
// The rift has been a static picture (Sprites/vfx/void_tear.webp) with three
// straight purple sticks spun over it by the renderer; the user asked for the
// "3 rotating purple lines inside the void" to be better and offered ludo.ai.
// The renderer already knows how to loop Sprites/vfx/anim/void_tear_0..8.webp
// (_lxVfxFrame('voidTear')) - the frames just never existed. This authors them
// from the existing still, so the art stays the art the user approved and only
// gains motion: the rim crackles, the flames lick, the shards drift.
//
// The frames are re-framed with ONE crop shared by every frame AND the base
// (union of all content boxes, 2:1 like the blit box) so the set cannot jitter
// and the pre-decode static blit does not jump when the loop takes over.
//
//   node scripts/gen_void_tear_anim.mjs             # dry-run, prints the prompt
//   node scripts/gen_void_tear_anim.mjs --generate  # needs LUDO_API_KEY
//   flags: --force (overwrite existing frames)
// Output -> Sprites/vfx/void_tear.webp (re-framed) + Sprites/vfx/anim/void_tear_0..8.webp
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VFX_DIR = join(repoRoot, 'Sprites', 'vfx');
const ANIM_DIR = join(VFX_DIR, 'anim');
const KEY = 'void_tear';
const FRAMES = 9, OUT_W = 1024, OUT_H = 512;   // the still's own dims; the renderer blits 2:1
const MARGIN = 0.03;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// Motion only. Every verb is about the rift; nothing moves the camera and
// nothing changes the silhouette, so the loop stays inside the blit box.
const MOTION =
  'The rift is alive: the jagged black tear pulses and breathes slowly, its glowing violet edges crackle ' +
  'and flicker with small arcs of purple lightning, the purple flames along the rim lick and flow and curl ' +
  'like streaming energy, the floating crystal shards drift and slowly orbit, and tiny violet sparks ' +
  'flare and fade inside the darkness.';
const HOLD =
  ' The tear stays centered, keeps its exact elongated horizontal shape and stays the same size in frame - ' +
  'do NOT zoom, do NOT pan, do NOT rotate, do NOT push the camera, do NOT redraw the silhouette. Nothing ' +
  'is cropped. Seamless loop: the last frame flows back into the first. Fully transparent background, ' +
  'consistent art style across every frame.';

if (!has('--generate')) {
  console.log(`# ${KEY} -> Sprites/vfx/${KEY}.webp (re-framed) + Sprites/vfx/anim/${KEY}_0..${FRAMES - 1}.webp\n`);
  console.log('--- motion prompt ---\n' + MOTION + HOLD);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const fetchBuf = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    if (!cols || !rows || !meta.width || !meta.height) throw new Error('bad sheet grid');
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    if (cw < 8 || ch < 8) throw new Error(`bad cell ${cw}x${ch}`);
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
const bbox = async (png) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 10) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1, n };
};

const basePath = join(VFX_DIR, `${KEY}.webp`);
if (!has('--force') && await exists(join(ANIM_DIR, `${KEY}_8.webp`))) { console.log('skip (frames exist - use --force)'); process.exit(0); }
const base = await readFile(basePath);
const bm = await sharp(base).metadata();
console.log(`base ${bm.width}x${bm.height} ${Math.round(base.length / 1024)} KB`);

// --- drive the still ----------------------------------------------------------
const small = await sharp(base).resize(1024, 512, { fit: 'inside' }).png().toBuffer();   // ~0.5 MP, the endpoint's comfort zone
const uri = 'data:image/png;base64,' + small.toString('base64');
let bufs;
for (let attempt = 1; ; attempt++) {
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION + HOLD, frames: FRAMES,
        frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
    });
    if (!res.ok) throw new Error(`animate ${res.status}: ${(await res.text()).slice(0, 140)}`);
    bufs = await framesFrom(await res.json(), FRAMES);
    break;
  } catch (e) { console.error(`  attempt ${attempt}: ${e.message}`); if (attempt >= 4) throw e; await sleep(4000 * attempt); }
}
// --- one shared re-frame, 2:1 ----------------------------------------------------
const rm = await sharp(bufs[0]).metadata(); const RW = rm.width, RH = rm.height;
console.log(`raw frames ${RW}x${RH}`);
const norm = [];
for (const b of bufs) norm.push(await sharp(b).resize(RW, RH, { fit: 'fill' }).ensureAlpha().png().toBuffer());
const baseRaw = await sharp(base).resize(RW, RH, { fit: 'fill' }).ensureAlpha().png().toBuffer();
const boxes = []; for (const p of norm) boxes.push(await bbox(p));
const bb = await bbox(baseRaw);
boxes.forEach((b, i) => console.log(`  frame ${i}: x ${b.x0}..${b.x1} y ${b.y0}..${b.y1} px ${b.n}` + (b.n < bb.n * 0.4 ? '  <-- NEAR-EMPTY' : '')));
if (boxes.some((b) => b.n < bb.n * 0.4)) { console.error('a frame lost most of the rift - re-run'); process.exit(1); }
const U = boxes.concat([bb]).reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }));
const mg = Math.round((U.x1 - U.x0) * MARGIN);
let x0 = Math.max(0, U.x0 - mg), x1 = Math.min(RW, U.x1 + 1 + mg), y0 = Math.max(0, U.y0 - mg), y1 = Math.min(RH, U.y1 + 1 + mg);
// widen the shorter axis to 2:1 so the resize below does not distort
let cw = x1 - x0, ch = y1 - y0;
if (cw < ch * 2) { const need = ch * 2 - cw; x0 = Math.max(0, x0 - Math.floor(need / 2)); x1 = Math.min(RW, x0 + ch * 2); x0 = Math.max(0, x1 - ch * 2); }
else if (ch < cw / 2) { const need = Math.ceil(cw / 2) - ch; y0 = Math.max(0, y0 - Math.floor(need / 2)); y1 = Math.min(RH, y0 + Math.ceil(cw / 2)); y0 = Math.max(0, y1 - Math.ceil(cw / 2)); }
cw = x1 - x0; ch = y1 - y0;
console.log(`union x ${U.x0}..${U.x1} y ${U.y0}..${U.y1} -> crop ${cw}x${ch} at (${x0},${y0}), aspect ${(cw / ch).toFixed(2)}`);
const reframe = (png) => sharp(png).extract({ left: x0, top: y0, width: cw, height: ch }).resize(OUT_W, OUT_H, { fit: 'fill' }).webp({ quality: 90 }).toBuffer();
await mkdir(ANIM_DIR, { recursive: true });
for (let i = 0; i < norm.length; i++) await writeFile(join(ANIM_DIR, `${KEY}_${i}.webp`), await reframe(norm[i]));
await writeFile(basePath, await reframe(baseRaw));
console.log(`${norm.length} frames ${OUT_W}x${OUT_H} -> ${ANIM_DIR}/${KEY}_0..${norm.length - 1}.webp, base re-framed to match`);
console.log('NOTE: run `node scripts/gen_sprite_frame_index.mjs` - the loader asks the index how many frames exist.');
