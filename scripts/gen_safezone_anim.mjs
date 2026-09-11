#!/usr/bin/env node
// The Singularity safe zone: a new marker sprite and its nine-frame loop (ludo.ai).
// =============================================================================
// Per user, with a screenshot of the old marker: "Safe zone needs to be regenerated to look less
// box like, can remove the whitish outline, also the regenerated sprite can be animated".
//
// The old sprite was a painted rectangle of ground with a portal on it; stretched into a 110x75
// rect it read as a box, and the cream wash the renderer laid over the same rect made the box
// worse. The new marker is a RING of light lying on the ground: round on the sheet, so the
// renderer's stretch into the zone rect turns it into an oval that reads as a pool of light on
// the floor, and feathered here so that no frame carries ink anywhere near its border - there
// is no box for the eye to find. The renderer draws it at the exact zone rect (the lethal
// boundary, see scripts/gravitos_safezone_draw_test.mjs) and nothing else.
//
//   node scripts/gen_safezone_anim.mjs              # dry run: prints the briefs
//   node scripts/gen_safezone_anim.mjs --generate   # needs LUDO_API_KEY; writes the base + 9 frames
//   flags: --force   --skip-base (animate the base already on disk)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { mkdir, writeFile, rename, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'gravitos_singularity_zone';
const BASE = join(ROOT, 'Sprites', 'fx', KEY + '.webp');
const ANIM_DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const S = 512, FRAMES = 9, FEATHER = 0.05;
const has = (f) => process.argv.includes(f);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

// v2 (per user, on the ring: "the safe zone art can still be better, like a circle dimensional
// portal"): a round portal seen from directly above, so the renderer's stretch into the wide zone
// rect lays it on the floor in perspective. It fills the sheet (a ring left the rect half empty and
// hovered at mid-height).
// v4 (per user: "the violet rim does not look good, regenerate the whole thing, make it nicer, the
// aesthetic should look similar and better to the crystal portal"). The crystal portal is a pale
// ice-cyan crystalline shard with a deep-blue vortex inside and a cyan glow; this is the same
// material laid flat as a round gate: a rim of jagged ice-crystal facets, the deep-blue vortex
// inside, cyan light. No violet, and no tone pass.
// v6 (per user: "regenerate this as a rift portal instead similar to the dimensional rift style,
// but put it in yellow"). The game's rift style is the phantom void rift: a jagged tear in space
// with crackling spiked edges and a bright core. This is that tear laid flat as a round gate, in
// gold: ragged golden-yellow edges spiking outward like cracked light, a dark void inside with
// amber-gold light swirling into a white-gold centre, gold sparks. The bold dark cel outline the
// crystal shard wears is kept (the brief asks, the generator guarantees).
// v7 (per user, on the gold rift: "make this more spherical"). The flat spiked disc becomes a
// volumetric ORB: the same gold rift energy, but shaded as a solid sphere - lit from the upper
// left, darker underside, a specular highlight, the void swirl seen inside as if through amber
// glass - with the crackling gold arcs and spikes kept around its silhouette.
const PROMPT =
  'game vfx sprite, a SPHERICAL golden DIMENSIONAL RIFT: a glowing three-dimensional ORB of swirling '
  + 'gold energy that fills almost the whole picture, shaded like a solid round ball, lit from the '
  + 'upper left with a darker amber underside and a small bright specular highlight, clearly a '
  + 'sphere with volume and not a flat disc. A dark void swirl is visible inside the orb as if seen '
  + 'through molten amber glass, spiralling into a blazing white-gold core. Around the silhouette, '
  + 'crackling golden lightning arcs and a few jagged gold spikes of energy, glowing amber at the '
  + 'base and white-hot at the tips, with gold sparks drifting off. Round overall, centred, with '
  + 'only a thin margin of empty space around it. Colours ONLY: golden yellow, amber, orange-gold, '
  + 'white-gold, dark void black and deep brown-black inside. No blue, no cyan, no purple, no '
  + 'violet, no pink, no green. Cel-shaded like a game sprite: a BOLD DARK OUTLINE traces the '
  + 'sphere and its spikes, crisp contour lines, flat cel shading with hard-edged highlights. Pure '
  + 'transparent background, alpha only: no ground, no floor, no scene, no box, no frame, no square, '
  + 'no border, no character, no text, no letters, no watermark.';
