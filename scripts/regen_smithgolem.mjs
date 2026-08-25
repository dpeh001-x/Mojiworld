#!/usr/bin/env node
// Rebuild the smith golem: bigger canvas, one locked scale, no padding hack.
//
//   node scripts/regen_smithgolem.mjs --base --rolls 4 --generate
//   node scripts/regen_smithgolem.mjs --states idle,walk,attack --generate
//   node scripts/regen_smithgolem.mjs --check
//
// Per user: "It may likely be a canvas issue, regenerate a whole new sprite for
// the smithgolem, a bigger one with a bigger canvas and generate new attack,
// idle and walking sprites."
//
// WHY THE CANVAS REALLY IS THE PROBLEM. The old assets do not share one:
//
//     base / idle / walk    768 canvas, character 0.7487 of it, feet on the floor
//     attack                640 canvas, character 0.4000 of it, feet 76px up
//
// The attack set is padded so the hammer arc is not clipped, and the engine
// undoes the padding with _ATK_FRAME_SCALE.smithgolem = 1.881. That constant is
// only correct while every attack frame keeps the character at exactly 0.40 -
// and they do not: measured 0.40 to 0.52 across the nine, so the golem grows
// through its own swing (head width 116 -> 142 px, 1.22x, confirmed against
// grey-body height and character box, all three agreeing).
//
// A constant cannot correct a set that is not constant. So instead of patching
// the frames, all four assets are rebuilt on ONE canvas with the character at
// ONE fraction, and the padding entry is deleted.
//
// THE ARITHMETIC THAT KEEPS THE MOB THE SAME SIZE ON SCREEN. drawMonster uses
//
//     sizeFactor = clamp(0.85, 1.20, canvasLongEdge / 768)
//     targetH    = m.h * 1.5 * sizeFactor * mobScale
//
// and the character's drawn height is CHAR_FRAC x targetH. At 768 the factor is
// 1.0; at 1024 it clamps to 1.20. To leave the on-screen size untouched:
//
//     CHAR_FRAC x 1.20  ==  0.7487 x 1.0     ->  CHAR_FRAC = 0.624
//
// which is the constant below. The reward is margin: 37.6% of the canvas free
// for the hammer instead of 25%, in every state rather than only in attack.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOB = join(repoRoot, 'Sprites', 'monsters');
const KEEP = join(repoRoot, 'scripts', '_tmp_smithgolem_rolls');
const KEY = 'smithgolem';
const CANVAS = 1024;
const CHAR_FRAC = 0.624;                 // see the header
const CHAR_H = Math.round(CANVAS * CHAR_FRAC);
// Room BELOW the boots, and it has to be real. At 8px the first attack rolls
// drifted their feet 14-33px, because a frame whose hammer dips under the boots
// was being shoved upward to keep the hammer on-canvas - moving the golem
// instead of the hammer. That is affordable while the padding constant is in
// play (the renderer re-anchors each padded attack frame on its own content
// bottom) and NOT affordable once it is removed, because then every state is
// anchored from the static sprite and a drifting foot line simply bobs.
const FLOOR_MARGIN = 96;                 // px of canvas below the feet
const FRAMES = 9, ALPHA = 12;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const LOOK =
  'a chunky chibi STONE GOLEM blacksmith: a squat blocky body of pale grey carved stone with darker '
  + 'grey seams and chipped edges, a big rectangular stone head with two glowing red square eyes and no '
  + 'mouth, a round glowing red emblem set into its chest, short thick stone arms and stubby legs, and '
  + 'it holds a blacksmith HAMMER whose head is a cage of molten orange-red lava glowing through black '
  + 'iron. Bold dark outline, painted highlights, cute but heavy. Facing slightly to its RIGHT.';
const STYLE =
  ' 2D side-scrolling platformer game sprite, full body, standing on the ground, centred on a pure '
  + 'transparent background, alpha only. No scene, no ground plane, no shadow, no background, no frame, '
  + 'no border, no text. One single character.';

