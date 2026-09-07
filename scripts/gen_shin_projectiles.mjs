#!/usr/bin/env node
// Shin-Shuriken projectile art: a KUNAI and a SHURIKEN (ludo.ai), replacing
// the brown-handled p_dagger.webp that the volley currently draws for BOTH of
// its projectile kinds. Per user: "For shinshuriken projectiles generate kunai
// and shuriken using ludo.ai to replace the current daggers".
//
// Outputs (new filenames - nothing is replaced, so no sw.js bump):
//   Sprites/projectiles/p_kunai.webp     696x319 landscape, tip pointing RIGHT
//                                        (same geometry as p_dagger, so the
//                                        renderer's size multiplier is unchanged)
//   Sprites/projectiles/p_shuriken.webp  512x512, 4-point star, centred
//
// GATES per roll (a failing roll is re-rolled, never shipped):
//   ALPHA   real transparency: corner alpha ~0
//   EDGE    zero opaque pixels on any canvas edge after fitting
//   KUNAI   long and thin (trimmed aspect >= 2.4) and the TIP IS ON THE RIGHT:
//           the rightmost 15% of the silhouette carries less than 60% of the
//           alpha mass of the leftmost 15% (a point is thinner than a handle)
//   STAR    roughly square (aspect 0.85-1.18) with an EMPTY centre hole or hub
//           smaller than the arms: mean alpha inside 12% radius vs the ring
//           between 35-60% - a filled disc is rejected
//   node scripts/gen_shin_projectiles.mjs             # dry-run
//   node scripts/gen_shin_projectiles.mjs --generate  # needs LUDO_API_KEY
//   node scripts/gen_shin_projectiles.mjs --install   # staged -> Sprites/
//   flags: --only=kunai|shuriken  --tries=N
import sharp from 'sharp';
import { writeFile, rename, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'shin_proj');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + '=')); return a ? a.split('=')[1] : d; };
const TRIES = Math.max(1, Number(val('--tries', 4)));
const ONLY = val('--only', '');

// The house look, copied from gen_projectile_restyle.mjs so the two new
// sprites sit beside mspore / p_pincer / p_arrow as one artist's work.
const STYLE = ' Cute chunky cartoon game sprite in the style of a chibi mobile RPG: ONE object centred in frame, '
  + 'a thick uniform near-black outline running the whole way round the silhouette, soft cel shading from a single '
  + 'upper-left light, glossy white highlight streaks on the metal, bright saturated colours, a bold silhouette that '
  + 'still reads at thumbnail size. Fully transparent background, no ground shadow, no background scenery, no text, '
  + 'no border, no frame, no motion lines, not pixel art, not photorealistic.';

const TARGETS = {
  kunai: {
    out: 'Sprites/projectiles/p_kunai.webp', W: 696, H: 319, ar: 'ar_16_9',
    prompt: 'A single ninja KUNAI throwing knife seen exactly side-on, lying horizontally and filling the width of '
      + 'the frame: a broad leaf-shaped double-edged steel blade tapering to a needle-sharp point aimed to the RIGHT, '
      + 'cool silver-blue polished steel with one crisp white highlight streak, a short dark grip wrapped in violet '
      + 'cord on the LEFT end, ending in a small round iron ring with a tiny fluttering violet ribbon. Sleek, deadly, '
      + 'assassin-styled. Blade on the right, ring on the left, no other objects.',
  },
  shuriken: {
    out: 'Sprites/projectiles/p_shuriken.webp', W: 512, H: 512, ar: 'ar_1_1',
    prompt: 'A single ninja SHURIKEN throwing star seen flat from above, centred: four sharp symmetrical blades '
      + 'radiating from a small round hub with a hole in the middle, cool silver-blue polished steel with crisp '
      + 'white highlight streaks along each blade, a thin violet accent line etched on each blade. Clean four-point '
      + 'star silhouette, perfectly symmetrical, sleek and deadly, assassin-styled. No other objects.',
  },
};

