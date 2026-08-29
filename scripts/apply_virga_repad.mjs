// v0.30.293 — Virga's wings stop being feathered and clipped.
// =============================================================================
// Per user: "virga's boss animation wings appears to be feathered and cutoff
// could you fix or regenerate the sprites".
//
// DIAGNOSED, not guessed. The engine feathers any sprite edge its probe finds
// art on (data/sprite_edges.js, built by gen_sprite_edges.mjs: the frame is
// drawn into a 48x48 canvas and the border rows/cols are sampled at alpha>24;
// more than one hit on an edge marks it "cut" and _lxDrawSoft fades that span).
// Virga's table entries:
//
//   fly     9/9 frames ""            <- clean, no feather. The intended look.
//   idle    8/9 frames L and/or R    <- the wings
//   attack  4/9 frames L and/or R
//   walk    3/9 frames L and/or R
//
// Measured against the art, that is exactly right: fly composes the bird with
// 66px of margin, while idle/attack sit 2-3px from the border and walk frames
// 2 and 5 are genuinely CUT (0px, wing runs off the canvas). At the probe's
// scale one border sample covers 1332/48 = 27.75 source px, so anything within
// ~28px of the edge bleeds into it. Hence: feathered wings, and on two frames
// a real truncation.
//
// THE FIX — recompose, do not regenerate. The artwork is good; it is simply
// laid out too large for its canvas in three of the four states. Regenerating
// 27 frames through ludo.ai would risk style drift against the 9 fly frames
// that are already correct. Instead each frame is uniformly scaled to k=0.913
// inside the SAME 1332x1332 canvas, centred horizontally, with the content's
// bottom pinned exactly where it was so the feet never move. Result: >=60px of
// margin on left/right/top - twice the probe's sample cell, and comparable to
// fly's 66px.
//
// ON-SCREEN SIZE IS UNCHANGED. One k for all three states (they differ by less
// than 0.3%, and a shared value keeps idle<->walk<->attack transitions from
// popping), compensated by a per-state calib scale s = 1/k = 1.095 in
// data/anim_calib.js under the exact keys the renderer looks up
// (zodiac/idle, zodiac/walk, zodiac/attack - verified against _loadBossFrames).
// The calib s is anchored at the feet, and so is this recompose, so the two
// cancel precisely. fly is untouched and keeps s = 1.
//
// The two truncated walk frames stay truncated - those pixels never existed -
// but they end up as a clean interior edge instead of a fading one, and the
// probe no longer fires on them.
//
// Backs originals up to Sprites/bosses/zodiac/_backup_prefeather/<state>/.
// Idempotent: re-running is a no-op once every frame already clears the margin.
import sharp from 'sharp';
import { mkdirSync, copyFileSync, existsSync, renameSync, statSync } from 'node:fs';
sharp.cache(false);

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const STATES = ['idle', 'walk', 'attack'];
const A = 24;        // alpha threshold — identical to the probe's
const M = 60;        // target left/right/top margin in source px (~2.2 probe cells)
const K = 0.913;     // one uniform scale for all three states

const bbox = (buf, W, H) => {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (buf[(y * W + x) * 4 + 3] > A) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, x1, y0, y1 };
};

let changed = 0, skipped = 0;
for (const st of STATES) {
  const dir = `${ROOT}/Sprites/bosses/zodiac/${st}`;
  const bak = `${ROOT}/Sprites/bosses/zodiac/_backup_prefeather/${st}`;
  mkdirSync(bak, { recursive: true });
  for (let i = 0; i < 9; i++) {
    const f = `${dir}/virgo_${i}.webp`;
    const src = sharp(f).ensureAlpha();
    const { width: W, height: H } = await src.metadata();
    const raw = await src.raw().toBuffer();
    const b = bbox(raw, W, H);
    const margin = Math.min(b.x0, W - 1 - b.x1, b.y0);
    if (margin >= M - 2) { skipped++; continue; }        // already clear — idempotent

    if (!existsSync(`${bak}/virgo_${i}.webp`)) copyFileSync(f, `${bak}/virgo_${i}.webp`);

    const sw = Math.round(W * K), sh = Math.round(H * K);
    // Centre the CONTENT horizontally; pin the content's bottom where it was
    // (the calib s that compensates this is anchored at the feet, so the two
    // only cancel if the feet do not move here).
    const ox = Math.round((W - K * (b.x0 + b.x1 + 1)) / 2);
    const oy = Math.round(b.y1 * (1 - K));
    const scaled = await sharp(f).ensureAlpha()
      .resize(sw, sh, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left: ox, top: oy }])
      .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();

    // Verify BEFORE replacing: the whole point is the new margin.
    const chk = sharp(out).ensureAlpha();
    const cm = await chk.metadata();
    const nb = bbox(await chk.raw().toBuffer(), cm.width, cm.height);
    const nMargin = Math.min(nb.x0, cm.width - 1 - nb.x1, nb.y0);
    if (cm.width !== W || cm.height !== H) { console.error(`ABORT ${st}/${i}: canvas changed`); process.exit(1); }
    if (nMargin < M - 6) { console.error(`ABORT ${st}/${i}: margin still ${nMargin}px`); process.exit(1); }

    const tmp = `${f}.tmp`;
    await sharp(out).toFile(tmp);
    if (statSync(tmp).size < 8000) { console.error(`ABORT ${st}/${i}: output suspiciously small`); process.exit(1); }
    renameSync(tmp, f);
    changed++;
    console.log(`  ${st}/virgo_${i}: margin ${margin} -> ${nMargin}px`);
  }
}
console.log(`repad done: ${changed} frames rewritten, ${skipped} already clear (k=${K}, target margin ${M}px)`);
