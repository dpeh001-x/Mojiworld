#!/usr/bin/env node
// Gravitos's TELEPORT RIFT, ONE PER FORM (ludo.ai). Per user: "can you redesign the rift to make it look more fitting for gravitos3",
// then "redo the voids for form 1 and 2 as well". The shared violet rift (gen_gravitos_voidrift.mjs) fitted none of them closely:
//   form 1 - the Weight-Bearer: indigo armour full of galaxies, glowing cyan circuit lines, a white-blue star core   -> a COSMIC tear
//   form 2 - Awakened: dark navy body split by orange lava veins, spikes, a fanged grin, a blue-violet star core      -> a FRACTURED tear
//   form 3 - Ascendant (v0.30.1427): black obsidian, red lava veins, orange-yellow flames, a green-gold core           -> a MOLTEN tear
// Each writes Sprites/fx/gravitos<N>_voidrift.webp + anim/gravitos<N>_voidrift_0..8.webp. Same 512 seat, feather and shape gates as
// the shared rift; no forced outline (per user, v0.30.1348: a dark shell round a glow read as a cut-out).
//   node scripts/gen_gravitos_form_rift.mjs --form 1                              # dry run: that form's briefs
//   node scripts/gen_gravitos_form_rift.mjs --form 1 --candidates <dir>           # stills for review (no repo writes)
//   node scripts/gen_gravitos_form_rift.mjs --form 1 --animate <picked.webp>     # the picked still -> base + 9 loop frames
//   node scripts/gen_gravitos_form_rift.mjs --form 1 --ring                      # the halo ring in the form's colour (no ludo call):
//        gravitos_riftring's brightness mapped onto FORMS[n].ring's two-tone (dark -> light), alpha kept -> Sprites/fx/gravitos<N>_riftring
//        (a hue rotation kept the ring's pale wisps pale - per user "tweak the rings", the colours were picked from a two-tone sheet)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), ANIM_DIR = join(ROOT, 'Sprites', 'fx', 'anim');
const S = 512, FRAMES = 9, FEATHER = 0.05, INSET = 0.93;
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = process.env.LUDO_API_KEY, API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const FRAME = 'Centred, with a clear empty margin all around. Pure transparent background, alpha only: no ground, no floor, no scene, no box, no frame, '
  + 'no square, no border, no character, no text, no letters, no watermark.';