// ---- measurement ------------------------------------------------------------
const measure = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let top = -1, bot = -1, l = -1, r = -1, edge = 0;
  const col = new Float64Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = data[(y * W + x) * 4 + 3];
    if (a > 16) {
      if (top < 0) top = y; bot = y; if (l < 0 || x < l) l = x; if (x > r) r = x;
      if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++;
    }
    col[x] += a;
  }
  if (top < 0) return null;
  const bw = r - l + 1, bh = bot - top + 1;
  const band = Math.max(1, Math.round(bw * 0.15));
  let left = 0, right = 0;
  for (let x = l; x < l + band; x++) left += col[x];
  for (let x = r - band + 1; x <= r; x++) right += col[x];
  // STAR test, angular: sample a ring at 55-70% of the radius in 72 angular
  // bins. A four-point star has clear GAPS between blades (many empty bins);
  // a filled disc or a rounded blob covers every bin. (The first version
  // compared the centre to the ring - backwards for a star with a solid hub.)
  const cx = (l + r) / 2, cy = (top + bot) / 2, rad = Math.min(bw, bh) / 2;
  const BINS = 72, binHit = new Float64Array(BINS), binN = new Float64Array(BINS);
  for (let y = top; y <= bot; y++) for (let x = l; x <= r; x++) {
    const d = Math.hypot(x - cx, y - cy) / rad;
    if (d < 0.55 || d > 0.70) continue;
    const bi = ((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI) * BINS) | 0;
    const b = Math.min(BINS - 1, bi); binN[b]++; if (data[(y * W + x) * 4 + 3] > 40) binHit[b]++;
  }
  let covered = 0, sampled = 0;
  for (let b = 0; b < BINS; b++) if (binN[b]) { sampled++; if (binHit[b] / binN[b] > 0.5) covered++; }
  const ringCoverage = sampled ? covered / sampled : 1;
  const corner = (data[3] + data[(W - 1) * 4 + 3] + data[((H - 1) * W) * 4 + 3] + data[((H - 1) * W + W - 1) * 4 + 3]) / 4;
  return { W, H, edge, aspect: bw / bh, tipRight: left > 0 ? right / left : 9, ringCoverage, corner };
};
const verdict = (key, m) => {
  if (!m) return ['EMPTY'];
  const bad = [];
  if (m.corner > 24) bad.push('background not transparent');
  if (m.edge > 0) bad.push('touches edge (' + m.edge + 'px)');
  if (key === 'kunai') {
    if (m.aspect < 2.4) bad.push('not long and thin (aspect ' + m.aspect.toFixed(2) + ')');
    if (m.tipRight >= 0.6) bad.push('tip is not on the right (right/left mass ' + m.tipRight.toFixed(2) + ')');
  } else {
    if (m.aspect < 0.85 || m.aspect > 1.18) bad.push('not square (aspect ' + m.aspect.toFixed(2) + ')');
    if (m.ringCoverage > 0.72) bad.push('reads as a filled disc, not a star with gaps between blades (ring coverage ' + Math.round(m.ringCoverage * 100) + '%)');
  }
  return bad;
};
// trim the model's padding, then letterbox into the shipped geometry with margin
const fitTo = async (raw, W, H) => {
  const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 8 }).toBuffer();
  const inner = await sharp(trimmed).resize(Math.round(W * 0.92), Math.round(H * 0.92), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer();
};
const atomicWrite = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };
const keys = Object.keys(TARGETS).filter((k) => !ONLY || k === ONLY);

if (has('--install')) {
  for (const k of keys) {
    const p = join(STAGE, k + '.webp');
    if (!existsSync(p)) { console.error('ABORT: nothing staged for ' + k); process.exit(1); }
    const bad = verdict(k, await measure(await readFile(p)));
    if (bad.length) { console.error('ABORT: staged ' + k + ' fails its gates: ' + bad.join('; ')); process.exit(1); }
    await copyFile(p, join(ROOT, TARGETS[k].out));
    console.log('installed ' + TARGETS[k].out);
  }
  console.log('NEXT: node scripts/gen_assets_manifest.mjs  (new files -> cache-warm list); no sw.js bump (nothing replaced)');
  process.exit(0);
}
if (!has('--generate')) {
  for (const k of keys) console.log('## ' + k + ' -> ' + TARGETS[k].out + '\n' + TARGETS[k].prompt + STYLE + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), review scripts/_style_pack/shin_proj/, then --install.');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
await mkdir(STAGE, { recursive: true });
let failed = 0;
for (const k of keys) {
  const t = TARGETS[k]; let best = null;
  for (let a = 1; a <= TRIES; a++) {
    let url;
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', signal: AbortSignal.timeout(150000),
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: t.ar, n: 1, augment_prompt: false, prompt: t.prompt + STYLE }) });
      if (!res.ok) { const tx = await res.text(); if (res.status === 402) { console.error('OUT OF CREDITS'); process.exit(3); } throw new Error(res.status + ' ' + tx.slice(0, 120)); }
      const d = await res.json(); url = Array.isArray(d) ? d[0]?.url : (d?.url || d?.images?.[0]?.url);
    } catch (e) { console.log('  ' + k + ' roll ' + a + ': ' + e.message); continue; }
    if (!url) continue;
    const fitted = await fitTo(await fetchBuf(url), t.W, t.H);
    const m = await measure(fitted), bad = verdict(k, m);
    console.log('  ' + k + ' roll ' + a + ': ' + (bad.length ? 'REJECT - ' + bad.join('; ')
      : 'OK aspect ' + m.aspect.toFixed(2) + (k === 'kunai' ? ' tip-ratio ' + m.tipRight.toFixed(2) : ' hub ' + Math.round(m.centre) + '/' + Math.round(m.ring))));
    await atomicWrite(join(STAGE, k + '_roll' + a + '.webp'), fitted);
    if (!bad.length) { best = fitted; break; }
  }
  if (!best) { failed++; console.error('no clean roll for ' + k); continue; }
  await atomicWrite(join(STAGE, k + '.webp'), best);
}
// review sheet: current dagger beside the two new sprites, on the game's dark ground
const tiles = [], T = 300; let x = 0;
for (const p of ['Sprites/projectiles/p_dagger.webp', join(STAGE, 'kunai.webp'), join(STAGE, 'shuriken.webp')]) {
  const abs = p.startsWith('Sprites') ? join(ROOT, p) : p; if (!existsSync(abs)) continue;
  tiles.push({ input: await sharp(await readFile(abs)).resize(T, T, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: x, top: 0 }); x += T;
}
await sharp({ create: { width: Math.max(T, x), height: T, channels: 4, background: { r: 24, g: 20, b: 34, alpha: 255 } } }).composite(tiles).png().toFile(join(STAGE, 'review.png'));
console.log(failed ? 'DONE with ' + failed + ' target(s) unfilled' : 'staged both -> scripts/_style_pack/shin_proj/ (review.png)');
process.exit(failed ? 2 : 0);
