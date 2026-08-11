// Honest audit of "is it zoomed / is it cut off", measuring what the eye sees.
//
// Why the shipping gates missed it: they normalise and then check the DARK
// BOUNDING BOX height. That box includes wings, raised arms and flame. When a
// pose spreads, the box grows, the normaliser shrinks the frame to keep the box
// constant — and the TORSO changes size while the number stays put. So the one
// measurement that mattered, the character's actual scale, was never taken.
//
// Torso proxies that wings/arms/flames cannot contaminate:
//   legW   width of the dark mass in the BOTTOM 20% of the body box (hips/legs)
//   headY  top of the dark mass in the middle 30% column band (the head), as a
//          fraction of canvas height
//   footY  bottom of the dark mass (feet)
//   torsoH footY - headY: the character's real height, ignoring wingspan
//   edge   smallest gap from ANY opaque pixel to each canvas edge, in % of canvas
//   node scripts/gravitos_scale_audit.mjs [key ...]
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
sharp.cache(false);

async function metrics(p) {
  const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const dark = (k) => {
    const lum = 0.299 * data[k * 4] + 0.587 * data[k * 4 + 1] + 0.114 * data[k * 4 + 2];
    return data[k * 4 + 3] > 200 && lum < 130;
  };
  let minX = W, maxX = -1, minY = H, maxY = -1;              // dark bbox
  let aMinX = W, aMaxX = -1, aMinY = H, aMaxY = -1;          // full-alpha bbox
  for (let k = 0; k < W * H; k++) {
    const x = k % W, y = (k / W) | 0;
    if (data[k * 4 + 3] > 200) {
      if (x < aMinX) aMinX = x; if (x > aMaxX) aMaxX = x;
      if (y < aMinY) aMinY = y; if (y > aMaxY) aMaxY = y;
    }
    if (dark(k)) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bh = maxY - minY + 1;
  // legs: widest dark row in the bottom 20% of the dark box
  let legW = 0;
  for (let y = maxY - Math.round(bh * 0.20); y <= maxY; y++) {
    let c = 0; for (let x = minX; x <= maxX; x++) if (dark(y * W + x)) c++;
    if (c > legW) legW = c;
  }
  // head: topmost dark pixel within the middle 30% of the dark box's width
  const cx = (minX + maxX) / 2, half = (maxX - minX + 1) * 0.15;
  let headY = maxY;
  for (let y = minY; y <= maxY && headY === maxY; y++)
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++)
      if (dark(y * W + x)) { headY = y; break; }
  // DETAIL. Laplacian variance over the body box. Generated frames are upscaled
  // from whatever the model returned — the API caps its input at 1 megapixel, so
  // padding spends that budget on empty space and the character comes back small
  // — and an upscaled sprite keeps its pixel dimensions while losing its edges.
  // Per user: "some of the images generated are very low resolution".
  const lumAt = (x, y) => {
    const k = (y * W + x) * 4;
    if (data[k + 3] < 40) return 0;
    return 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
  };
  let s1 = 0, s2 = 0, cnt = 0;
  for (let y = Math.max(1, minY + 1); y < Math.min(H - 1, maxY); y++)
    for (let x = Math.max(1, minX + 1); x < Math.min(W - 1, maxX); x++) {
      const L = 4 * lumAt(x, y) - lumAt(x - 1, y) - lumAt(x + 1, y) - lumAt(x, y - 1) - lumAt(x, y + 1);
      s1 += L; s2 += L * L; cnt++;
    }
  const detail = cnt ? (s2 / cnt - (s1 / cnt) ** 2) : 0;
  return {
    legW: legW / W, torsoH: (maxY - headY + 1) / H, footY: (maxY + 1) / H,
    boxH: bh / H, boxW: (maxX - minX + 1) / W, detail,
    edgeL: aMinX / W, edgeR: (W - 1 - aMaxX) / W, edgeT: aMinY / H, edgeB: (H - 1 - aMaxY) / H,
    W, H,
  };
}

const KEYS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['gravitospunch', 'gravitossoul', 'gravitoslaser',
     'gravitos2punch', 'gravitos2soul', 'gravitos2laser',
     'gravitos3punch', 'gravitos3soul', 'gravitos3laser'];

for (const key of KEYS) {
  const suf = /^gravitos([23])/.test(key) ? key.match(/^gravitos([23])/)[1] : '';
  const base = await metrics(`Sprites/bosses/gravitos${suf}.webp`);
  console.log(`\n===== ${key}   (base gravitos${suf}: legW ${(base.legW * 100).toFixed(1)}%  torsoH ${(base.torsoH * 100).toFixed(1)}%)`);
  console.log('  fr  legW    vs base   torsoH   vs base   footY   edges L/R/T/B (% of canvas)');
  let worstScale = 1, cut = 0;
  for (let i = 0; i < 9; i++) {
    const p = `Sprites/bosses/attack/${key}_${i}.webp`;
    if (!existsSync(p)) { console.log(`  ${i}  MISSING`); continue; }
    const m = await metrics(p);
    const rL = m.legW / base.legW, rT = m.torsoH / base.torsoH;
    if (Math.max(rL, rT) > worstScale) worstScale = Math.max(rL, rT);
    const minEdge = Math.min(m.edgeL, m.edgeR, m.edgeT);
    const flags = [];
    if (rL > 1.15 || rL < 0.85) flags.push('LEGS-SCALED');
    if (rT > 1.15 || rT < 0.85) flags.push('TORSO-SCALED');
    if (minEdge < 0.01) { flags.push('TOUCHES-EDGE'); cut++; }
    console.log(`  ${i}  ${(m.legW * 100).toFixed(1)}%   ${rL.toFixed(2)}x     ${(m.torsoH * 100).toFixed(1)}%   ${rT.toFixed(2)}x     ${(m.footY * 100).toFixed(1)}%   ${(m.edgeL * 100).toFixed(1)}/${(m.edgeR * 100).toFixed(1)}/${(m.edgeT * 100).toFixed(1)}/${(m.edgeB * 100).toFixed(1)}  ${flags.join(' ')}`);
  }
  console.log(`  -> worst scale deviation ${worstScale.toFixed(2)}x, ${cut} frame(s) touching an edge`);
  // Sharpness relative to the form's own base sprite, which is the ceiling: the
  // frames are derived from it, so they cannot legitimately carry more detail
  // (a bright FX flare can, which is why this reports rather than fails).
  const dets = [];
  for (let i = 0; i < 9; i++) {
    const p = `Sprites/bosses/attack/${key}_${i}.webp`;
    if (existsSync(p)) dets.push((await metrics(p)).detail);
  }
  if (dets.length) {
    const med = dets.slice().sort((a, b) => a - b)[dets.length >> 1];
    const rel = med / base.detail;
    console.log(`  -> detail (median edge energy) ${med.toFixed(0)} vs base ${base.detail.toFixed(0)} = ${rel.toFixed(2)}x` +
      (rel < 0.50 ? '   SOFT — visibly upscaled' : rel < 0.75 ? '   a little soft' : '   sharp'));
  }
}
