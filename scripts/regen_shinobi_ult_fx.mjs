#!/usr/bin/env node
// Regenerate the Hundred-Hand Shadow Dance (shinobi B-slot ultimate) FX.
//
// THE BRIEF, made measurable. Per user: "more petals, chinese chakra characters
// and more violet and purplish colouration." Two of those three are numbers, so
// they are gates rather than opinions. The art on disk measures:
//
//     violet 0.1%   blue 91.4%   petals 31
//
// which is the complaint exactly: it is a blue set with no violet in it at all.
// Hue share is counted over lit, saturated pixels (violet = 258-320 deg); the
// petal count is local maxima of the silhouette's radius profile, smoothed and
// separated so one ragged tip does not count three times.
//
// The Chinese seal-script characters cannot be scored this way and are checked
// by eye - the gate does not pretend otherwise.
//
//   node scripts/regen_shinobi_ult_fx.mjs             # measure what is on disk
//   node scripts/regen_shinobi_ult_fx.mjs --generate  # needs LUDO_API_KEY
//   ... --still-only | --anim-only                    # one half
import sharp from 'sharp';
import { writeFile, rename } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILL = join(ROOT, 'Sprites', 'fx', 'shinobi_ult.webp');
const ANIM = join(ROOT, 'Sprites', 'fx', 'anim');
const KEY = 'shinobi_ult';
const FRAMES = 9, STILL_PX = 768, ANIM_PX = 952;
const has = (f) => process.argv.slice(2).includes(f);

// Targets. Violet must DOMINATE, not merely appear - "more violet" against 0.1%
// is met by 2%, which would not read as any change at all on screen.
// TWO ZONES, measured separately. A single whole-sprite average cannot tell a
// violet mandala with a pink heart from a sprite that is uniformly pink - and
// it did not: asking for a pink sakura pulled the whole flower pink, and six of
// six rolls came back pink petals and all, one of them scoring 42% "violet"
// while reading pink to the eye. So gate the RIM and the CENTRE apart.
const MIN_OUTER_VIOLET = 55;  // % of lit pixels outside r > 0.5
const MIN_CENTRE_PINK  = 30;  // % of lit pixels inside  r < 0.32
const MIN_PETALS = 46;        // against 36 today, on the interior metric below
// Burst shape. These nine frames are played ONCE across the burst's life, so the
// set is a one-shot progression: it has to actually come apart.
const MIN_GROW = 1.25;        // last frame's mean radius against the first
const MAX_THIN = 0.80;        // at most this much of the art still present at the end
const MIN_THIN = 0.12;        // ...and at least this much: petals still flying, not gone
// A fade-out and a real burst both shed pixels - the first five rolls all shed
// 66-75% of theirs while the survivors ended up MORE central than they started.
// Only a burst empties the middle, so that is the gate that tells them apart.
const MIN_HOLLOW = 0.55;      // fraction of the core that must have cleared out

const PALETTE =
  'TWO COLOURS, KEPT APART. ' +
  'THE OUTER FLOWER IS PURPLE: every lotus petal in the surrounding rings, and ' +
  'the character ring, is DEEP ROYAL PURPLE AND VIOLET - amethyst and indigo, ' +
  'dark and richly saturated. The purple covers MOST of the image and it is what ' +
  'the sprite reads as at a glance. ' +
  'ONLY THE SMALL BLOSSOM AT THE VERY CENTRE IS PINK: soft rose and blush ' +
  'pink-violet, a warm pink heart sitting inside all that purple. ' +
  'The pink must stay INSIDE the central blossom. The surrounding lotus petals ' +
  'must NOT be pink, must NOT be rose, and must NOT fade toward pink at their ' +
  'tips - they stay purple all the way out. Do NOT make the whole flower pink. ' +
  'Do NOT make any of it blue, cyan, steel or ice-coloured.';