const STATES = {
  idle: {
    motion: 'The stone golem IDLES in place: it breathes with a slow heavy rock-and-settle, the molten '
      + 'hammer head pulses brighter and dimmer, its red eyes flicker, and a few embers drift off the '
      + 'hammer. It does NOT walk, step, turn or swing.',
    loop: true,
  },
  walk: {
    motion: 'The stone golem WALKS in place on a treadmill: its stubby stone legs take clear alternating '
      + 'steps, its body bobs heavily with each footfall, and the hammer swings gently at its side. It '
      + 'stays in the SAME spot and does not travel across the frame.',
    loop: true,
  },
  attack: {
    // Beat-by-beat. "Swing its hammer" gave frames where the hammer merged into
    // the body and one where it vanished entirely - the model needs told where
    // the hammer IS at each beat, not just that it moves.
    motion: 'A nine-beat HAMMER SMASH by the stone golem. Play these beats in order, and in EVERY frame '
      + 'the hammer must be clearly visible as a separate object held out away from the body, never '
      + 'overlapping or merging into the torso, and never disappearing: '
      + '(1) standing, hammer held low at its side. '
      + '(2) it lifts the hammer up and back, arm rising. '
      + '(3) hammer raised high above and behind its head, both arms up, body leaning back. '
      + '(4) the hammer starts down, arms coming forward. '
      + '(5) the hammer sweeps down in front of the body at chest height, clearly out to the side. '
      + '(6) IMPACT - the hammer head strikes the ground in front of its feet, a small burst of sparks '
      + 'at the point of contact only. '
      + '(7) hammer still down at the ground, sparks fading, body settling. '
      + '(8) it lifts the hammer back up to its side. '
      + '(9) standing again, hammer low at its side. '
      + 'The GOLEM BODY stays the same size and stays planted on its feet the whole way through - it is '
      + 'the arms and the hammer that travel, not the golem.',
    loop: false,
  },
};
const FRAMING =
  ' CRITICAL: the GOLEM stays exactly the same SIZE in every frame - no zoom, no camera push, it never '
  + 'grows or shrinks. It stays centred, its FEET STAY ON THE SAME LINE on the ground in every frame, '
  + 'and the hammer never leaves the frame. Same character, same colours, same art style, same left/'
  + 'right facing throughout. Never mirror or flip. Transparent background in every frame.';

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, border = 0, gx0 = w, gx1 = -1, gy0 = h, gy1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    // GREY STONE ONLY — the body. The lava hammer and its sparks are saturated
    // warm and must not decide how big the golem is; that confusion is what
    // made the old set look consistent when it was not.
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    if (sat > 0.22 || lum < 45 || lum > 235) continue;
    if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gy1) gy1 = y;
  }
  if (x1 < 0) return null;
  const body = gy1 < 0 ? { h: y1 - y0 + 1, x0, x1, y0, y1 } : { h: gy1 - gy0 + 1, x0: gx0, x1: gx1, y0: gy0, y1: gy1 };
  return { w, h, border, ink: { x0, y0, x1, y1 }, bodyH: body.h,
    bodyMidX: (body.x0 + body.x1) / 2, bodyBottom: body.y1, inkBottom: y1 };
}

// Place one frame on the shared canvas: body scaled to CHAR_H, body centred,
// FEET on the common floor line. Feet, not the ink bottom - a hammer that dips
// below the boots must not lift the golem off the ground.
// The body is CENTRED, not the ink: the renderer centres the canvas on the
// mob's foot position, so a body sitting off-centre would stand beside its own
// hitbox. The hammer is ~1.42x the body wide and hangs to one side, so with the
// body centred the ink can reach past an edge - it does on the old 768 base
// too, which clips 29px. So the scale is the SMALLER of "body at target" and
// "all ink inside the canvas", and whatever that costs in body fraction is
// reported so it can be handed back through _lxMobScale.
// Place one frame on the shared canvas: body scaled toward CHAR_H, body
// CENTRED, feet on the common floor line.
//
// The body is centred rather than the ink because the renderer centres the
// canvas on the mob's foot position - a body sitting off-centre would stand
// beside its own hitbox. The hammer is ~1.42x the body wide and hangs to one
// side, so at the ideal scale the ink can still reach past an edge.
//
// Rather than predict that (a first attempt guarded only ABOVE the feet and
// still clipped 284-349 px, because the hammer also dips BELOW them), the fit
// is VERIFIED: place, measure, shrink 2% and repeat until nothing touches an
// edge. Slower and certain, instead of clever and wrong.
async function place(buf) {
  const m = await measure(buf);
  let s = CHAR_H / m.bodyH;
  for (let guard = 0; guard < 40; guard++) {
    const out = await compose(buf, m, s);
    const om = await measure(out);
    if (om.border === 0) { place.lastFrac = om.bodyH / CANVAS; return out; }
    s *= 0.98;
  }
  const out = await compose(buf, m, s);
  place.lastFrac = (await measure(out)).bodyH / CANVAS;
  return out;
}

