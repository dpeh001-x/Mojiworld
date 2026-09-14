#!/usr/bin/env node
// War Cry's roar (ludo.ai):
//   1) NEW shockwave sprite   -> staged warcry.webp
//   2) 9-frame expanding roar -> staged warcry_0..8.webp
//   3) the struck-foe stamp   -> staged fx_warcry_mark.webp
//
//   node scripts/gen_warcry_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_warcry_fx.mjs --install    # staged -> Sprites/
//
// v0.30.x — per user: "War cry skill needs to be much bigger and intense, generate vfx using
// ludo.ai monsters being struck by war cry should also have a special hit marked".
//
// The old plate was a LION'S HEAD. As an icon it is fine and it still is the skill's icon; as the
// cast VFX it was a sticker of a face pasted over the player — a picture OF a roar rather than the
// roar itself, and at 220 px it sat inside the player's own silhouette. A shout that taunts
// everything within 340 px and staggers everything within 180 should look like a pressure wave
// crossing that ground, so this is authored as one: concentric shout-rings driven outward from a
// hot core, expanding across the nine frames.
//
// The mark is the second half of the request. A foe caught by the pulse gets a stamp, so the
// player can see WHICH foes the roar actually grabbed rather than inferring it from aggro.
import sharp from 'sharp';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = process.env.WC_STAGE || join(ROOT, 'scripts', '_style_pack', 'warcry');
const FRAMES = 9, SIZE = 768, MARK = 384;
const has = (f) => process.argv.includes(f);

const WAVE_PROMPT =
  'A BATTLE-ROAR SHOCKWAVE for a 2D fantasy game, seen head-on. Concentric rings of sound driven ' +
  'violently outward from a white-hot core at the exact centre: three or four bold ring arcs, ' +
  'each thicker and more ragged than the last, with sharp radiating force lines and chevrons ' +
  'punching outward between them. Crimson and scarlet deepening to blood-red at the outer edge, ' +
  'white-hot at the middle, gold highlights along the ring edges. Small debris flecks and dust ' +
  'thrown outward. Perfectly symmetrical and centred, filling the frame edge to edge. ' +
  'Flat 2D cartoon game sprite, bold clean shapes, crisp cel shading, thick dark outline. ' +
  'NO lion, NO animal, NO face, NO head, NO mouth, NO character, NO creature of any kind. ' +
  'NO text, NO letters, NO ground line, NO background. Fully TRANSPARENT background (alpha only).';

const MOTION =
  'A single pressure wave expanding start to finish across the nine frames, with visible change in ' +
  'every frame and NO looping back. Frames 1-3: the core flares white-hot and the innermost ring ' +
  'snaps outward. Frames 4-6: the rings SURGE outward and apart, growing thicker and more ragged, ' +
  'the radiating force lines stretching further, debris flung out. Frames 7-9: the rings reach the ' +
  'edge and BREAK UP — thinning, tearing into fragments, fading toward nothing, so the final frame ' +
  'is almost empty. ' +
  'CRITICAL — LOCKED FRAMING: the centre of the wave stays at the exact same point in every frame; ' +
  'no zoom, pan, crop, drift, mirror or flip. The EXPANSION is drawn within the frame; the camera ' +
  'never moves. Keep the exact same art style, palette (crimson, scarlet, white-hot core, gold ' +
  'edges), thick dark outline and fully transparent background in every frame. ' +
  'NO lion, NO animal, NO face, NO character, NO background, NO text.';

const MARK_PROMPT =
  'A small ROAR-STRUCK impact stamp for a 2D fantasy game: a ragged crimson ring cracked open in ' +
  'three or four places, with short sharp force chevrons radiating outward from it and a few ' +
  'white-hot sparks. Bold and readable at small size, symmetrical, centred, filling the frame. ' +
  'Crimson and scarlet with white-hot highlights and a thick dark outline. Flat 2D cartoon game ' +
  'sprite. NO lion, NO animal, NO face, NO character, NO text, NO letters, NO numbers, ' +
  'NO background. Fully TRANSPARENT background (alpha only).';

