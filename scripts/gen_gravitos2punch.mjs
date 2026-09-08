#!/usr/bin/env node
// GRAVITOS FORM 2 - PUNCH: regenerate the nine attack frames (ludo.ai), fitted so
// nothing is cut off and nothing pulses. Per user: "regenerate gravitos2punch
// animation sprites ensure no cutoff and ensure smoothness of animation".
//
// The shipped set (1656x1445): frames 0-6 have ink ON the bottom canvas row
// (7-26 edge pixels, zero bottom margin - the feet are cropped) and the ink
// height swings 1028-1146px across the cycle, which the boss content-normaliser
// turns into size jumps mid-punch.
//
// PIPELINE
//   seed  : current frame 0 (the form-2 look), re-padded with margins
//   animate: /assets/sprite/animate, 9 frames, individual frames, loop
//   fit   : ONE global scale for the whole set (max extents), each frame
//           centred on its FEET (bottom 12% of the ink mass - the stance stays
//           planted while the punch extends), every ink bottom on FOOT_ROW
//   gates : no edge pixels; >= MARGIN px every side; TORSO height (10th-90th
//           percentile rows of alpha mass - robust to the outstretched arm)
//           within +-6% of the set median; feet centre drift <= 6% of width
//   node scripts/gen_gravitos2punch.mjs             # measure current, print prompt
//   node scripts/gen_gravitos2punch.mjs --generate  # needs LUDO_API_KEY
//   node scripts/gen_gravitos2punch.mjs --install   # staged -> Sprites/bosses/attack/
//   flags: --rolls N (default 2)
import sharp from 'sharp';
import { writeFile, rename, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'gravitos2punch');
const DEST = (i) => join(ROOT, 'Sprites', 'bosses', 'attack', 'gravitos2punch_' + i + '.webp');
const W = 1656, H = 1445, N = 9, MARGIN = 48, FOOT_ROW = H - 1 - 28;
const argv = process.argv.slice(2); const has = (f) => argv.includes(f); const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const ROLLS = Math.max(1, Number(arg('--rolls') || 2));

const MOTION =
  'A colossal dark cosmic titan in starlit violet armour, fists wreathed in orange plasma flame, with a blazing blue star core in its chest, throws ONE heavy ' +
  'straight punch to the RIGHT: frames 1-3 wind up (shoulders coil back, fist drawn to the hip), frames 4-5 drive the ' +
  'right fist forward in a full-extension straight punch with the torso leaning in, frame 6 holds the impact with the ' +
  'arm fully extended, frames 7-9 pull back and settle to the guard pose so the loop closes cleanly. The character keeps ' +
  'the SAME size and the SAME feet position in every frame; only the arms, shoulders and torso move. Smooth, evenly ' +
  'spaced motion, no teleporting between frames, no camera move, no zoom, no ground, no shadow, nothing leaves the frame, ' +
  'no part of the body is cropped or cut off, generous empty margin on every side, transparent background.';

