// The Arbiter — one attack animation per attack (ludo.ai).
// =============================================================================
// Per user: "generate 2 new attack sprite animation sequences to show profound
// swordsmanship for towerarbiter ensure no cut offs, same in game scale, wire it
// to unique attacks of the towerarbiter".
//
// The Arbiter has two attacks that read as swordsmanship and one animation for
// both: the committed melee arc his bigMelee fires (a VERDICT since v0.30.467,
// which lands for 35% of max HP one swing in four) and the columnStrike that
// drops a pillar of judgment at range. Same nine frames for each, so the fight
// reads as one gesture whatever is about to hit you.
//
// This is scripts/generate_sovereign_attacks.mjs pointed at a different boss —
// deliberately, because every guard in it was paid for: the clip detector, the
// re-roll on a clipped set, the 1MP initial cap, and the feet-aligned bake back
// onto the source's exact canvas at the source's own content offset. Animating
// FROM the boss's own sprite is what keeps the character identical; only the
// motion differs.
//
//   node scripts/generate_arbiter_attacks.mjs                  # dry-run
//   node scripts/generate_arbiter_attacks.mjs --generate
//   ... --only verdict --tries 4 --frames 9
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATK_DIR = join(repoRoot, 'Sprites', 'bosses', 'attack');
const SRC = join(ATK_DIR, 'towerArbiter_0.webp');   // his own attack frame: same knight by construction
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FRAMES = Number(arg('--frames') || 9);

const COMMON = ' The character stays the same armoured knight in ornate polished GOLD plate with deep violet trim, a violet plume on the closed helm and a long violet cape, holding one large straight double-edged broadsword with a gold crossguard. Identical armour, cape, plume and sword in every frame. '
  + 'Centred, full body, feet on the same line, the silhouette stays the same size and position in frame. '
  // v2 — the first pass of volley and collapse came back CROPPED: the model
  // zoomed in, so the shard burst was sliced flat at the frame edge and the
  // Sovereign's legs were cut off below the knee. Padding alone did not stop
  // it; the prompt has to forbid it outright, and _edgeTouching() below now
  // measures it so a clipped set is never silently accepted.
  + 'The ENTIRE figure stays inside the frame at all times: the top of the head, both feet, the full cloak and every effect are fully visible with a wide empty margin on all four sides. '
  + 'Nothing is ever cropped or cut by the frame edge. Do not zoom in, do not scale the character up, keep the framing wide. '
  + 'The SWORD and its POINTED TIP are fully inside the frame in every single frame, with clear empty space beyond the tip. '
  + 'The blade is always drawn complete, from crossguard to sharp point. NEVER let the blade run past the frame edge and NEVER end the blade in a flat straight cut. '
  + 'Seamless loop, no camera movement, no zooming, no drifting, no text, transparent background.';

// One motion per attack. Each is written as a BODY ACTION rather than as an
// effect, because the effect itself is already drawn by the game (hazards,
// projectiles, telegraph columns) -- what is missing is the boss's own pose.
const ATTACKS = {
  // The VERDICT — his bigMelee. A full two-handed judgment cleave: the blade is
  // taken up behind the shoulder, then brought down and through in one committed
  // arc. Written as a BODY ACTION, because the game already draws the swing's
  // own hazard; what is missing is the knight's form.
  verdict: {
    key: 'towerArbiterverdict',
    motion: 'The armoured knight raises the broadsword high behind one shoulder with BOTH hands on the grip, turns the shoulders into the strike, and sweeps the blade down and across the body in one long committed diagonal cleave, cape flaring wide behind him with the turn, then settles back to a balanced guard with the sword low. '
      + 'A clean disciplined swordsman movement, weight shifting from the back foot to the front, both feet staying on the ground the whole time.' + COMMON,
  },
  // The COLUMN — his columnStrike. A formal high guard into a point-first plunge
  // that calls the pillar. The pillar itself is drawn by the game (fx_col_arbiter),
  // so the prompt asks only for the stance that summons it.
  column: {
    key: 'towerArbitercolumn',
    motion: 'The armoured knight brings the broadsword up vertically in front of the body with BOTH hands, point to the sky, holding it still for a beat in a formal high guard, then drives the blade point-first straight down into the ground in front of him and holds that stance with the sword planted, head bowed, cape settling. '
      + 'A slow deliberate ceremonial movement. The knight stays upright with both feet planted and fully visible; the blade goes down in front of him, never out of frame.' + COMMON,
  },
};