const CEL = 'Cel-shaded like a game sprite: crisp contour lines, flat cel shading with hard-edged highlights. ';
const TEAR = 'a tall vertical jagged tear shaped like a narrow upright lens, filling most of the picture height and about a third of its width. ';
export const FORMS = {
  1: { ring: { dark: '#2a5cff', light: '#c9d6ff' },   // azure (user-picked "B azure")
    motion: 'the cyan edges of the rift pulse brighter and dimmer, the galaxies and nebula inside swirl slowly inward, the star flare twinkles, star motes drift outward and fade while new ones appear',
    briefs: {
      nebula: 'game vfx sprite, a RIFT torn open in space: ' + TEAR + 'Inside, a deep indigo void swirling with galaxies, violet-blue nebula dust and tiny '
        + 'white stars. The torn edges are dark navy shards like cracked armour plates traced with thin glowing cyan light lines, and a bright white-blue '
        + 'four-pointed star flare shines at the centre; small cyan sparks and star motes drift off the edges. Colours ONLY: navy, deep indigo, royal blue, '
        + 'violet-blue nebula, cyan, pale blue-white highlights. No orange, no red, no yellow, no green, no pink. ' + CEL + FRAME,
      starlit: 'game vfx sprite, a COSMIC RIFT: a tall upright eye-shaped portal ripped in the sky, filling most of the picture height and about a third of its '
        + 'width. Inside, a deep blue starfield with a small spiral galaxy. Its rim is a band of glowing cyan energy with jagged dark indigo crystal shards splitting '
        + 'off it, and a white-blue star glint sits at its heart. Colours ONLY: navy, indigo, royal blue, cyan, pale blue-white, a touch of violet. No orange, '
        + 'no red, no yellow, no green, no pink. ' + CEL + FRAME } },
  2: { ring: { dark: '#6a4cff', light: '#d9d0ff' },   // blue-violet (user-picked "A blue-violet"): his core and the tear's void
    motion: 'the lava cracks along the rim of the rift glow brighter and dimmer, the blue-violet void inside swirls slowly inward, the star flare at its heart pulses, embers drift outward and fade while new ones rise',
    briefs: {
      fracture: 'game vfx sprite, a RIFT torn open in space: ' + TEAR + 'Inside, a deep blue-violet void with faint stars and a small bright blue-white star '
        + 'flare at its heart. The torn edges are cracked dark navy-black stone split by glowing orange lava veins, jagged spikes curling outward like claws, '
        + 'orange embers drifting off. Colours ONLY: black, dark navy, indigo, blue-violet, lava orange and amber in the cracks, blue-white at the flare. '
        + 'No green, no pink, no yellow flames, no cyan lines. ' + CEL + FRAME,
      maw: 'game vfx sprite, an AWAKENED RIFT: a tall vertical gash in space like a fanged maw standing upright, filling most of the picture height and about a '
        + 'third of its width. Its rim is dark indigo spikes like jagged teeth, veined with molten orange cracks; inside, deep violet-blue darkness with a bright '
        + 'blue-white star glint at the centre; orange embers fly off the edges. Colours ONLY: black, dark navy, indigo, blue-violet, lava orange, blue-white '
        + 'at the glint. No green, no pink, no yellow flames. ' + CEL + FRAME } },
  3: { ring: { dark: '#e0102a', light: '#ffb0a0' },   // crimson (user-picked "B crimson"): his lava veins
    motion: 'the molten edges of the rift pulse and glow brighter and dimmer, flames lick and flicker along both sides, the black void inside churns slowly inward, embers and ash drift outward and fade while new ones rise',
    briefs: {   // v1 (picked: core_1) - the brief that made the Ascendant's rift
      core: 'game vfx sprite, an INFERNAL RIFT: a tall vertical gash burned open in space, shaped like an upright eye, filling most of the picture height and about '
        + 'a third of its width. Inside, a pitch-black void; deep in its centre, one small smouldering green-gold ember glow like a distant burning core. The rim '
        + 'is black volcanic glass cracked with glowing red lava veins, jagged obsidian spikes curling outward like torn wings, flames of orange and yellow roaring '
        + 'off both edges, sparks and ash flying. Colours ONLY: pitch black, charcoal, blood red, crimson, molten orange, flame yellow at the hottest points. No '
        + 'purple, no violet, no pink, no magenta, no blue, no cyan, no white glow (the only exception: that small green-gold ember in the centre). ' + CEL + FRAME } },
};
const HOLD = '; the rift stays exactly in place and keeps its size and shape; seamless loop, nothing leaves the frame';
async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
async function feather(buf) {
  const p = await px(buf); const W = p.w, H = p.h, f = Math.round(W * FEATHER);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = Math.min(x, W - 1 - x), dy = Math.min(y, H - 1 - y); let k = Math.min(1, dx / f, dy / f); if (dx < 2 || dy < 2) k = 0;
    if (k < 1) { const i = (y * W + x) * 4 + 3; p.d[i] = Math.round(p.d[i] * k); }
  }
  return sharp(p.d, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
export async function seat(raw) {
  const inner = await sharp(raw).ensureAlpha().resize(Math.round(S * INSET), Math.round(S * INSET), { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return feather(await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: 'centre' }]).png().toBuffer());
}
export async function shape(buf) {
  const p = await px(buf); let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, ink = 0, corner = 0, border = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const a = p.d[(y * p.w + x) * 4 + 3];
    if (a > 40) { ink++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (a > 12 && (x < 2 || y < 2 || x > p.w - 3 || y > p.h - 3)) border++; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, c = Math.round(Math.min(bw, bh) * 0.18);
  for (const [cx, cy] of [[x0, y0], [x1 - c, y0], [x0, y1 - c], [x1 - c, y1 - c]]) for (let y = cy; y < cy + c; y++) for (let x = cx; x < cx + c; x++) if (p.d[(y * p.w + x) * 4 + 3] > 40) corner++;
  return { fill: ink / (p.w * p.h), boxFill: ink / (bw * bh), cornerFill: corner / (4 * c * c), bw, bh, border, tall: bh / Math.max(1, bw) };
}
export function gate(sh) {
  const bad = [];
  if (sh.border > 0) bad.push(`ink on the border (${sh.border} px)`);
  if (sh.boxFill > 0.86) bad.push(`reads as a slab (${(100 * sh.boxFill).toFixed(0)}% of its box opaque)`);
  if (sh.cornerFill > 0.40) bad.push(`square corners (${(100 * sh.cornerFill).toFixed(0)}%)`);
  if (sh.fill < 0.04) bad.push(`too faint (${(100 * sh.fill).toFixed(1)}%)`);
  if (sh.tall < 1.15) bad.push(`not a tall tear (h/w ${sh.tall.toFixed(2)})`);
  return bad;
}
async function pollJob(job, label) {
  const t0 = Date.now();
  for (;;) {
    await sleep(Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000)));
    let r; try { r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) }); } catch (e) { process.stdout.write('[poll retry] '); continue; }
    if (!r.ok) throw new Error(`job ${job.id}: ${r.status}`);
    job = await r.json();
    if (job.status === 'succeeded') return job;
    if (job.status === 'failed' || job.status === 'cancelled') throw new Error(`job ${job.id} ${job.status}`);
    if (Date.now() - t0 > 600000) throw new Error(`job ${job.id} still ${job.status} after 600s`);
    process.stdout.write(`[${label} ${job.status}] `);
  }
}
const isJob = (res, d) => res.status === 202 || (d && d.id && d.status && !d.url && !d.result && !d.individual_frame_urls && !d.spritesheet_url);
const unwrap = (d) => (d && d.result && !Array.isArray(d.result) && typeof d.result === 'object') ? Object.assign({}, d, d.result) : d;
async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000), body: JSON.stringify(body) });
  if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
  let d = await res.json(); if (isJob(res, d)) d = await pollJob(d, path.split('/').pop()); return unwrap(d);
}
async function framesFrom(d, n) {
  if (d.spritesheet_url && d.num_cols && d.num_rows) { const sheet = await fetchBuf(d.spritesheet_url), m = await sharp(sheet).metadata(); const cw = Math.floor(m.width / d.num_cols), ch = Math.floor(m.height / d.num_rows), o = [];
    for (let r = 0; r < d.num_rows && o.length < n; r++) for (let c = 0; c < d.num_cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o; }
  const urls = d.individual_frame_urls || []; if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in the response');
}
const put = async (p, buf, q) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p + '.tmp', await sharp(buf).webp({ quality: q }).toBuffer()); await rename(p + '.tmp', p); };
const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  const form = Number(arg('--form')), F = FORMS[form], candDir = arg('--candidates'), pick = arg('--animate');
  if (!F) { console.error('--form 1|2|3'); process.exit(1); }
  const KEY = `gravitos${form}_voidrift`, BASE = join(ROOT, 'Sprites', 'fx', KEY + '.webp');
  if (process.argv.includes('--ring')) {   // the shared violet ring, hue-rotated into this form's colour: base + 9 frames, same names
    const RK = `gravitos${form}_riftring`, hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), D = hx(F.ring.dark), L = hx(F.ring.light);
    const rot = async (src) => { const p = await px(await readFile(src));
      for (let i = 0; i < p.d.length; i += 4) { const k = Math.min(1, Math.max(0, ((0.299 * p.d[i] + 0.587 * p.d[i + 1] + 0.114 * p.d[i + 2]) / 255 - 0.15) / 0.8));
        for (let c = 0; c < 3; c++) p.d[i + c] = Math.round(D[c] + (L[c] - D[c]) * k); }
      return sharp(p.d, { raw: { width: p.w, height: p.h, channels: 4 } }).png().toBuffer(); };
    await put(join(ROOT, 'Sprites', 'fx', RK + '.webp'), await rot(join(ROOT, 'Sprites', 'fx', 'gravitos_riftring.webp')), 92);
    for (let i = 0; i < FRAMES; i++) await put(join(ANIM_DIR, `${RK}_${i}.webp`), await rot(join(ANIM_DIR, `gravitos_riftring_${i}.webp`)), 90);
    console.log(`-> Sprites/fx/${RK}.webp + anim/${RK}_0..${FRAMES - 1}.webp (${F.ring.dark} -> ${F.ring.light})`); process.exit(0);
  }
  if (!candDir && !pick) { for (const [k, v] of Object.entries(F.briefs)) console.log(k + ':\n' + v + '\n'); console.log('motion:\n' + F.motion + HOLD); process.exit(0); }
  if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
  if (candDir) {   // stills for review: 2 per brief, raw + seated, nothing in the repo
    for (const [name, prompt] of Object.entries(F.briefs)) {
      let urls = []; for (let a = 1; a <= 3 && urls.length < 2; a++) { try { process.stdout.write(`${name} attempt ${a} ... `);
        const d = await post('/assets/image', { image_type: 'sprite', art_style: 'Cel-Shaded', aspect_ratio: 'ar_1_1', n: 2, augment_prompt: false, prompt });
        urls = (Array.isArray(d) ? d : Array.isArray(d.result) ? d.result : (d.images || (d.url ? [d] : []))).map((x) => x && x.url).filter(Boolean); console.log(urls.length + ' in'); }
        catch (e) { console.log('fail: ' + e.message); await sleep(4000 * a); } }
      for (let i = 0; i < urls.length; i++) { const raw = await fetchBuf(urls[i]), s = await seat(raw), sh = await shape(s), bad = gate(sh);
        await put(join(candDir, `raw_f${form}_${name}_${i + 1}.webp`), raw, 95); await put(join(candDir, `f${form}_${name}_${i + 1}.webp`), s, 92);
        console.log(`  f${form}_${name}_${i + 1}: ${sh.bw}x${sh.bh} ${bad.length ? 'GATE: ' + bad.join('; ') : 'ok'}`); }
    }
  } else {   // the picked still becomes the base; the loop is animated from it and every frame is gated
    const base = await seat(await readFile(pick));
    const uri = 'data:image/png;base64,' + (await sharp(base).png().toBuffer()).toString('base64');
    let d = await post('/assets/sprite/animate', { initial_image: uri, motion_prompt: F.motion + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true });
    if (Array.isArray(d.result) && d.result[0] && typeof d.result[0] === 'object') d = Object.assign({}, d, d.result[0]);
    const raw = await framesFrom(d, FRAMES), out = [];
    for (let i = 0; i < FRAMES; i++) { const f = await seat(raw[i]); const bad = gate(await shape(f)); if (bad.length) throw new Error(`frame ${i}: ${bad.join('; ')}`); out.push(f); }
    await put(BASE, base, 92); for (let i = 0; i < FRAMES; i++) await put(join(ANIM_DIR, `${KEY}_${i}.webp`), out[i], 90);
    console.log(`-> Sprites/fx/${KEY}.webp + anim/${KEY}_0..${FRAMES - 1}.webp`);
  }
}
