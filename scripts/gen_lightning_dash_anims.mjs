#!/usr/bin/env node
// p_lightning (regenerated, pointing RIGHT) + the three remaining class-dash loops.
// ============================================================================
// Per user (2026-09-09): "Regenerate p_lightning with the front tip horizontally pointed,
// and animate it", "create animation for rogue dash and warrior dash sprites make it nice",
// "create animation for archer dash sprites as well and implement them", and
// "ensure no cutoff of edges".
//
// WHY p_lightning HAD TO BE REDRAWN, not just re-oriented: every entry in LX_PLAYER_PROJ is
// authored FACING RIGHT and drawProjectiles rotates it to the projectile's velocity vector.
// The shipped bolt was drawn as a VERTICAL zigzag pointing down, so the engine's rotation
// started from the wrong pose - a bolt fired to the right was rendered lying on its side, tip
// down-range of where it should be. p_arrow, right next to it, is the correct convention: a
// horizontal shaft with its head at the right edge.
//
// THE DASHES ARE NOT REDRAWN. dash_warrior (amber charge burst), dash_rogue (violet smoke
// puff) and dash_archer (emerald wind streak) are the looks already established in game; the
// ask was animation, so their existing sprites are the animation seed and their art is
// untouched. dash_mage was animated in v0.30.465; this finishes the set.
//   Sprites/fx/anim/dash_warrior_0..8.webp   + 'dash_warrior' in _FX_ANIM_KEYS
//   Sprites/fx/anim/dash_rogue_0..8.webp     + 'dash_rogue'
//   Sprites/fx/anim/dash_archer_0..8.webp    + 'dash_archer'
//   Sprites/projectiles/anim/lightning_0..8  + 'lightning' in _PROJ_ANIM_KEYS AND
//                                              lightning: 'lightning' in _GEN_PROJ_ANIM
// Both are opt-in gates: without the entries the loader returns null before it ever looks at
// the folder, so the frames would sit on disk unread.
//
// NO baked rotation in any loop. spawnSpriteBurst mirrors the dash burst for a left dash and
// drawProjectiles rotates the bolt to velocity; a rotation inside the frames would fight both.
//
// NO CUT-OFF EDGES (explicit user requirement). Three separate guards:
//   1. the still is trimmed to its ink and re-seated with a real transparent gutter;
//   2. the loop is packed by ONE shared crop of the nine-frame UNION - per-frame fitting would
//      re-centre each frame and make the loop jitter - and if that union already touches the
//      source border the model itself clipped the art, which throws and re-rolls;
//   3. every written file is re-measured and any ink on a border throws.
//
//   node scripts/gen_lightning_dash_anims.mjs                # dry run, prints the briefs
//   node scripts/gen_lightning_dash_anims.mjs --generate     # needs LUDO_API_KEY
//   flags: --only=lightning|warrior|rogue|archer   --rolls N   --anim-only
import sharp from 'sharp';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_ANIM = join(repoRoot, 'Sprites', 'fx', 'anim');
const PROJ_ANIM = join(repoRoot, 'Sprites', 'projectiles', 'anim');
const LIGHTNING_OUT = join(repoRoot, 'Sprites', 'projectiles', 'p_lightning.webp');
const FRAMES = 9, PROJ_SIZE = 768, FX_SIZE = 768;
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const ROLLS = Number(argOf('--rolls', '4'));

// ---- briefs -----------------------------------------------------------------
const LIGHTNING_PROMPT =
  'A LIGHTNING BOLT projectile for a 2D fantasy game, lying HORIZONTALLY and flying to the '
  + 'RIGHT. It reads like a thrown spear of electricity: a long jagged zig-zag shaft running '
  + 'left to right across the middle of the frame, tapering to a single sharp POINTED TIP at the '
  + 'RIGHT-HAND END, with a forked crackling tail trailing off to the LEFT. Brilliant white-hot '
  + 'core, bright violet and cornflower-blue electric edges, a few small sparks and arcs snapping '
  + 'off the shaft. '
  + 'The long axis is exactly horizontal and the sharp tip is at the right. Do NOT draw it '
  + 'vertical, diagonal, curved or S-shaped, and do not draw a lightning strike coming down from '
  + 'a cloud. One single bolt. '
  + 'Flat 2D cartoon game sprite, bold clean shapes, painted glow, crisp edges, no photorealism, '
  + 'no character, no background, no ground, no clouds, no text. Fully transparent background, '
  + 'the bolt floating free with a clear even margin on all four sides and nothing touching or '
  + 'running off the edge of the frame.';
