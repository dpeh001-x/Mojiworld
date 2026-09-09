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
  // v3 — measured: across six rolls of the swing, frames 0 and 8 (the still guard poses)
  // scored 0.07-0.10 on the taper test EVERY time and every mid-swing frame failed EVERY
  // time. The blade was not being cropped; it was being drawn as a fast-motion SMEAR, a
  // wide streak that ends flat because that is what a swung sword looks like to the model.
  // A smeared blade reads as a cut-off sword in game. So ask for still poses, not speed.
  + 'Every frame is a CRISP STILL POSE of the sword, never a motion blur. No speed lines, no smear, no streak, no ghosting, no double image, no glowing motion trail, no afterimage of the blade. '
  + 'In every single frame the blade is one solid narrow piece of steel with clean sharp edges that tapers evenly to a fine sharp POINT. The blade never widens toward its far end and never ends in a flat blunt edge. '
  + 'The sword moves only a SHORT distance from one frame to the next, so it is always crisply drawn. '
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
    motion: 'The armoured knight holds the broadsword OUT IN FRONT OF HIM at chest height with BOTH hands on the grip, blade level and pointing forward, in a steady braced two-handed guard. '
      + 'THE SWORD ITSELF BARELY MOVES. It stays out in front of him in almost the same place in the whole animation, fully extended into empty space, and only dips through a SMALL controlled downward angle of a few degrees and lifts back. It never swings, never sweeps, never travels across the frame. '
      + 'The animation is in his BODY, not in the sword: he settles his weight onto the back foot, turns his shoulders, drives forward into a braced lunge and leans into the strike with the cape flaring behind him, then settles back to the guard. '
      + 'The sword is ALWAYS IN FRONT OF THE KNIGHT and always held clear of his body, so its whole length is silhouetted against empty background in every frame. '
      + 'The blade NEVER goes above his head, NEVER goes behind his shoulder or behind his helmet, NEVER passes behind the cape, and is NEVER overlapped or hidden by any part of him. '
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
// v0.30.x — A BLADE THAT STOPS DEAD. Two passes of this runner shipped swords with the
// point sheared off, and neither border test could see it: the returned frames have NO
// opaque pixels on their own border (measured — the re-roll never once fired, at either
// threshold), because the model does not clip the blade, it DRAWS it without a tip. So
// test the tip itself. The armour is saturated gold/violet, the blade desaturated steel;
// take the steel mass, find its far end from the armour centroid, and compare the width
// across the outermost 6% of its reach against the width mid-blade. A real point tapers
// to nothing; a cut keeps most of the blade width right up to where it stops.
// Calibrated on eighteen labelled frames from the two shipped sets: every intact blade
// scored 0.073-0.095 and every cut one 0.297-1.076, so 0.18 sits in an empty gap with
// roughly 3x margin on both sides.
const TIP_TAPER_MAX = 0.18;
// A REBUILT point is judged a little more loosely, and the reason is in the detector,
// not the repair. tip/mid divides by the width mid-blade, and "mid-blade" is located
// relative to the armour centroid — so in a pose where the inner half of the sword is
// behind the helmet or the cape, the divisor is a narrow sliver of visible steel and the
// ratio reads high for a blade of any shape. A repaired tip converges linearly to a
// single pixel by construction, so it cannot be blunt; this bound only has to stay well
// under the 0.297 floor of the cut frames the threshold above was calibrated on.
const TIP_MENDED_MAX = 0.28;
async function bladeTipRatio(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const steel = [], arm = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C; if (data[i + 3] < 110) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (mx > 120 && sat < 0.20) steel.push(x, y); else if (mx > 40 && sat >= 0.32) arm.push(x, y);
  }
  if (steel.length < 200 || arm.length < 200) return null;   // no blade visible: nothing to judge
  let ax = 0, ay = 0; for (let k = 0; k < arm.length; k += 2) { ax += arm[k]; ay += arm[k + 1]; }
  ax /= arm.length / 2; ay /= arm.length / 2;
  let fx = 0, fy = 0, fd = -1;
  for (let k = 0; k < steel.length; k += 2) {
    const dx = steel[k] - ax, dy = steel[k + 1] - ay, d = dx * dx + dy * dy;
    if (d > fd) { fd = d; fx = steel[k]; fy = steel[k + 1]; }
  }
  fd = Math.sqrt(fd);
  const ux = (fx - ax) / fd, uy = (fy - ay) / fd, px = -uy, py = ux;
  const band = (lo, hi) => {
    let mn = 1e9, mx = -1e9, n = 0;
    for (let k = 0; k < steel.length; k += 2) {
      const dx = steel[k] - ax, dy = steel[k + 1] - ay;
      const t = dx * ux + dy * uy; if (t < lo || t > hi) continue;
      const p = dx * px + dy * py; if (p < mn) mn = p; if (p > mx) mx = p; n++;
    }
    return n ? mx - mn : null;
  };
  const tip = band(fd * 0.94, fd + 2), mid = band(fd * 0.55, fd * 0.75);
  return (tip == null || !mid) ? null : tip / mid;
}