const MOTION =
  'the golden energy swirls slowly around the surface of the sphere and the void inside it turns, '
  + 'the white-gold core pulses, the crackling arcs and spikes around the silhouette flicker like '
  + 'living lightning, gold sparks drift off and fade while new ones appear; the sphere stays '
  + 'perfectly in place and keeps its size and round shape; seamless loop, nothing leaves the frame';

async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
// alpha feather on all four sides + a guaranteed-clear border ring
async function feather(buf) {
  const p = await px(buf); const W = p.w, H = p.h, f = Math.round(W * FEATHER);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = Math.min(x, W - 1 - x), dy = Math.min(y, H - 1 - y);
    let k = Math.min(1, dx / f, dy / f); if (dx < 2 || dy < 2) k = 0;
    if (k < 1) { const i = (y * W + x) * 4 + 3; p.d[i] = Math.round(p.d[i] * k); }
  }
  return sharp(p.d, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
// v3 (per user: "the borders are too light coloured, make them darker so they can match the
// background better"). The model paints the rim near-white; the arena behind it is deep violet,
// so the rim read as a cut-out. This pulls every bright, low-saturation pixel toward a violet-blue
// (#6a4fc4) in proportion to how bright it is - the whites become a deep glowing rim, the vortex
// and the pale centre keep their colour - and lowers the brightest pixels' alpha a touch so the
// rim sits in the scene instead of on it. Deterministic, so the loop keeps its motion exactly.
// The eye of the vortex is spared (inner 24% of the sheet's radius, feathered out to 34%): the
// rim is what clashed with the arena; the bright centre is what the eye goes to.
export const TONE = { r: 0x6a, g: 0x4f, b: 0xc4, from: 150, strength: 0.72, alphaMul: 0.88, eyeR: 0.24, eyeFeather: 0.10 };
export async function tone(buf) {
  const p = await px(buf);
  const cx = p.w / 2, cy = p.h / 2, R = p.w / 2;
  for (let i = 0; i < p.d.length; i += 4) {
    const a = p.d[i + 3]; if (a < 8) continue;
    const r = p.d[i], g = p.d[i + 1], b = p.d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (lum <= TONE.from) continue;
    const px_ = (i / 4) % p.w, py_ = Math.floor(i / 4 / p.w);
    const d = Math.hypot(px_ - cx, py_ - cy) / R;
    const eye = d < TONE.eyeR ? 0 : d > TONE.eyeR + TONE.eyeFeather ? 1 : (d - TONE.eyeR) / TONE.eyeFeather;
    if (eye <= 0) continue;
    const k = Math.min(1, (lum - TONE.from) / (255 - TONE.from)) * TONE.strength * (1 - sat * 0.5) * eye;
    p.d[i] = Math.round(r + (TONE.r - r) * k);
    p.d[i + 1] = Math.round(g + (TONE.g - g) * k);
    p.d[i + 2] = Math.round(b + (TONE.b - b) * k);
    p.d[i + 3] = Math.round(a * (1 - (1 - TONE.alphaMul) * k));
  }
  return sharp(p.d, { raw: { width: p.w, height: p.h, channels: 4 } }).png().toBuffer();
}
// v5 (per user: "it should also have the same kind of outline" as the crystal portal). That
// sprite is cel-shaded: a bold dark-navy contour around its silhouette. The brief asks for it,
// and this guarantees it: the silhouette (alpha > 60) is dilated by OUTLINE.px and the ring that
// adds is painted dark navy under the art, so base and every frame wear one identical contour.
export const OUTLINE = { px: 4, r: 0x24, g: 0x14, b: 0x06, inset: 0.93 };   // v6: dark brown-black under the gold rift (was navy under the ice)
export async function outline(buf) {
  const p = await px(buf); const W = p.w, H = p.h, R = OUTLINE.px;
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = p.d[i * 4 + 3] > 60 ? 1 : 0;
  const offs = []; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) offs.push([dx, dy]);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let near = 0;
    if (!solid[i]) for (const [dx, dy] of offs) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && solid[yy * W + xx]) { near = 1; break; } }
    const o = i * 4;
    if (near) { out[o] = OUTLINE.r; out[o + 1] = OUTLINE.g; out[o + 2] = OUTLINE.b; out[o + 3] = 245; }
  }
  const ring = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(ring).composite([{ input: await sharp(buf).png().toBuffer() }]).png().toBuffer();
}
async function seat(raw) {
  const inS = Math.round(S * OUTLINE.inset);   // room for the contour inside the feather margin
  const inner = await sharp(raw).ensureAlpha().resize(inS, inS, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const canvas = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: 'centre' }]).png().toBuffer();
  const f = await feather(await outline(canvas));
  return has('--tone') ? tone(f) : f;   // v4: opt-in; the crystal brief wants its own colour
}
// --retone <dir-with-base-and-frames>: re-tone frames that were seated before the tone pass
// existed (no ludo call). Reads <dir>/base.webp and <dir>/frame_0..8.webp, writes the repo files.
export async function retone(dir) {
  const base = await tone(await sharp(await readFile(join(dir, 'base.webp'))).png().toBuffer());
  await writeFile(BASE + '.tmp', await sharp(base).webp({ quality: 92 }).toBuffer()); await rename(BASE + '.tmp', BASE);
  for (let i = 0; i < FRAMES; i++) {
    const f = await tone(await sharp(await readFile(join(dir, `frame_${i}.webp`))).png().toBuffer());
    const p = join(ANIM_DIR, `${KEY}_${i}.webp`);
    await writeFile(p + '.tmp', await sharp(f).webp({ quality: 90 }).toBuffer()); await rename(p + '.tmp', p);
  }
  console.log('  re-toned base + ' + FRAMES + ' frames from ' + dir);
}
export async function borderInk(buf) {
  const p = await px(buf); let n = 0;
  for (let x = 0; x < p.w; x++) for (const y of [0, 1, p.h - 2, p.h - 1]) if (p.d[(y * p.w + x) * 4 + 3] > 12) n++;
  for (let y = 0; y < p.h; y++) for (const x of [0, 1, p.w - 2, p.w - 1]) if (p.d[(y * p.w + x) * 4 + 3] > 12) n++;
  return n;
}
// "less box like", measured: the opaque mass must be an oval, not a slab - the ink's bounding
// box should be well under full-bleed and its corners must be empty.
export async function shape(buf) {
  const p = await px(buf); let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, ink = 0, corner = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.d[(y * p.w + x) * 4 + 3] > 40) { ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // corners of the ink box: an oval leaves them empty, a slab fills them
  const c = Math.round(Math.min(bw, bh) * 0.18);
  for (const [cx, cy] of [[x0, y0], [x1 - c, y0], [x0, y1 - c], [x1 - c, y1 - c]])
    for (let y = cy; y < cy + c; y++) for (let x = cx; x < cx + c; x++) if (p.d[(y * p.w + x) * 4 + 3] > 40) corner++;
  return { fill: ink / (p.w * p.h), boxFill: ink / (bw * bh), cornerFill: corner / (4 * c * c), bw, bh };
}
export function gate(sh, bi) {
  const bad = [];
  if (bi > 0) bad.push(`ink on the border (${bi} px)`);
  if (sh.boxFill > 0.86) bad.push(`reads as a slab: ${(100 * sh.boxFill).toFixed(0)}% of its own box is opaque (want <= 86%; a full disc is ~79%)`);
  if (sh.cornerFill > 0.40) bad.push(`square corners: ${(100 * sh.cornerFill).toFixed(0)}% of the box corners are opaque (want <= 40%; a disc leaves them mostly empty, a rectangle fills them)`);
  if (sh.fill < 0.04) bad.push(`too faint / empty: ${(100 * sh.fill).toFixed(1)}% of the sheet`);
  return bad;
}
// 2026-09-11: ludo's asset endpoints answer 202 with a JOB ({id, status: 'running',
// poll_after_ms}) instead of the asset; the finished job at GET /assets/jobs/<id> carries the
// result (image: result: [{url}]; animate: the frame urls / spritesheet on the job or its result).
async function pollJob(job, label) {
  const t0 = Date.now();
  for (;;) {
    await sleep(Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000)));
    const r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`job ${job.id}: ${r.status}`);
    job = await r.json();
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`job ${job.id} ${job.status}: ${JSON.stringify(job).slice(0, 160)}`);
    if (Date.now() - t0 > 600000) throw new Error(`job ${job.id} still ${job.status} after 600s`);
    process.stdout.write(`[${label} ${job.status}] `);
  }
}
const isJob = (res, data) => res.status === 202 || (data && data.id && data.status && !data.url && !data.result && !data.individual_frame_urls && !data.spritesheet_url);
const unwrap = (data) => (data && data.result && !Array.isArray(data.result) && typeof data.result === 'object') ? Object.assign({}, data, data.result) : data;
async function makeImage() {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  base attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      let data = await res.json();
      if (isJob(res, data)) data = await pollJob(data, 'image');
      const url = Array.isArray(data) ? data[0] && data[0].url
        : (data && (data.url || (data.images && data.images[0] && data.images[0].url) || (Array.isArray(data.result) && data.result[0] && data.result[0].url)));
      if (!url) throw new Error('no url in the response: ' + JSON.stringify(data).slice(0, 160));
      const seated = await seat(await fetchBuf(url));
      const sh = await shape(seated), bad = gate(sh, await borderInk(seated));
      console.log(`box ${sh.bw}x${sh.bh}, box fill ${(100 * sh.boxFill).toFixed(0)}%, corners ${(100 * sh.cornerFill).toFixed(0)}% - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'ok'}`);
      if (bad.length) throw new Error(bad.join('; '));
      return seated;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error('base FAILED: ' + (last && last.message));
}
export async function motionSteps(bufs) {
  const ps = []; for (const b of bufs) ps.push(await px(b));
  const steps = [];
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i]; let diff = 0, n = 0;
    for (let o = 0; o < a.d.length; o += 16) { diff += Math.abs(a.d[o + 3] - b.d[o + 3]) + Math.abs(a.d[o] - b.d[o]); n++; }
    steps.push(100 * diff / n / 255);
  }
  return steps;
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), o = [];
    for (let r = 0; r < data.num_rows && o.length < n; r++) for (let c = 0; c < data.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in the response');
}
async function animate(base) {
  const uri = 'data:image/png;base64,' + (await sharp(base).png().toBuffer()).toString('base64');
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      process.stdout.write(`  animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000), body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      let data = await res.json();
      if (isJob(res, data)) data = await pollJob(data, 'animate');
      data = unwrap(data);
      if (Array.isArray(data.result) && data.result[0] && typeof data.result[0] === 'object') data = Object.assign({}, data, data.result[0]);
      const raw = await framesFrom(data, FRAMES);
      console.log('frames in');
      const out = [];
      for (let i = 0; i < FRAMES; i++) {
        const f = await seat(raw[i]);
        const sh = await shape(f), bad = gate(sh, await borderInk(f));
        if (bad.length) throw new Error(`frame ${i}: ` + bad.join('; '));
        out.push(f);
      }
      // a loop that stalls looks broken: every step must actually change the picture
      const steps = await motionSteps(out);
      console.log(`  per-frame change ${steps.map((s) => s.toFixed(2)).join(' / ')} %`);
      const dead = steps.filter((s) => s < 0.3);
      if (dead.length) throw new Error(`the loop stalls: ${dead.length} step(s) under 0.3% change`);
      return out;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 3) await sleep(5000 * a); }
  }
  throw new Error('animate FAILED: ' + (last && last.message));
}

// only when run directly: the gates above are imported by scripts/safezone_anim_test.mjs
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (has('--retone')) { await retone(process.argv[process.argv.indexOf('--retone') + 1]); process.exit(0); }
  if (!has('--generate')) { console.log('DRY RUN.\n\nbase:\n' + PROMPT + '\n\nmotion:\n' + MOTION + '\n'); process.exit(0); }
  if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
  let base;
  if (has('--skip-base') && await exists(BASE)) { base = await sharp(await readFile(BASE)).png().toBuffer(); console.log('  base: using ' + BASE); }
  else {
    base = await makeImage();
    await writeFile(BASE + '.tmp', await sharp(base).webp({ quality: 92 }).toBuffer()); await rename(BASE + '.tmp', BASE);
    console.log('  -> Sprites/fx/' + KEY + '.webp');
  }
  const frames = await animate(base);
  await mkdir(ANIM_DIR, { recursive: true });
  for (let i = 0; i < FRAMES; i++) {
    const p = join(ANIM_DIR, `${KEY}_${i}.webp`);
    await writeFile(p + '.tmp', await sharp(frames[i]).webp({ quality: 90 }).toBuffer()); await rename(p + '.tmp', p);
  }
  console.log(`  -> Sprites/fx/anim/${KEY}_0..${FRAMES - 1}.webp\ndone.`);
}
