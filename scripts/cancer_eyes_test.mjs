// Cancer's eye art is the original art.
// ============================================================================
// Per user, after seeing the kawaii-eye pass in play: "then remove the kawaii
// eyes it looks too artificial and weird".
//
// v0.30.711 edited her base sprite to swap the blank amber-ringed discs for big
// black kawaii eyes and regenerated idle, walk and attack from it. In motion it
// did not work: the eyes read as pasted on, and the attack loop drifted them up
// the shell onto the feeler bases so she appeared to grow eyes on her antennae
// (frames 1-7 of nine). This test now asserts the REVERT — all 28 sprites back
// to exactly the bytes that shipped before that change.
//
// Byte equality against the pre-change commit is the real check; the pixel
// measurements below are a second, independent opinion that does not depend on
// git, so a future rewrite of history cannot make this pass vacuously.
//
// Run: node scripts/cancer_eyes_test.mjs
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Z = path.join(ROOT, 'Sprites', 'bosses', 'zodiac');
// The commit whose Cancer art is the one to hold: the parent of the kawaii-eye
// art commit (9dca9d0a), i.e. the art as it stood before v0.30.711.
const PRE = '3ced88f1ff1d3860313e1f8411f8e3cd328781b5';
const EYE = { left: 580, top: 940, width: 380, height: 180 };
// Measured signatures. The original art sits near 20%; the rejected kawaii pass
// sat at 38-40%. The 30% line is comfortably between the two populations.
const KAWAII_LINE = 30;

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const files = ['Sprites/bosses/zodiac/cancer.webp'];
for (const st of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) files.push(`Sprites/bosses/zodiac/${st}/cancer_${i}.webp`);

// ---- 1. byte equality with the pre-change art ------------------------------
const mismatched = [];
let gitOk = true;
for (const p of files) {
  try {
    const want = git(['rev-parse', `${PRE}:${p}`]);
    const got = git(['hash-object', p]);
    if (want !== got) mismatched.push(p.split('/').slice(-2).join('/'));
  } catch (e) { gitOk = false; break; }
}

// ---- 2. the same conclusion from the pixels, without git -------------------
async function eyeBlack(file) {
  const { data, info } = await sharp(await readFile(file)).extract(EYE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0, tot = 0;
  for (let p = 0; p < data.length; p += info.channels) {
    if (data[p + 3] < 128) continue;
    tot++;
    if (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2] < 40) black++;
  }
  return tot ? 100 * black / tot : 0;
}
const baseBlack = await eyeBlack(path.join(Z, 'cancer.webp'));
const loopBlack = {};
for (const st of ['idle', 'walk']) {
  const v = [];
  for (let i = 0; i < 9; i++) v.push(+(await eyeBlack(path.join(Z, st, `cancer_${i}.webp`))).toFixed(1));
  loopBlack[st] = v;
}
const kawaiiFrames = ['idle', 'walk'].flatMap((st) => loopBlack[st].map((v, i) => (v >= KAWAII_LINE ? `${st}_${i}` : null)).filter(Boolean));

// ---- 3. the manifest describes the art that is actually on disk ------------
const mf = {};
// eslint-disable-next-line no-new-func
new Function('window', await readFile(path.join(ROOT, 'data', 'anim_calib_manifest.js'), 'utf8'))(mf);
const entry = mf.LX_ANIM_MANIFEST && mf.LX_ANIM_MANIFEST.zodiac_cancer;
async function frameBox(p) {
  const { data, info } = await sharp(await readFile(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  let cT = -1, cB = -1, bT = -1, bB = -1;
  for (let y = 0; y < H; y++) {
    let any = false, solid = false;
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * C + 3];
      if (a > 16) { any = true; if (a > 235) { solid = true; break; } }
    }
    if (any) { if (cT < 0) cT = y; cB = y; }
    if (solid) { if (bT < 0) bT = y; bB = y; }
  }
  return [cT, cB, bT, bB];
}
const stale = [];
if (entry) {
  for (const st of ['idle', 'walk', 'attack']) {
    const want = [];
    for (let i = 0; i < 9; i++) want.push(await frameBox(path.join(Z, st, `cancer_${i}.webp`)));
    if (JSON.stringify(entry.states[st].cb) !== JSON.stringify(want)) stale.push(st);
  }
}

// ---- 4. control: the Aquarius fix from the same day is untouched -----------
let aqOk = 'not checked';
try {
  const out = git(['diff', '--name-only', 'origin/main', '--', 'Sprites/bosses/zodiac/idle/aquarius_0.webp',
    'Sprites/bosses/zodiac/idle/aquarius_4.webp', 'Sprites/bosses/zodiac/idle/aquarius_8.webp']);
  aqOk = out ? out.split('\n').join(', ') : 'none';
} catch (e) { aqOk = 'git failed'; }

console.log(`  base eye band ${baseBlack.toFixed(1)}% black  (original ~20.6%, rejected kawaii pass ~38.5%)`);
console.log(`  idle ${JSON.stringify(loopBlack.idle)}`);
console.log(`  walk ${JSON.stringify(loopBlack.walk)}`);
console.log(`  byte-identical to ${PRE.slice(0, 8)}: ${gitOk ? `${files.length - mismatched.length}/${files.length}` : 'git unavailable'} | manifest stale states: ${stale.join(', ') || 'none'} | aquarius idle changed: ${aqOk}`);

ok('THE ART IS THE ORIGINAL ART: all 28 sprites byte-identical to the pre-change commit',
  gitOk && mismatched.length === 0,
  gitOk ? (mismatched.length ? `differs: ${mismatched.join(', ')}` : `${files.length}/${files.length} match ${PRE.slice(0, 8)}`) : 'git unavailable - byte check could not run');
ok('NO KAWAII EYES ON THE BASE: the eye band reads as the original discs',
  baseBlack < KAWAII_LINE,
  `${baseBlack.toFixed(1)}% black, under the ${KAWAII_LINE}% line (the rejected pass measured 38.5%)`);
ok('NO KAWAII EYES IN ANY LOOP: no idle or walk frame carries them',
  kawaiiFrames.length === 0,
  kawaiiFrames.length ? `still kawaii: ${kawaiiFrames.join(', ')}` : `18 frames all under ${KAWAII_LINE}%`);
ok('THE MANIFEST MATCHES THE ART ON DISK: her frame boxes were re-measured',
  !!entry && stale.length === 0,
  entry ? (stale.length ? `stale: ${stale.join(', ')}` : 'idle, walk and attack all current') : 'zodiac_cancer missing from the manifest');
ok('CONTROL — AQUARIUS IS UNTOUCHED: the other zodiac fix is not collateral',
  aqOk === 'none', aqOk);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
