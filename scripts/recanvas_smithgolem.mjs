#!/usr/bin/env node
// SMITH GOLEM - re-canvas all 28 assets to ONE scale, ONE foot line, ONE body
// centre, with guaranteed margins. Per user: "regenerate and recalibrate the
// smithgolem canvas and all of the sprites such that there are no cutoffs and
// no pulse/variation between sprite frames".
//
// WHAT THE MEASUREMENT SAYS (grey stone body, hammer and gem excluded): the body
// height is already uniform across idle/walk/attack (95-102%, mostly +-1%). The
// pulse is not in the art - it is the calib fs[] baked in v0.30.403, which
// measured the CHEST GEM; the gem foreshortens when the golem turns (attack
// 3-5) and hides behind the arm (6-7), so that pass read a body shrink that is
// not there and scaled those frames up 12-58%. This tool therefore does NOT
// rescale frames against each other. It:
//   1. keeps one pixel scale for the whole set (a single global shrink k<=1 only
//      if the widest/tallest ink would otherwise breach the margin);
//   2. centres every frame horizontally on its STONE-BODY centre (the body no
//      longer slides 34px across the cycle);
//   3. places the ink bottom on one row (FOOT_ROW), the v0.30.235 convention;
//   4. guarantees >= MARGIN px clear on every side (no cutoffs, by construction).
// Pure resample-free translation unless k<1 (then one high-quality resize).
//   node scripts/recanvas_smithgolem.mjs            # measure + stage
//   node scripts/recanvas_smithgolem.mjs --install  # staged -> Sprites/
import sharp from 'sharp';
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'smithgolem_recanvas');
const CANVAS = 1024, MARGIN = 32, FOOT_ROW = 1012;   // ink bottom row: 1024 - FLOOR_MARGIN(11) - 1
const FILES = [{ st: 'base', rel: 'Sprites/monsters/smithgolem.webp' }];
for (const st of ['idle', 'walk', 'attack']) for (let i = 0; i < 9; i++) FILES.push({ st, i, rel: `Sprites/monsters/${st}/smithgolem_${i}.webp` });

export async function measure(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let t = -1, b = -1, l = -1, r = -1, edge = 0, st = -1, sb = -1, sl = -1, sr = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, a = data[o + 3];
    if (a > 16) { if (t < 0) t = y; b = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++; }
    if (a >= 200) { const R = data[o], G = data[o + 1], B = data[o + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      if ((mx ? (mx - mn) / mx : 0) < 0.22 && (R + G + B) / 3 > 120) { if (st < 0) st = y; sb = y; if (sl < 0 || x < sl) sl = x; if (x > sr) sr = x; } }
  }
  return { W, H, edge, ink: { l, r, t, b, w: r - l + 1, h: b - t + 1 }, stone: { l: sl, r: sr, t: st, b: sb, h: sb - st + 1, cx: (sl + sr) / 2 } };
}
const atomic = async (p, buf) => { await writeFile(p + '.tmp', buf); await rename(p + '.tmp', p); };

if (process.argv.includes('--install')) {
  for (const f of FILES) { const p = join(STAGE, f.rel.replace(/\//g, '__')); if (!existsSync(p)) { console.error('ABORT: not staged: ' + f.rel); process.exit(1); }
    const m = await measure(await readFile(p)); if (m.edge || m.ink.l < MARGIN || CANVAS - 1 - m.ink.r < MARGIN || m.ink.t < MARGIN) { console.error('ABORT: staged ' + f.rel + ' breaches the margin'); process.exit(1); }
    await copyFile(p, join(ROOT, f.rel)); }
  console.log('installed ' + FILES.length + ' assets. NEXT: gen_anim_manifest (smithgolem entry), calib: drop attack fs, sw.js bump.');
  process.exit(0);
}

await mkdir(STAGE, { recursive: true });
const src = [];
for (const f of FILES) { const buf = await readFile(join(ROOT, f.rel)); src.push({ ...f, buf, m: await measure(buf) }); }
// one global scale for the set: shrink only if the worst frame would breach the margin after centring
let k = 1;
for (const s of src) {
  const halfW = Math.max(s.m.ink.r - s.m.stone.cx, s.m.stone.cx - s.m.ink.l);   // ink half-width about the stone centre
  // +2px slack: k is floored to 3 decimals and the composite rounds, so aim inside the margin
  k = Math.min(k, (CANVAS / 2 - MARGIN - 2) / halfW, (FOOT_ROW - MARGIN - 2) / s.m.ink.h);
}
k = Math.floor(k * 1000) / 1000;
console.log('global scale k = ' + k + (k < 1 ? '  (one shrink so the widest swing clears the margin)' : '  (no resample: pure translation)'));
const rows = [];
for (const s of src) {
  let img = sharp(s.buf).ensureAlpha();
  let m = s.m;
  if (k < 1) { const nw = Math.round(s.m.W * k), nh = Math.round(s.m.H * k); const rb = await img.resize(nw, nh, { kernel: 'lanczos3' }).png().toBuffer(); img = sharp(rb); m = await measure(rb); }
  // translate so the stone centre sits at CANVAS/2 and the ink bottom on FOOT_ROW
  const dx = Math.round(CANVAS / 2 - m.stone.cx), dy = Math.round(FOOT_ROW - m.ink.b);
  const left = m.ink.l + dx, top = m.ink.t + dy;
  const crop = await img.extract({ left: m.ink.l, top: m.ink.t, width: m.ink.w, height: m.ink.h }).png().toBuffer();
  const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: crop, left, top }]).webp({ quality: 95, lossless: false }).toBuffer();
  const mm = await measure(out);
  rows.push({ ...s, out, mm });
  await atomic(join(STAGE, s.rel.replace(/\//g, '__')), out);
}
const ref = rows.filter(r => r.st === 'idle').reduce((a, r) => a + r.mm.stone.h, 0) / 9;
console.log('after: stone-height ref (idle mean) ' + ref.toFixed(1) + 'px\n' + 'state   i  stoneH   %ref  cx    inkBottom  margins L/R/T   EDGE');
for (const r of rows) console.log(`${r.st.padEnd(7)} ${String(r.i ?? '-').padStart(2)}  ${String(r.mm.stone.h).padStart(4)}   ${(100 * r.mm.stone.h / ref).toFixed(0).padStart(3)}%  ${String(Math.round(r.mm.stone.cx)).padStart(4)}  ${String(r.mm.ink.b).padStart(6)}     ${String(r.mm.ink.l).padStart(3)}/${String(CANVAS - 1 - r.mm.ink.r).padStart(3)}/${String(r.mm.ink.t).padStart(3)}   ${r.mm.edge}`);
const T = 110; for (const st of ['idle', 'walk', 'attack']) { const tiles = []; const fr = rows.filter(r => r.st === st);
  for (const r of fr) tiles.push({ input: await sharp(r.out).resize(T, T, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: r.i * T, top: 0 });
  await sharp({ create: { width: T * 9, height: T, channels: 4, background: { r: 24, g: 20, b: 34, alpha: 255 } } }).composite(tiles).png().toFile(join(STAGE, 'sheet_' + st + '.png')); }
console.log('staged in scripts/_style_pack/smithgolem_recanvas/ - review sheets, then --install');
