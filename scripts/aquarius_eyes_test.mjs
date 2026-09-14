// Aquarius' idle keeps her eyes open.
// ============================================================================
// Per user, over a screenshot of the fight: "some of the sprites eyes look a
// little creepy, for the sequence involving this eyes regenerate to make it
// look more kawaii cuter looking".
//
// WHAT WAS WRONG, MEASURED. Her eyes are two big round cyan lamps. Counting the
// bright-cyan pixels in the bell region of every frame of every loop:
//
//   walk    [10732,10368,6865,7449,10063,10194,7826,9015,10560]  floor 6865
//   attack  [10736,11575,9577,15744,47180,11885,11285,10027,10566] floor 9577
//   idle    [10715,11218,3450,2984,2766,2746,2785,9395,10401]  floor 2746
//
// Five of her nine idle frames sat around a QUARTER of the light every other
// loop carries, because the shared IDLE_MOTION prompt asks for "an occasional
// blink" and the model drew that blink as the eyes narrowing to dark lidded
// slits — held across five frames, so at 9 fps it reads as a slow glare rather
// than a blink. Her walk and attack never do it, so the idle was also the odd
// one out among her own three loops.
//
// THE BAR IS NOT A MAGIC NUMBER. It is derived from her own WALK loop at run
// time — the known-good reference the art already shipped — so this test keeps
// meaning if the art is ever redrawn again: every idle frame must carry at
// least 80% of the light of the DIMMEST walk frame.
//
// Run: node scripts/aquarius_eyes_test.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Z = path.join(ROOT, 'Sprites', 'bosses', 'zodiac');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

// The bell region: her eyes are the brightest cyan inside it. Measured on the
// 1191x1191 canvas the whole zodiac set is authored at.
const BOX = { left: 300, top: 170, width: 600, height: 260 };
// A lit eye pixel: opaque, strongly cyan (green AND blue high, red low). Tuned
// against her own art - a lit frame scores ~10.7k, a slitted one ~2.7k, so the
// two populations are four times apart and nothing sits in between.
const lit = (d, i) => d[i + 3] > 200 && d[i + 1] > 190 && d[i + 2] > 190 && d[i] < 160;

async function glow(file) {
  const { data, info } = await sharp(file).extract(BOX).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let p = 0; p < data.length; p += info.channels) if (lit(data, p)) n++;
  return n;
}
async function dims(file) { const m = await sharp(file).metadata(); return `${m.width}x${m.height}`; }
// Mean absolute difference between two frames, as a fraction - proves the loop
// actually moves rather than being nine copies of one drawing.
async function frameDelta(a, b) {
  const A = await sharp(a).resize(180, 180, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const B = await sharp(b).resize(180, 180, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]);
  return s / A.length / 255;
}
const frames = (st) => Array.from({ length: 9 }, (_, i) => path.join(Z, st, `aquarius_${i}.webp`));

const idle = [], walk = [], attack = [];
for (const f of frames('idle')) idle.push(await glow(f));
for (const f of frames('walk')) walk.push(await glow(f));
for (const f of frames('attack')) attack.push(await glow(f));

const walkFloor = Math.min(...walk);
const BAR = Math.round(walkFloor * 0.8);
const idleFloor = Math.min(...idle), idlePeak = Math.max(...idle);
const dimFrames = idle.map((v, i) => (v < BAR ? i : -1)).filter((i) => i >= 0);

const size = await dims(frames('idle')[0]);
const baseSize = await dims(path.join(Z, 'aquarius.webp'));

const deltas = [];
for (let i = 0; i < 9; i++) deltas.push(await frameDelta(frames('idle')[i], frames('idle')[(i + 1) % 9]));
const minDelta = Math.min(...deltas);

// CONTROL: only the idle loop may have changed. Compare walk + attack against
// the versions on origin, so a regeneration that quietly re-rolled her other
// two loops cannot pass.
let otherChanged = 'not checked';
try {
  const out = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'Sprites/bosses/zodiac/'], { cwd: ROOT, encoding: 'utf8' });
  const touched = out.split('\n').map((s) => s.trim()).filter(Boolean);
  otherChanged = touched.filter((p) => !p.includes('/idle/aquarius_')).join(', ') || 'none';
} catch (e) { otherChanged = 'git failed: ' + e.message; }

console.log('  idle   ' + JSON.stringify(idle));
console.log('  walk   ' + JSON.stringify(walk) + '   floor ' + walkFloor + ' -> bar ' + BAR);
console.log('  attack ' + JSON.stringify(attack));
console.log('  idle floor ' + idleFloor + ' / peak ' + idlePeak + ' | frame-to-frame delta min ' + minDelta.toFixed(4));
console.log('  size ' + size + ' (base ' + baseSize + ') | non-idle zodiac files changed vs origin: ' + otherChanged);

ok('HER EYES STAY LIT: every idle frame carries at least 80% of the dimmest walk frame',
  dimFrames.length === 0,
  dimFrames.length ? `frames ${dimFrames.join(', ')} below the ${BAR} bar: ${dimFrames.map((i) => idle[i]).join(', ')}`
    : `idle floor ${idleFloor} >= bar ${BAR} (previous build: 5 frames at 2746-3450)`);
ok('NO FRAME GOES DARK: the loop never dips below 60% of its own brightest frame',
  idleFloor >= idlePeak * 0.6,
  `floor ${idleFloor} vs peak ${idlePeak} = ${(idleFloor / idlePeak * 100).toFixed(0)}% (previous build: 25%)`);
ok('SHE IS STILL THE SAME SIZE: idle frames match the base canvas exactly',
  size === baseSize, `idle ${size}, base ${baseSize}`);
ok('THE LOOP STILL MOVES: consecutive frames differ, so it is not nine copies',
  minDelta > 0.002, `smallest frame-to-frame delta ${minDelta.toFixed(4)}`);
ok('CONTROL — ONLY THE IDLE LOOP CHANGED: walk and attack untouched vs origin',
  otherChanged === 'none', otherChanged);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
