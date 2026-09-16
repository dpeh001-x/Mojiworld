#!/usr/bin/env node
// Meteor Sigil's comet impact (ludo.ai): a 9-frame one-shot explosion.
//
//   node scripts/gen_sage_meteor_impact_fx.mjs --generate [--rolls N]   # needs LUDO_API_KEY
//   node scripts/gen_sage_meteor_impact_fx.mjs --install                # staged -> Sprites/
//
// Per user: "For sage's meteor sigil skill, when the meteor sigil contacts enemies make a explosion
// animation of the meteor (ensure no cutoffs of edges), it should cause splash damage to the near
// surrounding monsters", then "use ludo.ai to make the explosion animation".
//
// Until now a comet landing was ~27 generic particles and a shake - no explosion at all.
//
// NO CUTOFFS, in two layers, because they fail differently:
//   1. RAW MARGIN. The gen_ground_slam_fx.mjs pattern only checks border alpha AFTER feathering, and
//      the feather guarantees that number - so it cannot notice ludo drawing the fireball right up to
//      (or past) its own frame edge. A cropped blob, feathered, is still a cropped blob. So every RAW
//      frame's ink must keep RAW_MARGIN clear of all four edges at the explosion's largest, or the
//      roll is refused and re-rolled.
//   2. CANVAS FEATHER. The ink is then scaled into the canvas (CONTENT_SCALE) and faded by a radial
//      smoothstep that reaches zero INSIDE the square, so no edge or corner can be a hard cut. The
//      caller draws it 1/FILL larger to match.
//
//   node scripts/gen_sage_meteor_impact_fx.mjs --rejudge <rolls/rN>    # re-gate saved frames, no credits
import sharp from 'sharp';
import { writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY_NAME = 'sage_meteor_impact';
const STAGE = process.env.SMI_STAGE || join(ROOT, 'scripts', '_style_pack', KEY_NAME);
const GEN_FRAMES = 9, SIZE = 768;                 // ludo animates 9; 768^2 = 0.59 MP: True Size needs < 1 MP
// --keep N ships only the first N (min 7). Run 6 roll 1 was clean for eight frames and then its last frame
// pushed a smoke puff through the top edge (a solid 76 px run on row 0) - the burst tail-fade ends the
// explosion in game anyway, so a cut final frame is dropped rather than the whole roll.
const FRAMES = Math.max(7, Math.min(GEN_FRAMES, Number((process.argv.indexOf("--keep") >= 0 && process.argv[process.argv.indexOf("--keep") + 1]) || GEN_FRAMES)));
const CONTENT_SCALE = 0.86, FEATHER_IN = 0.80, FEATHER_OUT = 0.985;
const RAW_MARGIN = Math.round(SIZE * 0.025);      // ~19 px of clear air on every side, every frame
const MOTION_MIN = 4, DRIFT_MAX = 46;
// ROOM TO GROW. Three rolls in a row arrived cropped - a square-boxed flash, smoke sliced flat along the
// top - because the fireball was handed to the animator at 65-70% of its frame, and a blooming blast
// and rising smoke simply run out of box. The seed now goes in at SEED_SCALE of the frame, and the
// finished nine are re-framed afterwards to their UNION box (one crop, one scale, all frames) so the
// art is full-size again without any frame being scaled differently from its neighbours.
const SEED_SCALE = 0.34;   // 0.50 before the anchors; once free, a 0.50 seed bloomed past every edge (2 of 2 rolls)
// ...and shrinking the seed did NOT give it room, because True Size framing (frame_size -9) trims the
// seed's transparent border, animates only what is left, and pastes the result back. Measured on the
// raw frames of all three half-scale rolls: eight of nine frames stop on the SAME pixel line on every
// side (x 187..568, y 190..571 - the seed's own box), with straight ink runs of 56-159 px along it.
// However small the seed, the blast could never outgrow it. So the seed carries a faint ember mark in
// each corner: its box becomes the whole canvas, and the marks are erased from every returned frame
// (ANCHOR_CLEAR px square) before anything is measured.
const ANCHOR_PX = 4, ANCHOR_INSET = 3, ANCHOR_ALPHA = 96, ANCHOR_CLEAR = 64;
// A CLIP WALL: the same extreme line on WALL_FRAMES or more frames, with a straight run of at least
// WALL_RUN px along it. A blast grazes its box at a point; a clipped one lies flat against it.
const WALL_FRAMES = 3, WALL_RUN = 50;
// THE BLAST, NOT ITS SPARKS. Freed from the seed box, the first anchored roll bloomed naturally - and was
// refused because single ember specks flew to the canvas edge. A 5 px spark grazing the edge is not a
// cutoff; a fireball or shockwave ring running off it is. So every edge and wall measure reads a MASS
// mask - the alpha blurred by MASS_BLUR and cut at MASS_T - where a speck averages away (a 6 px spark
// peaks near 37) and a flame body or an 8 px ring stays solid (125+).
const MASS_BLUR = 6, MASS_T = 64;
const LUDO_EDGE_MIN = 6;      // px of air the MASS must keep from the edge of the frame LUDO returned
const UNION_PAD = 0.08;       // room around the mass union box: sparks there survive, and the fade below misses the mass
// Sparks beyond the union box are cropped with it, so the crop line itself is faded out over EDGE_FADE
// px of the re-framed square - nothing, not even a speck, ends on a hard line. (0.04 < the 0.08 pad.)
const EDGE_FADE = Math.round(SIZE * 0.04);
// How much of the canvas the blast fills after re-framing and CONTENT_SCALE: what the game divides the
// splash diameter by, so the drawn fireball and the damaged circle are the same size.
const FILL = CONTENT_SCALE / (1 + 2 * UNION_PAD);
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const BASE_PROMPT =
  'A FIERY METEOR IMPACT EXPLOSION for a 2D fantasy game, seen side-on. One clean idea: a ' +
  'white-hot core bursting into a round, billowing fireball, with a single bright shockwave ring ' +
  'and a few glowing ember sparks thrown outward. The comet that caused it is bright orange fire, ' +
  'so the palette is white-hot yellow at the core, blazing orange and gold in the fireball, deep ' +
  'ember red at the edges, and a few soft charcoal smoke puffs. Flat 2D cartoon game sprite, bold ' +
  'clean shapes, smooth cel shading, thick dark outline. Readable, NOT cluttered. ' +
  'The WHOLE explosion is centred and fits COMPLETELY INSIDE the frame with generous EMPTY MARGIN ' +
  'on all four sides - nothing touches or crosses the edge. ' +
  'NO character, NO weapon, NO ground, NO rocks on the floor, NO text, NO background, NO blue, NO ' +
  'green. Fully TRANSPARENT background (alpha only).';

const MOTION =
  'A single explosion played start to finish across the nine frames, with visible change in every ' +
  'frame and NO looping back. Frames 1-2: a tight white-hot flash IGNITES at the centre. Frames 3-5: ' +
  'the fireball BLOOMS outward to its full size, the shockwave ring racing ahead of it, embers ' +
  'flung out. Frames 6-7: the fire breaks up into orange flame tongues and a few small charcoal smoke ' +
  'puffs. Frames 8-9: it DISSIPATES IN PLACE into scattered embers and faint wisps, so the last frame ' +
  'is nearly gone. ' +
  'The flash is a ROUND burst whose outer glow fades softly into transparency - NEVER a square, box or ' +
  'rectangle of light, and no flame is ever cut off by a straight line. ' +
  'The smoke spreads OUTWARD in small puffs and fades where it is - it does NOT rise into a tall column ' +
  'and does NOT climb toward the top of the frame; keep wide EMPTY SPACE ABOVE the explosion in every ' +
  'frame. ' +
  'CRITICAL - LOCKED FRAMING: the explosion centre stays at the exact same point in every frame; no ' +
  'zoom, pan, crop, drift, mirror or flip. CRITICAL - SIZE LIMIT: the fireball grows to only about ' +
  'TWICE its starting size. EVEN AT ITS LARGEST (frames 4-5) the fireball, the shockwave ring and the ' +
  'smoke fill only the MIDDLE 60% of the frame, leaving a WIDE EMPTY TRANSPARENT BORDER on all four ' +
  'sides; the ring stays a small ring close around the fireball and never reaches the frame edge. Same art ' +
  'style, palette, thick dark outline and transparent background in every frame. ' +
  'NO character, NO ground, NO text, NO background, NO blue, NO green.';

// ---------------------------------------------------------------- install ----
if (has('--install')) {
  const base = join(STAGE, KEY_NAME + '.webp');
  if (!existsSync(base)) { console.error('nothing staged in ' + STAGE); process.exit(1); }
  await copyFile(base, join(ROOT, 'Sprites', 'fx', KEY_NAME + '.webp'));
  await mkdir(join(ROOT, 'Sprites', 'fx', 'anim'), { recursive: true });
  for (let i = 0; i < FRAMES; i++) {
    await copyFile(join(STAGE, `${KEY_NAME}_${i}.webp`), join(ROOT, 'Sprites', 'fx', 'anim', `${KEY_NAME}_${i}.webp`));
  }
  console.log(`installed base + ${FRAMES} frames`);
  console.log(`NOW: node scripts/gen_sprite_frame_index.mjs   (${FRAMES} new frames under fx/anim)`);
  process.exit(0);
}
if (!has('--generate') && !has('--rejudge') && !has('--matte')) { console.log('--generate [--rolls N]  |  --rejudge <rolls dir>  |  --matte <rolls dir>  |  --install'); process.exit(0); }

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
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) continue;
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
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(9); }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let j = await res.json();
  const st = j && (j.status || j.state);
  if (st && st !== 'succeeded' && st !== 'completed' && st !== 'done') {
    const id = j.id || j.job_id || j.jobId;
    if (!id) throw new Error('queued with no job id: ' + JSON.stringify(j).slice(0, 200));
    process.stdout.write(`  job ${id} ${st}…\n`);
    j = await pollJob(id);
  }
  // result can arrive as an ARRAY (the icon backdrop taught us this the hard way)
  if (j && j.result && !j.url && !j.spritesheet_url && !j.individual_frame_urls) {
    return Array.isArray(j.result) ? (j.result.length === 1 ? j.result[0] : j.result) : j.result;
  }
  return j;
}