const STILL_PROMPT =
  'A game VFX sprite seen head-on: a huge DEEP PURPLE lotus mandala, and at its ' +
  'dead centre one small SAKURA CHERRY BLOSSOM - five rounded petals with ' +
  'notched tips and fine stamens - glowing soft PINK against the purple. The ' +
  'sakura is SMALL, about a fifth of the whole width; the purple mandala around ' +
  'it is the bulk of the image. ' +
  'CRITICAL - NO HANDS, NO FIGURE: there must be NO hands, NO arms, NO fingers, ' +
  'NO hooded person and NO face anywhere in the image. The centre is the sakura ' +
  'blossom and nothing else. ' +
  'CRITICAL - PETALS: FIFTY OR MORE long, slender, blade-tipped lotus petals ' +
  'radiating outward in TWO OR THREE concentric layered rings, densely packed ' +
  'so the outer edge reads as a full flower rather than a ring of spikes. ' +
  'CRITICAL - CHARACTERS: a ring of glowing CHINESE CALLIGRAPHIC CHARACTERS in ' +
  'seal script set between the inner and outer petal rings, drawn as luminous ' +
  'chakra-seal glyphs with brush-stroke weight, evenly spaced around the whole ' +
  'circle. ' + PALETTE + ' ' +
  'Perfectly radially symmetric and centred, the whole mandala inside the frame ' +
  'with clear margin on every side, no cropping. Anime game-VFX art style, bold ' +
  'clean outlines, fully transparent background, no text, no logo, no border.';

// NOT A LOOP. The game plays this set ONCE across the burst's life -
// Math.floor(t * n), and neither shinobi_ult spawn sets frameGap - so it must be
// authored as a one-shot progression. The first version of this prompt asked for
// a SEAMLESS LOOP, which authored the wrong shape entirely: a breathing cycle
// that re-forms, played once and cut off wherever the burst happened to die.
const MOTION =
  'the lotus mandala BLOWS APART and its petals FLY OUTWARD across the nine ' +
  'frames, like a flower hit by an explosion. ' +
  'Frame 1: the mandala whole and intact. ' +
  'Frame 5: the petals have detached and are HALFWAY OUT toward the edge of the ' +
  'frame, spread wide apart with big gaps of empty space between them, and the ' +
  'middle of the image is already emptying. ' +
  'Frame 9: THE CENTRE IS EMPTY. The petals have travelled all the way out and ' +
  'sit as a wide sparse ring of separate petals near the edge of the frame, far ' +
  'apart from each other, with nothing at all left in the middle. ' +
  'CRITICAL - THE PETALS TRAVEL, THEY DO NOT FADE. Each petal MOVES a long way ' +
  'from where it started, keeping its full solid colour and hard edges the whole ' +
  'time. Do NOT fade them out. Do NOT dissolve them. Do NOT make them ' +
  'transparent, blurry, wispy or smoky. Do NOT shrink them. Do NOT let them dim ' +
  'in place. A petal that is still where it started is WRONG. ' +
  'CRITICAL - THE MIDDLE MUST EMPTY OUT. As the petals leave, the centre of the ' +
  'image becomes bare transparent background. By the last frame there is a HOLE ' +
  'in the middle where the flower used to be. ' +
  'The flower must not stay whole, must not merely spin, must not bloom and ' +
  'close again, and the last frame must NOT look like the first. ' +
  'CRITICAL - EVEN PACING: every frame carries the burst the SAME amount ' +
  'further; no lurch, no two consecutive frames that look alike. ' +
  'Do NOT add hands, arms, fingers, a hooded figure or a face. ' + PALETTE + ' ' +
  'CRITICAL - STAY IN FRAME: the flying petals must all stay INSIDE the frame ' +
  'with clear margin; do not let a petal touch or cross the edge, and do not ' +
  'zoom, crop closer or move the centre of the burst. ' +
  'DO NOT ADD new effects, sparks, background or text. Keep the same art style ' +
  'and a fully transparent background.';

const hashOf = (b) => createHash('md5').update(b).digest('hex');
// Rejected rolls are WRITTEN OUT, not discarded. A gate that throws art away
// unseen is a gate you cannot debug: the first run here refused three rolls on
// a broken petal metric and there was nothing left to look at afterwards.
const KEEP = process.env.KEEP_DIR || '';
let kept_n = 0;
async function keep(tag, buf) {
  if (!KEEP) return;
  const { writeFile } = await import('node:fs/promises');
  // Frame tags carry their own index; only untagged rolls need a counter.
  const name = /_f\d+$/.test(tag) ? tag : `${tag}_${String(++kept_n).padStart(2, '0')}`;
  await writeFile(join(KEEP, name + '.webp'), buf);
}

