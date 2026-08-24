#!/usr/bin/env node
// Virga's STARBURST lance — the projectile her eight-way burst fires.
// ============================================================================
//   node scripts/gen_virga_starburst_proj.mjs --rolls 4 --generate
//   node scripts/gen_virga_starburst_proj.mjs --check        # grade what shipped
//   node scripts/gen_virga_starburst_proj.mjs --bake 3       # ship a saved roll
//
// Two constraints come from the engine rather than from taste, and both are
// gated rather than eyeballed:
//
// 1. IT MUST POINT RIGHT. _PROJ_SPRITE_BLIT draws this in mode:'orient', which
//    rotates the sprite to its velocity vector on the assumption that the art's
//    "forward" is +x. A burst fires on all eight diagonals, so a sprite whose
//    tip faces the wrong way is wrong in every direction at once — and it is
//    the kind of wrong that reads as "the art is fine, the physics is broken".
//    taper() below measures it: a right-pointing lance is thick at the left and
//    thin at the right, so the mean column height of the left third must beat
//    the right third by a clear margin.
//
// 2. IT MUST SURVIVE ROTATION. Content is trimmed and re-fitted to <=300px on a
//    512 canvas, so the furthest corner sits at ~212px from centre against a
//    256px radius — no clipping at any angle. Same guarantee the elementalist
//    and bult projectile packs use.
//
// The palette gate is taste, but it is HER taste: this has to read as the same
// spell as fx_col_zodiac_virgo, so it is warm white and pale gold, and blue or
// violet ink disqualifies a roll outright.
// ============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'projectiles');
const OUT = join(DIR, 'p_virga_lance.webp');
const KEEP = join(repoRoot, 'scripts', '_tmp_virga_lance_rolls');
const CANVAS = 512, TARGET = 300;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PROMPT =
  'a single SERAPH LIGHT LANCE projectile flying to the RIGHT: a slender tapered spear of holy light '
  + 'with a blinding warm-white core, pale gold outer glow and a sharp point at its RIGHT end, trailing '
  + 'a short comb of soft golden feather-wisps and a few drifting motes of light behind it at the LEFT '
  + 'end. A faint thin halo ring encircles the shaft near the tail. It is clearly ARROW-SHAPED and '
  + 'clearly aimed RIGHT: broad at the left tail, tapering to a needle point at the right tip.';
const OUTLINE =
  ' Epic painterly fantasy game PROJECTILE sprite for a 2D side-scrolling platformer, a single object '
  + 'centred on a pure transparent background, alpha only, no scene, no ground, no character, no frame '
  + 'and no border. Vibrant warm white and pale gold ONLY - absolutely no blue, no violet, no purple, '
  + 'no red. A bold uniform 2px black outline around the silhouette. The object must point RIGHT.';

const ALPHA = 12;
const MIN_ASPECT = 1.45;    // a lance is longer than it is tall
const MIN_TAPER = 1.30;     // left-third thickness / right-third thickness
const MIN_WARM = 0.55;      // fraction of saturated ink in the gold/white band
const MAX_COOL = 0.10;      // fraction that is blue/violet

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
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;

  // Column heights across the content box, for the taper read.
  const colH = new Array(bw).fill(0);
  for (let x = x0; x <= x1; x++) {
    let lo = -1, hi = -1;
    for (let y = y0; y <= y1; y++) if (data[(y * w + x) * c + 3] > ALPHA) { if (lo < 0) lo = y; hi = y; }
    colH[x - x0] = lo < 0 ? 0 : hi - lo + 1;
  }
  const third = Math.max(1, Math.floor(bw / 3));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const left = mean(colH.slice(0, third)), right = mean(colH.slice(bw - third));

  // Palette, on SATURATED ink only: a white core is hueless and would otherwise
  // swamp the reading of what colour the glow actually is.
  let warm = 0, cool = 0, sat = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (y * w + x) * c;
    if (data[i + 3] <= 90) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0 || (mx - mn) / mx < 0.22) continue;    // unsaturated: white core / grey outline
    sat++;
    let hue;
    if (mx === r) hue = 60 * (((g - b) / (mx - mn)) % 6);
    else if (mx === g) hue = 60 * ((b - r) / (mx - mn) + 2);
    else hue = 60 * ((r - g) / (mx - mn) + 4);
    if (hue < 0) hue += 360;
    if (hue >= 18 && hue <= 72) warm++;                  // amber through gold
    else if (hue >= 180 && hue <= 300) cool++;           // cyan through violet
  }
  return { w, h, bw, bh, aspect: bw / bh, taper: left / Math.max(1e-6, right),
           warm: sat ? warm / sat : 0, cool: sat ? cool / sat : 1, satPx: sat };
}

