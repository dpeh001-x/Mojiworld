#!/usr/bin/env node
// DEADEYE / DEADEYE PROTOCOL revamp art (ludo.ai). Per user: "revamp the entire skill for marksman
// deadeye and deadeye protocol ... pure DPS with multiple lines of damage on a single target ... a
// fun spammy skill ... with a sizeable cooldown", and "generate new sprites and projectiles using
// ludo.ai". Six pieces:
//   tracer   Sprites/fx/deadeye_tracer.webp            the hitscan line (drawn stretched muzzle -> target)
//   reticle  Sprites/fx/deadeye_reticle.webp           the lock-on crosshair that sits on the marked foe
//   round    Sprites/projectiles/p_ult_marksman.webp   the Overclock volley round (replaces the old art)
//   exec     Sprites/projectiles/p_deadeye_execute.webp the Execute Round
//   hit      Sprites/fx/deadeye_hit.webp + anim/deadeye_hit_0..8      per-line impact spark (9 frames; the animate endpoint allows 4/9/16/25/...)
//   exechit  Sprites/fx/deadeye_execute.webp + anim/deadeye_execute_0..8  the Execute Round's impact (9 frames)
//
//   node scripts/gen_deadeye_art.mjs                       # dry run (prints prompts)
//   node scripts/gen_deadeye_art.mjs --generate [--only=tracer,reticle,round,exec,hit,exechit,hitanim,execanim]
// Needs LUDO_API_KEY. After a drop: node scripts/gen_sprite_frame_index.mjs && node scripts/animator_parity_check.mjs
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const has = (f) => process.argv.includes(f);
const only = ((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);

const STYLE = 'Painterly hand-painted 2D game VFX art with soft luminous glow and crisp readable shapes, NO hard black outline, NO sticker look. Fully TRANSPARENT background (alpha only). NO character, NO creature, NO face, NO text, NO watermark, NO shadow, NO ground, NO background, NO border.';
const PAL = 'Palette: white-hot core, warm gold and amber glow, with thin electric-cyan accents - NO red, NO purple, NO green.';
const PROMPTS = {
  tracer: { aspect: 'ar_16_9', W: 1024, H: 192, minAspect: 3.2, feather: 0,
    text: 'A single sniper tracer line for a side-scrolling game, seen flat from the side: one thin, perfectly straight horizontal rail of light, a white-hot needle core with a gold-amber glow around it, a sharp bright point at the RIGHT end and a soft fading tail at the LEFT end, a few tiny cyan sparks flicking off the line. Extremely wide and thin - at least six times wider than tall - and dead level, no curve, no angle. ' + PAL + ' ' + STYLE },
  reticle: { aspect: 'ar_1_1', W: 512, H: 512, minAspect: 0.85, maxAspect: 1.18, feather: 0,
    text: 'A sniper lock-on reticle icon: one thin glowing gold ring with four short tick marks at the top, bottom, left and right, a tiny bright dot at the exact centre, and two thin cyan corner brackets just outside the ring. Clean, minimal, symmetrical, mostly empty inside the ring so the enemy under it stays visible. ' + PAL + ' ' + STYLE },
  round: { aspect: 'ar_16_9', W: 512, H: 224, minAspect: 1.8, feather: 0, allowClip: true, tail: 0.16,
    text: 'A single sleek high-velocity rifle round for a side-scrolling game, flying to the RIGHT, seen flat from the side: a pointed white-gold bullet with a bright cyan plasma sheath and a short streaking amber trail behind it to the left. Long and narrow, horizontal, dead level. ' + PAL + ' ' + STYLE },
  exec: { aspect: 'ar_16_9', W: 640, H: 288, minAspect: 1.6, feather: 0, allowClip: true, tail: 0.16,
    text: 'A single huge armour-piercing drill round for a side-scrolling game, flying to the RIGHT, seen flat from the side: a heavy pointed white-gold slug wrapped in a spiralling cyan energy helix, a wide blazing amber-gold exhaust trail behind it to the left with small cyan sparks. Long, powerful, horizontal, dead level. ' + PAL + ' ' + STYLE },
  hit: { aspect: 'ar_1_1', W: 640, H: 640, minAspect: 0.7, maxAspect: 1.4, feather: 40,
    text: 'A small sharp bullet-impact spark burst: a bright white-gold flash at the centre with six to eight thin radiating spikes of light, a few tiny cyan shards flung outward, and a faint thin gold ring. Compact, punchy, symmetrical, centred, filling about 75% of the frame. ' + PAL + ' ' + STYLE },
  exechit: { aspect: 'ar_1_1', W: 896, H: 896, minAspect: 0.75, maxAspect: 1.35, feather: 56, allowClip: true,
    text: 'A large decisive impact burst shaped like a crosshair: a blinding white core, four long bright gold rays in a plus shape, a thin expanding cyan ring, and a spray of small angular gold and cyan shards between the rays. Symmetrical, centred, filling about 85% of the frame. ' + PAL + ' ' + STYLE },
};
const OUT = {
  tracer: 'Sprites/fx/deadeye_tracer.webp', reticle: 'Sprites/fx/deadeye_reticle.webp',
  round: 'Sprites/projectiles/p_ult_marksman.webp', exec: 'Sprites/projectiles/p_deadeye_execute.webp',
  hit: 'Sprites/fx/deadeye_hit.webp', exechit: 'Sprites/fx/deadeye_execute.webp',
};
const ANIMS = {
  hitanim: { still: 'hit', keyName: 'deadeye_hit', frames: 9, W: 640, feather: 40,
    motion: 'The spark burst FLASHES AND DISSIPATES with strong visible change in every frame, spread evenly across all nine: frames 1-3 the white core blooms and the spikes shoot out to full length; frames 4-6 the spikes thin and the shards fly outward, the gold ring expands; frames 7-9 everything fades and shrinks toward transparency. CRITICAL - DO NOT ROTATE, no spin, no mirror, no flip; the centre stays at the exact centre in every frame; the burst never touches the frame edges. Same palette (white, gold, amber, cyan), same painterly style, fully transparent background in every frame.' },
  execanim: { still: 'exechit', keyName: 'deadeye_execute', frames: 9, W: 896, feather: 56,
    motion: 'The crosshair burst DETONATES AND DISSIPATES with strong visible change in every frame, spread evenly across all nine: frames 1-3 the white core blooms and the four gold rays snap out to full length, the cyan ring appears small; frames 4-6 the ring races outward and thins, the shards fly out between the rays, the core narrows to a pinpoint; frames 7-9 the rays retract and fade, the ring dissolves at its rim, everything dims toward transparency. CRITICAL - DO NOT ROTATE, no spin, no mirror, no flip; the centre stays at the exact centre in every frame; the burst never touches the frame edges. Same palette (white, gold, amber, cyan), same painterly style, fully transparent background in every frame.' },
};

async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) throw new Error('fully transparent');
  const corner = data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3];
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H, corner };
}
// alpha ramps to zero over the outermost `ramp` px so a burst fades instead of being guillotined
async function feather(buf, ramp) {
  if (!ramp) return sharp(buf).webp({ quality: 92 }).toBuffer();
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const sm = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const rr = new Float32Array(H), cr = new Float32Array(W);
  for (let y = 0; y < H; y++) rr[y] = Math.min(sm(y / ramp), sm((H - 1 - y) / ramp));
  for (let x = 0; x < W; x++) cr[x] = Math.min(sm(x / ramp), sm((W - 1 - x) / ramp));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * C + 3; if (!data[i]) continue; const r = Math.min(rr[y], cr[x]); if (r < 1) data[i] = Math.round(data[i] * r); }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
}
// crop to content, fit into a W x H canvas with a 6% margin, centred
async function seat(buf, b, W, H, ramp, tail) {
  let cropped = await sharp(buf).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).png().toBuffer();
  if (tail) {   // fade the LEFT `tail` fraction (the exhaust) to zero so a trail that ran off the source edge ends softly
    const { data, info } = await sharp(cropped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const tw = Math.max(1, Math.round(info.width * tail));
    for (let y = 0; y < info.height; y++) for (let x = 0; x < tw; x++) { const i = (y * info.width + x) * 4 + 3; const t = x / tw; data[i] = Math.round(data[i] * t * t * (3 - 2 * t)); }
    cropped = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  }
  const fitted = await sharp(cropped).resize(Math.round(W * 0.94), Math.round(H * 0.94), { fit: 'inside' }).png().toBuffer();
  const fm = await sharp(fitted).metadata();
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, left: Math.round((W - fm.width) / 2), top: Math.round((H - fm.height) / 2) }]).png().toBuffer();
  return feather(png, ramp);
}
async function ludoImage(prompt, aspect) {
  const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: aspect, n: 1, augment_prompt: false, prompt }) });
  const j = await ludoResult(res);
  const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
  if (!url) throw new Error('no url');
  return fetchBuf(url);
}
// v0.30.x - the image and animate endpoints answer 202 + a job now (the sound endpoint went first):
// poll GET /assets/jobs/{id}?wait=30 until it settles and hand back the job's result; a sync 200 is returned as-is.
async function ludoResult(res) {
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const j = await res.json();
  if (res.status !== 202 || !j.id) return j;
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${API}/assets/jobs/${j.id}?wait=30`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`job HTTP ${r.status}`);
    const q = await r.json();
    if (q.status === 'succeeded') return q.result;
    if (q.status === 'failed' || q.status === 'cancelled') throw new Error('job ' + q.status + ': ' + JSON.stringify(q.error || '').slice(0, 120));
    await new Promise((s) => setTimeout(s, Math.max(1000, q.poll_after_ms || 2000)));
  }
  throw new Error('job timed out');
}
async function writeAtomic(rel, buf) { const f = join(ROOT, rel); await mkdir(dirname(f), { recursive: true }); await writeFile(f + '.tmp', buf); await rename(f + '.tmp', f); console.log('wrote ' + rel); }

async function makeStill(k) {
  const P = PROMPTS[k];
  for (let round = 1; round <= 5; round++) {
    process.stdout.write(`${k} attempt ${round} ... `);
    try {
      const raw = await ludoImage(P.text, P.aspect);
      const b = await box(raw), aspect = b.w / b.h;
      const clipped = b.x0 === 0 || b.y0 === 0 || b.x0 + b.w === b.W || b.y0 + b.h === b.H;
      console.log(`content ${b.w}x${b.h} aspect ${aspect.toFixed(2)} cornerA ${b.corner}`);
      if (b.corner > 0) { console.log('  rejected: background not transparent'); continue; }
      if (clipped && !P.allowClip) { console.log('  rejected: clipped at the canvas edge'); continue; }   // the rounds may run their trail off the left edge (feathered in seat)
      if (P.minAspect && aspect < P.minAspect) { console.log(`  rejected: aspect under ${P.minAspect}`); continue; }
      if (P.maxAspect && aspect > P.maxAspect) { console.log(`  rejected: aspect over ${P.maxAspect}`); continue; }
      await writeAtomic(OUT[k], await seat(raw, b, P.W, P.H, P.feather, P.tail));
      return;
    } catch (e) { console.log('failed: ' + e.message); await new Promise((r) => setTimeout(r, 2500 * round)); }
  }
  console.error(`REFUSING: no ${k} met the gate in 5 rounds.`); process.exit(1);
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows, sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++) o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}
async function makeAnim(k) {
  const A = ANIMS[k];
  const uri = 'data:image/png;base64,' + (await sharp(await readFile(join(ROOT, OUT[A.still]))).resize(990, 990, { fit: 'inside' }).png().toBuffer()).toString('base64');
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`animate ${A.keyName} attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: A.motion, frames: A.frames, frame_size: -9, model: 'eagle', individual_frames: true }) });
      const jr = await ludoResult(res);
      const bufs = await framesFrom(Array.isArray(jr) ? jr[0] : jr, A.frames);
      const outs = [];
      for (const b of bufs) {
        const bb = await box(b);
        if (bb.corner > 0) throw new Error('a frame lost its transparency - rejected before writing');
        outs.push(await feather(await sharp(b).resize(A.W, A.W, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), A.feather));
      }
      for (let i = 0; i < A.frames; i++) await writeAtomic(`Sprites/fx/anim/${A.keyName}_${i}.webp`, outs[i]);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (attempt < 4) await new Promise((s) => setTimeout(s, 4000 * attempt)); }
  }
  console.error('FAILED: ' + (last && last.message)); process.exit(1);
}
if (has('--generate')) {
  if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  for (const k of Object.keys(PROMPTS)) if (want(k)) await makeStill(k);
  for (const k of Object.keys(ANIMS)) if (want(k)) await makeAnim(k);
} else { for (const k of Object.keys(PROMPTS)) console.log(k + ': ' + PROMPTS[k].text + '\n'); for (const k of Object.keys(ANIMS)) console.log(k + ': ' + ANIMS[k].motion + '\n'); console.log('--generate [--only=a,b,...]'); }
