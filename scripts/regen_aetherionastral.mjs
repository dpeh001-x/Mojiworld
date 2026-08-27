#!/usr/bin/env node
// Regenerate Aetherion's ASTRAL JUDGEMENT set from his own walk frame.
// ============================================================================
// Per user: "regenerate the aetherionastral sprite sequence starting with
// aetherion_5 walking as the 1st frame".
//
// WHY THE SEED MATTERS. The shipped set is off-model: a paler, thinner, upright
// dragon that does not read as the crystalline white-and-gold quadruped every
// other Aetherion state draws. Seeding from Sprites/bosses/walk/aetherion_5
// makes the cast the same creature as the walk it interrupts.
//
// TWO HARD CONSTRAINTS, both from the engine rather than taste:
//
//   1. THE DETONATION MUST PEAK AT FRAME 4. _AE_ASTRAL_BURST = 4 splits the set
//      across the 1500 ms telegraph: frames 0-4 are the wind-up and the damage
//      resolves exactly as 4 lands, then 5-8 dissipate over 420 ms. The game's
//      own comment says the constant was "READ OFF THE ART" and that when the
//      art was last regenerated the constant had to move with it, "or the spell
//      would visually die two frames before it landed". So this script MEASURES
//      the violet peak after baking (--check) instead of assuming it.
//
//   2. NO PER-FRAME NORMALISATION IS AVAILABLE. Aetherion is in
//      _BOSS_FRAME_TRUST, so his frames are drawn EXACTLY as authored - no
//      content-norm, constant box, static-bbox anchor. Whatever size and foot
//      drift the model produces ships straight to the screen. Hence: one
//      uniform scale for the whole set (never per-frame, which would cancel the
//      rear-up), plus per-frame foot alignment so he cannot slide vertically.
//
// MEASURING THE DRAGON, NOT THE SPELL. Unlike the Sauro lizards - orange
// creature, orange fire, no way to separate them - this pairs a white/gold
// dragon with a violet spell. So the body is measurable: drop violet pixels
// (blue and red both clearly above green) and what is left is Aetherion.
//
//   node scripts/regen_aetherionastral.mjs --rolls 3
//   node scripts/regen_aetherionastral.mjs --bake --roll 2
//   node scripts/regen_aetherionastral.mjs --check
// ============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(root, 'Sprites', 'bosses');
const KEEP = join(root, 'scripts', '_tmp_astral_rolls');
const KEY = 'aetherionastral';
const SEED = join(B, 'walk', 'aetherion_5.webp');
const FRAMES = 9;
const ALPHA = 8;
const CANVAS_W = 1656, CANVAS_H = 1325;
// FEET AS LOW AS THE ART ALLOWS, computed per set rather than fixed.
// aetherion_astral_test states the convention — "feet ON the bottom row = the
// anchor convention" — and the static aetherion.webp that FRAME_TRUST anchors
// this set against is flush at 1324. But planting the feet ON 1324 clipped
// 263px: the violet spiral wraps the dragon and hangs BELOW his feet, and that
// overhang has to live somewhere. So the floor is chosen as the lowest row that
// still fits every frame's spell tail, which is 1324 when nothing hangs below
// and drops only by however much does.
const FOOT_ROW_MAX = CANVAS_H - 1;
const BURST = 5;                // _AE_ASTRAL_BURST — the frame the damage lands on (moved 4->5 with this art)

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i < 0 ? null : argv[i + 1]; };

