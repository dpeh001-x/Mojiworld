#!/usr/bin/env node
// Grand Hex's SEEKING EYE orb — base sprite + 9-frame loop (ludo.ai).
//   -> Sprites/projectiles/p_hexmaster_hexorb.webp
//      Sprites/projectiles/anim/p_hexmaster_hexorb_0..8.webp
//
//   node scripts/gen_hexorb_ward.mjs --rolls 4 --generate     # base, best of N
//   node scripts/gen_hexorb_ward.mjs --anim                   # the loop, from the base
//   node scripts/gen_hexorb_ward.mjs --check                  # grade what shipped
//   node scripts/gen_hexorb_ward.mjs --bake 2                 # ship a saved roll
//
// The gate that matters is NOT "is this a nice orb". The Hexmaster already
// owns an orb — p_ult_hexorb, Pandemic Hex's black void sphere in green plague
// flame — and the failure mode of asking a model for "a hex orb" is getting
// that one back. Two orbs on one class that read the same is worse than no new
// art, because the player learns nothing from seeing it.
//
// So hueDistance() below measures a candidate against the hue histogram of
// EVERY orb the game already owns and rejects anything too close. There are two
// of them: the Pandemic orb, and — once the palette went blue-with-a-green-
// tinge per user — the necromancer's teal Soul Ward flame, which that palette
// passes right next to. The intended read is a seeking eye: a cobalt iris
// ringed by turning hex runes, trailing green venom wisps. Different silhouette
// (ringed, not flame-wreathed), different dominant hue, same class.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const ANIM = join(DIR, 'anim');
const KEY = 'p_hexmaster_hexorb';
const OUT = join(DIR, KEY + '.webp');
const RIVAL_PANDEMIC = join(DIR, 'p_ult_hexorb.webp');            // Pandemic Hex's void orb
const RIVAL_SOULORB  = join(DIR, 'p_necromancer_soulorb.webp');   // the necromancer's teal soul-flame
const KEEP = join(repoRoot, 'scripts', '_tmp_hexorb_rolls');
const BASE_SIZE = 256, ANIM_SIZE = 768, FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PROMPT =
  'a SEEKING HEX EYE orb: a round floating sapphire eyeball-sigil, its iris a deep glowing cobalt BLUE '
  + 'with a narrow vertical slit pupil of black, set in a pale ice-blue sclera veined with faint azure. '
  + 'A thin ring of angular glowing blue hex runes floats around it like a halo, and a few wisps of '
  + 'toxic green venom curl off its lower edge with two or three small green ember flecks drifting '
  + 'nearby. Predominantly BLUE - cobalt, sapphire and azure - with a slight green tinge only in the '
  + 'wisps, the flecks and a faint green rim-light on the lower edge.';
const OUTLINE =
  ' Epic painterly fantasy game sprite for a 2D side-scrolling platformer, a single ROUND object '
  + 'centred on a pure transparent background, alpha only, no scene, no ground, no character, no '
  + 'background, no frame and no border. Bold uniform dark outline around the silhouette. It must be '
  + 'ROUGHLY CIRCULAR overall, not a bolt, arrow, blade or elongated shape. NOT a black void sphere, '
  + 'NOT wreathed in flame, and NOT purple or violet - the body is a BLUE eye. Not a teal or turquoise '
  + 'flame wisp either: a solid blue eye with a rune halo.';

const MOTION =
  'The hex eye SEEKS: the ring of blue runes turns slowly around the eye, the slit pupil narrows and '
  + 'widens as if focusing and flicks its gaze slightly, the azure veins in the sclera pulse, and the '
  + 'green venom wisps curl and re-form while the ember flecks drift. '
  + 'CRITICAL - DO NOT ROTATE THE ORB: the eye itself must not spin, tumble or revolve as a whole; its '
  + 'orientation is identical in every frame. Only the rune ring turns and the details inside move. '
  + 'CRITICAL - LOCKED FRAMING: perfectly centred, the exact same size, position and scale in every '
  + 'frame; no zoom, pan, crop, rescale, drift, wobble, mirror or flip. '
  + 'CRITICAL - SEAMLESS LOOP: the last frame flows continuously back into the first with no pop. '
  + 'Keep the exact same art style, blue-dominant palette with its slight green tinge, thick dark '
  + 'outline and fully transparent background in every frame.';