async function compose(buf, m, s) {
  const sw = Math.max(1, Math.round(m.w * s)), sh = Math.max(1, Math.round(m.h * s));
  const scaled = await sharp(buf).ensureAlpha().resize(sw, sh, { fit: 'fill' }).png().toBuffer();
  const sm = await measure(scaled);
  const left = Math.round(CANVAS / 2 - sm.bodyMidX);
  // Floor line from the BODY's feet, and NOTHING moves it. If the hammer
  // reaches below the boots it uses the floor margin above; if it needs more
  // than that, place() shrinks the whole frame rather than lifting the golem.
  const top = Math.round((CANVAS - 1 - FLOOR_MARGIN) - sm.bodyBottom);
  const cropL = Math.max(0, -left), cropT = Math.max(0, -top);
  const availW = Math.min(sw - cropL, CANVAS - Math.max(0, left));
  const availH = Math.min(sh - cropT, CANVAS - Math.max(0, top));
  const piece = await sharp(scaled)
    .extract({ left: cropL, top: cropT, width: Math.max(1, availW), height: Math.max(1, availH) }).png().toBuffer();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }])
    .webp({ quality: 94 }).toBuffer();
}

// PER-FRAME NORMALISE, THEN ONE GLOBAL SHRINK.
//
// Two wrong versions preceded this one and both are worth recording.
//
//   Fitting each frame independently gets every body to the same height, but
//   the clip check then shrinks whichever frames swing the hammer widest - so
//   the golem came out smallest exactly when it swung hardest. 1.055x of
//   residual swing, self-inflicted.
//
//   Giving the whole set ONE scale removes that, and exposes what it had been
//   hiding: the model's own frames vary 1.24x in body size. A single scale
//   cannot fix a set that is not uniform - the same lesson the padding constant
//   taught, one layer down.
//
// So: normalise each frame's BODY to CHAR_H (kills the model's variation), then
// find the ONE factor g <= 1 that lets every frame fit, and apply it to all of
// them. Bodies stay equal because g is shared; nothing clips because g is
// chosen against the worst frame.
async function placeSet(bufs) {
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));
  const per = ms.map((m) => CHAR_H / m.bodyH);        // equalises the bodies
  let g = 1;
  for (let guard = 0; guard < 40; guard++) {
    let worst = 0;
    for (let i = 0; i < bufs.length; i++) {
      const om = await measure(await compose(bufs[i], ms[i], per[i] * g));
      if (om.border > worst) worst = om.border;
    }
    if (!worst) break;
    g *= 0.98;
  }
  const out = [];
  for (let i = 0; i < bufs.length; i++) out.push(await compose(bufs[i], ms[i], per[i] * g));
  placeSet.lastG = g;
  return out;
}

async function report(label, bufs) {
  const ms = [];
  for (const b of bufs) ms.push(await measure(b));
  const H = ms.map((m) => m.bodyH);
  const feet = ms.map((m) => m.bodyBottom);
  const swing = Math.max(...H) / Math.min(...H);
  const border = ms.reduce((a, m) => a + m.border, 0);
  const footSpread = Math.max(...feet) - Math.min(...feet);
  const frac = (Math.max(...H) / ms[0].h);
  console.log(`  ${label.padEnd(9)} canvas ${ms[0].w}x${ms[0].h}  body ${Math.min(...H)}..${Math.max(...H)} (${(frac * 100).toFixed(1)}% of canvas)  swing ${swing.toFixed(3)}x  feet ${footSpread}px  clipped ${border}`);
  return { swing, border, footSpread, ok: swing <= 1.05 && border === 0 && footSpread <= 8 };
}

if (has('--check')) {
  const out = [];
  const basePath = join(MOB, `${KEY}.webp`);
  if (existsSync(basePath)) out.push(await report('base', [await readFile(basePath)]));
  for (const st of ['idle', 'walk', 'attack']) {
    const bufs = [];
    for (let i = 0; i < FRAMES; i++) {
      const p = join(MOB, st, `${KEY}_${i}.webp`);
      if (existsSync(p)) bufs.push(await readFile(p));
    }
    if (bufs.length) out.push(await report(st, bufs));
  }
  process.exit(out.every((r) => r.ok) ? 0 : 1);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());
await mkdir(KEEP, { recursive: true });