// Per user, after the first set: "not good, the frames can be smoother".
// The first brief described the beats but not the SPACING between them, and the
// model duly jumped: frames 1-3 barely moved, then 3->4 teleported into a fully
// formed spiral. Every frame now gets an explicit "a little further than the
// last" instruction, and the smoothness gate below refuses a set that lurches.
const MOTION =
  'A crystalline white-and-gold dragon casts an astral spell, animated as ONE '
  + 'CONTINUOUS SMOOTH MOTION. Every frame must be a SMALL, EVEN step further '
  + 'along than the frame before it - no frame may jump or teleport, and no two '
  + 'consecutive frames may look nearly identical. Think of it as tracing a '
  + 'single unbroken movement at a steady speed. '
  + 'FRAME 1: the dragon on all fours in its walking pose. '
  + 'FRAME 2: it begins to settle its weight back, head lifting slightly, and the '
  + 'faintest violet glow appears in the air around it. '
  + 'FRAME 3: weight further back, chest rising, wings starting to open, and the '
  + 'glow has drawn into a wide, thin violet-and-gold ring. '
  + 'FRAME 4: reared further, wings wider, the ring noticeably smaller and '
  + 'brighter as it spirals INWARD. '
  + 'FRAME 5: fully reared, wings spread, the ring now a tight blazing coil '
  + 'pulled in close against the dragon. '
  + 'FRAME 6: THE DETONATION, the biggest and brightest moment of the sequence - '
  + 'the coil bursts outward into a huge violet-and-gold flare at its widest. '
  + 'FRAME 7: the flare has expanded further and begun to thin, streaming away. '
  + 'FRAME 8: only scattered violet wisps remain, the dragon lowering. '
  + 'FRAME 9: the wisps are almost gone and the dragon has settled back onto all '
  + 'fours, close to its FRAME 1 pose. '
  + 'THE DRAGON ITSELF stays exactly the same size throughout and its feet stay '
  + 'on the same ground line - only its pose and the spell change.';

const FRAMING = ' The camera is LOCKED: identical framing, identical zoom and '
  + 'identical dragon size in every frame. Do not zoom, pan, crop or rescale the '
  + 'dragon. Keep it facing the same direction throughout. Hand-painted 2D game '
  + 'sprite, side-scroller side view, fully transparent background, no ground '
  + 'shadow, no floor, no scenery, no text.';

// ---- measurement ------------------------------------------------------------
// Violet is the SPELL; everything else opaque is the dragon.
const isViolet = (r, g, b) => (b > g + 24 && r > g + 12) || (b > 110 && b > g + 40);

async function scan(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let ix0 = w, ix1 = -1, iy0 = h, iy1 = -1;          // all ink
  let dx0 = w, dx1 = -1, dy0 = h, dy1 = -1;          // dragon only
  let violet = 0, body = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= ALPHA) continue;
    if (x < ix0) ix0 = x; if (x > ix1) ix1 = x;
    if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
    if (isViolet(data[i], data[i + 1], data[i + 2])) { violet++; continue; }
    body++;
    if (x < dx0) dx0 = x; if (x > dx1) dx1 = x;
    if (y < dy0) dy0 = y; if (y > dy1) dy1 = y;
  }
  if (ix1 < 0) return null;
  return { w, h, ink: { x0: ix0, x1: ix1, y0: iy0, y1: iy1 },
    dragon: dx1 < 0 ? null : { x0: dx0, x1: dx1, y0: dy0, y1: dy1, h: dy1 - dy0 + 1, w: dx1 - dx0 + 1 },
    violet, body };
}

