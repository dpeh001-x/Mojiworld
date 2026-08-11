// QC for a generated cast set. The existing gates measure canvas size, body
// size and edge contact — all the things that were failing when the user said
// "no cutoffs". They say nothing about the third thing the user asked for every
// time: SMOOTHNESS. A set can pass every numeric gate and still be four
// identical frames followed by a jump cut, which is what form 2's first clean
// punch roll was.
//
// Adjacent-frame silhouette IoU turns that into a number:
//   IoU ~1.00  the pose did not change    -> a dead frame, the animation stalls
//   IoU  low   the pose changed violently -> a jump cut, reads as a glitch
//   HEAD BAND  share of dark armour in the top 12% of the body box; it collapses
//              when the model hides the head behind an arm, which is exactly how
//              form 2's punch lost its head from frame 4 on.
//   node scripts/gravitos_anim_qc.mjs gravitos2punch
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
sharp.cache(false);

const KEY = process.argv[2];
if (!KEY) { console.error('usage: gravitos_anim_qc.mjs <key>'); process.exit(1); }
// CALIBRATED AGAINST THE SHIPPED, ACCEPTED FORM-1 SETS — not against intuition.
// First pass used DEAD 0.985 / JUMP 0.55 / a head-band floor, and gravitospunch
// (which is in the game and looks right) failed 6 jumps and 8 "headless". Two
// lessons baked in here:
//   • A LOW IoU is not a defect. Form 1's punch runs 0.399-0.563 for every pair
//     because it is a real punch with real travel; that is the "more action" the
//     user asked for. What matters is that the change is EVEN — form 1's spread
//     is 0.165, form 2's failed roll was 0.575 (four near-still frames, then
//     lurches). Evenness is the smoothness signal; magnitude is not.
//   • The head-band proxy measured lean, not heads. It flagged frames of form 1
//     that are visibly fine. Removed as a gate, still printed as information.
//   • Nor is SPREAD a gate. Second pass tried it and failed the shipped soul
//     (0.533) and laser (0.409) sets too — both are built by ping-pong, which
//     holds a peak frame on purpose, and one deliberate hold blows the spread
//     wide open. A metric that condemns three of the four accepted sets is
//     measuring construction, not quality.
// What actually separated the bad roll from all three good ones is a RUN of
// consecutive near-static pairs: form 2's punch opened 0.875 / 0.819 / 0.874 —
// four frames of a nine-frame animation spent standing still — while every
// shipped set has at most ONE high pair (the intended ping-pong hold). So the
// gate is "no three consecutive pairs barely moving", which permits a hold and
// catches a stall.
const STALL = 0.90;       // single pair barely moving — reported, not fatal
const RUN_LIMIT = 0.75;   // a pair above this counts toward a stall run
const RUN_LEN = 3;        // three in a row = the animation is standing still

