#!/usr/bin/env node
// Gravitos form-2 STAR attack — regenerated with feathered edges.
// =============================================================================
//   node scripts/generate_gravitos_star_anim.mjs             # dry-run
//   node scripts/generate_gravitos_star_anim.mjs --generate  # call Ludo, write
//   node scripts/generate_gravitos_star_anim.mjs --feather-only  # re-feather in place
//
// Per user: "regenerate gravitos 2 star animation attack, make sure that the
// edges are feathered well if there is some zoom in cutoff." The shipped set
// zooms ~3x across the charge; by frame 8 the legs are HARD-CUT at the bottom
// border (450 fully-opaque pixels ON the edge) and the aura ends in a straight
// boxy line. Two defences, in order:
//   1. The motion prompt forbids zooming, so the cutoff should not recur.
//   2. A FEATHER pass runs regardless: wherever content sits within RAMP px of
//      a canvas edge, alpha is multiplied by a smooth 0->1 ramp toward that
//      edge — so any residual overshoot fades out instead of slicing off.
// The canvas stays the shipped 1656x1505: _drawBossSprite derives draw size
// from canvas geometry (clamped at this size) and BOSS_SPRITE_META bbox is
// lazily re-detected, so keeping geometry keeps the on-screen size.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATK_DIR = join(ROOT, 'Sprites', 'bosses', 'attack');
const KEY = 'gravitos2star';
const FRAMES = 9;
const CANVAS_W = 1656, CANVAS_H = 1505;
const RAMP = 48;   // feather width, px
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const MOTION =
  'the colossal cosmic star-titan performs a FEROCIOUS charge-up attack IN ' +
  'PLACE: the blazing blue-white star core in his chest detonates with light, ' +
  'strobing from hard white to deep violet as it builds; ribbons and whipping ' +
  'arcs of violet-and-cyan PLASMA tear upward off his shoulders and forearms ' +
  'and wrap around his limbs; the lava-crack seams across his dark armour ' +
  'flare white-hot; he hauls both fists in toward the core, shoulders ' +
  'hunching, head tipping back, his whole frame straining; forked lightning ' +
  'snaps between his arms and the core; thin rings of pure light expand and ' +
  'fade around him. Every frame must look VIOLENTLY different from the last ' +
  '- big, dramatic, high-contrast swings in the light and the energy, never ' +
  'a subtle shimmer. PALETTE IS ABSOLUTE: only deep violet, magenta, ' +
  'electric cyan and blue-white starlight against his near-black armour. ' +
  'NO smoke, NO white puffy clouds, NO steam, NO dust, NO sand, NO soil, NO ' +
  'rubble, NO ground debris, NO beige or cream or tan or brown anywhere, and ' +
  'NOTHING on the floor around his feet - he stands on empty transparent ' +
  'space. The energy is clean glowing plasma and light, never particulate. ' +
  'CRITICAL: the character stays the EXACT same size, scale and position in ' +
  'EVERY frame - do NOT zoom in, do NOT enlarge him, do NOT crop closer; the ' +
  'whole body including the legs and feet stays fully inside the frame with ' +
  'clear margin on all sides in every frame. Frame him so he occupies about ' +
  '80% of the frame height, centred, feet well above the bottom edge, and ' +
  'hold that framing in every single frame. The aura stays wispy and FADES ' +
  'OUT well before the frame edges - never a hard rectangular edge of ' +
  'energy, and never let the energy reach a border. Keep the same left/right ' +
  'facing as the source; never mirror or flip.';

// ---------- the feather ----------
// Multiply alpha by a smooth ramp toward each canvas edge. Content deep in the
// frame is untouched (ramp = 1 beyond RAMP px); content ON the edge goes to 0.
async function feather(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  for (let y = 0; y < H; y++) {
    const ry = Math.min(smooth(y / RAMP), smooth((H - 1 - y) / RAMP));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C + 3;
      if (data[i] === 0) continue;
      const r = Math.min(ry, smooth(x / RAMP), smooth((W - 1 - x) / RAMP));
      if (r < 1) data[i] = Math.round(data[i] * r);
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
}

const exists = (p) => access(p).then(() => true, () => false);

// ---------- body normalisation ----------
// The repo's gravitos convention (see generate_gravitos_attack_anim.mjs):
// the DARK ARMOUR body — alpha > 200, luminance < 130, so the glowing aura is
// excluded — holds constant height with the feet anchored, and the aura does
// all the growing. Measured on a raw roll of this set: the body itself zoomed
// 1227 -> 1437px (17%) with the feet drifting 105px down, so the loop wrap
// snapped. One uniform transform per frame: scale to frame 0's body height,
// pin body-bottom and centre-x to frame 0's.
async function darkBodyBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let y0 = H, y1 = -1, x0 = W, x1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * C;
    const lum = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
    if (data[k + 3] > 200 && lum < 130) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  return (y1 < 0) ? null : { x0, y0, x1, y1, h: y1 - y0 + 1, cx: (x0 + x1) / 2 };
}
async function bodyNormalize() {
  const p0 = join(ATK_DIR, `${KEY}_0.webp`);
  const ref = await darkBodyBox(await readFile(p0));
  if (!ref) { console.error('no dark body in frame 0'); process.exit(1); }
  console.log(`ref (frame 0): body h=${ref.h}, bottom y=${ref.y1}, cx=${Math.round(ref.cx)}`);
  const { rename } = await import('node:fs/promises');
  const targets = [];
  for (let i = 1; i < FRAMES; i++) targets.push(join(ATK_DIR, `${KEY}_${i}.webp`));
  targets.push(join(ATK_DIR, `${KEY}.webp`));   // the static rides frame 8's pose
  for (const p of targets) {
    if (!(await exists(p))) continue;
    const buf = await readFile(p);
    const b = await darkBodyBox(buf);
    if (!b) continue;
    const k = ref.h / b.h;
    if (Math.abs(k - 1) < 0.015 && Math.abs(ref.y1 - b.y1) < 10 && Math.abs(ref.cx - b.cx) < 12) {
      console.log(`  ${p.replace(/^.*[\\/]/, '')}: within tolerance`); continue;
    }
    const nw = Math.round(CANVAS_W * k), nh = Math.round(CANVAS_H * k);
    const scaled = await sharp(buf).resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    // place so the scaled body-bottom lands on ref.y1 and body-cx on ref.cx
    const left = Math.round(ref.cx - b.cx * k), top = Math.round(ref.y1 - b.y1 * k);
    const sx = Math.max(0, -left), sy = Math.max(0, -top);
    const dx = Math.max(0, left), dy = Math.max(0, top);
    const cw = Math.min(nw - sx, CANVAS_W - dx), ch = Math.min(nh - sy, CANVAS_H - dy);
    const piece = await sharp(scaled).extract({ left: sx, top: sy, width: cw, height: ch }).png().toBuffer();
    const composed = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: piece, left: dx, top: dy }]).png().toBuffer();
    await writeFile(p + '.tmp', await feather(composed));
    await rename(p + '.tmp', p);
    console.log(`  ${p.replace(/^.*[\\/]/, '')}: body ${b.h}px -> x${k.toFixed(3)}, feet pinned`);
  }
}