// ---- placement ---------------------------------------------------------------
// ONE scale for the whole set, then per-frame FOOT alignment.
//
// Per-frame size normalisation is deliberately NOT used. It was right for the
// smith golem, whose raw frames varied 1.24x and whose grey stone could be
// isolated from its lava; it is wrong for a cast that goes from a standing
// quadruped to a reared detonation, because the dragon's ink height changes for
// real and "correcting" it would flatten the very motion being animated. One
// scale keeps him a single size; aligning his own bottom row stops him sliding.
async function placeSet(raws) {
  const ms = [];
  for (const r of raws) { const m = await scan(r); if (!m || !m.dragon) return null; ms.push(m); }
  const seedM = await scan(await readFile(SEED));
  const target = seedM.dragon.h;                    // match the walk frame he comes from
  const hs = ms.map((m) => m.dragon.h).slice().sort((a, b) => a - b);
  const med = hs[hs.length >> 1];                   // median, so one wild frame cannot size the set
  let g = target / med;
  for (const m of ms) {                             // shrink further if any frame's INK would clip
    const iw = (m.ink.x1 - m.ink.x0 + 1) * g, ih = (m.ink.y1 - m.ink.y0 + 1) * g;
    if (iw > CANVAS_W - 8) g *= (CANVAS_W - 8) / iw;
    if (ih > CANVAS_H - 8) g *= (CANVAS_H - 8) / ih;
  }
  // How far below the feet does the spell reach, at its worst across the set?
  // The floor drops by exactly that, and no further.
  let overhang = 0;
  for (const m of ms) overhang = Math.max(overhang, (m.ink.y1 - m.dragon.y1) * g);
  const FOOT_ROW = Math.round(FOOT_ROW_MAX - overhang);

  if (g > 1.25) console.log('    NOTE: placing at ' + g.toFixed(2) + 'x — upscaling blurs; seed the model larger');
  else console.log('    placement scale ' + g.toFixed(3) + 'x');
  const out = [];
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const iw = m.ink.x1 - m.ink.x0 + 1, ih = m.ink.y1 - m.ink.y0 + 1;
    const nw = Math.max(1, Math.round(iw * g)), nh = Math.max(1, Math.round(ih * g));
    const cropped = await sharp(raws[i]).extract({ left: m.ink.x0, top: m.ink.y0, width: iw, height: ih })
      .resize(nw, nh, { fit: 'fill' }).png().toBuffer();
    // The DRAGON's bottom lands on FOOT_ROW; the spell hangs into the margin.
    const dragonBottomInCrop = (m.dragon.y1 - m.ink.y0) * g;
    const top = Math.round(FOOT_ROW - dragonBottomInCrop);
    const dragonCx = ((m.dragon.x0 + m.dragon.x1) / 2 - m.ink.x0) * g;
    const left = Math.round(CANVAS_W / 2 - dragonCx);
    out.push(await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: Math.max(0, Math.min(CANVAS_W - nw, left)), top: Math.max(0, Math.min(CANVAS_H - nh, top)) }])
      .webp({ quality: 94 }).toBuffer());
  }
  return out;
}

// TOP, LEFT and RIGHT only. The BOTTOM row is deliberately excluded: ink there
// is the anchor convention this set is supposed to follow ("feet ON the bottom
// row"), not damage. Counting it rejected four consecutive rolls for doing the
// right thing — 241 to 373 "clipped" pixels that were the dragon's feet and the
// spell's tail sitting exactly where they belong.
async function borderPx(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let n = 0;
  for (let x = 0; x < w; x++) if (data[x * c + 3] > ALPHA) n++;                       // top
  for (let y = 0; y < h; y++) {
    if (data[(y * w) * c + 3] > ALPHA) n++;                                           // left
    if (data[(y * w + w - 1) * c + 3] > ALPHA) n++;                                   // right
  }
  return n;
}