// --- measurement -----------------------------------------------------------
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
  if (h < 0) h += 360;
  return [h, mx ? d / mx : 0, mx / 255];
}
async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let lit = 0, cx = 0, cy = 0, n = 0;
  let cPink = 0, cLit = 0, oVio = 0, oLit = 0;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * C;
    if (data[o + 3] < 128) continue;
    n++; cx += x; cy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    const [h, s, v] = hsv(data[o], data[o + 1], data[o + 2]);
    if (v < 0.12) continue;
    lit++;
  }
  if (!n) return null;
  cx /= n; cy /= n;
  // Petal count from INTERNAL angular structure, NOT the silhouette.
  //
  // The first version counted spikes on the outline and scored three perfectly
  // good rolls at ZERO: a dense lotus has an almost-circular rim, so packing
  // MORE petals in makes the outline SMOOTHER and a silhouette metric reads
  // dense art as having none. Sample rings inside the mandala instead and count
  // how many times the image repeats around the circle - each petal is a bright
  // body between darker edges. Reads 35-36 on the art this replaces, against a
  // hand count of ~31 visible blades.
  let maxR = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 128)
    maxR = Math.max(maxR, Math.hypot(x - cx, y - cy));
  // Hue bands, with a deliberate GAP between them so a magenta that could be
  // called either does not satisfy both gates at once: violet 250-298, pink
  // 306-358. The rim is judged on violet, the heart on pink.
  const Rin = maxR * 0.32, Rout = maxR * 0.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - cx, y - cy);
    const o = (y * W + x) * C;
    if (data[o + 3] < 128) continue;
    const [h, sa, v] = hsv(data[o], data[o + 1], data[o + 2]);
    if (v < 0.12) continue;
    if (r <= Rin) { cLit++; if (sa > 0.12 && (h >= 306 || h < 8)) cPink++; }
    else if (r >= Rout) { oLit++; if (sa > 0.18 && h >= 250 && h < 298) oVio++; }
  }
  const NB = 1440, ringCounts = [];
  for (const frac of [0.55, 0.68, 0.80, 0.90]) {
    const R = maxR * frac, lum = new Array(NB).fill(0);
    for (let i = 0; i < NB; i++) {
      const a = i / NB * Math.PI * 2;
      const px = Math.round(cx + Math.cos(a) * R), py = Math.round(cy + Math.sin(a) * R);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const o = (py * W + px) * C;
      lum[i] = data[o + 3] < 60 ? 0 : (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * (data[o + 3] / 255);
    }
    const K = 3;
    const sm = lum.map((_, i) => { let t = 0; for (let d = -K; d <= K; d++) t += lum[(i + d + NB) % NB]; return t / (2 * K + 1); });
    const mean = sm.reduce((a, b) => a + b, 0) / NB;
    const sd = Math.sqrt(sm.reduce((a, b) => a + (b - mean) ** 2, 0) / NB);
    if (sd < 3) { ringCounts.push(0); continue; }
    const SEP = 8, k2 = [];
    for (let i = 0; i < NB; i++) {
      if (sm[i] < mean + sd * 0.35) continue;
      let top = true;
      for (let d = -SEP; d <= SEP; d++) if (sm[(i + d + NB) % NB] > sm[i]) { top = false; break; }
      if (top && !k2.some((j) => Math.min(Math.abs(i - j), NB - Math.abs(i - j)) < SEP)) k2.push(i);
    }
    ringCounts.push(k2.length);
  }
  const sorted = [...ringCounts].sort((a, b) => a - b);
  const kept = { length: sorted[2] };   // upper-middle ring: robust to a blank centre and a soft rim
  let edge = 0;
  for (let x = 0; x < W; x++) { if (data[x * C + 3] > 200) edge++; if (data[((H - 1) * W + x) * C + 3] > 200) edge++; }
  for (let y = 0; y < H; y++) { if (data[(y * W) * C + 3] > 200) edge++; if (data[(y * W + W - 1) * C + 3] > 200) edge++; }
  return { outerViolet: +(100 * oVio / Math.max(1, oLit)).toFixed(1),
           centrePink: +(100 * cPink / Math.max(1, cLit)).toFixed(1),
           petals: kept.length, edge, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H } };
}
const fmt = (m) => `rimViolet ${m.outerViolet}%  centrePink ${m.centrePink}%  petals ${m.petals}  edge ${m.edge}`;

// Square, centred, and inset so the burst never touches its own frame - the
// game spins and scales this sprite, so a tip on the border swings off-screen.
async function normalise(buf, px) {
  const t = await sharp(buf).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const side = Math.max(t.info.width, t.info.height);
  const inner = Math.round(px * 0.92);
  const scaled = await sharp(t.data).resize(
    Math.max(1, Math.round(t.info.width / side * inner)),
    Math.max(1, Math.round(t.info.height / side * inner)),
    { fit: 'fill' }).png().toBuffer();
  const m = await sharp(scaled).metadata();
  return sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round((px - m.width) / 2), top: Math.round((px - m.height) / 2) }])
    .webp({ quality: 92 }).toBuffer();
}

