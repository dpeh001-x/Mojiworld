#!/usr/bin/env node
// Bastion of Dawn — the Crusader's B, rebuilt around a stored charge (ludo.ai):
//   aura    bastion_aura     9-frame LOOP drawn around the paladin while the bastion is armed
//   nova    crusader_ult     9-frame one-shot, the Dawnbreak detonation (REPLACES the old medallion)
//   pillar  bastion_pillar   9-frame one-shot, the shaft of dawn light that lands with it
//
//   node scripts/gen_bastion_fx.mjs --generate [--only aura|nova|pillar]   # needs LUDO_API_KEY
//   node scripts/gen_bastion_fx.mjs --install                               # staged -> Sprites/
//
// Per user: "Make paladin B skill animate more extravagant if required use ludo.ai to generate
// better sprites and ensure no cut-offs of the sprite edges".
//
// THE OLD SET WAS CUT OFF. crusader_ult_4 carried a mean alpha of 16.6 on its outermost 3 px —
// the medallion's glow ran straight into the square edge of its own canvas — and frames 3 and 5
// touched it too. Drawn at 250 px that is a visible straight line through a round burst.
//
// So the feather here is stricter than Ground Slam's. There, CONTENT_SCALE 0.86 put the RAW canvas
// edge at 0.86 of the radius while the falloff only started at 0.80, which leaves ~74% alpha at the
// raw edge midpoints: harmless for art that never reached its edge, and exactly the seam this set
// needs to kill, because a nova is SUPPOSED to fill its frame. FEATHER_OUT < CONTENT_SCALE means
// the falloff reaches zero before the generated canvas ends, at every angle — so no ink the model
// put on its own border can survive as a line. The gate below checks both edges: the shipped
// canvas border AND the band where the raw edge now sits.
import { createRequire } from 'node:module';
import { writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.BASTION_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const sharp = require('sharp'); sharp.cache(false);
const STAGE = process.env.BASTION_STAGE || join(ROOT, 'scripts', '_style_pack', 'bastion');
const INSTALL = process.env.BASTION_INSTALL || ROOT;
const FRAMES = 9, SIZE = 768;
const CONTENT_SCALE = 0.95, FEATHER_IN = 0.64, FEATHER_OUT = 0.93;
const has = (f) => process.argv.includes(f);
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();

const STYLE =
  'Flat 2D fantasy game VFX sprite, bold clean shapes, luminous cel-shaded light, crisp edges. ' +
  'Palette: blinding white and pale gold at the hottest points, rich warm gold and amber light, ' +
  'small sapphire-blue accents. Holy, radiant, majestic. ' +
  'The whole effect sits INSIDE the frame with a GENEROUS EMPTY MARGIN on every side — nothing ' +
  'touches or crosses the frame edges. Centred and symmetrical. ' +
  'NO character, NO person, NO weapon, NO text, NO letters, NO background, NO floor, NO frame, ' +
  'NO border. Fully TRANSPARENT background (alpha only).';

const ASSETS = {
  aura: {
    key: 'bastion_aura', dir: 'anim', loop: true, motionMin: 1.2, driftMax: 40, saturation: 2.0,
    prompt:
      'A HOLY BASTION BARRIER, the charging aura of a paladin: a glowing circular ward of golden ' +
      'light with a HOLLOW DARK-FREE CENTRE where a knight would stand, ringed by a slowly turning ' +
      'circle of small luminous shield-shaped runes, a soft inner halo, faint golden god-rays ' +
      'rising upward from the ring, and a few drifting motes of light. Elegant and ornate but ' +
      'airy — mostly light and glow, not a solid disc. ' + STYLE,
    motion:
      'A seamless charging LOOP: the ring of shield-runes ROTATES steadily around the centre, the ' +
      'halo PULSES bright and soft, the god-rays SHIMMER upward and motes of light RISE. The last ' +
      'frame flows back into the first. ' +
      'CRITICAL — LOCKED FRAMING: the centre stays at the exact same position in every frame; no ' +
      'zoom, pan, crop, drift, mirror or flip; the effect never grows past the frame. Keep the ' +
      'exact same art style, gold-white-sapphire palette and fully transparent background in ' +
      'every frame. NO character, NO background, NO text.',
  },
  nova: {
    key: 'crusader_ult', dir: 'anim', loop: false, motionMin: 4, driftMax: 46,
    prompt:
      'DAWNBREAK — a colossal holy detonation: a blinding white-gold sunburst core, a great ' +
      'expanding ring of dawn light, long radiant spear-like rays fanning out in a perfect star, ' +
      'sweeping curved wing-like arcs of golden light, and glittering fragments of shattered ' +
      'golden shield-sigils flung outward. Overwhelming, divine, final. ' + STYLE,
    motion:
      'One detonation played start to finish across the nine frames, with visible change in every ' +
      'frame and NO looping back. Frames 1-2: light IMPLODES — a small intense white core gathers ' +
      'as streaks rush inward. Frames 3-4: it DETONATES — a blinding white-gold flash, the star of ' +
      'rays bursts out. Frames 5-7: the ring of dawn light SURGES outward, the wing-arcs sweep, ' +
      'sigil fragments fly. Frames 8-9: everything THINS and DISSOLVES into drifting golden motes, ' +
      'the final frame almost gone. ' +
      'CRITICAL — LOCKED FRAMING: the core stays at the exact same position in every frame; no ' +
      'zoom, pan, crop, drift, mirror or flip; the expansion stays INSIDE the frame and never ' +
      'reaches its edges. Keep the exact same art style, palette and fully transparent background ' +
      'in every frame. NO character, NO background, NO text.',
  },
  pillar: {
    key: 'bastion_pillar', dir: 'anim', loop: false, motionMin: 3, driftMax: 46, driftAxis: 'x', vfade: [0.03, 0.42, 0.70, 0.88], lumaKey: [0.16, 0.42],
    prompt:
      // v2: the first roll put the impact at the BOTTOM of the canvas, where the radial feather eats it,
      // and painted a cracked stone floor into its last five frames - a patch of paving dropped onto
      // every map. The impact is pinned to the centre and every kind of ground is named and refused.
      'A PILLAR OF DAWN, floating in empty space: a single vertical shaft of brilliant holy light ' +
      'coming straight down from above. Its POINT OF IMPACT - a flat glowing halo ring of light seen ' +
      'slightly from above - sits EXACTLY at the CENTRE of the image. The shaft rises from that centre ' +
      'straight up, white-hot at its heart with golden edges, and FADES to nothing well before the top ' +
      'edge. Below the halo the image is EMPTY except for a few sparks of light. ' +
      'NO ground, NO floor, NO stone, NO tiles, NO cracks, NO rubble, NO rocks, NO dirt, NO crater. ' + STYLE,
    motion:
      'One strike played start to finish across the nine frames, with visible change in every ' +
      'frame and NO looping back. Frames 1-2: a thin bright line of light DESCENDS. Frames 3-4: ' +
      'the shaft SLAMS to full width, white-hot, the base halo flares. Frames 5-7: sparks spray, ' +
      'the halo ring widens outward, the shaft blazes. Frames 8-9: the shaft THINS to a ' +
      'thread and FADES, leaving drifting motes. ' +
      'CRITICAL — LOCKED FRAMING: the halo stays at the exact CENTRE and the shaft at the same horizontal position in every ' +
      'frame; no zoom, pan, crop, drift, mirror or flip; nothing crosses the frame edges. Keep the ' +
      'exact same art style, palette and fully transparent background in every frame. ' +
      'NO character, NO background, NO ground, NO floor, NO stone, NO cracks, NO rubble, NO text.',
  },
};
const PICK = ONLY ? { [ONLY]: ASSETS[ONLY] } : ASSETS;
if (ONLY && !ASSETS[ONLY]) { console.error('unknown --only ' + ONLY); process.exit(1); }

// ---------------------------------------------------------------- install ----
if (has('--install')) {
  for (const a of Object.values(PICK)) {
    if (!existsSync(join(STAGE, `${a.key}.webp`))) { console.error('nothing staged for ' + a.key); process.exit(1); }
    await mkdir(join(INSTALL, 'Sprites', 'fx', 'anim'), { recursive: true });
    await copyFile(join(STAGE, `${a.key}.webp`), join(INSTALL, 'Sprites', 'fx', `${a.key}.webp`));
    for (let i = 0; i < FRAMES; i++) await copyFile(join(STAGE, `${a.key}_${i}.webp`), join(INSTALL, 'Sprites', 'fx', 'anim', `${a.key}_${i}.webp`));
    console.log(`installed ${a.key}: base + ${FRAMES} frames`);
  }
  console.log('NOW: node scripts/gen_sprite_frame_index.mjs   (new frames under fx/anim)');
  process.exit(0);
}
if (!has('--generate') && !has('--refeather')) { console.error('pass --generate, --refeather or --install'); process.exit(1); }

// ----------------------------------------------------------------- ludo API ----
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
async function pollJob(id) {
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (!r || !r.ok) continue;
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
    process.stdout.write(`  job ${id} ${st}...\n`);
    j = await pollJob(id);
  }
  if (j && j.result && !j.url && !j.spritesheet_url && !j.individual_frame_urls) {
    return Array.isArray(j.result) ? (j.result.length === 1 ? j.result[0] : j.result) : j.result;
  }
  return j;
}

