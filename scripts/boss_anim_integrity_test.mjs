// Two defects the user caught by eye that every existing gate passed:
//   1. AMPUTATED LIMBS — the model zoomed, the crop cut the legs off, and the
//      scale-normalizer then anchored the truncated edge at the foot line, so
//      a cropped shin measured as "feet planted on the floor".
//   2. A FROZEN SEQUENCE — gravitos_3..8 were byte-identical, because a
//      nearest-neighbour backfill duplicated one survivor six times. Every
//      frame passed its checks; the animation did not exist.
// Both are now asserted directly, for every gravitos cast set.
//
//   node scripts/boss_anim_integrity_test.mjs
import sharp from 'sharp';
import { existsSync } from 'node:fs';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const SETS = ['gravitos', 'gravitospunch', 'gravitossoul', 'gravitoslaser'];
const DIR = 'Sprites/bosses/attack';

async function armour(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1;
  for (let i = 0; i < info.width * info.height; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (data[i * 4 + 3] > 200 && lum < 130) {
      const x = i % info.width, y = (i / info.width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { W: info.width, H: info.height, minX, maxX, minY, maxY, h: maxY - minY + 1 };
}

const base = await armour('Sprites/bosses/gravitos.webp');
// The base sprite's own feet sit this far off the canvas bottom. A frame whose
// armour runs materially LOWER than that is not "standing on the floor" — it is
// a body cut off by the crop.
const baseFootGap = base.H - 1 - base.maxY;

for (const key of SETS) {
  const files = [];
  for (let i = 0; i < 9; i++) { const p = `${DIR}/${key}_${i}.webp`; if (existsSync(p)) files.push(p); }
  if (files.length !== 9) { ok(`${key}: 9 frames present`, false, { found: files.length }); continue; }

  // --- 1. no amputation -----------------------------------------------------
  const cut = [];
  for (const p of files) {
    const a = await armour(p);
    const gap = a.H - 1 - a.maxY;
    if (a.minX <= 4 || a.minY <= 4 || a.maxX >= a.W - 5) cut.push({ f: p.split('/').pop(), why: 'side/top' });
    else if (gap < baseFootGap - 12) cut.push({ f: p.split('/').pop(), why: `body runs ${baseFootGap - gap}px below the base foot line — legs cut` });
  }
  ok(`${key}: NO CUTOFFS — nothing clipped, nothing amputated at the floor`, cut.length === 0, cut.slice(0, 3));

  // --- 2. character size constant -------------------------------------------
  let worst = 0;
  for (const p of files) { const a = await armour(p); worst = Math.max(worst, Math.abs(a.h - base.h) / base.h); }
  // 18%, calibrated on the shipped gravitospunch set (15.5%): a full-body
  // punch that extends genuinely changes the silhouette, and failing accepted
  // art would only train people to ignore this suite. A camera zoom — the
  // defect being guarded against — runs 25-70%, well clear of the line.
  ok(`${key}: character size matches the base sprite`, worst <= 0.18,
     { worstDrift: (worst * 100).toFixed(1) + '%' });

  // --- 3. it actually animates ---------------------------------------------
  const small = [];
  for (const p of files) small.push(await sharp(p).resize(200, 200, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
  const dupes = [];
  for (let i = 1; i < small.length; i++) {
    let diff = 0;
    for (let q = 0; q < small[i].length; q += 4)
      if (Math.abs(small[i][q] - small[i - 1][q]) > 12 || Math.abs(small[i][q + 3] - small[i - 1][q + 3]) > 12) diff++;
    const pct = diff / (small[i].length / 4) * 100;
    if (pct < 0.5) dupes.push(`${i - 1}->${i}`);
  }
  // A short hold at the peak is legitimate; a run of identical frames is a
  // freeze wearing an animation's name.
  ok(`${key}: SMOOTH — no run of identical frames`, dupes.length <= 1, { identicalPairs: dupes });

  // --- 4. canvas exact ------------------------------------------------------
  let dims = true;
  for (const p of files) { const m = await sharp(p).metadata(); if (m.width !== base.W || m.height !== base.H) dims = false; }
  ok(`${key}: every frame on the base canvas (${base.W}x${base.H})`, dims, {});
}

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