// Calibration: measure arbitrary files and stop. A gate is only trustworthy if
// you have checked it against art you have already judged by eye.
if (has('--measure')) {
  for (const f of process.argv.slice(2).filter((x) => !x.startsWith('--'))) {
    const m = await measure(readFileSync(f));
    console.log(f.split(/[\/]/).pop().padEnd(26), fmt(m));
  }
  process.exit(0);
}
const curStill = existsSync(STILL) ? await measure(readFileSync(STILL)) : null;
if (curStill) console.log('still on disk :', fmt(curStill));
if (existsSync(join(ANIM, `${KEY}_0.webp`))) {
  const a0 = await measure(readFileSync(join(ANIM, `${KEY}_0.webp`)));
  console.log('anim  on disk :', fmt(a0));
}
if (!has('--generate')) {
  console.log(`\n# Re-run with --generate (needs LUDO_API_KEY).`);
  console.log(`# Gate: rim violet >= ${MIN_OUTER_VIOLET}%, centre pink >= ${MIN_CENTRE_PINK}%,` +
              ` petals >= ${MIN_PETALS}, contained, ${FRAMES} unique frames.`);
  console.log(`# Burst: spread >= x${MIN_GROW}, ends between ${Math.round(MIN_THIN * 100)}% and` +
              ` ${Math.round(MAX_THIN * 100)}% of its art, core >= ${Math.round(MIN_HOLLOW * 100)}% cleared,` +
              ' never falls back inward.');
  console.log('# NOT scorable, check by eye: the Chinese seal-script glyphs, and that');
  console.log('# no hands / hooded figure came back.');
  process.exit(0);
}

