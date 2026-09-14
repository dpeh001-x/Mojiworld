// Cancer has black kawaii eyes, in every loop.
// ============================================================================
// Per user: "for zodiac cancer the eyes are also a little weird, please do the
// same with black kawaii eyes".
//
// WHAT WAS WRONG. Her two eyes were blank, pupil-less cream discs inside amber
// rings — a lifeless stare. Unlike Aquarius (whose base was fine and whose idle
// prompt spoiled it), the discs were in cancer.webp ITSELF, so every frame of
// all three loops inherited them. The base was edited first (ludo.ai image
// edit, scripts/gen_cancer_eyes.mjs) and the three loops regenerated from it.
//
// THE MEASURE. How much of the eye band is solid black. The first cut of this
// used "mean luminance of the darkest 8%", which scored ~3 on the untouched art
// AND ~0 on every candidate — useless, because the darkest pixels in that crop
// are the character's outline, which is there either way. Coverage is the right
// question: the blank discs are large, so turning them into black eyes moves it
// a long way while the outline contributes equally to both.
//
//   previous build:  base 20.6%   idle 17-19%   walk 16-18%
//
// The per-frame bar is derived from the CURRENT BASE at run time, not hardcoded,
// so this keeps its meaning if she is ever redrawn again. Attack frames whose
// eye band is washed out by her charge-up glow are exempted BY MEASUREMENT (and
// named in the output) rather than by index, so the exemption cannot silently
// widen if the animation changes.
//
// Run: node scripts/cancer_eyes_test.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Z = path.join(ROOT, 'Sprites', 'bosses', 'zodiac');
const BASE = path.join(Z, 'cancer.webp');
const EYE = { left: 580, top: 940, width: 380, height: 180 };
// What the shipped art measured before this change - a recorded fact, used only
// to give the base check a floor and to print an honest before/after.
const PREV_BASE_BLACK = 20.6;

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

async function eyeStats(file) {
  const { data, info } = await sharp(file).extract(EYE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0, tot = 0, sum = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    if (data[p + 3] < 128) continue;
    tot++;
    const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    sum += l;
    if (l < 40) black++;
  }
  return tot ? { black: 100 * black / tot, mean: sum / tot } : { black: 0, mean: 255 };
}
async function silhouette(file, N = 256) {
  const { data, info } = await sharp(file).resize(N, N, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(N * N);
  for (let i = 0, p = 0; p < data.length; p += info.channels, i++) m[i] = data[p + 3] > 64 ? 1 : 0;
  return m;
}
const iou = (a, b) => { let x = 0, u = 0; for (let i = 0; i < a.length; i++) { if (a[i] | b[i]) u++; if (a[i] & b[i]) x++; } return u ? x / u : 0; };
async function delta(a, b) {
  const A = await sharp(a).resize(160, 160, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const B = await sharp(b).resize(160, 160, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]);
  return s / A.length / 255;
}
const frame = (st, i) => path.join(Z, st, `cancer_${i}.webp`);

const baseStat = await eyeStats(BASE);
const baseMeta = await sharp(BASE).metadata();
const baseSil = await silhouette(BASE);
const BAR = baseStat.black * 0.6;
// A frame is glow-washed when her charge-up floods the eye band with light.
const GLOW = baseStat.mean + 25;

const loops = {};
for (const st of ['idle', 'walk', 'attack']) {
  const stats = [], sizes = new Set(), deltas = [];
  for (let i = 0; i < 9; i++) {
    stats.push(await eyeStats(frame(st, i)));
    const m = await sharp(frame(st, i)).metadata();
    sizes.add(`${m.width}x${m.height}`);
  }
  for (let i = 0; i < 9; i++) deltas.push(await delta(frame(st, i), frame(st, (i + 1) % 9)));
  loops[st] = {
    black: stats.map((s) => +s.black.toFixed(1)),
    glow: stats.map((s, i) => (s.mean > GLOW ? i : -1)).filter((i) => i >= 0),
    sizes: [...sizes],
    minDelta: Math.min(...deltas),
    sil: await silhouette(frame(st, 0)),
  };
}

const dim = (st) => loops[st].black.map((v, i) => ((v < BAR && !loops[st].glow.includes(i)) ? i : -1)).filter((i) => i >= 0);
const idleBad = dim('idle'), walkBad = dim('walk'), atkBad = dim('attack');

console.log(`  base   eye band ${baseStat.black.toFixed(1)}% black (previous build: ${PREV_BASE_BLACK}%)  -> per-frame bar ${BAR.toFixed(1)}%`);
for (const st of ['idle', 'walk', 'attack']) {
  const L = loops[st];
  console.log(`  ${st.padEnd(6)} ${JSON.stringify(L.black)}  glow-washed ${L.glow.length ? L.glow.join(',') : 'none'}  minDelta ${L.minDelta.toFixed(4)}  ${L.sizes.join('/')}  IoU-vs-base ${iou(baseSil, L.sil).toFixed(3)}`);
}

ok('THE BASE HAS BLACK EYES: the blank cream discs are gone',
  baseStat.black >= 30,
  `${baseStat.black.toFixed(1)}% of the eye band is solid black (previous build: ${PREV_BASE_BLACK}%)`);
ok('IDLE KEEPS THEM: every idle frame carries the black eyes',
  idleBad.length === 0,
  idleBad.length ? `frames ${idleBad.join(', ')} under the ${BAR.toFixed(1)}% bar` : `floor ${Math.min(...loops.idle.black)}% vs bar ${BAR.toFixed(1)}%`);
ok('WALK KEEPS THEM: every walk frame carries the black eyes',
  walkBad.length === 0,
  walkBad.length ? `frames ${walkBad.join(', ')} under the bar` : `floor ${Math.min(...loops.walk.black)}% vs bar ${BAR.toFixed(1)}%`);
ok('ATTACK KEEPS THEM: every attack frame not washed out by her own glow',
  atkBad.length === 0,
  atkBad.length ? `frames ${atkBad.join(', ')} under the bar` : `${loops.attack.glow.length} frame(s) exempt as glow-washed (measured, not assumed): ${loops.attack.glow.join(',') || 'none'}`);
ok('STILL THE SAME CRAB: each loop matches the base silhouette',
  ['idle', 'walk', 'attack'].every((st) => iou(baseSil, loops[st].sil) >= 0.80),
  ['idle', 'walk', 'attack'].map((st) => `${st} ${iou(baseSil, loops[st].sil).toFixed(3)}`).join(', '));
ok('THE LOOPS STILL MOVE: no loop is nine copies of one drawing',
  ['idle', 'walk', 'attack'].every((st) => loops[st].minDelta > 0.002),
  ['idle', 'walk', 'attack'].map((st) => `${st} ${loops[st].minDelta.toFixed(4)}`).join(', '));
ok('SIZE UNCHANGED: every frame matches the base canvas',
  ['idle', 'walk', 'attack'].every((st) => loops[st].sizes.length === 1 && loops[st].sizes[0] === `${baseMeta.width}x${baseMeta.height}`),
  `base ${baseMeta.width}x${baseMeta.height}; loops ${['idle', 'walk', 'attack'].map((st) => loops[st].sizes.join('/')).join(', ')}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