if (!has('--generate')) {
  console.log('# Arbiter per-attack animations (ludo.ai)\n');
  console.log('  source :', 'Sprites/bosses/attack/towerArbiter_0.webp (animated FROM the boss itself)');
  console.log('  frames :', FRAMES, 'per attack\n');
  for (const [n, a] of Object.entries(ATTACKS)) {
    console.log(`  ${n.padEnd(9)} -> Sprites/bosses/attack/${a.key}_0..${FRAMES - 1}.webp`);
  }
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --only <key> --frames N --tries N');
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

// v0.30.x — THE KNIGHT, NOT THE UNION. The bake below used to fit the union box of all
// nine frames into the source content box. That is right for a staff, and wrong for a
// broadsword: the union is dominated by wherever the blade reaches, so a set whose cleave
// swings wide renders a SMALLER knight than a set that holds the sword close — measured
// across two rolls of the same prompt, 87% and 104% of each other. Since the calibration
// that scales these sets is authored per set in the animator, that turns a re-roll into a
// silent resize of a boss somebody has already calibrated.
//
// The armour is saturated gold and violet; the blade is desaturated steel. Measuring the
// box of SATURATED pixels tracks the character and ignores the sword, so every roll can be
// normalised to the same knight height and the calibration stays meaningful across re-rolls.
async function armourBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    if (data[i + 3] < 80) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 40 || (mx - mn) / mx < 0.32) continue;   // desaturated => steel, not armour
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return (x1 < 0) ? null : { x0, y0, x1, y1 };
}
// The knight height each set is normalised to, in source-canvas pixels. These are the sizes
// the shipped v0.30.478 calibration was authored against (verdict s 2.18, column s 2.1), so
// pinning them here means a re-roll cannot move a boss out from under its own calibration.
const ARMOUR_TARGET = { towerArbiterverdict: 383, towerArbitercolumn: 356 };

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
const PAD = 0.62;   // v0.30.x — 0.42 framed a staff; a broadsword at full extension needs more
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
      // A sword is THIN. The 24-pixel threshold inherited from the Sovereign (whose
      // staff is short and whose cloak is the thing that brushes the border) let three
      // frames through with the blade sheared flat and tipless: a blade crossing the
      // frame edge contributes only its own width in border pixels, ~10-20, which is
      // under 24. Nothing legitimate touches the border here — the bake re-places the
      // art on the game canvas afterwards, so the model has no reason to reach the edge
      // at all — and 4 leaves room for stray antialiasing without excusing a cut.
      for (const b of bufs) { if (await edgeTouching(b) > 4) clipped++; }
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
    // Scale so the KNIGHT lands at this set's target height (see ARMOUR_TARGET above),
    // measured on the median armour box so one wild frame cannot set the size for all nine.
    const aHs = [];
    for (const b of bufs) { const ab = await armourBox(b); if (ab) aHs.push(ab.y1 - ab.y0 + 1); }
    if (!aHs.length) throw new Error('no armour found in any frame');
    const aMed = aHs.slice().sort((p, q) => p - q)[aHs.length >> 1];
    const target = ARMOUR_TARGET[a.key] || Math.round(cropH * 0.86);
    let sc = target / aMed;
    // ...but never let the sweep overflow the game canvas: if the scaled union does not fit,
    // fall back to fitting it, and say so rather than silently clipping the blade.
    const fit = Math.min(CANVAS_W / uw, srcBox.y1 + 1 - Math.max(0, srcBox.y1 + 1 - CANVAS_H) > 0 ? (srcBox.y1 + 1) / uh : 1);
    if (uw * sc > CANVAS_W || uh * sc > srcBox.y1 + 1) {
      process.stdout.write(`[union ${Math.round(uw * sc)}x${Math.round(uh * sc)} exceeds canvas; fitting instead] `);
      sc = Math.min(sc, fit);
    }
    const dw = Math.max(1, Math.round(uw * sc)), dh = Math.max(1, Math.round(uh * sc));
    // centre on the ARMOUR, not on the union: otherwise a blade held out to one side shoves
    // the knight off his own foot mark by half the blade.
    const a0 = await armourBox(bufs[0]);
    const aCx = a0 ? ((a0.x0 + a0.x1) / 2 - U.x0) * sc : dw / 2;
    const offX = Math.max(0, Math.min(CANVAS_W - dw, Math.round(srcBox.x0 + (a0 ? (srcBox.x1 - srcBox.x0 + 1) / 2 : cropW / 2) - aCx)));
    const offY = Math.max(0, (srcBox.y1 + 1) - dh);   // feet-aligned to the source foot line
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