// ---------------------------------------------------------------- install ----
if (has('--install')) {
  if (!existsSync(join(STAGE, 'warcry.webp'))) { console.error('nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'warcry.webp'), join(ROOT, 'Sprites', 'fx', 'warcry.webp'));
  await mkdir(join(ROOT, 'Sprites', 'fx', 'anim'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await copyFile(join(STAGE, `warcry_${i}.webp`), join(ROOT, 'Sprites', 'fx', 'anim', `warcry_${i}.webp`));
  await copyFile(join(STAGE, 'fx_warcry_mark.webp'), join(ROOT, 'Sprites', 'fx', 'fx_warcry_mark.webp'));
  console.log(`installed base + ${FRAMES} frames + the mark`);
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs   (nine new frames under fx/anim)');
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
// Both endpoints answer with a queued job (the API went async on 2026-09-11).
async function pollJob(id) {
  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) continue;
    const j = await r.json();
    const st = j && (j.status || j.state);
    if (st === 'succeeded' || st === 'completed' || st === 'done') return j;
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(j).slice(0, 200));
  }
  throw new Error('job timed out');
}
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let j = await res.json();
  const st = j && (j.status || j.state);
  if (st && st !== 'succeeded' && st !== 'completed' && st !== 'done') {
    const id = j.id || j.job_id || j.jobId;
    if (!id) throw new Error('queued with no job id: ' + JSON.stringify(j).slice(0, 200));
    process.stdout.write(`  job ${id} ${st}…\n`);
    j = await pollJob(id);
  }
  if (j && j.result && !j.url && !j.spritesheet_url && !j.individual_frame_urls) {
    return Array.isArray(j.result) ? (j.result.length === 1 ? j.result[0] : j.result) : j.result;
  }
  return j;
}
const image = async (prompt, size) => {
  const d = await post('/assets/image', { image_type: 'sprite', prompt, art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false });
  const u = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
  if (!u) throw new Error('no url: ' + JSON.stringify(d).slice(0, 200));
  return sharp(await fetchBuf(u)).ensureAlpha().resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
};

await mkdir(STAGE, { recursive: true });

const base = await image(WAVE_PROMPT, SIZE);
await writeFile(join(STAGE, 'warcry.webp'), base);
console.log('base -> warcry.webp');

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
const frames = [];
for (const b of bufs.slice(0, FRAMES)) {
  frames.push(await sharp(b).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer());
}

// ---- the gate ---------------------------------------------------------------
// The same two failure modes the Doombringer blade was gated on, plus the one specific to a wave:
// it has to actually EXPAND. A pulse whose ink never grows is a still picture of a ring.
const stats = [];
for (const f of frames) {
  const { data: a, info } = await sharp(f).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0, rad = 0;
  for (let p = 0; p < a.length; p++) {
    if (a[p] > 24) { const x = p % info.width, y = (p / info.width) | 0; sx += x; sy += y; n++; }
  }
  const cx = n ? sx / n : 0, cy = n ? sy / n : 0;
  for (let p = 0; p < a.length; p += 3) {
    if (a[p] > 24) { const x = p % info.width, y = (p / info.width) | 0; rad = Math.max(rad, Math.hypot(x - cx, y - cy)); }
  }
  stats.push({ a, cx, cy, n, rad });
}
let motion = 0;
for (let i = 1; i < stats.length; i++) {
  let d = 0; const A = stats[i - 1].a, B = stats[i].a;
  for (let p = 0; p < A.length; p += 7) d += Math.abs(A[p] - B[p]);
  motion += d / (A.length / 7);
}
motion /= (stats.length - 1);
// Drift is measured only over frames that still HAVE a wave. A dissipating pulse is supposed to
// end almost empty, and the centroid of a nearly-empty frame is noise — the first roll of this art
// measured 400 px of "drift" that was entirely the last two frames' scattered embers moving the
// mean around. Frames under a quarter of the peak ink are excluded, which measures framing
// stability while the wave is actually on screen and stops the gate rejecting the fade it asked for.
const peakInk = Math.max(...stats.map((s) => s.n));
const solid = stats.filter((s) => s.n >= peakInk * 0.25);
const cxs = solid.map((s) => s.cx), cys = solid.map((s) => s.cy);
const drift = Math.max(Math.max(...cxs) - Math.min(...cxs), Math.max(...cys) - Math.min(...cys));
console.log('  per-frame ink: ' + stats.map((s) => (s.n / peakInk).toFixed(2)).join(' ') + `  (drift over ${solid.length}/${stats.length} solid frames)`);
const growth = Math.max(...stats.map((s) => s.rad)) / Math.max(1, stats[0].rad);
const MOTION_MIN = 4, DRIFT_MAX = 46, GROWTH_MIN = 1.06;
console.log(`  motion ${motion.toFixed(2)} (min ${MOTION_MIN}) · drift ${drift.toFixed(1)}px (max ${DRIFT_MAX}) · growth x${growth.toFixed(2)} (min x${GROWTH_MIN})`);
const bad = [];
if (motion < MOTION_MIN) bad.push('frames barely change — this is a still picture of a ring');
if (drift > DRIFT_MAX) bad.push('framing drifts — the wave would slide off the caster');
if (growth < GROWTH_MIN) bad.push('the wave never expands — a shockwave that does not travel');
if (bad.length) { console.error('REFUSING:\n  - ' + bad.join('\n  - ')); process.exit(3); }

for (let i = 0; i < FRAMES; i++) await writeFile(join(STAGE, `warcry_${i}.webp`), frames[i]);
console.log(`${FRAMES} frames staged`);

const mark = await image(MARK_PROMPT, MARK);
await writeFile(join(STAGE, 'fx_warcry_mark.webp'), mark);
console.log('mark -> fx_warcry_mark.webp');

// contact sheet
const TH = 200;
const all = ['warcry.webp']; for (let i = 0; i < FRAMES; i++) all.push(`warcry_${i}.webp`); all.push('fx_warcry_mark.webp');
const tiles = [];
for (let i = 0; i < all.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, all[i])).resize(TH, TH, { fit: 'contain', background: { r: 22, g: 18, b: 28, alpha: 255 } }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(all.length / 5), channels: 4, background: { r: 22, g: 18, b: 28, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`staged in ${STAGE} — review contact_sheet.png, then --install`);