if (has('--body-normalize')) { await bodyNormalize(); process.exit(0); }

if (has('--feather-only')) {
  for (let i = 0; i < FRAMES; i++) {
    const p = join(ATK_DIR, `${KEY}_${i}.webp`);
    if (!(await exists(p))) continue;
    await writeFile(p + '.tmp', await feather(await readFile(p)));
    const { rename } = await import('node:fs/promises');
    await rename(p + '.tmp', p);
    console.log(`feathered ${KEY}_${i}.webp`);
  }
  const sp = join(ATK_DIR, `${KEY}.webp`);
  if (await exists(sp)) {
    await writeFile(sp + '.tmp', await feather(await readFile(sp)));
    const { rename } = await import('node:fs/promises');
    await rename(sp + '.tmp', sp);
    console.log(`feathered ${KEY}.webp`);
  }
  process.exit(0);
}

if (!has('--generate')) {
  console.log('DRY RUN — nothing called, nothing written.\n');
  console.log(`out: ${FRAMES} frames + static at ${CANVAS_W}x${CANVAS_H}, feather ramp ${RAMP}px\n`);
  console.log(`--- motion ---\n${MOTION}\n`);
  console.log('Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };

// Input: FRAME 0 of the shipped set — the one pose with the full body at
// normal scale and zero edge contact. The static pose is itself bottom-cut
// (the zoom's last frame), and a cut input teaches the model to keep cutting.
const baseBuf = await readFile(join(ATK_DIR, `${KEY}_0.webp`));
const baseUri = 'data:image/png;base64,' +
  (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

// Ludo's animate call routinely outruns undici's 300s HEADERS timeout, which
// AbortSignal cannot extend — so retry rather than wait longer, the same way
// gen_bolt_anim.mjs and the other animation generators do.
async function animate() {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      process.stdout.write(`animating ${FRAMES} frames, attempt ${attempt} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(900000),
        body: JSON.stringify({ initial_image: baseUri, motion_prompt: MOTION,
          frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
      });
      if (!res.ok) { const t = await res.text();
        if (/\b402\b/.test(t) || res.status === 402) throw new Error('402 OUT OF CREDITS');
        throw new Error(`${res.status}: ${t.slice(0, 160)}`); }
      console.log('OK');
      return await res.json();
    } catch (e) {
      last = e;
      console.log('fail: ' + e.message);
      if (/OUT OF CREDITS/.test(e.message)) break;
      if (attempt < 4) await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
  throw new Error('animate failed after retries: ' + (last && last.message));
}
const anim = await animate();
let bufs = [];
if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
  const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
  for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
    for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
      bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
}
if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
  bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
}
if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);

process.stdout.write('normalising + feathering ... ');
for (let i = 0; i < FRAMES; i++) {
  const onCanvas = await sharp(bufs[i]).resize(CANVAS_W, CANVAS_H, { fit: 'fill' }).png().toBuffer();
  await writeFile(join(ATK_DIR, `${KEY}_${i}.webp`), await feather(onCanvas));
}
// Static fallback = the charge peak (last frame), same as the set convention.
{
  const onCanvas = await sharp(bufs[FRAMES - 1]).resize(CANVAS_W, CANVAS_H, { fit: 'fill' }).png().toBuffer();
  await writeFile(join(ATK_DIR, `${KEY}.webp`), await feather(onCanvas));
}
console.log(`OK — ${FRAMES} frames + static at ${CANVAS_W}x${CANVAS_H}, ramp ${RAMP}px`);

// A fresh roll can still drift, and the prompt alone is not a guarantee — so
// always follow a generate with the body normalisation that pins the dark
// armour's height and feet to frame 0. Previously this had to be run by hand.
process.stdout.write('body-normalising the fresh roll ... \n');
await bodyNormalize();
