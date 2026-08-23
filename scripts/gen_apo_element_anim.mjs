#!/usr/bin/env node
// Apotheosis element projectiles — 9-frame loops from the authored base sprite.
// =============================================================================
//   node scripts/gen_apo_element_anim.mjs                 # dry run, show prompts
//   node scripts/gen_apo_element_anim.mjs --generate ice lightning
//   node scripts/gen_apo_element_anim.mjs --feather-only ice
//
// These are DIRECTIONAL projectiles: drawProjectiles rotates the frame to the
// travel vector and scales it, so the art must point RIGHT in every frame and
// must never tumble, drift or change size — any of those fights the blit's own
// rotation and reads as a wobble in flight.
//
// Measured on the shipped sets before this existed: p_apo_ice averaged 1.4%
// frame-to-frame change (nine frames of a still image) and p_apo_lightning
// 11.3%, against 35-48% for the boss animation sets. The prompts below push
// for violent per-frame change in the ENERGY while the silhouette holds.
//
// Two hard-won details are baked in, both from the gravitos star work:
//   * Ludo's animate call outruns undici's 300s HEADERS timeout, which
//     AbortSignal cannot extend — so this retries rather than waiting longer.
//   * A feather pass runs on every frame regardless of the prompt, so any
//     energy that reaches a border fades instead of ending on a hard edge.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJ = join(ROOT, 'Sprites', 'projectiles');
const ANIM = join(PROJ, 'anim');
const FRAMES = 9, SIDE = 512, RAMP = 26;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const exists = (p) => access(p).then(() => true, () => false);

const HOLD =
  ' CRITICAL FRAMING: the projectile keeps the EXACT same size, position and ' +
  'left-to-right orientation in every frame — it always points RIGHT, it never ' +
  'rotates, never tumbles, never drifts across the frame, never zooms in or ' +
  'out. Only the energy changes. Keep it centred with clear margin on all ' +
  'sides; the glow and sparks fade out well before the frame edges and never ' +
  'touch a border. Transparent background, no scenery, no ground, no text.';

const SETS = {
  ice: { key: 'p_apo_ice', motion:
    'A hurtling glacial comet of jagged blue-white ice, seen from the side and ' +
    'flying to the right. Make it VIOLENT frame to frame: the crystalline core ' +
    'flares and refracts, hairline fractures race across it and heal, splinters ' +
    'of ice tear off the leading edge and shatter into glittering dust, the ' +
    'trailing vapour whips and coils like a torn banner, rime blooms and blows ' +
    'apart, and a hard white glint strobes through the heart of the shard. ' +
    'Palette is absolute: glacial cyan, deep blue and white only.' },
  lightning: { key: 'p_apo_lightning', motion:
    'A screaming lightning bolt shaped like an arrowhead, seen from the side ' +
    'and flying to the right. Make it VIOLENT frame to frame: the arc snaps, ' +
    'breaks and re-forms along a new path every frame, forked branches lash out ' +
    'and vanish, the core strobes from deep gold to blinding white, sparks and ' +
    'electric motes spit off the trailing edge, and thin plasma filaments crawl ' +
    'over the surface. Palette is absolute: gold, amber and white-hot only.' },
  fire: { key: 'p_apo_fire', motion:
    'A roaring wave of fire flying to the right. Make it VIOLENT frame to ' +
    'frame: the flame front curls and breaks, embers tear away, the core ' +
    'strobes from deep red to white-hot. Palette: orange, red and white only.' },
  void: { key: 'p_apo_void', motion:
    'A collapsing void singularity flying to the right. Make it VIOLENT frame ' +
    'to frame: the event horizon ripples, violet corona lashes outward, the ' +
    'black core pulses. Palette: violet, magenta and black only.' },
};

// Fade alpha toward every border so nothing ends on a hard rectangular edge.
async function feather(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) {
    const ry = Math.min(smooth(y / RAMP), smooth((H - 1 - y) / RAMP));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C + 3;
      if (!data[i]) continue;
      const r = Math.min(ry, smooth(x / RAMP), smooth((W - 1 - x) / RAMP));
      if (r < 1) data[i] = Math.round(data[i] * r);
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
}

// Solid-core box (alpha > 200) — the shard itself, excluding the glow.
async function coreBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let t = -1, b = -1, l = W, r = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 200) { if (t < 0) t = y; b = y; if (x < l) l = x; if (x > r) r = x; }
  }
  return t < 0 ? null : { t, b, l, r, h: b - t + 1, cx: (l + r) / 2, cy: (t + b) / 2 };
}