async function report(label, bufs) {
  const ms = [];
  for (const b of bufs) ms.push(await scan(b));
  const dh = ms.map((m) => m.dragon.h), feet = ms.map((m) => m.dragon.y1);
  const violet = ms.map((m) => m.violet);
  const footSpread = Math.max(...feet) - Math.min(...feet);
  const peak = violet.indexOf(Math.max(...violet));

  // SETTLED frames only. A swing measured across all nine conflates two things
  // that must not be gated together: the dragon REARING UP mid-cast, which is
  // the animation and is wanted, and the dragon changing SIZE, which is not.
  // Measured across the whole set the first roll read 1.568x - frames 2-5 at
  // ~215px against ~176px at rest - and every roll would have been rejected for
  // animating. Frames 0, 1 and 8 are the same settled quadruped pose before and
  // after the spell, so a difference between THEM is scale and nothing else.
  // (The opaque-core mask does not rescue the whole-set number either: it only
  // brings 1.568x to 1.329x, because the rear-up is real in both.)
  const SETTLED = [0, 1, FRAMES - 1];
  const sh = SETTLED.map((i) => dh[i]);
  const swing = Math.max(...sh) / Math.min(...sh);
  let clipped = 0;
  for (const b of bufs) clipped += await borderPx(b);

  // SMOOTHNESS, per user: "the frames can be smoother". Measured as the change
  // between CONSECUTIVE frames — the fraction of pixels whose alpha flips — and
  // reported as the worst step over the median step. An animation reads as
  // smooth when every frame is a similar-sized increment on the last; it reads
  // as juddery when one pair barely moves and the next teleports. So the number
  // that matters is the RATIO, not the raw difference: a fast animation can be
  // perfectly smooth, and a slow one can still lurch.
  // On the DRAGON only. A first version differenced every pixel and the spell
  // swamped it: a flare doubling in size changes far more pixels than the
  // dragon ever does, so the number described the spell's growth curve and
  // called it judder. The dragon mask is what the eye actually tracks for
  // smooth motion, so the violet is dropped from both frames before comparing.
  const raw = [];
  for (const b of bufs) raw.push((await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data);
  const dragonMask = (d) => {
    const m = new Uint8Array(d.length / 4);
    for (let p = 0, q = 0; p < d.length; p += 4, q++) {
      m[q] = (d[p + 3] > 64 && !isViolet(d[p], d[p + 1], d[p + 2])) ? 1 : 0;
    }
    return m;
  };
  const masks = raw.map(dragonMask);
  const steps = [];
  for (let i = 1; i < masks.length; i++) {
    let diff = 0;
    for (let q = 0; q < masks[i].length; q++) if (masks[i - 1][q] !== masks[i][q]) diff++;
    steps.push(diff);
  }
  const sorted = steps.slice().sort((a, b) => a - b);
  const medStep = sorted[sorted.length >> 1] || 1;
  const judder = Math.max(...steps) / Math.max(1, Math.min(...steps));
  // 6x was too loose to mean anything: the first three rolls measured 2.5x,
  // 3.6x and 4.4x and the user rejected the 2.5x one by eye. 3.0x is the number
  // that separates the sets that read as one motion from the sets that lurch.
  const ok = swing <= 1.10 && footSpread <= 10 && clipped === 0 && judder <= 3.0;
  console.log('    ' + label + ': settled swing ' + swing.toFixed(3) + 'x  feet ' + footSpread
    + 'px  clipped ' + clipped + 'px  violet peak f' + peak + (peak === BURST ? '' : ' (constant says ' + BURST + ')')
    + '  JUDDER ' + judder.toFixed(1) + 'x');
  console.log('      dragon h per frame:  ' + dh.join(', '));
  console.log('      violet px per frame: ' + violet.join(', '));
  console.log('      pixels changed per step: ' + steps.join(', ') + '   (median ' + medStep + ')');
  return { ok, swing, footSpread, clipped, peak, violet, judder, steps };
}

// ---- --check ------------------------------------------------------------------
if (has('--check')) {
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) {
    const p = join(B, 'attack', KEY + '_' + i + '.webp');
    if (existsSync(p)) bufs.push(await readFile(p));
  }
  if (bufs.length < FRAMES) { console.error('only ' + bufs.length + ' frames on disk'); process.exit(1); }
  const g = await report('on disk', bufs);
  console.log('\n  _AE_ASTRAL_BURST is ' + BURST + '; this art peaks at ' + g.peak + '.');
  if (g.peak !== BURST) console.log('  => the constant must become ' + g.peak + ', or the spell dies before it lands.');
  process.exit(g.ok ? 0 : 1);
}

// ---- generation ----------------------------------------------------------------
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const hdr = { Authorization: 'ApiKey ' + apiKey, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(180000) })).arrayBuffer());
await mkdir(KEEP, { recursive: true });