// ------------------------------------------------------------------ feather ----
const square = (buf) => sharp(buf).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
async function featherRadial(buf) {
  const inner = Math.round(SIZE * CONTENT_SCALE);
  const padded = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(buf).ensureAlpha().resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
                  left: Math.round((SIZE - inner) / 2), top: Math.round((SIZE - inner) / 2) }])
    .png().toBuffer();
  const { data, info } = await sharp(padded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = info.width / 2, R = info.width / 2;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    if (!data[i + 3]) continue;
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / R;
    let k;
    if (d <= FEATHER_IN) k = 1;
    else if (d >= FEATHER_OUT) k = 0;
    else { const t = (d - FEATHER_IN) / (FEATHER_OUT - FEATHER_IN); k = 1 - (t * t * (3 - 2 * t)); }
    data[i + 3] = Math.round(data[i + 3] * k);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94, alphaQuality: 100 }).toBuffer();
}
// mean alpha on a square ring `inset` px in from the canvas edge, `band` px wide
async function ringAlpha(buf, inset, band) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0; const W = info.width, H = info.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (e >= inset && e < inset + band) { s += data[y * W + x]; n++; }
  }
  return n ? s / n : 0;
}

// -------------------------------------------------------------------- build ----
// The animate model desaturates: the aura's base plate is warm gold, its nine frames came back
// cream. A per-asset saturation lift restores the plate's colour on the frames it was animated from.
async function grade(buf, a) {
  let out = a.saturation ? await sharp(buf).modulate({ saturation: a.saturation }).png().toBuffer() : buf;
  if (!a.vfade && !a.lumaKey) return out;
  // SHAPE THE ALPHA for art the radial feather cannot describe. The pillar is a tall narrow shaft:
  // a circle fades its top over ~110 px, which on a bright narrow column still reads as a cut, and
  // its late frames push the shaft BELOW the halo into what would be the ground. vfade dissolves the
  // top across the upper ~40% of the canvas and removes everything under the halo. lumaKey fades
  // dark pixels: this is an effect made of light, and its only dark ink was a smoke smear that would
  // have printed a brown stain on the map.
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ss = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < info.height; y++) {
    const v = y / info.height;
    const kv = a.vfade ? ss(a.vfade[0], a.vfade[1], v) * (1 - ss(a.vfade[2], a.vfade[3], v)) : 1;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (!data[i + 3]) continue;
      const kl = a.lumaKey ? ss(a.lumaKey[0], a.lumaKey[1], (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255) : 1;
      data[i + 3] = Math.round(data[i + 3] * kv * kl);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
// THE LETTERBOX SEAM. The model does not always answer square: the pillar came back PORTRAIT, and
// squaring it leaves the art ending on two vertical lines ~17% in from each side - inside the radial
// feather, which still kept ~83% of a column the model had filled to its own edge. So measure the
// ink's bounding box, and wherever a side of it is HARD (mean alpha along that line above 2), ramp
// the alpha to zero across the inner 14% of the box on that side. Soft sides are left alone, so art
// that already dissolves (the aura) is untouched.
async function inkBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const col = (x) => { let t = 0; for (let y = 0; y < H; y++) t += data[y * W + x]; return t / H; };
  const row = (y) => { let t = 0; for (let x = 0; x < W; x++) t += data[y * W + x]; return t / W; };
  return { x0, x1, y0, y1, L: col(x0), R: col(x1), T: row(y0), B: row(y1) };
}
async function edgeFeather(buf) {
  const box = await inkBox(buf);
  if (!box || Math.max(box.L, box.R, box.T, box.B) <= 2) return buf;
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bw = 0.14 * (box.x1 - box.x0 + 1), bh = 0.14 * (box.y1 - box.y0 + 1);
  const ramp = (d, band) => { const t = Math.max(0, Math.min(1, d / band)); return t * t * (3 - 2 * t); };
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    const i = (y * info.width + x) * 4; if (!data[i + 3]) continue;
    let k = 1;
    if (box.L > 2) k *= ramp(x - box.x0, bw);
    if (box.R > 2) k *= ramp(box.x1 - x, bw);
    if (box.T > 2) k *= ramp(y - box.y0, bh);
    if (box.B > 2) k *= ramp(box.y1 - y, bh);
    data[i + 3] = Math.round(data[i + 3] * k);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
// Everything after the model: grade, feather, the no-cut-off gate, write, contact sheet. Shared by
// --generate and --refeather, so a re-grade can never ship through a different path than a roll.
async function finish(a, raw, rawFrames) {
  const outs = [await featherRadial(await edgeFeather(await grade(raw, a)))];
  for (const f of rawFrames) outs.push(await featherRadial(await edgeFeather(await grade(f, a))));
  let border = 0, seam = 0;
  const rawEdgeInset = Math.round(SIZE * (1 - CONTENT_SCALE) / 2);   // where the generated canvas's own edge now sits
  for (const o of outs) {
    border = Math.max(border, await ringAlpha(o, 0, 3));
    seam = Math.max(seam, await ringAlpha(o, Math.max(0, rawEdgeInset - 2), 5));
  }
  let hard = 0;   // the letterbox gate, on what ships: no side of any frame's ink may end in a line
  for (const o of outs) { const bx = await inkBox(o); if (bx) hard = Math.max(hard, bx.L, bx.R, bx.T, bx.B); }
  console.log(`  shipped: canvas border alpha ${border.toFixed(2)} - raw-edge seam ${seam.toFixed(2)} - hardest ink-box side ${hard.toFixed(2)}`);
  if (border > 0.5 || seam > 0.5 || hard > 2) throw new Error('REFUSING: an edge survives the feather');
  await writeFile(join(STAGE, `${a.key}.webp`), outs[0]);
  for (let i = 0; i < FRAMES; i++) await writeFile(join(STAGE, `${a.key}_${i}.webp`), outs[i + 1]);
  const TH = 200, tiles = [];
  for (let i = 0; i < outs.length; i++)
    tiles.push({ input: await sharp(outs[i]).resize(TH, TH).png().toBuffer(), left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
  await sharp({ create: { width: TH * 5, height: TH * 2, channels: 4, background: { r: 34, g: 38, b: 52, alpha: 255 } } })
    .composite(tiles).png().toFile(join(STAGE, `${a.key}_sheet.png`));
  console.log(`  staged ${a.key} (+ ${a.key}_sheet.png)`);
}

await mkdir(STAGE, { recursive: true });
let failed = 0;
for (const [name, a] of Object.entries(PICK)) {
  console.log(`\n== ${name} -> ${a.key}`);
  try {
    if (has('--refeather')) {   // rebuild the staged set from the raw frames already on disk - no API call
      const raw = await sharp(join(STAGE, `${a.key}_raw.png`)).png().toBuffer();
      const rawFrames = [];
      for (let i = 0; i < FRAMES; i++) rawFrames.push(await sharp(join(STAGE, `${a.key}_raw_${i}.png`)).png().toBuffer());
      await finish(a, raw, rawFrames);
      continue;
    }
    const d0 = await post('/assets/image', { image_type: 'sprite', prompt: a.prompt, art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false });
    const url = Array.isArray(d0) ? d0[0]?.url : (d0?.url || d0?.images?.[0]?.url);
    if (!url) throw new Error('no url: ' + JSON.stringify(d0).slice(0, 200));
    const raw = await square(await fetchBuf(url));
    await writeFile(join(STAGE, `${a.key}_raw.png`), raw);
    console.log(`  base raw-edge alpha ${(await ringAlpha(raw, 0, 3)).toFixed(1)}`);

    const anim = await post('/assets/sprite/animate', {
      initial_image: `data:image/png;base64,${raw.toString('base64')}`,
      motion_prompt: a.motion, frames: FRAMES, frame_size: -9,
      model: 'eagle', individual_frames: true, loop: a.loop, image_type: 'sprite',
    });
    let bufs = [];
    if (Array.isArray(anim.individual_frame_urls) && anim.individual_frame_urls.length >= FRAMES) {
      for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
    } else if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
      const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
      const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
      for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
        for (let c2 = 0; c2 < anim.num_cols && bufs.length < FRAMES; c2++)
          bufs.push(await sharp(sheet).extract({ left: c2 * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    }
    if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
    const rawFrames = [];
    for (let i = 0; i < FRAMES; i++) { rawFrames.push(await square(bufs[i])); await writeFile(join(STAGE, `${a.key}_raw_${i}.png`), rawFrames[i]); }

    // motion + drift gate, measured on the RAW frames
    const stats = [];
    for (const f of rawFrames) {
      const { data: al, info } = await sharp(f).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
      let sx = 0, sy = 0, n = 0;
      for (let p = 0; p < al.length; p++) if (al[p] > 24) { sx += p % info.width; sy += (p / info.width) | 0; n++; }
      stats.push({ al, cx: n ? sx / n : 0, cy: n ? sy / n : 0, n });
    }
    let motion = 0;
    for (let i = 1; i < stats.length; i++) {
      let dd = 0; const A = stats[i - 1].al, B = stats[i].al;
      for (let p = 0; p < A.length; p += 7) dd += Math.abs(A[p] - B[p]);
      motion += dd / (A.length / 7);
    }
    motion /= (stats.length - 1);
    // drift only over frames that still hold the effect (an empty fade frame's centroid is noise).
    // A shaft that DESCENDS moves its centroid vertically by design, so the pillar is judged on X alone.
    const peak = Math.max(...stats.map((s) => s.n));
    const solid = stats.filter((s) => s.n >= peak * 0.25);
    const dx = Math.max(...solid.map((s) => s.cx)) - Math.min(...solid.map((s) => s.cx));
    const dy = Math.max(...solid.map((s) => s.cy)) - Math.min(...solid.map((s) => s.cy));
    const drift = a.driftAxis === 'x' ? dx : Math.max(dx, dy);
    let rawEdge = 0; for (const f of rawFrames) rawEdge = Math.max(rawEdge, await ringAlpha(f, 0, 3));
    console.log(`  motion ${motion.toFixed(2)} (min ${a.motionMin}) - drift ${drift.toFixed(1)}px${a.driftAxis ? ' on ' + a.driftAxis : ''} (max ${a.driftMax}) - worst RAW edge alpha ${rawEdge.toFixed(1)}`);
    const bad = [];
    if (motion < a.motionMin) bad.push('frames barely change');
    if (drift > a.driftMax) bad.push('framing drifts');
    if (bad.length) throw new Error('REFUSING: ' + bad.join('; '));
    await finish(a, raw, rawFrames);
  } catch (e) {
    failed++; console.error(`  ${name} FAILED: ${e.message}`);
  }
}
process.exit(failed ? 2 : 0);