const LIGHTNING_MOTION =
  'The lightning bolt CRACKLES as it flies. Across the nine frames, spread the motion EVENLY so '
  + 'every frame differs clearly from the one before it, including the last three: the jagged '
  + 'shaft re-forms into slightly different zig-zags, the white-hot core pulses brighter and '
  + 'dimmer, small arcs snap off along its length and fade, and the forked tail on the left '
  + 'flickers. '
  + 'The bolt keeps the SAME horizontal direction, the SAME overall length and the SAME position '
  + 'in every frame, with its sharp tip staying at the RIGHT end. Do not rotate, tilt, flip, move '
  + 'or zoom the picture, and do not add any letters or symbols. The last frame flows back into '
  + 'the first so the loop is seamless. Nothing touches the border.';
// The dash loops seed from the sprites already in game, so each brief describes THAT art moving.
const DASH_MOTION = {
  dash_warrior:
    'This amber speed-burst charge streak SURGES forward. Across the nine frames, spread the motion '
    + 'EVENLY so every frame differs clearly from the one before, including the last three: the '
    + 'converging speed lines stretch and flow to the right, the hot core at the point flares '
    + 'brighter and dimmer, and the small embers drift back and fade. '
    + 'The streak keeps the SAME position, SAME length and SAME horizontal direction every frame - '
    + 'do not rotate, tilt, travel, grow or shrink it, and do not add letters or new objects. '
    + 'The last frame flows into the first. Nothing touches the border.',
  dash_rogue:
    'This violet shadow-smoke puff BILLOWS and dissipates. Across the nine frames, spread the motion '
    + 'EVENLY so every frame differs clearly from the one before, including the last three: the '
    + 'smoke curls and churns outward, its edges softening and thinning as it disperses, and the '
    + 'thin trailing wisp on the left frays away. '
    + 'The puff keeps the SAME position and roughly the SAME overall size every frame - do not '
    + 'rotate, travel or zoom it, and do not add letters or new objects. The last frame flows into '
    + 'the first. Nothing touches the border.',
  dash_archer:
    'These emerald wind streaks STREAM to the right. Across the nine frames, spread the motion '
    + 'EVENLY so every frame differs clearly from the one before, including the last three: the '
    + 'ribbons of wind ripple and flow rightward, overtaking one another, while the small leaves '
    + 'tumble and spin along with them. '
    + 'The gust keeps the SAME position, SAME length and SAME horizontal direction every frame - do '
    + 'not rotate, tilt, travel, grow or shrink it, and do not add letters or new objects. The last '
    + 'frame flows into the first. Nothing touches the border.',
};

const key = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
const ALPHA_ON = 8;
async function px(buf) { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function inkBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; }
  if (x1 < 0) throw new Error('fully transparent');
  return { x0, y0, x1, y1, n, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h };
}
// how tall the ink is inside a horizontal slice of the ink box - a real point tapers
function sliceHeight(p, bx, from, to) {
  let top = p.h, bot = -1;
  const a = Math.round(bx.x0 + bx.w * from), b = Math.round(bx.x0 + bx.w * to);
  for (let y = 0; y < p.h; y++) for (let x = a; x <= b && x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > ALPHA_ON) { if (y < top) top = y; if (y > bot) bot = y; break; }
  return bot < 0 ? 0 : bot - top + 1;
}

