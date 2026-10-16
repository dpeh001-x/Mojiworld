#!/usr/bin/env node
// Precompute sprite BBOX metrics into data/sprite_bbox.js.
//
// WHY: profiling a 29-mob fight showed 5.7 s of the run blocked inside
// getImageData, and the two bbox scanners were 3.2 s of it. Cutting the pixels
// they read by 83% (band scanning) bought only 7% of the time — because the
// cost is the per-call GPU->CPU sync stall, ~7 ms EVERY call regardless of
// size. The only way to win is to not call it at runtime at all.
//
// This replicates the two runtime scans EXACTLY — same alpha thresholds, same
// two-opaque-pixel run rule, same fallbacks — so the table is a drop-in answer
// rather than an approximation. scripts/sprite_bbox_test.mjs proves that in the
// browser by comparing table values against live scans.
//
// Edge-feather data is deliberately NOT precomputed: that probe downscales to
// 48x48 through the browser's own resampler, and sharp's resize would not match
// it pixel for pixel. Wrong feather is a visible regression; it keeps its
// runtime probe (now budgeted per frame instead).
//
//   node scripts/gen_sprite_bbox.mjs            # write data/sprite_bbox.js
//   node scripts/gen_sprite_bbox.mjs --check    # exit 1 if the table is stale
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
sharp.cache(false);

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const OUT = join(ROOT, 'data', 'sprite_bbox.js');
const CHECK = process.argv.includes('--check');
const SUM_ONLY = process.argv.includes('--summons-only');   // keep the existing LX_SPRITE_BBOX line verbatim; regenerate only LX_SUMMON_BOX
// Only the trees whose sprites actually reach the two scanners.
const DIRS = ['monsters', 'bosses', 'objects', 'npc'];
const SKIP = (n) => n.startsWith('_') || /backup/i.test(n) || /^pre_\d/.test(n) || n === 'Todo list';

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (SKIP(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.webp') || e.name.endsWith('.png')) files.push(p);
  }
};
if (!SUM_ONLY) for (const d of DIRS) { const p = join(ROOT, 'Sprites', d); if (existsSync(p)) walk(p); }
files.sort();

// --- the two scans, replicated exactly from mojiworld_game.html -------------
// bottom: alpha > 64, needs TWO consecutive opaque px in a row, scanning up.
//         no hit -> height - 1.
// top:    alpha > 12, first opaque px scanning down. no hit -> 0.
async function metrics(file) {
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const A = (x, y) => data[(y * W + x) * C + 3];
  let bot = H - 1;
  outer: for (let y = H - 1; y >= 0; y--) {
    let run = 0;
    for (let x = 0; x < W; x++) {
      if (A(x, y) > 64) { if (++run >= 2) { bot = y; break outer; } } else run = 0;
    }
  }
  let top = 0;
  outer2: for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) { if (A(x, y) > 12) { top = y; break outer2; } }
  }
  return [top, bot, W, H];
}

const table = {};
let n = 0;
for (const f of files) {
  const key = relative(join(ROOT, 'Sprites'), f).split('\\').join('/');
  try { table[key] = await metrics(f); } catch (e) { /* unreadable art is skipped, runtime falls back */ }
  if (++n % 500 === 0) process.stdout.write(`  ${n}/${files.length}\r`);
}