// ---- re-place a saved base roll, no credits spent ---------------------------
if (has('--bake-base')) {
  const n = arg('--bake-base');
  const raw = await readFile(join(KEEP, `base_r${n}.png`));
  await writeFile(join(MOB, `${KEY}.webp`), await place(raw));
  const frac = place.lastFrac;
  console.log(`baked base roll ${n}`);
  await report('base', [await readFile(join(MOB, `${KEY}.webp`))]);
  // What the mob scale must become so the golem keeps its on-screen size:
  //   achievedFrac x 1.20 x mobScale  ==  0.7487 x 1.00
  console.log(`  body landed at ${(frac * 100).toFixed(1)}% of canvas`);
  console.log(`  => _lxMobScale('smithgolem') should be ${(0.7487 / (frac * 1.20)).toFixed(4)} to keep the drawn size unchanged`);
  process.exit(0);
}

// ---- the base sprite --------------------------------------------------------
if (has('--base')) {
  const ROLLS = Number(arg('--rolls') || 4);
  let best = null;
  for (let r = 1; r <= ROLLS; r++) {
    process.stdout.write(`base roll ${r}/${ROLLS} ... `);
    let raw;
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: hdr, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Hand-Painted', perspective: 'Side-Scroll',
          aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: LOOK + STYLE }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const d = await res.json();
      const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      raw = await fetchBuf(url);
    } catch (e) { console.log('FAIL ' + e.message); continue; }
    await writeFile(join(KEEP, `base_r${r}.png`), raw);
    const m = await measure(raw);
    // The body must be findable as grey stone, and be a real share of the art.
    const greyShare = m.bodyH / (m.ink.y1 - m.ink.y0 + 1);
    console.log(`body ${m.bodyH}px, grey share ${(greyShare * 100).toFixed(0)}%`);
    if (greyShare < 0.55) { console.log('  gated: too little of it reads as stone'); continue; }
    if (!best || greyShare > best.greyShare) best = { raw, greyShare };
  }
  if (!best) { console.error('no usable base — re-run'); process.exit(2); }
  await writeFile(join(MOB, `${KEY}.webp`), await place(best.raw));
  console.log('wrote base');
  await report('base', [await readFile(join(MOB, `${KEY}.webp`))]);
  process.exit(0);
}

// ---- re-place saved state rolls, no credits spent ---------------------------
if (has('--bake-state')) {
  const st = arg('--bake-state'), n = arg('--roll') || '1';
  const raws = [];
  for (let i = 0; i < FRAMES; i++) raws.push(await readFile(join(KEEP, `${st}_r${n}_${i}.png`)));
  const placed = await placeSet(raws);
  const g = await report(`${st} r${n}`, placed);
  if (!g.ok && !has('--force')) { console.error('  gated — not written'); process.exit(2); }
  await mkdir(join(MOB, st), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(MOB, st, `${KEY}_${i}.webp`), placed[i]);
  console.log('  written');
  process.exit(0);
}

// ---- the three animation sets ----------------------------------------------
const want = (arg('--states') || 'idle,walk,attack').split(',').map((x) => x.trim()).filter(Boolean);
const baseBuf = await readFile(join(MOB, `${KEY}.webp`));
// Pad on the way out: frame_size:-9 carries the margin into every returned
// frame, so the hammer has somewhere to go instead of the canvas edge.
const PAD = Number(arg('--pad') || 0.16);
const padded = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(baseBuf).resize(Math.round(CANVAS * (1 - 2 * PAD)), Math.round(CANVAS * (1 - 2 * PAD)), { fit: 'inside' }).png().toBuffer(), gravity: 'centre' }])
  .png().toBuffer();
const uri = 'data:image/png;base64,'
  + (await sharp(padded).resize(940, 940, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');

const ROLLS = Number(arg('--rolls') || 3);
for (const st of want) {
  const cfg = STATES[st];
  let best = null;
  for (let r = 1; r <= ROLLS; r++) {
    process.stdout.write(`${st} roll ${r}/${ROLLS} ... `);
    let bufs;
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: cfg.motion + FRAMING, frames: FRAMES,
          frame_size: -9, model: 'eagle', individual_frames: true, loop: cfg.loop, image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
      const d = await res.json();
      const urls = d.individual_frame_urls || [];
      if (urls.length < FRAMES) throw new Error(`got ${urls.length} frames`);
      bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
    } catch (e) { console.log('FAIL ' + e.message); continue; }
    for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, `${st}_r${r}_${i}.png`), bufs[i]);
    const placed = await placeSet(bufs);
    const g = await report(`${st} r${r}`, placed);
    if (!g.ok) { console.log('    gated'); continue; }
    if (!best) best = { placed, g };
  }
  if (!best) { console.error(`${st}: no clean roll`); continue; }
  await mkdir(join(MOB, st), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(MOB, st, `${KEY}_${i}.webp`), best.placed[i]);
  console.log(`  wrote ${st}`);
}