// ---------------------------------------------------------------- measurement ----
const fit = (buf) => sharp(buf).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 94 }).toBuffer();
async function inkStats(buf) {
  const { data: a, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0, x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let p = 0; p < a.length; p++) {
    if (a[p] <= 24) continue;
    const x = p % info.width, y = (p / info.width) | 0;
    sx += x; sy += y; n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const margin = n ? Math.min(x0, y0, info.width - 1 - x1, info.height - 1 - y1) : info.width;
  return { a, n, cx: n ? sx / n : 0, cy: n ? sy / n : 0, margin };
}
// A CROP INSIDE THE FRAME. The margin gate only asks whether ink touches the CANVAS edge; a roll that
// passed it still arrived with its flash boxed into a square and its smoke sliced flat, 30+ px clear
// of every edge. A per-frame "how flat is this side" score could not separate that from a broad-topped
// fireball (clean 101 px vs cropped 105 px). What does separate them is REPETITION: a clip is one fixed
// line, so frame after frame stops on it (see WALL_FRAMES / WALL_RUN).
async function clearCorners(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, c = ANCHOR_CLEAR;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if ((x < c || x >= W - c) && (y < c || y >= H - c)) data[(y * W + x) * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
// Pieces of ink smaller than SPARK_AREA px are sparks. The blur alone let an elongated ember streak
// (~12 x 35 px) through as "mass" and refused the best roll for it; a component filter does not care
// about shape. A fireball, a smoke puff joined to it or an unbroken ring is thousands of px.
const SPARK_AREA = 1500;
function dropSparks(data, W, H, cut) {
  const lab = new Int32Array(W * H), stack = new Int32Array(W * H), keep = new Uint8Array(W * H);
  let id = 0;
  for (let p0 = 0; p0 < W * H; p0++) {
    if (lab[p0] || data[p0] <= cut) continue;
    id++; let sp = 0, n = 0; const members = [];
    stack[sp++] = p0; lab[p0] = id;
    while (sp) {
      const p = stack[--sp]; members.push(p); n++;
      const x = p % W;
      for (const q of [p - W, p + W, x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1])
        if (q >= 0 && q < W * H && !lab[q] && data[q] > cut) { lab[q] = id; stack[sp++] = q; }
    }
    if (n >= SPARK_AREA) for (const p of members) keep[p] = 1;
  }
  return keep;
}
async function extents(buf, massMask = true) {   // of the MASS mask (blur, then sparks dropped), or of raw alpha
  let img = sharp(buf).ensureAlpha().extractChannel('alpha');
  if (massMask) img = img.blur(MASS_BLUR);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const cut = massMask ? MASS_T : 24, W = info.width, H = info.height;
  const kept = massMask ? dropSparks(data, W, H, cut) : null;
  const on = kept ? (x, y) => kept[y * W + x] === 1 : (x, y) => data[y * W + x] > cut;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) {
    n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  let L = 0, R = 0, T = 0, B = 0;   // ink along the outermost column / row on each side
  if (n) {
    for (let y = 0; y < H; y++) { if (on(x0, y)) L++; if (on(x1, y)) R++; }
    for (let x = 0; x < W; x++) { if (on(x, y0)) T++; if (on(x, y1)) B++; }
  }
  const margin = n ? Math.min(x0, y0, W - 1 - x1, H - 1 - y1) : W;
  return { n, x0, y0, x1, y1, L, R, T, B, margin };
}
async function fadeSquareEdge(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ss = (t) => (t >= 1 ? 1 : t * t * (3 - 2 * t));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (e < EDGE_FADE) data[(y * W + x) * 4 + 3] = Math.round(data[(y * W + x) * 4 + 3] * ss(e / EDGE_FADE));
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 94 }).toBuffer();
}
// Judged on BOTH masks, because each blinds the other: sparks scatter the raw-alpha extremes so no line
// repeats, and the blur rounds a clip's corners so its straight run shrinks (a clipped roll's 89 px left
// wall read 46 px blurred). A side is walled when either mask says so; a line within LUDO_EDGE_MIN of the
// canvas edge is the edge gate's business, not a wall. The roll is refused on TWO walled sides: a clip box
// walls three or four (every clipped roll on record), while a blast sitting on a flat shock ring - which
// the anchored rolls draw - flattens only its bottom.
const WALL_SIDES = 2;
function clipWalls(extRaw, extMass) {
  const walls = [], log = [];
  for (const [side, key, run, pick, edge] of [['left', 'x0', 'L', Math.min, (v) => v], ['right', 'x1', 'R', Math.max, (v) => SIZE - 1 - v],
                                               ['top', 'y0', 'T', Math.min, (v) => v], ['bottom', 'y1', 'B', Math.max, (v) => SIZE - 1 - v]]) {
    const read = [];
    for (const [name, ext] of [['raw', extRaw], ['mass', extMass]]) {
      const live = ext.filter((e) => e.n > 0);
      const lim = pick(...live.map((e) => e[key]));
      const at = live.filter((e) => Math.abs(e[key] - lim) <= 1);
      const longest = Math.max(...at.map((e) => e[run]));
      const hit = edge(lim) >= LUDO_EDGE_MIN && at.length >= WALL_FRAMES && longest >= WALL_RUN;
      read.push({ name, lim, frames: at.length, longest, hit });
    }
    log.push(`${side} ` + read.map((x) => `${x.name} ${x.frames}f/${x.longest}px${x.hit ? '!' : ''}`).join(' '));
    const w = read.find((x) => x.hit);
    if (w) walls.push(`${side} edge stops at ${w.lim}px on ${w.frames} frames, ${w.longest}px straight (${w.name})`);
  }
  return { walls, refuse: walls.length >= WALL_SIDES,
           log: log.join(' · ') + ` (wall = ${WALL_FRAMES}+ frames and ${WALL_RUN}+ px; refuse at ${WALL_SIDES} sides)` };
}
// THE HOT CORE, not all ink. The drift gate this generator inherited from gen_ground_slam_fx.mjs
// measured the centroid of every opaque pixel - right for a crater pinned to the ground, wrong for an
// explosion, whose smoke RISES and whose flames billow. Three rolls were refused for 71-131 px of
// "drift" that nothing showed was the blast leaving its impact point. What must not move is where the
// blast STARTED: the white-hot core. Charcoal smoke is dark, so it cannot pull this centroid.
async function coreStats(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let p = 0, q = 0; p < data.length; p += 4, q++) {
    if (data[p + 3] < 128) continue;
    const luma = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    if (luma < 200) continue;
    sx += q % info.width; sy += (q / info.width) | 0; n++;
  }
  return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
}
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
    const d = Math.hypot(x - c, y - c) / R;
    let k;
    if (d <= FEATHER_IN) k = 1;
    else if (d >= FEATHER_OUT) k = 0;
    else { const t = (d - FEATHER_IN) / (FEATHER_OUT - FEATHER_IN); k = 1 - (t * t * (3 - 2 * t)); }
    data[i + 3] = Math.round(data[i + 3] * k);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 94 }).toBuffer();
}
async function borderAlpha(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let s = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++)
    if (x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2) { s += data[y * info.width + x]; n++; }
  return s / n;
}