const ALPHA = 12;
const ASPECT_LO = 0.78, ASPECT_HI = 1.28;   // a ward orb is round; a bolt is not
const MIN_BLUE = 0.40;                      // of saturated ink — the body is blue
const MAX_VIOLET = 0.30;                    // ...not the purple it started as
// Blue-with-a-green-tinge lives one hue band away from TEAL, and teal is
// exactly what the Soul Ward orb already is. Capping the teal band is what
// keeps "slightly green blue" from sliding into "the necromancer's orb again".
const MAX_TEAL = 0.28;
// The venom accent only has to EXIST. 0.05 was a guess and it was wrong in the
// most self-defeating way available: the prompt asks for a violet orb with
// green only in the wisps, and then the gate rejected five straight rolls for
// being a violet orb with green only in the wisps (measured 2-4%). Every one of
// them showed the green flecks clearly at a glance. 0.015 is calibrated to what
// a visible accent actually measures, and still fails a roll that dropped the
// venom entirely.
const MIN_GREEN = 0.015;
const MAX_WARM = 0.14;                      // no fire orbs
const MIN_RIVAL_DIST = 0.30;                // hue-histogram distance from p_ult_hexorb

// A 36-bin hue histogram over saturated ink, L1-normalised.
function hueHist(data, w, h, c, box) {
  const bins = new Array(36).fill(0);
  let n = 0;
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= 90) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0 || (mx - mn) / mx < 0.22) continue;
    let hue;
    if (mx === r) hue = 60 * (((g - b) / (mx - mn)) % 6);
    else if (mx === g) hue = 60 * ((b - r) / (mx - mn) + 2);
    else hue = 60 * ((r - g) / (mx - mn) + 4);
    if (hue < 0) hue += 360;
    bins[Math.min(35, Math.floor(hue / 10))]++;
    n++;
  }
  return { bins: bins.map((v) => (n ? v / n : 0)), n };
}

async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const box = { x0, y0, x1, y1 };
  const hh = hueHist(data, w, h, c, box);
  const band = (lo, hi) => hh.bins.slice(lo / 10, hi / 10).reduce((s, v) => s + v, 0);
  return { w, h, bw: x1 - x0 + 1, bh: y1 - y0 + 1, aspect: (x1 - x0 + 1) / (y1 - y0 + 1),
    hist: hh.bins, satPx: hh.n,
    blue: band(200, 260), violet: band(270, 330), teal: band(160, 200),
    green: band(80, 160), warm: band(0, 60) + band(340, 360) };
}

// L1 / 2 -> 0 (identical) .. 1 (no shared hue at all).
function hueDistance(a, b) {
  let s = 0;
  for (let i = 0; i < 36; i++) s += Math.abs(a[i] - b[i]);
  return s / 2;
}

const _rivalCache = {};
async function rivalHist(path) {
  if (_rivalCache[path] !== undefined) return _rivalCache[path];
  _rivalCache[path] = existsSync(path) ? (await measure(await readFile(path))).hist : null;
  return _rivalCache[path];
}

