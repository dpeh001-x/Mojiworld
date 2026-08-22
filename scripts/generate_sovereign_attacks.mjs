#!/usr/bin/env node
// The Sovereign of the Spire — one attack animation per attack (ludo.ai).
// =============================================================================
// Per user: "using ludo.ai generate new unique attacking sprites for the
// different towersovereign attacks".
//
// The Sovereign has FIVE distinct attacks and one attack animation. Every one of
// them -- the melee swing, the starfire column, the singularity collapse, the
// five-shard homing volley, the drain pillars -- plays the same nine frames, so
// the apex fight reads as one repeated gesture no matter what is about to hit
// you. Gravitos already sets the precedent for the fix: gravitospunch /
// gravitoslaser / gravitossoul / gravitosstar are separate sets in
// Sprites/bosses/attack/, chosen by a per-attack sprite key.
//
// WHY ANIMATE AND NOT GENERATE FROM SCRATCH. A text-to-image call cannot
// reproduce this specific character -- hooded, black-and-gold plate, cloak,
// runed staff -- five times running, and five subtly different Sovereigns would
// be worse than one repeated animation. /assets/sprite/animate takes an
// initial_image, so every set is animated FROM the Sovereign's own sprite with a
// different motion prompt. Same character by construction; only the motion
// differs.
//
// Frames are baked back onto the source's exact 1656x1314 canvas at the source's
// own content offset. The renderer anchors a boss by its content bbox, so a
// tight-cropped frame would rescale the boss mid-attack.
//
//   node scripts/generate_sovereign_attacks.mjs                 # dry-run
//   node scripts/generate_sovereign_attacks.mjs --generate      # all five
//   flags: --only <key>   --frames N
// Needs LUDO_API_KEY. Never commit the key.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATK_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const SRC = join(ATK_DIR, 'towerSovereign_0.webp');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAMES = Number(arg('--frames') || 9);

const COMMON = ' The character stays the same hooded armoured sovereign in black and gold plate with a long cloak and a runed staff, identical costume and colours in every frame. '
  + 'Centred, full body, feet on the same line, the silhouette stays the same size and position in frame. '
  // v2 — the first pass of volley and collapse came back CROPPED: the model
  // zoomed in, so the shard burst was sliced flat at the frame edge and the
  // Sovereign's legs were cut off below the knee. Padding alone did not stop
  // it; the prompt has to forbid it outright, and _edgeTouching() below now
  // measures it so a clipped set is never silently accepted.
  + 'The ENTIRE figure stays inside the frame at all times: the top of the head, both feet, the full cloak and every effect are fully visible with a wide empty margin on all four sides. '
  + 'Nothing is ever cropped or cut by the frame edge. Do not zoom in, do not scale the character up, keep the framing wide. '
  + 'Seamless loop, no camera movement, no zooming, no drifting, no text, transparent background.';

// One motion per attack. Each is written as a BODY ACTION rather than as an
// effect, because the effect itself is already drawn by the game (hazards,
// projectiles, telegraph columns) -- what is missing is the boss's own pose.
const ATTACKS = {
  swing: {
    key: 'towerSovereignswing',
    motion: 'The sovereign raises the runed staff high overhead with both hands and sweeps it down and across in a wide committed melee arc, cloak flaring outward with the swing, then recovers.' + COMMON,
  },
  column: {
    key: 'towerSovereigncolumn',
    motion: 'The sovereign drives the butt of the runed staff straight down into the ground and holds it there, both hands on the shaft, head bowed, cloak settling from the impact, pale starfire light rising around the staff base.' + COMMON,
  },
  collapse: {
    key: 'towerSovereigncollapse',
    // v2 — the sphere is explicitly SMALL and held clear of the frame edge. The
    // first pass grew it until it dominated the top of the frame, which pushed
    // the figure down and cropped its legs.
    motion: 'The sovereign lifts both arms high and wide, palms up, back slightly arched, gathering a SMALL dark sphere of collapsing light in the air above the hands. '
      + 'The sphere stays small and compact, well clear of the top of the frame. The sovereign remains standing upright with both feet planted and fully visible.' + COMMON,
  },
  volley: {
    key: 'towerSovereignvolley',
    // v2 — the shards travel FORWARD from the hand rather than exploding
    // radially. The first pass produced a full-frame starburst that buried the
    // character and was sliced flat on three sides.
    // v3 tried to strengthen the motion with "THRUSTS ... sharply forward" and
    // clipped 9 frames out of 9 on three consecutive rolls at x1.46-1.63 zoom:
    // the urgent verbs make the model frame in tighter, every time. That is a
    // property of the prompt, not luck, so v4 keeps v2's calm wording (which
    // never clipped) and gets the motion from a described ARM POSITION instead
    // of from an urgent verb. Residual drift is corrected by --normalize.
    motion: 'The sovereign stands and slowly extends one arm straight out in front of the body at shoulder height, palm open and facing away, while the staff arm lowers and draws back behind the hip. '
      + 'The extended arm is held out clearly away from the torso through the middle of the sequence, then lowers again. '
      + 'A few small bright shards drift away from the open palm. '
      + 'No radial explosion, no starburst, no glow around the body, nothing covering the sovereign.' + COMMON,
  },
  drain: {
    key: 'towerSovereigndrain',
    motion: 'The sovereign spreads both arms low and wide with palms turned down toward the floor, leaning back slightly, drawing streams of pale light upward past the body from below, cloak lifting.' + COMMON,
  },
};