// ---------------------------------------------------------------- one roll ----
async function roll(r) {
  console.log(`\nroll ${r}`);
  const d0 = await post('/assets/image', { image_type: 'sprite', prompt: BASE_PROMPT, art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false });
  const url = Array.isArray(d0) ? (d0[0] && (d0[0].url || d0[0])) : (d0 && (d0.url || (d0.images && d0.images[0] && d0.images[0].url)));
  if (!url) throw new Error('no base url: ' + JSON.stringify(d0).slice(0, 200));
  const base = await fit(await fetchBuf(url));
  const bs = await inkStats(base);
  console.log(`  base plate: ink margin ${bs.margin}px`);
  if (bs.margin < RAW_MARGIN) return { ok: false, why: `the base plate already touches its edge (${bs.margin}px < ${RAW_MARGIN})` };

  const seedInner = Math.round(SIZE * SEED_SCALE);
  const mark = await sharp({ create: { width: ANCHOR_PX, height: ANCHOR_PX, channels: 4, background: { r: 255, g: 150, b: 60, alpha: ANCHOR_ALPHA / 255 } } }).png().toBuffer();
  const far = SIZE - ANCHOR_INSET - ANCHOR_PX;
  const seed = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(base).resize(seedInner, seedInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
                  left: Math.round((SIZE - seedInner) / 2), top: Math.round((SIZE - seedInner) / 2) },
                ...[[ANCHOR_INSET, ANCHOR_INSET], [far, ANCHOR_INSET], [ANCHOR_INSET, far], [far, far]].map(([left, top]) => ({ input: mark, left, top }))])
    .png().toBuffer();   // PNG: the anchors' partial alpha must reach ludo exactly
  await mkdir(join(STAGE, 'rolls', 'r' + r), { recursive: true });
  await writeFile(join(STAGE, 'rolls', 'r' + r, 'seed.png'), seed);
  const anim = await post('/assets/sprite/animate', {
    initial_image: `data:image/png;base64,${seed.toString('base64')}`,
    motion_prompt: MOTION, frames: GEN_FRAMES, frame_size: -9,
    model: 'eagle', individual_frames: true, loop: false, image_type: 'sprite',
  });
  let bufs = [];
  if (Array.isArray(anim.individual_frame_urls)) for (const u of anim.individual_frame_urls.slice(0, GEN_FRAMES)) bufs.push(await fetchBuf(u));
  if (bufs.length < GEN_FRAMES && anim.spritesheet_url && anim.num_cols && anim.num_rows) {
    bufs = [];
    const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
    const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
    for (let y = 0; y < anim.num_rows && bufs.length < GEN_FRAMES; y++)
      for (let x = 0; x < anim.num_cols && bufs.length < GEN_FRAMES; x++)
        bufs.push(await sharp(sheet).extract({ left: x * cw, top: y * ch, width: cw, height: ch }).png().toBuffer());
  }
  if (bufs.length < GEN_FRAMES) return { ok: false, why: `got ${bufs.length}/${GEN_FRAMES} frames` };
  const rdir0 = join(STAGE, 'rolls', 'r' + r);
  await mkdir(rdir0, { recursive: true });
  for (let i = 0; i < GEN_FRAMES; i++)   // untouched, for review - and for --rejudge, which costs no credits
    await writeFile(join(rdir0, `ludo_raw_${i}.png`), await sharp(bufs[i]).png().toBuffer());
  return judge('r' + r, bufs.slice(0, FRAMES));
}