// Compact: "top,bot,w,h" strings keep the file a third of the JSON-array size.
let flat = {};
for (const k of Object.keys(table).sort()) flat[k] = table[k].join(',');
if (SUM_ONLY) { const m = (existsSync(OUT) ? readFileSync(OUT, 'utf8') : '').match(/^window\.LX_SPRITE_BBOX = (.*);$/m); if (!m) throw new Error('--summons-only needs the existing LX_SPRITE_BBOX line'); flat = JSON.parse(m[1]); }
// summon-table: the summon art's measures, replicated from the game (see _lxSummonRow): "top,bottom,W,H,cb,gap" - top / bottom the first / last row with alpha > 64 (what _spriteContentBox reads),
// cb the last row with alpha > 40 (_summonContentBottomFrac), gap the px the higher near foot sits above the lowest (_summonFeetFrac)
async function summonRow(file) {
  const { data, info } = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height, C = info.channels, A = (x, y) => data[(y * W + x) * C + 3];
  const rowHas = (y, t) => { for (let x = 0; x < W; x++) if (A(x, y) > t) return true; return false; };
  let top = -1, bottom = -1, cb = -1; for (let y = 0; y < H && top < 0; y++) if (rowHas(y, 64)) top = y; if (top < 0) return null;
  for (let y = H - 1; y >= top && bottom < 0; y--) if (rowHas(y, 64)) bottom = y; if (bottom < 0) bottom = top;
  for (let y = H - 1; y >= 0 && cb < 0; y--) if (rowHas(y, 40)) cb = y;
  const low = new Int32Array(W).fill(-1); let t128 = -1, b128 = -1;
  for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (A(x, y) >= 128) { low[x] = y; if (y > b128) b128 = y; break; }
  for (let y = 0; y < H && t128 < 0; y++) for (let x = 0; x < W; x++) if (A(x, y) >= 128) { t128 = y; break; }
  let gap = 0;
  if (b128 >= 0 && t128 >= 0) {
    const band = b128 - (b128 - t128) * 0.3, win = Math.max(8, Math.round(W / 36)), tips = [];
    for (let x = 0; x < W; x++) { if (low[x] < band) continue; let tip = true; for (let k = Math.max(0, x - win); k <= Math.min(W - 1, x + win); k++) if (low[k] > low[x]) { tip = false; break; }
      if (tip) { const f = tips[tips.length - 1]; if (f && x - f.r <= win + 2) { f.r = x; if (low[x] > f.low) f.low = low[x]; } else tips.push({ l: x, r: x, low: low[x] }); } }
    tips.sort((p, q) => q.low - p.low);
    const near = tips.filter((t) => (b128 - t.low) <= H * 0.04); if (near.length >= 2) gap = Math.max(0, b128 - near[near.length - 1].low);
  }
  return [top, bottom, W, H, cb, gap].join(',');
}
const sumFiles = []; { const w2 = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (SKIP(e.name)) continue; const p = join(d, e.name); if (e.isDirectory()) w2(p); else if (e.name.endsWith('.webp') || e.name.endsWith('.png')) sumFiles.push(p); } }; const sd = join(ROOT, 'Sprites', 'summons'); if (existsSync(sd)) w2(sd); sumFiles.sort(); }
const sumFlat = {}; for (const f of sumFiles) { try { const r = await summonRow(f); if (r) sumFlat[relative(join(ROOT, 'Sprites'), f).split('\\').join('/')] = r; } catch (e) { /* unreadable: the runtime falls back */ } }
const body = `// GENERATED by scripts/gen_sprite_bbox.mjs — do not hand-edit.
// Opaque-content bounds per sprite: "bboxTop,bboxBottom,width,height".
// Runtime reads this instead of a getImageData scan; see _detectSpriteBboxTop /
// _detectSpriteBboxBottom in mojiworld_game.html. Regenerate after any art drop
// under Sprites/{monsters,bosses,objects,npc}: node scripts/gen_sprite_bbox.mjs
window.LX_SPRITE_BBOX = ${JSON.stringify(flat)};
// LX_SUMMON_BOX - the summon art's own measures (see _lxSummonRow in mojiworld_game.html), read when the pixel readback is blocked (CDN art, a file:// build):
// "top,bottom,W,H,cb,gap" per Sprites/summons file. Regenerate after any summon art drop: node scripts/gen_sprite_bbox.mjs --summons-only
window.LX_SUMMON_BOX = ${JSON.stringify(sumFlat)};
`;

if (CHECK) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur.trim() !== body.trim()) { console.error(`STALE: ${OUT} differs — re-run without --check`); process.exit(1); }
  console.log(`sprite_bbox.js is current (${Object.keys(flat).length} sprites)`);
  process.exit(0);
}
writeFileSync(OUT, body);
console.log(`\nwrote ${OUT}: ${Object.keys(flat).length} sprites + ${Object.keys(sumFlat).length} summon rows, ${(body.length / 1024).toFixed(0)} KB`);