const K = process.env.LUDO_API_KEY;
if (!K) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const post = async (p, body) => {
  const r = await fetch(API + p, { method: 'POST',
    headers: { Authorization: `ApiKey ${K}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(600000), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${p} ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`);
  return r.json();
};
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(300000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
const ROLLS = Number(process.env.ROLLS || 5);

// --- the still -------------------------------------------------------------
let stillBuf = existsSync(STILL) ? readFileSync(STILL) : null;
if (!has('--anim-only')) {
  let best = null;
  for (let a = 1; a <= ROLLS; a++) {
    try {
      process.stdout.write(`still ${a}: `);
      const data = await post('/assets/image', { image_type: 'sprite', art_style: 'Anime/Manga',
        aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: STILL_PROMPT });
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const out = await normalise(await fetchBuf(url), STILL_PX);
      const m = await measure(out);
      if (!m) throw new Error('empty');
      console.log(fmt(m));
      await keep('still', out);
      if (m.outerViolet < MIN_OUTER_VIOLET) throw new Error(`the outer mandala is not violet (${m.outerViolet}% < ${MIN_OUTER_VIOLET}%)`);
      if (m.petals < MIN_PETALS) throw new Error(`not enough petals (${m.petals} < ${MIN_PETALS})`);
      if (m.centrePink < MIN_CENTRE_PINK) throw new Error(`the centre is not pink (${m.centrePink}% < ${MIN_CENTRE_PINK}%)`);
      if (m.edge > 0) throw new Error(`touches the frame edge (${m.edge}px)`);
      // Among rolls that clear the brief, take the one with the cleanest
      // separation between the two zones plus the densest petals.
      const score = m.petals + m.centrePink + m.outerViolet;
      console.log(`        accepted — score ${score.toFixed(1)}` + (best ? ` (incumbent ${best.score.toFixed(1)})` : ''));
      if (!best || score > best.score) best = { buf: out, m, score };
    } catch (e) {
      console.log('rejected: ' + e.message);
      if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
    }
  }
  if (!best) { console.error('STILL FAILED — art left untouched'); process.exit(1); }
  await writeFile(STILL + '.tmp', best.buf);
  await rename(STILL + '.tmp', STILL);
  stillBuf = best.buf;
  console.log(`WROTE still — ${fmt(best.m)} (was ${curStill ? fmt(curStill) : 'n/a'})`);
}
if (has('--still-only')) process.exit(0);

// --- the animation ---------------------------------------------------------
// Containment by construction, the same fix the Gravitos walk needed: the model
// re-frames to fill whatever canvas it is handed, so cropping a fixed box back
// off slices through whatever it moved outward. Take the union of the content
// boxes across ALL frames, apply ONE scale and ONE offset, and centre it. A
// single shared transform keeps the frames' motion relative to each other -
// per-frame fitting would cancel the breathing pulse this animation is built on.
async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 24) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, W, H };
}
async function refit(raw, px) {
  const boxes = [];
  for (const b of raw) { const bx = await contentBox(b); if (!bx) throw new Error('a frame came back empty'); boxes.push(bx); }
  const U = { x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)) };
  U.w = Math.max(...boxes.map((b) => b.x + b.w)) - U.x;
  U.h = Math.max(...boxes.map((b) => b.y + b.h)) - U.y;
  const inner = Math.round(px * 0.92);
  const scale = Math.min(inner / U.w, inner / U.h);
  const dw = Math.max(1, Math.round(U.w * scale)), dh = Math.max(1, Math.round(U.h * scale));
  const dx = Math.round((px - dw) / 2), dy = Math.round((px - dh) / 2);
  const out = [];
  for (const b of raw) {
    const cropped = await sharp(b).extract({ left: U.x, top: U.y, width: U.w, height: U.h })
      .resize(dw, dh, { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cropped, left: dx, top: dy }]).webp({ quality: 92 }).toBuffer());
  }
  return out;
}
// Does the sequence actually BURST? Two numbers answer that: the art must
// spread outward from its own centre, and it must thin out as petals leave.
// Measured in raw pixels rather than normalised - a burst that grows is exactly
// what a scale-invariant metric would hide.
async function dispersal(bufs) {
  const spread = [], mass = [], core = [];
  for (const b of bufs) {
    const { data, info } = await sharp(b).resize(200, 200, { fit: 'fill' })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    let n = 0, cx = 0, cy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 96) { n++; cx += x; cy += y; }
    if (!n) { spread.push(0); mass.push(0); core.push(0); continue; }
    cx /= n; cy /= n;
    let r = 0, inner = 0;
    const R = W * 0.22;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * C + 3] > 96) {
      const d2 = Math.hypot(x - cx, y - cy);
      r += d2;
      if (d2 < R) inner++;
    }
    spread.push(+(r / n).toFixed(1)); mass.push(n); core.push(inner);
  }
  // Where the mass SITS, not just how much of it survives. A fade-out and a
  // real burst both shed pixels; only a burst empties the middle.
  const grow = +(spread[spread.length - 1] / Math.max(0.001, spread[0])).toFixed(2);
  const thin = +(mass[mass.length - 1] / Math.max(1, mass[0])).toFixed(2);
  let out = 0;
  for (let i = 1; i < spread.length; i++) if (spread[i] >= spread[i - 1] - 0.3) out++;
  // Hollow = how much of the middle has emptied. 1.0 means the core is bare.
  const hollow = +(1 - core[core.length - 1] / Math.max(1, core[0])).toFixed(2);
  return { spread, mass, core, grow, thin, out, hollow };
}
async function steps(bufs) {
  const small = [];
  for (const b of bufs) small.push(await sharp(b).resize(96, 96, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const out = [];
  for (let i = 0; i < small.length; i++) {
    const a = small[i], b = small[(i + 1) % small.length];
    let s = 0;
    for (let q = 0; q < a.length; q += 4) s += Math.abs(a[q] - b[q]) + Math.abs(a[q + 3] - b[q + 3]);
    out.push(Math.round(s / 1000));
  }
  return out;
}
const cvOf = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length;
  return +(Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m).toFixed(2); };

const src = await sharp(stillBuf).resize(920, 920, { fit: 'inside' }).png().toBuffer();
let bestA = null;
for (let a = 1; a <= ROLLS; a++) {
  try {
    process.stdout.write(`anim ${a}: `);
    const data = await post('/assets/sprite/animate', {
      initial_image: 'data:image/png;base64,' + src.toString('base64'),
      motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle',
      individual_frames: true, loop: false, image_type: 'sprite',
    });
    // Slice the SPRITESHEET, never individual_frame_urls: those square off a
    // non-square frame and the art comes back stretched.
    let raw = [];
    if (data.spritesheet_url && data.num_cols && data.num_rows) {
      const sheet = await fetchBuf(data.spritesheet_url);
      const m = await sharp(sheet).metadata();
      const cw = Math.floor(m.width / data.num_cols), ch = Math.floor(m.height / data.num_rows);
      for (let r = 0; r < data.num_rows && raw.length < FRAMES; r++)
        for (let c = 0; c < data.num_cols && raw.length < FRAMES; c++)
          raw.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    } else {
      const urls = data.individual_frame_urls || [];
      if (urls.length < FRAMES) throw new Error('too few frames');
      for (let i = 0; i < FRAMES; i++) raw.push(await fetchBuf(urls[i]));
    }
    if (raw.length < FRAMES) throw new Error(`got ${raw.length}`);
    const finals = await refit(raw, ANIM_PX);
    const uniq = new Set(finals.map(hashOf)).size;
    const m0 = await measure(finals[0]);
    const st = await steps(finals);
    const d = await dispersal(finals);
    let edge = 0;
    for (const f of finals) { const mm = await measure(f); if (mm.edge > edge) edge = mm.edge; }
    console.log(`unique=${uniq}/${FRAMES} ${fmt(m0)} spread=[${d.spread.join(' ')}] x${d.grow} thin=${d.thin} hollow=${d.hollow} cv=${cvOf(st)} worstEdge=${edge}`);
    for (let q = 0; q < finals.length; q++) await keep(`anim${String(a).padStart(2, '0')}_f${q}`, finals[q]);
    if (uniq < FRAMES) throw new Error(`only ${uniq} unique frames`);
    if (edge > 0) throw new Error(`touches the frame edge (${edge}px)`);
    if (m0.outerViolet < MIN_OUTER_VIOLET) throw new Error(`the animation lost the violet rim (${m0.outerViolet}%)`);
    if (m0.petals < MIN_PETALS) throw new Error(`the animation lost the petals (${m0.petals})`);
    if (m0.centrePink < MIN_CENTRE_PINK) throw new Error(`the animation lost the pink centre (${m0.centrePink}%)`);
    if (d.grow < MIN_GROW) throw new Error(`it does not burst outward (spread x${d.grow} < x${MIN_GROW})`);
    if (d.thin > MAX_THIN) throw new Error(`nothing leaves - it stays whole (${Math.round(d.thin * 100)}% of the art still there at the end)`);
    if (d.thin < MIN_THIN) throw new Error(`it bursts into nothing (only ${Math.round(d.thin * 100)}% left at the end; the game fades it out too)`);
    if (d.hollow < MIN_HOLLOW) throw new Error(`the middle never empties (hollow ${d.hollow} < ${MIN_HOLLOW}) - the petals faded instead of flying`);
    if (d.out < FRAMES - 2) throw new Error(`the burst falls back inward (only ${d.out}/${FRAMES - 1} steps move outward)`);
    // The last frame must NOT resemble the first. This plays once, so a
    // re-formed flower at the end is a loop authored into a one-shot.
    const wrap = st[st.length - 1], mid = st.slice(0, -1).reduce((a, b) => a + b, 0) / (st.length - 1);
    if (wrap < mid * 0.6) throw new Error(`it re-forms into frame 1 (wrap step ${wrap} vs mean ${Math.round(mid)})`);
    // Dispersal is GATED, not scored - scoring it just picks the most extreme
    // roll on offer, which is how a burst that ends at 5% won the first round.
    // Among rolls that burst properly, prefer even pacing and a remainder that
    // still reads as petals in flight (~25%).
    const score = +(-(cvOf(st) + Math.abs(d.thin - 0.25) * 2)).toFixed(2);
    console.log(`        accepted — burst x${d.grow} thin ${d.thin} cv ${cvOf(st)} score ${score}` +
      (bestA ? ` (incumbent ${bestA.score})` : ''));
    if (!bestA || score > bestA.score) bestA = { finals, m0, st, score, d };
  } catch (e) {
    console.log('rejected: ' + e.message);
    if (/\b402\b|credit/i.test(e.message)) { console.error('OUT OF CREDITS'); process.exit(3); }
  }
}
if (!bestA) { console.error('ANIM FAILED — frames left untouched'); process.exit(1); }
for (let i = 0; i < FRAMES; i++) {
  const p = join(ANIM, `${KEY}_${i}.webp`);
  await writeFile(p + '.tmp', bestA.finals[i]);
  await rename(p + '.tmp', p);
}
console.log(`WROTE ${FRAMES} frames — ${fmt(bestA.m0)}`);
console.log(`  bursts x${bestA.d.grow} outward, thins to ${Math.round(bestA.d.thin * 100)}%, core ${Math.round(bestA.d.hollow * 100)}% cleared`);
console.log(`  spread ${bestA.d.spread.join(' ')}`);