// Base geometry for this key's FORM — the slab test below is relative to it.
const FORM_SUF = /^gravitos([23])/.test(KEY) ? KEY.match(/^gravitos([23])/)[1] : '';
const BASE_P = `Sprites/bosses/gravitos${FORM_SUF}.webp`;
async function alphaBox(p) {
  const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let minX = info.width, maxX = -1, minY = info.height, maxY = -1, opaque = 0;
  for (let k = 0; k < n; k++) if (data[k * 4 + 3] > 200) {
    opaque++;
    const x = k % info.width, y = (k / info.width) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  return { fill: opaque / (w * h), w, h, canvasW: info.width, canvasH: info.height };
}
const baseBox = existsSync(BASE_P) ? await alphaBox(BASE_P) : null;
const SLAB_FILL = 0.75, SLAB_WIDE = 1.6;

const masks = [], heads = [], boxes = [], slabs = [], canvases = [];
for (let i = 0; i < 9; i++) {
  const p = `Sprites/bosses/attack/${KEY}_${i}.webp`;
  if (!existsSync(p)) { console.error(`missing ${p}`); process.exit(1); }
  const ab = await alphaBox(p);
  slabs.push(ab);
  canvases.push(`${ab.canvasW}x${ab.canvasH}`);
  const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const m = new Uint8Array(n);
  let minY = info.height, maxY = -1, minX = info.width, maxX = -1;
  for (let k = 0; k < n; k++) {
    const lum = 0.299 * data[k * 4] + 0.587 * data[k * 4 + 1] + 0.114 * data[k * 4 + 2];
    if (data[k * 4 + 3] > 200 && lum < 130) {
      m[k] = 1;
      const x = k % info.width, y = (k / info.width) | 0;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
  }
  // head band: dark pixels in the top 12% of the body box, as a share of the
  // widest row there. A visible head fills a good part of its own band.
  const bandH = Math.max(1, Math.round((maxY - minY + 1) * 0.12));
  let band = 0;
  for (let y = minY; y < minY + bandH; y++) for (let x = minX; x <= maxX; x++) if (m[y * info.width + x]) band++;
  heads.push(band / (bandH * Math.max(1, maxX - minX + 1)));
  boxes.push({ w: info.width, h: info.height, bw: (maxX - minX + 1) / info.width, bh: (maxY - minY + 1) / info.height });
  masks.push(m);
}

console.log(`${KEY}  ${boxes[0].w}x${boxes[0].h}`);
console.log('\npair   IoU     verdict');
let dead = 0, jump = 0;
const ious = [];
for (let i = 1; i < masks.length; i++) {
  let inter = 0, uni = 0;
  for (let k = 0; k < masks[i].length; k++) { const a = masks[i - 1][k], b = masks[i][k]; if (a & b) inter++; if (a | b) uni++; }
  const iou = uni ? inter / uni : 1;
  ious.push(iou);
  let v = 'ok';
  if (iou > STALL) { v = 'STALLED (pose barely changed)'; dead++; }
  console.log(`${i - 1}->${i}  ${iou.toFixed(3)}   ${v}`);
}
console.log('\nframe  bodyW  bodyH  topBand(info)');
for (let i = 0; i < 9; i++) {
  console.log(`  ${i}    ${(boxes[i].bw * 100).toFixed(0)}%    ${(boxes[i].bh * 100).toFixed(0)}%    ${heads[i].toFixed(3)}`);
}
const spread = Math.max(...ious) - Math.min(...ious);
let run = 0, worstRun = 0;
for (const v of ious) { run = v > RUN_LIMIT ? run + 1 : 0; if (run > worstRun) worstRun = run; }
const stalledRun = worstRun >= RUN_LEN;
console.log(`\nIoU ${Math.min(...ious).toFixed(3)}-${Math.max(...ious).toFixed(3)}   spread ${spread.toFixed(3)} (info)`);
console.log(`longest run of pairs above ${RUN_LIMIT}: ${worstRun} (limit ${RUN_LEN - 1}); single stalled pairs: ${dead}`);
if (stalledRun) console.log(`  STALL RUN — ${worstRun + 1} consecutive frames barely change; the animation stands still`);
// SLAB / CANVAS / SIZE — the other three ways a set has gone wrong this session.
let slabBad = 0, canvasBad = 0;
if (baseBox) {
  console.log(`\nbase ${BASE_P.split('/').pop()}: canvas ${baseBox.canvasW}x${baseBox.canvasH}, fill ${baseBox.fill.toFixed(2)}, body ${baseBox.w}px wide`);
  for (let i = 0; i < 9; i++) {
    const s = slabs[i], wide = s.w / baseBox.w;
    if (s.fill > SLAB_FILL && wide > SLAB_WIDE) {
      slabBad++;
      console.log(`  frame ${i}: PAINTED SLAB — fill ${s.fill.toFixed(2)}, ${wide.toFixed(1)}x base width`);
    }
    if (s.canvasW !== baseBox.canvasW || s.canvasH !== baseBox.canvasH) {
      canvasBad++;
      console.log(`  frame ${i}: WRONG CANVAS ${s.canvasW}x${s.canvasH}, form base is ${baseBox.canvasW}x${baseBox.canvasH}`);
    }
  }
  if (!slabBad && !canvasBad) console.log('  no painted slabs; every frame on the form\'s own canvas');
}
const okAll = !stalledRun && !slabBad && !canvasBad;
console.log(okAll ? 'PASS — motion is continuous and evenly paced'
                  : 'FAIL — see flags above');
process.exit(okAll ? 0 : 1);