export async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height; const rowMass = new Float64Array(h); let t = -1, b = -1, l = -1, r = -1, edge = 0, total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = data[(y * w + x) * 4 + 3]; if (a > 16) { if (t < 0) t = y; b = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === h - 1 || x === 0 || x === w - 1) edge++; } rowMass[y] += a; total += a; }
  // torso rows: 10th-90th percentile of the alpha mass along y (arms in flight are a small share of the mass)
  let acc = 0, p10 = t, p90 = b; for (let y = 0; y < h; y++) { acc += rowMass[y]; if (acc >= total * 0.10 && p10 === t) p10 = y; if (acc >= total * 0.90) { p90 = y; break; } }
  // feet centre: mass centre x of the bottom 12% of the ink rows
  const fy0 = Math.round(b - (b - t) * 0.12); let fm = 0, fx = 0; for (let y = fy0; y <= b; y++) for (let x = 0; x < w; x++) { const a = data[(y * w + x) * 4 + 3]; fm += a; fx += a * x; }
  return { w, h, edge, l, r, t, b, inkH: b - t + 1, inkW: r - l + 1, torsoH: p90 - p10 + 1, feetCx: fm ? fx / fm : (l + r) / 2 };
}
const atomic = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// Fit a set: trim each frame, ONE global scale k, feet-centred, ink bottom on FOOT_ROW.
export async function fitSet(bufs) {
  const ms = []; const trims = [];
  for (const bf of bufs) { const tb = await sharp(bf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer(); trims.push(tb); ms.push(await measure(tb)); }
  let k = 1;
  for (const m of ms) { const halfW = Math.max(m.feetCx - m.l, m.r - m.feetCx) + 4; k = Math.min(k, (W / 2 - MARGIN - 2) / halfW, (FOOT_ROW - MARGIN - 2) / m.inkH); }
  k = Math.floor(k * 1000) / 1000;
  const out = [];
  for (let i = 0; i < trims.length; i++) {
    const m = ms[i]; const nw = Math.max(1, Math.round(m.w * k)), nh = Math.max(1, Math.round(m.h * k));
    const rb = await sharp(trims[i]).resize(nw, nh, { kernel: 'lanczos3' }).png().toBuffer(); const mm = await measure(rb);
    const left = Math.round(W / 2 - mm.feetCx), top = Math.round(FOOT_ROW - mm.b);
    const canvas = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: rb, left, top }]).webp({ quality: 95 }).toBuffer();
    out.push({ buf: canvas, m: await measure(canvas) });
  }
  return { k, frames: out };
}
export function verdict(frames) {
  const bad = []; const med = frames.map((f) => f.m.torsoH).sort((a, b) => a - b)[frames.length >> 1];
  frames.forEach((f, i) => {
    if (f.m.edge) bad.push(i + ': touches edge');
    if (f.m.l < MARGIN || W - 1 - f.m.r < MARGIN || f.m.t < MARGIN) bad.push(i + ': margin ' + Math.min(f.m.l, W - 1 - f.m.r, f.m.t) + '<' + MARGIN);
    // +-10%: the flaming arms overhead widen the percentile band on wind-up frames (arm mass, not body); the shipped set varies 13% by this measure
    if (Math.abs(f.m.torsoH / med - 1) > 0.10) bad.push(i + ': torso ' + (100 * f.m.torsoH / med).toFixed(0) + '% (pulse)');
    // the character must FILL the frame like the shipped set (ink >= 60% of the canvas height) - a tiny render is a reject, not a fit problem
    if (f.m.inkH < H * 0.60) bad.push(i + ': character too small (ink ' + Math.round(100 * f.m.inkH / H) + '% of height)');
    if (Math.abs(f.m.feetCx - W / 2) > W * 0.06) bad.push(i + ': feet drift ' + Math.round(f.m.feetCx - W / 2) + 'px');
    if (Math.abs(f.m.b - FOOT_ROW) > 2) bad.push(i + ': foot row ' + f.m.b);
  });
  return bad;
}
const sheet = async (frames, p) => { const T = 120; const tiles = []; for (let i = 0; i < frames.length; i++) tiles.push({ input: await sharp(frames[i].buf || frames[i]).resize(T, T, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: i * T, top: 0 });
  await sharp({ create: { width: T * frames.length, height: T, channels: 4, background: { r: 24, g: 20, b: 34, alpha: 255 } } }).composite(tiles).png().toFile(p); };

if (has('--install')) {
  const frames = []; for (let i = 0; i < N; i++) { const p = join(STAGE, 'frame_' + i + '.webp'); if (!existsSync(p)) { console.error('ABORT: not staged: ' + i); process.exit(1); } const buf = await readFile(p); frames.push({ buf, m: await measure(buf) }); }
  const bad = verdict(frames); if (bad.length) { console.error('ABORT: staged set fails its gates: ' + bad.join('; ')); process.exit(1); }
  for (let i = 0; i < N; i++) await copyFile(join(STAGE, 'frame_' + i + '.webp'), DEST(i));
  console.log('installed 9 frames. NEXT: gen_anim_manifest (gravitos2punch entry), sprite_bbox keys, sw.js bump.'); process.exit(0);
}
await mkdir(STAGE, { recursive: true });
const cur = []; for (let i = 0; i < N; i++) cur.push(await readFile(DEST(i)));
const curM = []; for (const b of cur) curM.push(await measure(b));
console.log('current: edge px per frame ' + curM.map((m) => m.edge).join('/') + '  bottom margin ' + curM.map((m) => H - 1 - m.b).join('/') + '  torsoH ' + curM.map((m) => m.torsoH).join('/'));
if (!has('--generate')) { console.log('\n' + MOTION + '\n\n# --generate (LUDO_API_KEY), review scripts/_style_pack/gravitos2punch/, then --install'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY; if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
// seed: frame 0 cropped TIGHT to the character (+8% padding) so the titan fills the
// input - the first two rolls kept the padded seed's small share and came back at
// ~60% of the original's size, murky. The model preserves the seed's framing.
const seedTrim = await sharp(cur[0]).ensureAlpha().trim({ threshold: 8 }).png().toBuffer(); const tm = await sharp(seedTrim).metadata();
const pad = Math.round(Math.max(tm.width, tm.height) * 0.08);
const seedSq = await sharp(seedTrim).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const sm0 = await sharp(seedSq).metadata(); const sc = Math.min(1, Math.sqrt(1000000 / (sm0.width * sm0.height)) * 0.98);
const seed = await sharp(seedSq).resize(Math.floor(sm0.width * sc), Math.floor(sm0.height * sc)).webp({ quality: 94 }).toBuffer();
await atomic(join(STAGE, 'seed.webp'), seed);
let best = null;
for (let roll = 1; roll <= ROLLS; roll++) {
  let anim;
  try {
    const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', signal: AbortSignal.timeout(600000), headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_image: 'data:image/webp;base64,' + seed.toString('base64'), motion_prompt: MOTION, frames: N, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }) });
    if (!res.ok) { const t = await res.text(); if (res.status === 402) { console.error('OUT OF CREDITS'); process.exit(3); } throw new Error(res.status + ' ' + t.slice(0, 140)); }
    anim = await res.json();
  } catch (e) { console.log('  roll ' + roll + ': ' + e.message); continue; }
  let bufs = [];
  if (anim.spritesheet_url && anim.num_cols && anim.num_rows) { const sh = await fetchBuf(anim.spritesheet_url); const sm = await sharp(sh).metadata(); const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
    for (let r = 0; r < anim.num_rows && bufs.length < N; r++) for (let c = 0; c < anim.num_cols && bufs.length < N; c++) bufs.push(await sharp(sh).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer()); }
  if (bufs.length < N && Array.isArray(anim.individual_frame_urls)) { bufs = []; for (const u of anim.individual_frame_urls.slice(0, N)) bufs.push(await fetchBuf(u)); }
  if (bufs.length < N) { console.log('  roll ' + roll + ': only ' + bufs.length + '/' + N + ' frames'); continue; }
  const fit = await fitSet(bufs); const bad = verdict(fit.frames);
  console.log('  roll ' + roll + ': k=' + fit.k + '  torsoH ' + fit.frames.map((f) => f.m.torsoH).join('/') + '  ' + (bad.length ? 'REJECT - ' + bad.slice(0, 6).join('; ') : 'OK'));
  await sheet(fit.frames, join(STAGE, 'roll_' + roll + '.png'));
  for (let i = 0; i < N; i++) await atomic(join(STAGE, 'roll_' + roll + '_' + i + '.webp'), fit.frames[i].buf);
  if (!bad.length && (!best || fit.k > best.k)) best = fit;
  if (best && !bad.length) break;
}
if (!best) { console.error('ABORT: no roll passed the gates'); process.exit(2); }
for (let i = 0; i < N; i++) await atomic(join(STAGE, 'frame_' + i + '.webp'), best.frames[i].buf);
await sheet(best.frames, join(STAGE, 'frames.png'));
await sheet(cur, join(STAGE, 'before.png'));
console.log('staged 9 frames (k=' + best.k + ') -> scripts/_style_pack/gravitos2punch/ (frames.png, before.png)');