if (has('--bake')) {
  const n = arg('--roll') || '1';
  const raws = [];
  for (let i = 0; i < FRAMES; i++) raws.push(await readFile(join(KEEP, 'r' + n + '_' + i + '.png')));
  const placed = await placeSet(raws);
  if (!placed) { console.error('  a frame had no dragon in it'); process.exit(2); }
  const g = await report('roll ' + n, placed);
  if (!g.ok && !has('--force')) { console.error('  gated — not written (--force to override)'); process.exit(2); }
  await mkdir(join(B, 'attack'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) await writeFile(join(B, 'attack', KEY + '_' + i + '.webp'), placed[i]);
  console.log('  written');
  process.exit(0);
}

// SPEND THE MEGAPIXEL ON THE DRAGON.
//
// The first version composited the whole 1656x1325 plate onto a padded canvas
// and then shrank it to 940 wide, which reduced the dragon TWICE. He came back
// 199px tall inside a 752px frame - 26% of the resolution being paid for - and
// getting him to his authored 680px then meant a 3.42x upscale. That is the
// blur the user reported: measured edge energy 10.9-21.4 against 23.4 for the
// seed he was made from and 34.2 for the idle frames beside him.
//
// frame_size:-9 (True Size) returns frames at the source's own dimensions and
// refuses anything over 1 megapixel, so the budget is fixed at ~1e6 px. Spend
// it on the subject: crop to the dragon's own ink, add a margin for the spell
// to occupy, and fill the megapixel with THAT. The dragon now comes back near
// his final size, so the placement scale lands close to 1.0 and no upscale blur
// is introduced at all.
const seedBuf = await readFile(SEED);
const MARGIN = Number(arg('--margin') || 0.30);   // room around the dragon for the spell
const sm = await scan(seedBuf);
const iw = sm.ink.x1 - sm.ink.x0 + 1, ih = sm.ink.y1 - sm.ink.y0 + 1;
let boxW = Math.round(iw * (1 + 2 * MARGIN)), boxH = Math.round(ih * (1 + 2 * MARGIN));
const MP = 999000;                                 // stay under the API's 1 MP ceiling
if (boxW * boxH > MP) { const k = Math.sqrt(MP / (boxW * boxH)); boxW = Math.floor(boxW * k); boxH = Math.floor(boxH * k); }
const fit = Math.min(boxW / (iw * (1 + 2 * MARGIN)), boxH / (ih * (1 + 2 * MARGIN)));
const cropped = await sharp(seedBuf)
  .extract({ left: sm.ink.x0, top: sm.ink.y0, width: iw, height: ih })
  .resize(Math.max(1, Math.round(iw * fit)), Math.max(1, Math.round(ih * fit)), { fit: 'fill' })
  .png().toBuffer();
const seedImg = await sharp({ create: { width: boxW, height: boxH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: cropped, gravity: 'centre' }]).png().toBuffer();
console.log('seed: dragon ' + iw + 'x' + ih + ' -> sent at ' + boxW + 'x' + boxH
  + ' (' + ((boxW * boxH) / 1e6).toFixed(2) + ' MP, dragon fills '
  + ((ih * fit / boxH) * 100).toFixed(0) + '% of frame height)');
const uri = 'data:image/png;base64,' + seedImg.toString('base64');

const ROLLS = Number(arg('--rolls') || 3);
let best = null;
for (let r = 1; r <= ROLLS; r++) {
  process.stdout.write('astral roll ' + r + '/' + ROLLS + ' ... ');
  let bufs;
  try {
    const res = await fetch(API + '/assets/sprite/animate', {
      method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION + FRAMING,
        frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true,
        loop: false, image_type: 'sprite' }),
    });
    if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160));
    const d = await res.json();
    const urls = d.individual_frame_urls || [];
    if (urls.length < FRAMES) throw new Error('got ' + urls.length + ' frames');
    bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
  } catch (e) { console.log('FAIL ' + e.message); continue; }
  console.log('ok');
  for (let i = 0; i < bufs.length; i++) await writeFile(join(KEEP, 'r' + r + '_' + i + '.png'), bufs[i]);
  const placed = await placeSet(bufs);
  if (!placed) { console.log('    a frame had no dragon in it'); continue; }
  const g = await report('roll ' + r, placed);
  if (!g.ok) { console.log('    gated'); continue; }
  if (!best || g.swing < best.g.swing) best = { placed, g, r };
}
if (!best) { console.error('no clean roll — re-run, or --bake --roll N --force'); process.exit(2); }
await mkdir(join(B, 'attack'), { recursive: true });
for (let i = 0; i < FRAMES; i++) await writeFile(join(B, 'attack', KEY + '_' + i + '.webp'), best.placed[i]);
console.log('  wrote the set from roll ' + best.r);