function grade(m) {
  if (!m) return { ok: false, why: 'empty' };
  const fails = [];
  if (m.aspect < MIN_ASPECT) fails.push(`aspect ${m.aspect.toFixed(2)}<${MIN_ASPECT}`);
  if (m.taper < MIN_TAPER) fails.push(`taper ${m.taper.toFixed(2)}<${MIN_TAPER} (not pointing right)`);
  if (m.warm < MIN_WARM) fails.push(`warm ${(m.warm * 100).toFixed(0)}%<${MIN_WARM * 100}%`);
  if (m.cool > MAX_COOL) fails.push(`cool ${(m.cool * 100).toFixed(0)}%>${MAX_COOL * 100}%`);
  return { ok: !fails.length, why: fails.join(', ') };
}

// Trim to the alpha box, fit into TARGET, centre on CANVAS^2 — the rotation
// guarantee described at the top.
async function frameNoCutoff(buf) {
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
  const content = await sharp(buf).ensureAlpha()
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(TARGET, TARGET, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const md = await sharp(content).metadata();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: content, left: Math.round((CANVAS - md.width) / 2), top: Math.round((CANVAS - md.height) / 2) }])
    .webp({ quality: 92 }).toBuffer();
}

if (has('--check')) {
  if (!existsSync(OUT)) { console.error('no ' + OUT); process.exit(1); }
  const m = await measure(await readFile(OUT));
  const g = grade(m);
  console.log(`  box ${m.bw}x${m.bh} on ${m.w}x${m.h}  aspect ${m.aspect.toFixed(2)}  taper ${m.taper.toFixed(2)}`
    + `  warm ${(m.warm * 100).toFixed(0)}%  cool ${(m.cool * 100).toFixed(0)}%`);
  const reach = Math.hypot(m.bw, m.bh) / 2, radius = Math.min(m.w, m.h) / 2;
  console.log(`  rotation reach ${reach.toFixed(0)} vs canvas radius ${radius.toFixed(0)}  ${reach <= radius ? 'no clip' : 'CLIPS'}`);
  console.log(g.ok && reach <= radius ? 'PASS' : 'FAIL ' + g.why);
  process.exit(g.ok && reach <= radius ? 0 : 1);
}

const BAKE = arg('--bake');
if (BAKE) {
  const raw = await readFile(join(KEEP, `r${BAKE}.png`));
  const g = grade(await measure(raw));
  if (!g.ok) { console.error(`roll ${BAKE} does not clear the gate: ${g.why}`); process.exit(2); }
  await mkdir(DIR, { recursive: true });
  await writeFile(OUT, await frameNoCutoff(raw));
  console.log(`baked roll ${BAKE} -> ${OUT}`);
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key || !has('--generate')) { console.error('usage: --generate (needs LUDO_API_KEY) | --bake N | --check'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const ROLLS = Number(arg('--rolls') || 4);
const hdr = { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' };
const fetchBuf = async (u) => Buffer.from(await (await fetch(u)).arrayBuffer());

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
  await writeFile(join(KEEP, `r${r}.png`), raw);        // every roll kept, passed or not
  const m = await measure(raw);
  const g = grade(m);
  console.log(m ? `aspect ${m.aspect.toFixed(2)} taper ${m.taper.toFixed(2)} warm ${(m.warm * 100).toFixed(0)}%`
    + ` cool ${(m.cool * 100).toFixed(0)}% ${g.ok ? 'pass' : 'GATED ' + g.why}` : 'empty');
  if (!g.ok) continue;
  // Among rolls that read right, the most emphatically directional wins.
  if (!best || m.taper > best.m.taper) best = { raw, m };
}
if (!best) { console.error('no roll cleared the gate — re-run, or --bake a saved roll after reviewing it'); process.exit(2); }
await mkdir(DIR, { recursive: true });
await writeFile(OUT, await frameNoCutoff(best.raw));
console.log(`wrote ${OUT}  aspect ${best.m.aspect.toFixed(2)} taper ${best.m.taper.toFixed(2)} warm ${(best.m.warm * 100).toFixed(0)}%`);