// Hold the core at frame 0's size, centred. A roll that zooms is the norm, not
// the exception, so this runs after every generate rather than on request.
async function normalizeSet(key) {
  const p0 = join(ANIM, key + '_0.webp');
  if (!(await exists(p0))) return;
  const ref = await coreBox(await readFile(p0));
  if (!ref) { console.log('  no core in frame 0, skipping normalise'); return; }
  for (let i = 1; i < FRAMES; i++) {
    const p = join(ANIM, key + '_' + i + '.webp');
    if (!(await exists(p))) continue;
    const buf = await readFile(p);
    const box = await coreBox(buf);
    if (!box) continue;
    const k = ref.h / box.h;
    if (Math.abs(k - 1) < 0.02) continue;                 // already in tolerance
    const nw = Math.max(1, Math.round(SIDE * k)), nh = Math.max(1, Math.round(SIDE * k));
    const scaled = await sharp(buf).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    // place so the scaled core centre lands on the canvas centre
    const left = Math.round(SIDE / 2 - box.cx * k), top = Math.round(SIDE / 2 - box.cy * k);
    const sx = Math.max(0, -left), sy = Math.max(0, -top);
    const dx = Math.max(0, left), dy = Math.max(0, top);
    const cw = Math.min(nw - sx, SIDE - dx), ch = Math.min(nh - sy, SIDE - dy);
    if (cw <= 0 || ch <= 0) continue;
    const piece = await sharp(scaled).extract({ left: sx, top: sy, width: cw, height: ch }).png().toBuffer();
    const composed = await sharp({ create: { width: SIDE, height: SIDE, channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: dx, top: dy }]).png().toBuffer();
    await writeFile(p + '.tmp', await feather(composed));
    await rename(p + '.tmp', p);
    console.log('  f' + i + ': core ' + box.h + 'px -> x' + k.toFixed(3));
  }
}

const names = argv.filter((a) => !a.startsWith('--'));
const wanted = names.length ? names : Object.keys(SETS);

if (has('--normalize')) {
  for (const n of wanted) { const s2 = SETS[n]; if (!s2) continue;
    console.log('normalising ' + s2.key); await normalizeSet(s2.key); }
  process.exit(0);
}

if (has('--feather-only')) {
  for (const n of wanted) {
    const { key } = SETS[n] || {};
    if (!key) continue;
    for (let i = 0; i < FRAMES; i++) {
      const p = join(ANIM, `${key}_${i}.webp`);
      if (!(await exists(p))) continue;
      await writeFile(p + '.tmp', await feather(await readFile(p)));
      await rename(p + '.tmp', p);
    }
    console.log('feathered ' + key);
  }
  process.exit(0);
}

if (!has('--generate')) {
  console.log('DRY RUN — nothing called, nothing written.\n');
  for (const n of wanted) {
    const s = SETS[n]; if (!s) { console.log('unknown set: ' + n); continue; }
    console.log(`--- ${n} -> Sprites/projectiles/anim/${s.key}_0..${FRAMES - 1}.webp`);
    console.log(s.motion + HOLD + '\n');
  }
  console.log('Re-run with --generate <names> (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function animate(baseUri, motion) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`  attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(900000),
        body: JSON.stringify({ initial_image: baseUri, motion_prompt: motion + HOLD,
          frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true,
          loop: true, image_type: 'sprite' }),
      });
      if (!res.ok) { const t = await res.text();
        if (res.status === 402 || /\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
        throw new Error(res.status + ': ' + t.slice(0, 140)); }
      console.log('OK');
      return await res.json();
    } catch (e) {
      last = e; console.log('fail: ' + e.message);
      if (/OUT OF CREDITS/.test(e.message)) break;
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw new Error('animate failed: ' + (last && last.message));
}

async function framesFrom(anim) {
  let bufs = [];
  if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
    const sheet = await fetchBuf(anim.spritesheet_url), m = await sharp(sheet).metadata();
    const cw = Math.floor(m.width / anim.num_cols), ch = Math.floor(m.height / anim.num_rows);
    for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
      for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
        bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
  }
  if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
    bufs = [];
    for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
  }
  if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
  return bufs;
}

for (const n of wanted) {
  const s = SETS[n];
  if (!s) { console.log('unknown set: ' + n); continue; }
  const basePath = join(PROJ, s.key + '.webp');
  if (!(await exists(basePath))) { console.log('no base sprite for ' + n); continue; }
  console.log(`\n${n} (${s.key})`);
  const baseUri = 'data:image/png;base64,' +
    (await sharp(await readFile(basePath)).resize(990, 990, { fit: 'inside', withoutEnlargement: true })
      .png().toBuffer()).toString('base64');
  const bufs = await framesFrom(await animate(baseUri, s.motion));
  for (let i = 0; i < FRAMES; i++) {
    const onCanvas = await sharp(bufs[i])
      .resize(SIDE, SIDE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    await writeFile(join(ANIM, `${s.key}_${i}.webp`), await feather(onCanvas));
  }
  console.log(`  wrote ${FRAMES} frames at ${SIDE}x${SIDE}`);
  // a roll that zooms is the norm, not the exception — always follow with the
  // core-size hold rather than leaving it as a manual step
  await normalizeSet(s.key);
}
