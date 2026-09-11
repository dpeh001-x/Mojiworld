#!/usr/bin/env node
// Feather the sliced edges of sprites that were cut flat by their canvas.
// ============================================================================
// Found by scripts/art_polish_audit.mjs: a handful of sprites whose art runs into the frame on one
// side - a fireball's trail, a shell's widest rim, a swing arc's tip, the end of a ground band -
// and stops flat there. The slice is small (3-10% of the edge) but a flat cut on a curved or
// glowing shape is exactly the kind of thing that reads as "something is wrong" at gameplay size.
//
// A feather is the cheapest honest fix: over the last few percent of the sliced edge the alpha
// ramps to zero, so the cut becomes a fade. Nothing moves, nothing is redrawn, dimensions are kept
// (the renderer's hitboxes and offsets stay exactly as calibrated), and only the edges the audit
// named are touched - an edge covered more than 60% is a deliberate band and is left alone.
//
//   node scripts/feather_sliced_edges.mjs            # measure and report, write nothing
//   node scripts/feather_sliced_edges.mjs --write    # write, atomically, and re-measure
//   flags: --depth 0.04 (fraction of the edge's axis to feather over)   --only <substring>
import sharp from 'sharp';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
sharp.cache(false);
const has = (f) => process.argv.includes(f);
const argOf = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const DEPTH = Number(argOf('--depth', '0.04'));
const ONLY = argOf('--only', null);
const DIRS = ['Sprites/fx', 'Sprites/vfx', 'Sprites/projectiles', 'Sprites/projectiles/cast'];

async function edges(buf) {
  const { data: d, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => d[(y * W + x) * 4 + 3];
  let L = 0, R = 0, T = 0, B = 0;
  for (let y = 0; y < H; y++) { if (A(0, y) > 180) L++; if (A(W - 1, y) > 180) R++; }
  for (let x = 0; x < W; x++) { if (A(x, 0) > 180) T++; if (A(x, H - 1) > 180) B++; }
  const e = { L: 100 * L / H, R: 100 * R / H, T: 100 * T / W, B: 100 * B / W };
  const band = Object.values(e).some((v) => v > 60);
  return { W, H, e, band, sliced: band ? [] : Object.keys(e).filter((k) => e[k] >= 3 && e[k] <= 60) };
}
// The column beams (fx_col_*) fill their frame top to bottom BY DESIGN - the brief that made them
// says "filling the frame top to bottom" - and the renderer stretches them into a box whose ends
// are the beam's ends. A top or bottom run on one of those is the beam, not a cut; only a side
// slice would be. The same rule lives in art_polish_audit.mjs.
// The telegraph columns (tg_col_*) stand on a pedestal whose underside sits on the floor line in the
// game, so a bottom run there is the base meeting the ground, not a cut (tg_col_legosaurus, B 4%).
const isBeam = (p) => /fx_col_/.test(p);
const isFloorSeated = (p) => /tg_col_/.test(p);
const realSlices = (p, sliced) => sliced.filter((k) => !(isBeam(p) && (k === 'T' || k === 'B')) && !(isFloorSeated(p) && k === 'B'));
async function feather(buf, W, H, sides) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = Math.max(2, Math.round(W * DEPTH)), py = Math.max(2, Math.round(H * DEPTH)), C = info.channels;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 1;
    if (sides.includes('L') && x < px) k = Math.min(k, x / px);
    if (sides.includes('R') && W - 1 - x < px) k = Math.min(k, (W - 1 - x) / px);
    if (sides.includes('T') && y < py) k = Math.min(k, y / py);
    if (sides.includes('B') && H - 1 - y < py) k = Math.min(k, (H - 1 - y) / py);
    if (k < 1) { const i = (y * W + x) * C + 3; data[i] = Math.round(data[i] * k); }
  }
  return sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toBuffer();
}
let found = 0, written = 0;
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!/\.webp$/.test(f)) continue;
    const p = join(dir, f); if (ONLY && !p.includes(ONLY)) continue;
    let buf; try { buf = await readFile(p); } catch { continue; }
    let m; try { m = await edges(buf); } catch { continue; }
    const sides = realSlices(p, m.sliced);
    if (!sides.length) { if (m.sliced.length) console.log(`  ${p}: ${m.sliced.map((k) => `${k} ${m.e[k].toFixed(0)}%`).join(', ')} is by design (beam end / floor-seated base) - skipped`); continue; }
    found++;
    const before = sides.map((k) => `${k} ${m.e[k].toFixed(0)}%`).join(', ');
    if (!has('--write')) { console.log(`  ${p}: sliced on ${before}  (${m.W}x${m.H})`); continue; }
    const out = await feather(buf, m.W, m.H, sides);
    const after = await edges(out);
    const leftSides = realSlices(p, after.sliced);
    const left = leftSides.map((k) => `${k} ${after.e[k].toFixed(0)}%`).join(', ') || 'none';
    if (leftSides.length) { console.log(`  ${p}: ${before} -> still ${left} - NOT written`); continue; }
    await writeFile(p + '.tmp', out); await rename(p + '.tmp', p); written++;
    console.log(`  ${p}: ${before} -> feathered over ${(100 * DEPTH).toFixed(0)}% of the edge, now ${left}`);
  }
}
console.log(`\n${found} sliced sprite(s)${has('--write') ? `, ${written} written` : ' - dry run, nothing written (add --write)'}`);