if (!has('--generate')) {
  console.log('# Sovereign per-attack animations (ludo.ai)\n');
  console.log('  source :', 'Sprites/bosses/attack/towerSovereign_0.webp (animated FROM the boss itself)');
  console.log('  frames :', FRAMES, 'per attack\n');
  for (const [n, a] of Object.entries(ATTACKS)) {
    console.log(`  ${n.padEnd(9)} -> Sprites/bosses/attack/${a.key}_0..${FRAMES - 1}.webp`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --only <key> --frames N');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 402 || /\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS');
    throw new Error(`${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// content bbox of an RGBA buffer
const ALPHA = 16;
async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return (x1 < 0) ? null : { x0, y0, x1, y1, W, H };
}

const srcMeta = await sharp(SRC).metadata();
const CANVAS_W = srcMeta.width, CANVAS_H = srcMeta.height;
const srcBox = await bbox(await sharp(SRC).toBuffer());
if (!srcBox) { console.error('source sprite is empty'); process.exit(1); }
console.log(`source ${CANVAS_W}x${CANVAS_H}, content box ${srcBox.x1 - srcBox.x0 + 1}x${srcBox.y1 - srcBox.y0 + 1} at (${srcBox.x0},${srcBox.y0})`);

// Is any opaque pixel sitting on the outer border of its own frame? That is
// exactly the reported defect -- "the sprite edges are cut off" -- and it can
// only be seen on the RAW returned frame: once the set is baked into the game
// canvas the clip is already inside the art and looks like a design choice.
async function edgeTouching(buf, margin = 2) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const hot = (x, y) => data[(y * W + x) * C + 3] > 48;
  let n = 0;
  for (let x = 0; x < W; x++) for (let m = 0; m < margin; m++) { if (hot(x, m)) n++; if (hot(x, H - 1 - m)) n++; }
  for (let y = 0; y < H; y++) for (let m = 0; m < margin; m++) { if (hot(m, y)) n++; if (hot(W - 1 - m, y)) n++; }
  return n;
}

// NOTE — a foot-band width check was tried here as a "did the model zoom?"
// gate and REMOVED: measured across the finished sets it reported 1.64-1.88x
// drift for every one of them, including swing and column, which do not zoom at
// all. The band widens when the cloak flares, so it tracks the POSE rather than
// the character's scale. Gating on it would have rejected good sets and, worse,
// "normalising" against it would have shrunk exactly the frames whose cloak is
// doing the most work. Clipping is still gated below, because that one is
// unambiguous: opaque pixels on the frame border are always a defect.

// Feed the model a padded crop. v2: 0.16 -> 0.42. The first pass of volley and
// collapse both came back clipped because an arms-up pose and a radiating burst
// need far more headroom than a standing pose does, and the model treats the
// supplied frame as the whole world.
const cropW = srcBox.x1 - srcBox.x0 + 1, cropH = srcBox.y1 - srcBox.y0 + 1;
const PAD = 0.42;
// The endpoint refuses a source over 1 megapixel ("True Size only works with
// source images under 1 megapixel"), and 0.42 padding on a 523x615 crop lands
// right on that line. Downscaling the initial costs nothing -- the returned
// frames are rescaled back onto the source canvas regardless -- so cap it well
// under the limit rather than trading away the headroom that stops the crops.
const MAX_PX = 900000;
let initial = await sharp(SRC)
  .extract({ left: srcBox.x0, top: srcBox.y0, width: cropW, height: cropH })
  .extend({
    top: Math.round(cropH * PAD), bottom: Math.round(cropH * PAD),
    left: Math.round(cropW * PAD), right: Math.round(cropW * PAD),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 94 }).toBuffer();
{
  const im = await sharp(initial).metadata();
  const px = im.width * im.height;
  if (px > MAX_PX) {
    const k = Math.sqrt(MAX_PX / px);
    initial = await sharp(initial)
      .resize(Math.floor(im.width * k), Math.floor(im.height * k))
      .webp({ quality: 94 }).toBuffer();
    const im2 = await sharp(initial).metadata();
    console.log(`initial downscaled ${im.width}x${im.height} -> ${im2.width}x${im2.height} (1MP API cap)`);
  }
}

const only = arg('--only');
const TRIES = Math.max(1, Number(arg('--tries') || 3));
let failed = 0;
for (const [name, a] of Object.entries(ATTACKS)) {
  if (only && only !== name && only !== a.key) continue;
  process.stdout.write(`  ${name} (${a.key}) ... `);
  try {
    let bufs = [], clipped = 0;
    // Re-roll a clipped set rather than shipping it. The model is stochastic:
    // the same prompt that crops on one draw is usually clean on the next, and
    // "cut off at the edge" is cheap to detect and impossible to fix later.
    for (let attempt = 1; attempt <= TRIES; attempt++) {
      const anim = await post('/assets/sprite/animate', {
        initial_image: `data:image/webp;base64,${initial.toString('base64')}`,
        motion_prompt: a.motion, frames: FRAMES, frame_size: -9,
        model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite',
      });
      bufs = [];
      if (anim.spritesheet_url && anim.num_cols && anim.num_rows) {
        const sheet = await fetchBuf(anim.spritesheet_url), sm = await sharp(sheet).metadata();
        const cw = Math.floor(sm.width / anim.num_cols), ch = Math.floor(sm.height / anim.num_rows);
        for (let r = 0; r < anim.num_rows && bufs.length < FRAMES; r++)
          for (let c = 0; c < anim.num_cols && bufs.length < FRAMES; c++)
            bufs.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).webp({ quality: 94 }).toBuffer());
      }
      if (bufs.length < FRAMES && Array.isArray(anim.individual_frame_urls)) {
        bufs = []; for (const u of anim.individual_frame_urls.slice(0, FRAMES)) bufs.push(await fetchBuf(u));
      }
      if (bufs.length < FRAMES) throw new Error(`got ${bufs.length}/${FRAMES} frames`);
      clipped = 0;
      for (const b of bufs) { if (await edgeTouching(b) > 24) clipped++; }
      if (!clipped) break;
      process.stdout.write(`[clipped ${clipped}/${FRAMES}; re-roll ${attempt}/${TRIES}] `);
    }
    if (clipped) throw new Error(`still ${clipped}/${FRAMES} frames clipped after ${TRIES} tries`);

    const boxes = [];
    for (const b of bufs) { const bb = await bbox(b); if (bb) boxes.push(bb); }
    if (!boxes.length) throw new Error('every frame empty');
    const U = boxes.reduce((p, q) => ({
      x0: Math.min(p.x0, q.x0), y0: Math.min(p.y0, q.y0),
      x1: Math.max(p.x1, q.x1), y1: Math.max(p.y1, q.y1),
    }));
    const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;
    // scale the union box to the SOURCE content box, preserving aspect
    const sc = Math.min(cropW / uw, cropH / uh);
    const dw = Math.max(1, Math.round(uw * sc)), dh = Math.max(1, Math.round(uh * sc));
    const offX = srcBox.x0 + Math.round((cropW - dw) / 2);
    const offY = srcBox.y0 + (cropH - dh);          // feet-aligned: bottom, not centre
    await mkdir(ATK_DIR, { recursive: true });
    for (let i = 0; i < bufs.length; i++) {
      let cut = null;
      {
        cut = await sharp(bufs[i]).extract({ left: U.x0, top: U.y0, width: uw, height: uh })
          .resize(dw, dh, { fit: 'fill' }).png().toBuffer();
      }
      const out = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: cut, left: offX, top: offY }])
        .webp({ quality: 92 }).toBuffer();
      await writeFile(join(ATK_DIR, `${a.key}_${i}.webp`), out);
    }
    console.log(`OK ${bufs.length} frames`);
    await sleep(1200);
  } catch (e) { failed++; console.log('FAIL: ' + e.message); }
}
console.log(failed ? `\n${failed} attack set(s) failed.` : '\nAll sets written.');
console.log('NEXT: node scripts/gen_sprite_frame_index.mjs   (the loader asks the index how many frames exist)');
process.exit(failed ? 2 : 0);
