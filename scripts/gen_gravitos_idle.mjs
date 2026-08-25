#!/usr/bin/env node
// Rebuild Gravitos's 9-frame IDLE loop around one chosen pose.
// =============================================================================
// Per user: Sprites/bosses/attack/gravitos.webp "should be gravitos midframe
// idle animation, please regenerate the idle sequence with this as the midframe
// idle frame".
//
// WHY THIS COMPOSITES INSTEAD OF ANIMATING. The obvious tool is the Ludo
// animateSprite runner that built the original idle sets, and this repo has
// already paid to learn that it is the wrong instrument for "hold this pose".
// gen_aetherion_astral.mjs records three rolls that could not: told to trace the
// same drawing every frame, frame 0 came back a side-on rear-up, frame 8 had
// turned front-on and grown, and two frames had their legs sliced off by the
// crop. An idle IS "hold absolutely still and breathe", and the request names an
// exact frame that has to survive intact - so the pose is a fixed layer and only
// the breath is computed. That makes "this frame is the midframe" true by
// construction rather than by hope, and no frame can be re-posed or cropped.
//
// THE MOTION IS COPIED FROM THE SET IT REPLACES, measured rather than invented:
//     bottom   1503 in all nine frames  -> feet pinned, zero drift
//     height   875..882                 -> a 7px breath, 0.8% of the figure
//     top      622..629
//
// THE BREATH RUNS ONE WAY, 0 to 8, AND THAT IS THE WHOLE POINT. The first cut
// peaked on the midframe and eased back down to both ends, which is symmetric -
// frame 1 equalled frame 7, 2 equalled 6, 0 equalled 8, so nine files held five
// images. That is exactly the shape regen_pingpong_boss_anims.mjs was written to
// hunt down ("f0 f1 f2 f3 f3 f3 f2 f1 f0 <- 4 unique images, not 9"). The engine
// ALREADY ping-pongs idle (0->8->0), so baking the return into the frames buys a
// duplicate set and two breaths where one was wanted. Instead frame 0 is fully
// exhaled, frame 8 fully inhaled, the source pose sits at 4 exactly as asked,
// and the sine eases to zero at both extremes so the turnaround does not jerk.
// All nine frames are distinct.
//
//   node scripts/gen_gravitos_idle.mjs             # write candidates + report
//   node scripts/gen_gravitos_idle.mjs --install   # ...and install over the set
// =============================================================================
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'Sprites/bosses/attack/gravitos.webp');
const OUT = join(root, 'scripts', '_style_pack', 'anim_regen', 'gravitos_idle');
const DEST = join(root, 'Sprites/bosses/idle');
const INSTALL = process.argv.includes('--install');

const N = 9, MID = 4;
const AMP = 0.008;      // 0.8% breath - the measured amplitude of the set this replaces
const SWAY = 3;         // px lean, zero at the middle and at both ends
const FOOT_Y = 1503;    // every frame of the old set pinned its feet here

// alpha bounding box of an image
async function box(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let t = -1, b = -1, l = W, r = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 16) { if (t < 0) t = y; b = y; if (x < l) l = x; if (x > r) r = x; }
    }
  }
  return { W, H, t, b, l, r, w: r - l + 1, h: b - t + 1 };
}

const srcBuf = await readFile(SRC);
const S = await box(srcBuf);
const meta = await sharp(srcBuf).metadata();
const CW = meta.width, CH = meta.height;
console.log('source  ' + SRC.split(/[\\/]/).pop() + '  canvas ' + CW + 'x' + CH
  + '  content ' + S.w + 'x' + S.h + ' at (' + S.l + ',' + S.t + ')  bottom ' + S.b);

// the pose, cropped to its own content once - every frame is this exact crop
const poseBuf = await sharp(srcBuf).extract({ left: S.l, top: S.t, width: S.w, height: S.h }).png().toBuffer();
const CX = Math.round((S.l + S.r) / 2);

await mkdir(OUT, { recursive: true });
const rows = [];
for (let i = 0; i < N; i++) {
  // one-way breath: -1 at frame 0, 0 on the midframe, +1 at frame 8, easing
  // flat at both ends so the ping-pong turnaround is smooth
  const u = Math.sin(Math.PI * (i - MID) / (2 * MID));
  const s = 1 + (AMP / 2) * u;                     // exactly 1 on the midframe
  const dx = Math.round(SWAY * u);
  const w = Math.max(1, Math.round(S.w * s));
  const h = Math.max(1, Math.round(S.h * s));
  const left = Math.round(CX + dx - w / 2);
  const top = FOOT_Y - h + 1;                      // feet pinned, breath comes off the top
  if (left < 0 || top < 0 || left + w > CW || top + h > CH) {
    console.error('frame ' + i + ' would fall off the canvas'); process.exit(1);
  }
  const layer = (s === 1) ? poseBuf
    : await sharp(poseBuf).resize({ width: w, height: h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: layer, left, top }])
    .webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  await writeFile(join(OUT, 'gravitos_' + i + '.webp'), out);
  const B = await box(out);
  rows.push({ i, s: +s.toFixed(5), dx, t: B.t, b: B.b, h: B.h, w: B.w, mid: i === MID });
}

console.log('\n frame   scale    lean    top  bottom  height  width');
for (const r of rows) {
  console.log('   ' + r.i + '    ' + r.s.toFixed(5) + '   ' + String(r.dx).padStart(3)
    + '   ' + String(r.t).padStart(5) + '  ' + String(r.b).padStart(6) + '  ' + String(r.h).padStart(6)
    + '  ' + String(r.w).padStart(6) + (r.mid ? '   <- midframe, the pose untouched' : ''));
}
const feet = [...new Set(rows.map((r) => r.b))];
const hs = rows.map((r) => r.h);
console.log('\nfeet pinned: ' + (feet.length === 1 ? 'yes, bottom=' + feet[0] : 'NO -> ' + feet.join(',')));
console.log('breath: ' + Math.min(...hs) + '..' + Math.max(...hs) + 'px ('
  + (Math.max(...hs) - Math.min(...hs)) + 'px, '
  + ((Math.max(...hs) - Math.min(...hs)) / Math.min(...hs) * 100).toFixed(2) + '%)');
const uniq = new Set(rows.map((r) => r.h + 'x' + r.w + '@' + r.dx)).size;
console.log('distinct frames: ' + uniq + '/' + N + (uniq === N ? '  (no mirrored duplicates)' : '  <- DUPLICATES'));
console.log('one-way breath, exhaled ' + rows[0].h + 'px -> inhaled ' + rows[8].h + 'px; the engine ping-pongs the return');
console.log('midframe is the source pose, unscaled: ' + (rows[MID].s === 1 && rows[MID].h === S.h && rows[MID].w === S.w));

if (INSTALL) {
  for (let i = 0; i < N; i++) {
    await writeFile(join(DEST, 'gravitos_' + i + '.webp'), await readFile(join(OUT, 'gravitos_' + i + '.webp')));
  }
  console.log('\ninstalled -> Sprites/bosses/idle/gravitos_0..8.webp');
} else {
  console.log('\ncandidates in ' + OUT + '  (re-run with --install to write them over the set)');
}