// ---------------------------------------------------------------- judge nine frames ----
async function judge(tag, bufs) {
  // gate 0 - margin against the frame LUDO RETURNED, before any resize or pad can move a crop line
  // inland (which is how a cropped flash previously reached the canvas 32 px clear of every edge).
  const ext = [], extRaw = [];
  for (let i = 0; i < FRAMES; i++) {
    bufs[i] = await clearCorners(await fit(bufs[i]));
    ext.push(await extents(bufs[i]));
    extRaw.push(await extents(bufs[i], false));
  }
  const ludoMin = Math.min(...ext.map((e) => e.margin)), ludoAt = ext.findIndex((e) => e.margin === ludoMin);
  console.log(`  ludo frames: blast mass keeps ${ludoMin}px from the edge at its tightest, frame ${ludoAt} (need ${LUDO_EDGE_MIN})`);
  if (ludoMin < LUDO_EDGE_MIN) return { ok: false, why: `the blast runs off ludo's own frame on frame ${ludoAt} (${ludoMin}px)` };
  const cw = clipWalls(extRaw, ext);
  console.log('  clip walls: ' + cw.log);
  if (cw.refuse) return { ok: false, why: 'the blast is clipped flat inside the frame - ' + cw.walls.join('; ') };

  // re-frame all nine to the UNION of their mass boxes - one crop and one scale for the whole set
  const fitted = bufs;
  let ux0 = SIZE, uy0 = SIZE, ux1 = -1, uy1 = -1;
  for (const e of ext) if (e.n) {
    ux0 = Math.min(ux0, e.x0); uy0 = Math.min(uy0, e.y0); ux1 = Math.max(ux1, e.x1); uy1 = Math.max(uy1, e.y1);
  }
  const side = Math.max(ux1 - ux0 + 1, uy1 - uy0 + 1);
  const pad = Math.round(side * UNION_PAD), box = side + pad * 2;
  const cxU = (ux0 + ux1) / 2, cyU = (uy0 + uy1) / 2;
  const left = Math.round(cxU - box / 2), top = Math.round(cyU - box / 2);
  console.log(`  union box ${ux1 - ux0 + 1}x${uy1 - uy0 + 1} -> square ${box}px re-framed to ${SIZE}`);
  const raw = [];
  for (const f of fitted) {
    // extend with transparency where the square crop leaves the canvas, then crop and scale up
    const ext = await sharp(f).extend({ top: Math.max(0, -top), bottom: Math.max(0, top + box - SIZE),
      left: Math.max(0, -left), right: Math.max(0, left + box - SIZE), background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    raw.push(await fadeSquareEdge(await sharp(ext).extract({ left: Math.max(0, left), top: Math.max(0, top), width: box, height: box })
      .resize(SIZE, SIZE).png().toBuffer()));
  }
  const st = [], mass = [];
  for (const f of raw) { st.push(await inkStats(f)); mass.push(await extents(f)); }

  // gate 1 - it must actually MOVE
  let motion = 0;
  for (let i = 1; i < st.length; i++) {
    let d = 0; const A = st[i - 1].a, B = st[i].a;
    for (let p = 0; p < A.length; p += 7) d += Math.abs(A[p] - B[p]);
    motion += d / (A.length / 7);
  }
  motion /= (st.length - 1);
  // gate 2 - the blast must not slide off its impact point. Judged on the HOT CORE (see coreStats),
  // over the frames that still have one - a dissipated frame has no core and its centroid is noise.
  const cores = [];
  for (const f of raw) cores.push(await coreStats(f));
  const corePeak = Math.max(...cores.map((c) => c.n));
  const hot = cores.filter((c) => c.n >= Math.max(40, corePeak * 0.15));
  const coreDrift = hot.length < 2 ? 0 : Math.max(
    Math.max(...hot.map((c) => c.cx)) - Math.min(...hot.map((c) => c.cx)),
    Math.max(...hot.map((c) => c.cy)) - Math.min(...hot.map((c) => c.cy)));
  // the all-ink numbers, kept for the log so a refusal can be read (rising smoke shows as Y, a slide as X)
  const peak = Math.max(...st.map((s) => s.n));
  const solid = st.filter((s) => s.n >= peak * 0.25);
  const inkDX = Math.max(...solid.map((s) => s.cx)) - Math.min(...solid.map((s) => s.cx));
  const inkDY = Math.max(...solid.map((s) => s.cy)) - Math.min(...solid.map((s) => s.cy));
  // gate 3 - THE NO-CUTOFF GATE, on the re-framed blast mass, before any feather can hide it
  const minMargin = Math.min(...mass.map((s) => s.margin));
  const worstFrame = mass.findIndex((s) => s.margin === minMargin);
  console.log(`  motion ${motion.toFixed(2)} (min ${MOTION_MIN}) · core drift ${coreDrift.toFixed(1)}px over ${hot.length} hot frames (max ${DRIFT_MAX}) · ` +
              `ink drift x ${inkDX.toFixed(0)} y ${inkDY.toFixed(0)} (info) · tightest raw margin ${minMargin}px on frame ${worstFrame} (need ${RAW_MARGIN})`);

  // keep EVERY roll, passed or not, so a refusal can be looked at rather than taken on trust
  const rdir = join(STAGE, 'rolls', tag);
  await mkdir(rdir, { recursive: true });
  const feathered = [];
  for (let i = 0; i < FRAMES; i++) {
    const out = await featherRadial(raw[i]);
    feathered.push(out);
    await writeFile(join(rdir, `${KEY_NAME}_${i}.webp`), out);
  }
  const TH = 180, tiles = [];
  for (let i = 0; i < FRAMES; i++) {
    tiles.push({ input: await sharp(raw[i]).resize(TH, TH, { fit: 'contain', background: { r: 40, g: 44, b: 56, alpha: 255 } }).png().toBuffer(),
                 left: (i % 9) * TH, top: 0 });
  }
  await sharp({ create: { width: TH * 9, height: TH, channels: 4, background: { r: 40, g: 44, b: 56, alpha: 255 } } })
    .composite(tiles).png().toFile(join(rdir, 'raw_strip.png'));

  const bad = [];
  if (motion < MOTION_MIN) bad.push('frames barely change');
  if (hot.length < 2) bad.push('no white-hot core to anchor the blast on');
  if (coreDrift > DRIFT_MAX) bad.push(`the blast core itself slides ${coreDrift.toFixed(0)} px off its impact point`);
  if (minMargin < RAW_MARGIN) bad.push(`the explosion reaches its frame edge on frame ${worstFrame} (${minMargin}px) - that is a CUTOFF`);
  if (bad.length) return { ok: false, why: bad.join('; ') };

  // passed: stage at the install path
  await mkdir(STAGE, { recursive: true });
  let worstBorder = 0;
  await writeFile(join(STAGE, KEY_NAME + '.webp'), feathered[4]);   // the still = the full bloom
  // a shorter set must not inherit a longer set's tail frames from an earlier stage
  for (let i = FRAMES; i < GEN_FRAMES; i++) await rm(join(STAGE, `${KEY_NAME}_${i}.webp`), { force: true });
  for (let i = 0; i < FRAMES; i++) {
    worstBorder = Math.max(worstBorder, await borderAlpha(feathered[i]));
    await writeFile(join(STAGE, `${KEY_NAME}_${i}.webp`), feathered[i]);
  }
  console.log(`  worst border alpha after feather ${worstBorder.toFixed(2)} (max 1) · fill ${FILL.toFixed(3)} (game draws size = splash diameter / fill)`);
  if (worstBorder > 1) return { ok: false, why: 'the feathered circumference is not clean' };
  return { ok: true, motion, coreDrift, minMargin };
}

// ---------------------------------------------------------------- matte ----
// --matte <rolls/rN>: ludo sometimes paints an opaque sky behind an otherwise good blast (run 6 roll 1:
// the size cap held on all nine frames, but eight came back on a dark background). Rather than throw
// that roll away, each OPAQUE frame goes through ludo's own remove-background (0.5 credits a frame) and
// the matted nine are written beside it, for --rejudge to gate like any other roll.
const MATTE = arg('--matte');
if (MATTE) {
  const out = MATTE.replace(/[\\/]+$/, '') + '_matte';
  await mkdir(out, { recursive: true });
  for (let i = 0; i < GEN_FRAMES; i++) {
    const src = await sharp(join(MATTE, `ludo_raw_${i}.png`)).png().toBuffer();
    const { data } = await sharp(src).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
    let solid = 0;
    for (const v of data) if (v > 200) solid++;
    const cover = solid / data.length;
    let buf = src;
    if (cover > 0.9) {
      const d = await post('/assets/image/remove-background', { image: 'data:image/png;base64,' + src.toString('base64') });
      const url = Array.isArray(d) ? (d[0] && (d[0].url || d[0])) : (d && (d.url || (d.images && d.images[0] && d.images[0].url)));
      if (!url) throw new Error('no matte url: ' + JSON.stringify(d).slice(0, 200));
      const got = await fetchBuf(url), m = await sharp(got).metadata();
      // a matte that comes back trimmed has lost where the blast sat in the frame - refuse, don't guess
      if (m.width !== SIZE || m.height !== SIZE) throw new Error(`matte for f${i} came back ${m.width}x${m.height}, not ${SIZE}x${SIZE}`);
      buf = await sharp(got).ensureAlpha().png().toBuffer();
    }
    console.log(`  f${i} opaque ${(cover * 100).toFixed(0)}% - ${cover > 0.9 ? 'matted' : 'kept'}`);
    await writeFile(join(out, `ludo_raw_${i}.png`), buf);
  }
  console.log(`matted set in ${out} - next: --rejudge ${out}`);
  process.exit(0);
}

// ---------------------------------------------------------------- run ----
let win = null;
const REJUDGE = arg('--rejudge');
if (REJUDGE) {
  // re-run every gate on nine frames ludo already returned (rolls/<r>/ludo_raw_*.png): no credits spent
  const bufs = [];
  for (let i = 0; i < FRAMES; i++) bufs.push(await sharp(join(REJUDGE, `ludo_raw_${i}.png`)).png().toBuffer());
  console.log(`\nrejudge ${REJUDGE}`);
  const res = await judge('rejudged_' + REJUDGE.replace(/[\\/:]+/g, '_').slice(-40), bufs);
  if (res.ok) win = res; else { console.log('  REFUSED: ' + res.why); process.exit(3); }
} else {
  const ROLLS = Math.max(1, Number(arg('--rolls') || 3));
  for (let r = 1; r <= ROLLS && !win; r++) {
    try {
      const res = await roll(r);
      if (res.ok) win = res; else console.log('  REFUSED: ' + res.why);
    } catch (e) { console.log('  roll failed: ' + String(e.message).slice(0, 200)); }
  }
  if (!win) { console.error(`\nno roll passed all gates in ${ROLLS}`); process.exit(3); }
}

const TH = 200, names = [KEY_NAME + '.webp'];
for (let i = 0; i < FRAMES; i++) names.push(`${KEY_NAME}_${i}.webp`);
const tiles = [];
for (let i = 0; i < names.length; i++) {
  tiles.push({ input: await sharp(join(STAGE, names[i])).resize(TH, TH, { fit: 'contain', background: { r: 40, g: 44, b: 56, alpha: 255 } }).png().toBuffer(),
               left: (i % 5) * TH, top: Math.floor(i / 5) * TH });
}
await sharp({ create: { width: TH * 5, height: TH * Math.ceil(names.length / 5), channels: 4, background: { r: 40, g: 44, b: 56, alpha: 255 } } })
  .composite(tiles).png().toFile(join(STAGE, 'contact_sheet.png'));
console.log(`\nstaged in ${STAGE} — review contact_sheet.png, then --install`);