async function grade(m) {
  if (!m) return { ok: false, why: 'empty' };
  const f = [];
  if (m.aspect < ASPECT_LO || m.aspect > ASPECT_HI) f.push(`aspect ${m.aspect.toFixed(2)} outside ${ASPECT_LO}-${ASPECT_HI} (not round)`);
  if (m.blue < MIN_BLUE) f.push(`blue ${(m.blue * 100).toFixed(0)}%<${MIN_BLUE * 100}%`);
  if (m.violet > MAX_VIOLET) f.push(`violet ${(m.violet * 100).toFixed(0)}%>${MAX_VIOLET * 100}%`);
  if (m.teal > MAX_TEAL) f.push(`teal ${(m.teal * 100).toFixed(0)}%>${MAX_TEAL * 100}% (drifting toward the Soul Ward orb)`);
  if (m.green < MIN_GREEN) f.push(`green ${(m.green * 100).toFixed(0)}%<${MIN_GREEN * 100}%`);
  if (m.warm > MAX_WARM) f.push(`warm ${(m.warm * 100).toFixed(0)}%>${MAX_WARM * 100}%`);
  // Distance from BOTH orbs the game already owns. The Pandemic orb was always
  // the risk; going blue-with-green makes the Soul Ward orb one too.
  const dPan = await rivalHist(RIVAL_PANDEMIC), dSoul = await rivalHist(RIVAL_SOULORB);
  const dist = dPan ? hueDistance(m.hist, dPan) : 1;
  const distSoul = dSoul ? hueDistance(m.hist, dSoul) : 1;
  if (dist < MIN_RIVAL_DIST) f.push(`too close to p_ult_hexorb (hue distance ${dist.toFixed(2)}<${MIN_RIVAL_DIST})`);
  if (distSoul < MIN_RIVAL_DIST) f.push(`too close to p_necromancer_soulorb (hue distance ${distSoul.toFixed(2)}<${MIN_RIVAL_DIST})`);
  return { ok: !f.length, why: f.join(', '), dist, distSoul };
}

// Centre the content with margin. No rotation to survive here (the ward draws
// the orb upright, per the v0.30.1 rule), but the 40px blit must not clip.
async function frameOrb(buf, size) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, c = info.channels;
  let x0 = w, y0 = h, x1 = 0, y1 = 0, any = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > ALPHA) {
      any = true;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!any) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const inner = Math.round(size * 0.88);
  const content = await sharp(buf).ensureAlpha()
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(inner, inner, { fit: 'inside' }).png().toBuffer();
  const md = await sharp(content).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left: Math.round((size - md.width) / 2), top: Math.round((size - md.height) / 2) }])
    .webp({ quality: 92 }).toBuffer();
}

if (has('--check')) {
  if (!existsSync(OUT)) { console.error('no ' + OUT); process.exit(1); }
  const m = await measure(await readFile(OUT));
  const g = await grade(m);
  console.log(`  base ${m.w}x${m.h} box ${m.bw}x${m.bh} aspect ${m.aspect.toFixed(2)}`);
  console.log(`  blue ${(m.blue * 100).toFixed(0)}%  green ${(m.green * 100).toFixed(0)}%  teal ${(m.teal * 100).toFixed(0)}%  violet ${(m.violet * 100).toFixed(0)}%  warm ${(m.warm * 100).toFixed(0)}%`);
  console.log(`  hue distance — from p_ult_hexorb ${g.dist.toFixed(2)}, from p_necromancer_soulorb ${g.distSoul.toFixed(2)}`);
  let frames = 0;
  for (let i = 0; i < FRAMES; i++) if (existsSync(join(ANIM, `${KEY}_${i}.webp`))) frames++;
  console.log(`  loop frames ${frames}/${FRAMES}`);
  console.log(g.ok && frames === FRAMES ? 'PASS' : 'FAIL ' + (g.why || `only ${frames} frames`));
  process.exit(g.ok && frames === FRAMES ? 0 : 1);
}

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(120000) })).arrayBuffer());

const BAKE = arg('--bake');
if (BAKE) {
  const raw = await readFile(join(KEEP, `r${BAKE}.png`));
  const g = await grade(await measure(raw));
  if (!g.ok) { console.error(`roll ${BAKE} does not clear the gate: ${g.why}`); process.exit(2); }
  await mkdir(DIR, { recursive: true });
  await writeFile(OUT, await frameOrb(raw, BASE_SIZE));
  console.log(`baked roll ${BAKE} -> ${OUT}`);
  process.exit(0);
}

if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }

// ---- the 9-frame loop, animated FROM the shipped base ----------------------
if (has('--anim')) {
  if (!existsSync(OUT)) { console.error('no base yet — run --generate first'); process.exit(1); }
  const baseBuf = await readFile(OUT);
  const uri = 'data:image/png;base64,'
    + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let bufs = null, err = '';
  for (let a = 1; a <= 4 && !bufs; a++) {
    process.stdout.write(`animate attempt ${a} ... `);
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: hdr, signal: AbortSignal.timeout(300000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES,
          frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const d = await res.json();
      if (d.spritesheet_url && d.num_cols && d.num_rows) {
        const sheet = await fetchBuf(d.spritesheet_url), md = await sharp(sheet).metadata();
        const cw = Math.floor(md.width / d.num_cols), ch = Math.floor(md.height / d.num_rows), o = [];
        for (let r = 0; r < d.num_rows && o.length < FRAMES; r++)
          for (let cc = 0; cc < d.num_cols && o.length < FRAMES; cc++)
            o.push(await sharp(sheet).extract({ left: cc * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
        if (o.length >= FRAMES) bufs = o;
      }
      if (!bufs) {
        const urls = d.individual_frame_urls || [];
        if (urls.length >= FRAMES) bufs = await Promise.all(urls.slice(0, FRAMES).map(fetchBuf));
      }
      if (!bufs) throw new Error('no usable frames');
      console.log('ok');
    } catch (e) { err = e.message; console.log('FAIL ' + err); }
  }
  if (!bufs) { console.error('animate failed: ' + err); process.exit(2); }
  await mkdir(ANIM, { recursive: true });
  // Shared canvas, no per-frame trim: per-frame trims re-centre and jitter.
  for (let i = 0; i < FRAMES; i++) {
    await writeFile(join(ANIM, `${KEY}_${i}.webp`),
      await sharp(bufs[i]).resize(ANIM_SIZE, ANIM_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 92 }).toBuffer());
  }
  console.log(`wrote ${FRAMES} frames ${ANIM_SIZE}x${ANIM_SIZE} -> anim/${KEY}_0..8.webp`);
  process.exit(0);
}

if (!has('--generate')) { console.error('usage: --generate [--rolls N] | --anim | --bake N | --check'); process.exit(1); }
const ROLLS = Number(arg('--rolls') || 4);
await mkdir(KEEP, { recursive: true });
let best = null;
for (let r = 1; r <= ROLLS; r++) {
  process.stdout.write(`roll ${r}/${ROLLS} ... `);
  let raw;
  try {
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST', headers: hdr, signal: AbortSignal.timeout(150000),
      body: JSON.stringify({ image_type: 'sprite-vfx', art_style: 'Hand-Painted', perspective: 'Side-Scroll',
        aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT + OUTLINE }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
    const d = await res.json();
    const url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    raw = await fetchBuf(url);
  } catch (e) { console.log('FAIL ' + e.message); continue; }
  await writeFile(join(KEEP, `r${r}.png`), raw);      // every roll kept
  const m = await measure(raw);
  const g = await grade(m);
  console.log(m ? `aspect ${m.aspect.toFixed(2)} blue ${(m.blue * 100).toFixed(0)}% green ${(m.green * 100).toFixed(0)}% teal ${(m.teal * 100).toFixed(0)}%`
    + ` dist pan ${g.dist.toFixed(2)} soul ${g.distSoul.toFixed(2)} ${g.ok ? 'pass' : 'GATED ' + g.why}` : 'empty');
  if (!g.ok) continue;
  // Among passing rolls, the one furthest from the NEAREST existing orb wins.
  if (!best || Math.min(g.dist, g.distSoul) > Math.min(best.g.dist, best.g.distSoul)) best = { raw, m, g };
}
if (!best) { console.error('no roll cleared the gate — re-run, or --bake a saved roll after reviewing it'); process.exit(2); }
await mkdir(DIR, { recursive: true });
await writeFile(OUT, await frameOrb(best.raw, BASE_SIZE));
console.log(`wrote ${OUT}  aspect ${best.m.aspect.toFixed(2)} blue ${(best.m.blue * 100).toFixed(0)}% green ${(best.m.green * 100).toFixed(0)}% dist pan ${best.g.dist.toFixed(2)} soul ${best.g.distSoul.toFixed(2)}`);
console.log('now run: node scripts/gen_hexorb_ward.mjs --anim');
