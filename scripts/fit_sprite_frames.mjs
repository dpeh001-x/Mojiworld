#!/usr/bin/env node
// Keep generated sprites off the canvas edge — as a library AND a CLI.
//
//   node scripts/fit_sprite_frames.mjs <base.webp> <framesDir> <key> [--margin=0.07] [--match-base] [--write]
//   import { fitToMargin, fitFramesToBase, measure } from './fit_sprite_frames.mjs'
//
// Why this exists. ludo.ai composes to fill the frame, so a generated sprite
// routinely runs to the canvas edge — and every engine that draws it fitted to
// a box then shows a shaved outline. On mwrap the user could see it directly:
// "there seems to be a bit of cutoff". Re-prompting for "clear space on all
// four sides" does not reliably work; four candidates in a row came back at
// margin 0, so the framing is fixed here instead of asked for. Both generators
// call into this now, which is the point — the fix has to be automatic or it
// is just another step to forget.
//
// TWO MODES, and picking the wrong one double-shrinks the art:
//   fitToMargin       insets a set by ONE shared transform so the union of all
//                     images clears the edge. For a fresh base with no frames
//                     yet, or a whole set that is edge-to-edge.
//   fitFramesToBase   scales/translates the FRAMES so their union lands on the
//                     BASE's existing box, leaving the base untouched. For
//                     frames animated off an already-fitted base — running
//                     fitToMargin there would inset a second time.
//
// The shared transform is the load-bearing idea in both: insetting each image
// on its own bounding box would normalise away the differences that make the
// animation, and the sprite would pulse in size as the loop played.
//
// CAVEAT on fitFramesToBase: it assumes the frames are meant to occupy the same
// footprint as the base. That holds for a churn/shimmer loop; it does NOT hold
// for a loop where something legitimately extends past the base silhouette (a
// streamer unfurling), which it would squash back in. Use fitToMargin there.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
sharp.cache(false);

export async function measure(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { W, H, x0: 0, y0: 0, x1: W - 1, y1: H - 1, empty: true, margin: 0 };
  return { W, H, x0, y0, x1, y1, margin: Math.min(x0, W - 1 - x1, y0, H - 1 - y1) };
}

// Apply one scale+offset (in canvas space) to every file.
async function apply(files, W, H, scale, offX, offY, write) {
  const done = [];
  for (const f of files) {
    const scaled = await sharp(f).ensureAlpha()
      .resize(Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)), { fit: 'fill' })
      .png().toBuffer();
    const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: scaled, left: Math.round(offX), top: Math.round(offY) }])
      .webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
    if (write) await writeFile(f, out);
    done.push(f);
  }
  return done;
}

/** Inset a set by one shared transform until the union clears `margin` on all sides. */
export async function fitToMargin(files, { margin = 0.07, write = true, log = () => {} } = {}) {
  const boxes = []; for (const f of files) boxes.push(await measure(f));
  const W = boxes[0].W, H = boxes[0].H;
  const U = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }), { x0: W, y0: H, x1: -1, y1: -1 });
  const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;
  const scale = Math.min(1, (W * (1 - 2 * margin)) / uw, (H * (1 - 2 * margin)) / uh);
  if (scale >= 0.999) { log(`fit: union ${uw}x${uh} already clears ${(margin * 100) | 0}% — no change`); return { scale: 1, changed: 0 }; }
  const offX = (W - uw * scale) / 2 - U.x0 * scale, offY = (H - uh * scale) / 2 - U.y0 * scale;
  await apply(files, W, H, scale, offX, offY, write);
  log(`fit: inset ${files.length} file(s) by ${scale.toFixed(3)} for a ${(margin * 100) | 0}% margin`);
  return { scale, changed: files.length };
}

/** Map the frames' union onto the base's box. The base file is never rewritten. */
export async function fitFramesToBase(basePath, frameFiles, { write = true, log = () => {}, tol = 0.02 } = {}) {
  if (!frameFiles.length) return { scale: 1, changed: 0 };
  const B = await measure(basePath);
  const boxes = []; for (const f of frameFiles) boxes.push(await measure(f));
  const W = B.W, H = B.H;
  const U = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }), { x0: W, y0: H, x1: -1, y1: -1 });
  const uw = U.x1 - U.x0 + 1, uh = U.y1 - U.y0 + 1;
  const bw = B.x1 - B.x0 + 1, bh = B.y1 - B.y0 + 1;
  const scale = Math.min(bw / uw, bh / uh);
  // centre the scaled union on the base's centre
  const bcx = (B.x0 + B.x1 + 1) / 2, bcy = (B.y0 + B.y1 + 1) / 2;
  const offX = bcx - (U.x0 + uw / 2) * scale, offY = bcy - (U.y0 + uh / 2) * scale;
  if (Math.abs(scale - 1) <= tol && Math.abs(offX) <= W * tol && Math.abs(offY) <= H * tol) {
    log(`fit: frames already sit on the base box (scale ${scale.toFixed(3)}) — no change`);
    return { scale: 1, changed: 0 };
  }
  await apply(frameFiles, W, H, scale, offX, offY, write);
  log(`fit: mapped ${frameFiles.length} frame(s) onto the base box (scale ${scale.toFixed(3)}), base untouched`);
  return { scale, changed: frameFiles.length };
}

// ---- CLI ----
// pathToFileURL, not a hand-rolled `file://${path}`: on Windows that yields
// file://C:/... against import.meta.url's file:///C:/... and the CLI silently
// never runs.
const { pathToFileURL } = await import('node:url');
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [BASE, DIR, KEY, ...rest] = process.argv.slice(2);
  if (!BASE || !DIR || !KEY) {
    console.error('usage: fit_sprite_frames.mjs <base.webp> <framesDir> <key> [--margin=0.07] [--match-base] [--write]');
    process.exit(2);
  }
  const margin = Number((rest.find(a => a.startsWith('--margin=')) || '--margin=0.07').split('=')[1]);
  const write = rest.includes('--write');
  const frames = [];
  for (let i = 0; i < 9; i++) { const f = `${DIR}/${KEY}_${i}.webp`; if (existsSync(f)) frames.push(f); }
  const log = (m) => console.log(m + (write ? '' : '  [dry run — add --write]'));
  if (rest.includes('--match-base')) await fitFramesToBase(BASE, frames, { write, log });
  else await fitToMargin([BASE, ...frames], { margin, write, log });
  for (const f of [BASE, ...frames]) { const m = await measure(f);
    console.log(`  ${f.split('/').pop()}  margins l${m.x0} r${m.W - 1 - m.x1} t${m.y0} b${m.H - 1 - m.y1}`); }
}