// v0.30.x — GIVE THE SWORD ITS POINT BACK. Nineteen rolls across four different
// motion prompts never once produced nine frames with an intact blade; the best was
// six. The model draws a proper tapered point when the sword is held still and clear
// of the body (frames 0 and 8 passed EVERY roll) and a stubby chisel end whenever the
// blade is mid-arc or tucked near the helmet. Asking harder does not work: prompting
// moved the failure rate from 5/9 to 3/9 and stopped there. So repair it instead.
//
// A blade is a simple solid: a long steel wedge whose cross-section is dark edge /
// bright flat / dark edge. Taking the cross-section a few pixels inboard of the blunt
// end and re-drawing it with the perpendicular extent shrinking linearly to zero
// extrudes exactly the point the model failed to draw, in the blade's own colours,
// with its own outline carried along the two new edges. Rasterised in DESTINATION
// space (each candidate pixel projected back onto the blade axis) so a diagonal blade
// cannot leave gaps, and 2x2 supersampled so the new edges are antialiased like the
// rest of the art.
//
// It is deliberately timid. It refuses unless the steel really is blade-shaped, it
// never paints over a pixel that already has art, it gives up if the space ahead of
// the tip is not empty (a tip resting against the body is not a cut), and the caller
// re-measures afterwards and still rejects the frame if the taper test does not pass.
// How long the rebuilt point runs, in blade widths. This sword tapers ELEGANTLY: the
// model-drawn blades that pass the test narrow over most of their outer half, which is
// why 2.0 still measured blunt (0.18-0.24) even though the shape was right.
const TIP_POINT_LEN = 3.2;
async function repairBladeTip(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  if (C !== 4) return null;
  const steel = [], arm = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C; if (data[i + 3] < 110) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (mx > 120 && sat < 0.20) steel.push(x, y); else if (mx > 40 && sat >= 0.32) arm.push(x, y);
  }
  if (steel.length < 400 || arm.length < 200) return null;
  let ax = 0, ay = 0; for (let k = 0; k < arm.length; k += 2) { ax += arm[k]; ay += arm[k + 1]; }
  ax /= arm.length / 2; ay /= arm.length / 2;
  // A crude axis first — armour centroid to the farthest steel pixel — but ONLY to pick out
  // which steel is the outer blade. It is useless as the blade's direction: the farthest
  // pixel is a CORNER of the blunt end, so a taper built on it grows as a needle out of one
  // side of the sword. (That is exactly what the first cut of this did.)
  let fx = 0, fy = 0, fd = -1;
  for (let k = 0; k < steel.length; k += 2) {
    const dx = steel[k] - ax, dy = steel[k + 1] - ay, d = dx * dx + dy * dy;
    if (d > fd) { fd = d; fx = steel[k]; fy = steel[k + 1]; }
  }
  fd = Math.sqrt(fd);
  const gx = (fx - ax) / fd, gy = (fy - ay) / fd;
  const outer = [];
  for (let k = 0; k < steel.length; k += 2) {
    const t = (steel[k] - ax) * gx + (steel[k + 1] - ay) * gy;
    if (t > fd * 0.45) outer.push(steel[k], steel[k + 1]);
  }
  if (outer.length < 200) return null;
  // The real blade direction is the principal axis of that outer mass.
  let cx = 0, cy = 0; for (let k = 0; k < outer.length; k += 2) { cx += outer[k]; cy += outer[k + 1]; }
  cx /= outer.length / 2; cy /= outer.length / 2;
  let sxx = 0, syy = 0, sxy = 0;
  for (let k = 0; k < outer.length; k += 2) {
    const dx = outer[k] - cx, dy = outer[k + 1] - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(th), uy = Math.sin(th);
  if ((cx - ax) * ux + (cy - ay) * uy < 0) { ux = -ux; uy = -uy; }   // point it away from the knight
  const px = -uy, py = ux;
  // profile the blade along its own axis
  let tMin = 1e9, tMax = -1e9;
  const ts = new Float64Array(outer.length / 2), qs = new Float64Array(outer.length / 2);
  for (let k = 0, j = 0; k < outer.length; k += 2, j++) {
    const dx = outer[k] - cx, dy = outer[k + 1] - cy;
    const t = dx * ux + dy * uy; ts[j] = t; qs[j] = dx * px + dy * py;
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
  }
  const R = tMax - tMin; if (R < 12) return null;
  const widthAt = (lo, hi) => {
    let a = 1e9, b = -1e9, n = 0;
    for (let j = 0; j < ts.length; j++) { if (ts[j] < lo || ts[j] > hi) continue; if (qs[j] < a) a = qs[j]; if (qs[j] > b) b = qs[j]; n++; }
    return n >= 4 ? { lo: a, hi: b, w: b - a } : null;
  };
  // mid-blade width, measured well clear of both ends
  const mid = widthAt(tMin + R * 0.15, tMin + R * 0.60);
  if (!mid || mid.w < 3 || mid.w > R * 0.75) return null;   // not wedge-shaped: refuse
  const wBlade = mid.w;
  // the cross-section to extrude: one blade-width back from the end, where the steel is
  // still at full width rather than inside the chisel the model drew
  const back = Math.max(3, Math.round(wBlade * 0.9));
  const tRef = tMax - back;
  const ref = widthAt(tRef - 1.5, tRef + 1.5);
  // Extrude from the blade AS IT ACTUALLY IS at that point, not from full width. Two
  // different truncations occur: a chisel, where the steel runs at full width to a flat
  // stop, and a clipped point, where the blade tapers properly and then simply ends part
  // way down (one frame narrowed to 8.5px of a 28px blade before stopping). Sizing the
  // new point off the cross-section that is really there continues whichever it is;
  // demanding full width refused the second kind outright.
  if (!ref || ref.w < Math.max(3, wBlade * 0.2)) return null;
  // ...and never let the point outgrow the sword. Without this a wide end cross-section
  // extrudes a spike half a blade long, which reads as a spear rather than a broadsword.
  const L = Math.max(4, Math.min(Math.round(ref.w * TIP_POINT_LEN), Math.round(R * 0.45)));
  // The model caps its blunt blade with the same dark outline it uses everywhere else, so
  // a taper that merely starts BEYOND that cap leaves the cap in place as a black seam
  // straight across the sword. Redraw the last sliver of the blade at full width too.
  const CAP = Math.max(2, Math.min(back, Math.round(ref.w * 0.5)));
  const at = (x, y) => ((y * W + x) * C);
  const PX = (t, q) => [cx + t * ux + q * px, cy + t * uy + q * py];
  // the space the point will occupy has to be empty, or this is not a cut at all
  let probe = 0, blocked = 0;
  for (let k = 1; k <= L; k++) {
    const sc = 1 - k / L;
    for (const q of [ref.lo * sc, (ref.lo + ref.hi) / 2 * sc, ref.hi * sc]) {
      const [fxp, fyp] = PX(tMax + k, q);
      const x = Math.round(fxp), y = Math.round(fyp);
      if (x < 0 || y < 0 || x >= W || y >= H) return null;   // the point would leave the frame
      probe++; if (data[at(x, y) + 3] >= 40) blocked++;
    }
  }
  if (blocked > probe * 0.15) return null;
  // Bake the cross-section into a profile ONCE, and keep only steel in it. Where a blade
  // crosses the cape the strip between its two edges is not all sword — sampling the raw
  // pixels there extruded a violet stripe down the middle of a rebuilt point. Non-steel
  // samples are refilled from the nearest steel neighbour so the new point is all blade.
  const STEP = 0.5, NP = Math.max(2, Math.round((ref.hi - ref.lo) / STEP) + 1);
  const prof = new Float64Array(NP * 4), good = new Uint8Array(NP);
  const raw = (sx, sy, out) => {
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fxr = sx - x0, fyr = sy - y0;
    let r = 0, g = 0, b = 0, a = 0;
    for (const [dx, dy, wgt] of [[0, 0, (1 - fxr) * (1 - fyr)], [1, 0, fxr * (1 - fyr)], [0, 1, (1 - fxr) * fyr], [1, 1, fxr * fyr]]) {
      const x = Math.min(W - 1, Math.max(0, x0 + dx)), y = Math.min(H - 1, Math.max(0, y0 + dy));
      const i = at(x, y); r += data[i] * wgt; g += data[i + 1] * wgt; b += data[i + 2] * wgt; a += data[i + 3] * wgt;
    }
    out[0] = r; out[1] = g; out[2] = b; out[3] = a;
  };
  { const c = [0, 0, 0, 0];
    for (let j = 0; j < NP; j++) {
      const q = ref.lo + j * STEP; const [sx, sy] = PX(tRef, q); raw(sx, sy, c);
      const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]);
      good[j] = (c[3] >= 100 && mx > 90 && (mx ? (mx - mn) / mx : 0) < 0.30) ? 1 : 0;
      prof[j * 4] = c[0]; prof[j * 4 + 1] = c[1]; prof[j * 4 + 2] = c[2]; prof[j * 4 + 3] = c[3];
    }
    let nGood = 0; for (let j = 0; j < NP; j++) nGood += good[j];
    if (nGood < NP * 0.5) return null;              // that cross-section is not mostly sword
    for (let j = 0; j < NP; j++) if (!good[j]) {    // refill from the nearest steel sample
      let lo = j, hi = j;
      while (lo >= 0 && !good[lo]) lo--;
      while (hi < NP && !good[hi]) hi++;
      const src = (lo < 0) ? hi : (hi >= NP) ? lo : (j - lo <= hi - j ? lo : hi);
      for (let ch = 0; ch < 4; ch++) prof[j * 4 + ch] = prof[src * 4 + ch];
    }
  }
  const sample = (q, out) => {
    const u = Math.min(NP - 1, Math.max(0, (q - ref.lo) / STEP));
    const j0 = Math.floor(u), j1 = Math.min(NP - 1, j0 + 1), f = u - j0;
    for (let ch = 0; ch < 4; ch++) out[ch] = prof[j0 * 4 + ch] * (1 - f) + prof[j1 * 4 + ch] * f;
  };
  // rasterise in DESTINATION space (a diagonal blade cannot leave gaps that way),
  // 2x2 supersampled so the two new edges antialias like the rest of the art
  const out = Buffer.from(data), col = [0, 0, 0, 0];
  const pad = Math.ceil(wBlade + L + 3);   // bbox only; generous on purpose
  const [ex, ey] = PX(tMax, (ref.lo + ref.hi) / 2);
  const bx0 = Math.max(0, Math.floor(ex - pad)), bx1 = Math.min(W - 1, Math.ceil(ex + pad));
  const by0 = Math.max(0, Math.floor(ey - pad)), by1 = Math.min(H - 1, Math.ceil(ey + pad));
  let painted = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = at(x, y);
    // only the doomed end-cap may be painted over; everything else the model drew stands
    const tc = (x + 0.5 - cx) * ux + (y + 0.5 - cy) * uy;
    if (data[i + 3] >= 40 && !(tc > tMax - CAP && tc <= tMax)) continue;
    let cov = 0, qAcc = 0;
    for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const dx = x + ox - cx, dy = y + oy - cy;
      const t = dx * ux + dy * uy; if (t <= tMax - CAP || t > tMax + L) continue;
      const sc = t <= tMax ? 1 : 1 - (t - tMax) / L; if (sc <= 0) continue;
      const q = dx * px + dy * py; if (q < ref.lo * sc || q > ref.hi * sc) continue;
      cov++; qAcc += q / sc;
    }
    if (!cov) continue;
    sample(qAcc / cov, col);
    const a = Math.round(Math.min(255, col[3]) * (cov / 4));
    if (a < 8) continue;
    out[i] = Math.round(col[0]); out[i + 1] = Math.round(col[1]); out[i + 2] = Math.round(col[2]); out[i + 3] = a;
    painted++;
  }
  if (painted < L) return null;                                // nothing meaningful drawn
  return await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 94 }).toBuffer();
}

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
      let blunt = 0, mended = 0; const taper = [];
      for (let fi = 0; fi < bufs.length; fi++) {
        if (await edgeTouching(bufs[fi]) > 4) { clipped++; taper.push('EDGE'); continue; }
        let t = await bladeTipRatio(bufs[fi]), fixedIt = false;
        if (t != null && t > TIP_TAPER_MAX) {
          // the model left this blade blunt; extrude the point it should have drawn
          const fixed = await repairBladeTip(bufs[fi]);
          if (fixed) {
            const t2 = await bladeTipRatio(fixed);
            if (t2 != null && t2 <= TIP_MENDED_MAX) { bufs[fi] = fixed; t = t2; fixedIt = true; mended++; }
          }
        }
        taper.push((t == null ? 'n/a' : t.toFixed(2)) + (fixedIt ? '*' : ''));   // * = point rebuilt
        if (t != null && t > (fixedIt ? TIP_MENDED_MAX : TIP_TAPER_MAX)) blunt++;   // could not be mended
      }
      clipped += blunt;
      if (mended) process.stdout.write('[' + mended + ' tip' + (mended > 1 ? 's' : '') + ' rebuilt] ');
      if (!clipped) break;
      process.stdout.write(`[${clipped}/${FRAMES} bad (taper ${taper.join(" ")}); re-roll ${attempt}/${TRIES}] `);
    }
    if (clipped) throw new Error(`still ${clipped}/${FRAMES} frames clipped or tipless after ${TRIES} tries`);

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