// ---- gates ------------------------------------------------------------------
function gateLightning(p, bx) {
  const bad = [];
  if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) bad.push('ink on the canvas border');
  const aspect = bx.w / bx.h;
  if (aspect < 1.6) bad.push(`not horizontal: ink ${bx.w}x${bx.h} (aspect ${aspect.toFixed(2)}, want >= 1.6) - the engine rotates it from a right-facing pose`);
  const tip = sliceHeight(p, bx, 0.90, 1.0), body = sliceHeight(p, bx, 0.25, 0.75);
  if (!body || tip / body > 0.45) bad.push(`the right end is not a point: tip slice ${tip}px vs body ${body}px (want tip <= 45% of body)`);
  return bad;
}
// ONE shared crop across the loop: per-frame fitting re-centres each frame and makes the loop
// jitter. A union already on the border means the model clipped it - no transform invents pixels.
async function packFrames(bufs, size, label) {
  const boxes = []; for (const b of bufs) boxes.push(inkBox(await px(b)));
  const W = boxes[0].W, H = boxes[0].H;
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const touched = [u.x0 <= 1 && 'left', u.y0 <= 1 && 'top', u.x1 >= W - 2 && 'right', u.y1 >= H - 2 && 'bottom'].filter(Boolean);
  if (touched.length) throw new Error(`the loop is clipped at the source edge (${touched.join(', ')})`);
  const inner = Math.round(size * 0.90), cw = u.x1 - u.x0 + 1, chh = u.y1 - u.y0 + 1;
  const scale = inner / Math.max(cw, chh), out = [];
  for (const b of bufs) {
    const crop = await sharp(b).extract({ left: u.x0, top: u.y0, width: cw, height: chh })
      .resize(Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(chh * scale)), { fit: 'fill' }).png().toBuffer();
    out.push(await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: crop, gravity: 'centre' }]).webp({ quality: 92 }).toBuffer());
  }
  console.log(`  ${label}: union ${cw}x${chh} of ${W}x${H} -> packed to ${inner}px, ${Math.round((size - inner) / 2)}px gutter every side`);
  return out;
}
// A loop that stalls looks broken on screen. Measure per-step change and refuse a dead pair.
async function motionProfile(bufs) {
  const ps = []; for (const b of bufs) ps.push(await px(b));
  const steps = [];
  for (let i = 1; i < ps.length; i++) { const a = ps[i - 1], b = ps[i]; let diff = 0, n = 0;
    for (let o = 0; o < a.d.length; o += 16) { diff += Math.abs(a.d[o + 3] - b.d[o + 3]) + Math.abs(a.d[o] - b.d[o]); n++; }
    steps.push(diff / n / 255); }
  return steps;
}
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / data.num_cols), ch = Math.floor(meta.height / data.num_rows), o = [];
    for (let r = 0; r < data.num_rows && o.length < n; r++) for (let c = 0; c < data.num_cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in the response');
}
async function makeImage(prompt, label) {
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} image attempt ${a} ... `);
      const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000), body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0] && data[0].url : (data && (data.url || (data.images && data.images[0] && data.images[0].url)));
      if (!url) throw new Error('no url in the response');
      console.log('ok'); return await fetchBuf(url);
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} FAILED: ${last && last.message}`);
}
async function seat(raw, size, margin) {
  let content; try { content = await sharp(raw).trim({ threshold: 6 }).png().toBuffer(); } catch { content = await sharp(raw).png().toBuffer(); }
  const inner = Math.round(size * (1 - 2 * margin));
  const fitted = await sharp(content).resize(inner, inner, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'centre' }]).webp({ quality: 95 }).toBuffer();
}
async function animate(baseBuf, motion, size, prefix, dir, label) {
  const uri = 'data:image/png;base64,' + (await sharp(baseBuf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      process.stdout.write(`  ${label} animate attempt ${a} ... `);
      const res = await fetch(`${API}/assets/sprite/animate`, { method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(600000), body: JSON.stringify({ initial_image: uri, motion_prompt: motion, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite' }) });
      if (res.status === 402) { console.log('OUT OF CREDITS'); process.exit(3); }
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      console.log('frames in');
      const packed = await packFrames(bufs, size, label);
      const steps = (await motionProfile(packed)).map((s) => +(s * 100).toFixed(2));
      console.log(`  ${label}: per-frame change ${steps.join(' / ')} %`);
      const dead = steps.filter((s) => s < 0.35);
      if (dead.length) throw new Error(`the loop stalls: ${dead.length} step(s) under 0.35% change`);
      await mkdir(dir, { recursive: true });
      const written = [];
      for (let i = 0; i < FRAMES; i++) { const p = join(dir, `${prefix}_${i}.webp`); await writeFile(p + '.tmp', packed[i]); await rename(p + '.tmp', p); written.push(p); }
      let worst = 1e9;
      for (const f of written) { const bx = inkBox(await px(await readFile(f)));
        if (bx.x0 === 0 || bx.y0 === 0 || bx.x1 >= bx.W - 1 || bx.y1 >= bx.H - 1) throw new Error(`${f} touches the border after packing`);
        worst = Math.min(worst, bx.x0, bx.y0, bx.W - 1 - bx.x1, bx.H - 1 - bx.y1); }
      console.log(`  ${label}: ${FRAMES} frames written, no cut-off - tightest margin ${worst}px`);
      return;
    } catch (e) { last = e; console.log('fail: ' + e.message); if (a < 4) await sleep(4000 * a); }
  }
  throw new Error(`${label} ANIM FAILED: ${last && last.message}`);
}
// ---- run --------------------------------------------------------------------
if (!has('--generate')) {
  console.log('DRY RUN - briefs only. Re-run with --generate (needs LUDO_API_KEY).\n');
  console.log('p_lightning base:\n' + LIGHTNING_PROMPT + '\n\np_lightning motion:\n' + LIGHTNING_MOTION + '\n');
  for (const k of Object.keys(DASH_MOTION)) console.log(k + ' motion:\n' + DASH_MOTION[k] + '\n');
  process.exit(0);
}
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
if (!only || only === 'lightning') {
  console.log('\n=== p_lightning ===');
  let chosen = null;
  if (has('--anim-only')) chosen = await readFile(LIGHTNING_OUT);
  else for (let roll = 1; roll <= ROLLS && !chosen; roll++) {
    const seated = await seat(await makeImage(LIGHTNING_PROMPT, `lightning roll ${roll}`), PROJ_SIZE, 0.05);
    const p = await px(seated), bx = inkBox(p), bad = gateLightning(p, bx);
    console.log(`  roll ${roll}: ink ${bx.w}x${bx.h} (aspect ${(bx.w / bx.h).toFixed(2)}) - ${bad.length ? 'REJECT: ' + bad.join('; ') : 'PASSES every gate'}`);
    if (!bad.length) { chosen = seated; await writeFile(LIGHTNING_OUT + '.tmp', seated); await rename(LIGHTNING_OUT + '.tmp', LIGHTNING_OUT); console.log('  base -> Sprites/projectiles/p_lightning.webp'); }
  }
  if (!chosen) { console.error('p_lightning: no roll passed the gates'); process.exitCode = 2; }
  else await animate(chosen, LIGHTNING_MOTION, PROJ_SIZE, 'lightning', PROJ_ANIM, 'lightning');
}
for (const cls of ['warrior', 'rogue', 'archer']) {
  if (only && only !== cls) continue;
  const src = join(repoRoot, 'Sprites', 'fx', `dash_${cls}.webp`);
  if (!existsSync(src)) { console.error(`dash_${cls}: no base sprite at ${src}`); process.exitCode = 2; continue; }
  console.log(`\n=== dash_${cls} (animating the shipped sprite, art unchanged) ===`);
  await animate(await readFile(src), DASH_MOTION[`dash_${cls}`], FX_SIZE, `dash_${cls}`, FX_ANIM, `dash_${cls}`);
}
console.log('\ndone.');
