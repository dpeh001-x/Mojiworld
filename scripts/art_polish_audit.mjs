#!/usr/bin/env node
// Art polish audit — every mechanical way this session has found art to be wrong, run over the whole
// game at once. Per user: "Find final art polishes to the game to work on".
//
// It looks for the classes of fault that were each found one at a time before this:
//   1. a sprite table that names a file that is not on disk (a 404 -> the procedural fallback);
//   2. an enemy projectile key that draws PROCEDURALLY - it has art, or not, but no blit row and no
//      dedicated branch (the Sovereign's homers fell through exactly this gap, v0.30.577);
//   3. a columnStrike whose sprite is squashed hard into its band (the drain pillar, v0.30.579);
//   4. sprites with ink on the canvas border (cut-offs), near-blank sprites, near-blank or repeated
//      frames in a loop (block_mage_8 was blank; mspore frames 4/5 were identical), tiny sources,
//      and painterly outliers in cel-shaded families (the drain pillar, measured by concentration).
//   node scripts/art_polish_audit.mjs [path/to/mojiworld_game.html]
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
sharp.cache(false);
const GAME = process.argv[2] || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');
const out = { missing: [], procedural: [], squash: [], border: [], blank: [], tiny: [], painterly: [], loops: [] };

// ---- 1. table -> file references -----------------------------------------------------------
function tableBlock(name) { const i = src.indexOf(`const ${name} = (() => {`); if (i < 0) return ''; const j = src.indexOf('\n})();', i); return src.slice(i, j); }
function parseFiles(name) {
  const b = tableBlock(name); if (!b) return [];
  const base = (b.match(/'(Sprites\/[a-z/]+\/)' \+ f/) || [])[1] || (b.match(/\('(Sprites\/[a-z/]+\/)' \+ f\)/) || [])[1] || '';
  const rows = [];
  for (const m of b.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+\.webp)'/gm)) rows.push({ key: m[1], file: m[2].startsWith('Sprites/') ? m[2] : base + m[2], table: name });
  return rows;
}
const tables = ['LX_VFX', 'LX_MOB_PROJ', 'LX_PLAYER_PROJ', 'LX_FX', 'LX_MOB_CAST'].flatMap(parseFiles);
for (const m of src.matchAll(/_loadBG\('([^']+)'\)/g)) tables.push({ key: 'bg', file: m[1], table: 'BG_IMAGES' });
// Existence is checked against the PUSHED tree first, not just the working copy: this repo is edited
// by several sessions committing through plumbing, so the local checkout is routinely stale and mid-
// refactor (its first run flagged grav_impact.webp and safezone_shield.webp, both fine on origin).
import { execFileSync } from 'node:child_process';
let treeSet = null;
try { treeSet = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'Sprites', 'backgrounds'], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n')); } catch (e) {}
const shipped = (f) => (treeSet ? treeSet.has(f) : false) || existsSync(f);
for (const r of tables) { const f = r.file; const alt = f.replace(/\.webp$/, '.png'); if (!shipped(f) && !shipped(alt)) out.missing.push(`${r.table}.${r.key} -> ${f}`); }

// ---- 2. enemy projectile keys that draw procedurally ---------------------------------------
const mobProj = new Set(parseFiles('LX_MOB_PROJ').map((r) => r.key));
const blit = new Set([...src.matchAll(/^\s*([A-Za-z0-9_]+):\s*\{\s*mode:\s*'(?:orient|spin|static)'/gm)].map((m) => m[1]));
const dedicated = new Set([...src.matchAll(/p\.skill === '([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
const enemyKeys = new Set([...src.matchAll(/shoot:'([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
for (const m of src.matchAll(/owner: 'enemy'[^\n]*?skill: '([A-Za-z0-9_]+)'|skill: '([A-Za-z0-9_]+)'[^\n]*?owner: 'enemy'/g)) enemyKeys.add(m[1] || m[2]);
for (const k of [...enemyKeys].sort()) {
  const hasArt = mobProj.has(k), drawn = blit.has(k) || dedicated.has(k);
  if (!drawn) out.procedural.push(`${k}: ${hasArt ? 'HAS ART but no blit row / branch (draws as the colour circle)' : 'no sprite at all (procedural)'}`);
}

// ---- 3. columnStrike squash ---------------------------------------------------------------
for (const m of src.matchAll(/columnStrike:\{[^}]*?width:(\d+)[^}]*?range:(\d+)[^}]*?sprite:'([A-Za-z0-9_]+)'/g)) {
  const f = `Sprites/fx/${m[3]}.webp`; if (!existsSync(f)) continue;
  out.squash.push({ key: m[3], w: +m[1], r: +m[2], file: f });
}
// drawProjectiles blits a column at 1.6x its hitbox width (the halo bleed), so that is the width the
// art is actually squashed into - the first run of this compared against the bare hitbox and
// overstated every column by that factor
for (const s of out.squash) { const m = await sharp(s.file).metadata(); s.art = `${m.width}x${m.height}`; s.factor = +((m.width / m.height) / ((1.6 * s.w) / s.r)).toFixed(2); }
out.squash = out.squash.filter((s) => s.factor >= 1.4 || s.factor <= 0.7).sort((a, b) => b.factor - a.factor).map((s) => `${s.key}: art ${s.art} drawn ${Math.round(1.6 * s.w)}x${s.r} -> ${s.factor}x (${s.factor > 1 ? 'narrower' : 'wider'} than authored)`);

// ---- 4. per-sprite scans ----------------------------------------------------------------------
async function scan(file) {
  const { data: d, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let lit = 0, interior = 0; const hist = new Array(32).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, a = d[i + 3]; if (a <= 16) continue; lit++;
    if (a > 200) { interior++; hist[Math.min(31, Math.floor((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 8))]++; }
  }
  // A SLICE, NOT A BORDER COUNT. Raw border ink flagged 86 sprites, most of them bands and beams that
  // run edge to edge on purpose. A cut-off looks different: a SHORT run of near-opaque ink on one
  // edge - the widest part of a shape stopped flat by the frame. So: per-edge near-opaque coverage,
  // and an edge covered 3-60% is a slice unless some edge is covered >60%, which is a deliberate band.
  const A = (x, y) => d[(y * W + x) * 4 + 3];
  let L = 0, R = 0, T = 0, B = 0;
  for (let y = 0; y < H; y++) { if (A(0, y) > 180) L++; if (A(W - 1, y) > 180) R++; }
  for (let x = 0; x < W; x++) { if (A(x, 0) > 180) T++; if (A(x, H - 1) > 180) B++; }
  const edges = { L: 100 * L / H, R: 100 * R / H, T: 100 * T / W, B: 100 * B / W };
  const band = Object.values(edges).some((v) => v > 60);
  // fx_col_* beams fill their frame top to bottom by design (the brief says so) and the renderer
  // stretches them into a box whose ends ARE the beam's ends - a top/bottom run there is not a cut.
  // tg_col_* pedestals sit on the floor line in-game, so their bottom run is the base meeting the ground.
  const beam = /fx_col_/.test(file), seated = /tg_col_/.test(file);
  const sliced = band ? [] : Object.entries(edges).filter(([k, v]) => v >= 3 && v <= 60 && !(beam && (k === 'T' || k === 'B')) && !(seated && k === 'B')).map(([k, v]) => `${k} ${v.toFixed(0)}%`);
  const top4 = [...hist].sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0);
  return { W, H, litPct: 100 * lit / (W * H), sliced, concentration: interior ? 100 * top4 / interior : 0, alpha: d };
}
const DIRS = ['Sprites/fx', 'Sprites/vfx', 'Sprites/projectiles', 'Sprites/projectiles/cast'];
const stats = {};
for (const dir of DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!/\.webp$/.test(f)) continue; const p = join(dir, f);
    try { const s = await scan(p); delete s.alpha; stats[p] = s;
      if (s.sliced.length) out.border.push(`${p}: sliced on ${s.sliced.join(', ')} (${s.W}x${s.H})`);
      if (s.litPct < 0.3) out.blank.push(`${p}: ${s.litPct.toFixed(2)}% ink`);
      if (Math.max(s.W, s.H) < 128) out.tiny.push(`${p}: ${s.W}x${s.H}`);
    } catch (e) { out.missing.push(`${p}: unreadable (${e.message})`); }
  }
}
// painterly outliers: the bottom of each family by concentration, only where the family is clearly cel (median >= 45)
for (const dir of DIRS) {
  const rows = Object.entries(stats).filter(([p]) => p.startsWith(dir + '/') || p.startsWith(dir + '\\')).map(([p, s]) => ({ p, c: s.concentration })).filter((r) => r.c > 0).sort((a, b) => a.c - b.c);
  if (rows.length < 8) continue; const med = rows[Math.floor(rows.length / 2)].c;
  if (med < 45) continue;
  for (const r of rows.slice(0, 6)) if (r.c < med * 0.55) out.painterly.push(`${r.p}: concentration ${r.c.toFixed(0)}% vs family median ${med.toFixed(0)}%`);
}
// loops: blank or repeated consecutive frames in every anim set
for (const dir of ['Sprites/fx/anim', 'Sprites/vfx/anim', 'Sprites/projectiles/anim']) {
  if (!existsSync(dir)) continue;
  const sets = {}; for (const f of readdirSync(dir)) { const m = f.match(/^(.*)_(\d+)\.webp$/); if (m) (sets[m[1]] = sets[m[1]] || []).push(+m[2]); }
  for (const [key, idx] of Object.entries(sets)) {
    idx.sort((a, b) => a - b); const frames = [];
    for (const i of idx) { const p = join(dir, `${key}_${i}.webp`); try { frames.push(await scan(p)); } catch (e) { frames.push(null); } }
    const blanks = idx.filter((i, k) => frames[k] && frames[k].litPct < 0.3);
    if (blanks.length) out.loops.push(`${dir}/${key}: blank frame(s) ${blanks.join(',')}`);
    let dup = [];
    for (let k = 0; k + 1 < frames.length; k++) { const a = frames[k], b = frames[k + 1]; if (!a || !b || a.W !== b.W || a.H !== b.H) continue;
      // all four channels - an alpha-only diff reported a brightness-only pulse (taurus_boulder) as nine identical frames
      let diff = 0; for (let q = 0; q < a.alpha.length; q++) diff += Math.abs(a.alpha[q] - b.alpha[q]); if (100 * diff / (255 * 4 * a.W * a.H) < 0.05) dup.push(`${idx[k]}=${idx[k + 1]}`); }
    if (dup.length) out.loops.push(`${dir}/${key}: identical consecutive frames ${dup.join(' ')}`);
  }
}
// ---- report ---------------------------------------------------------------------------------
const section = (title, rows) => { console.log(`\n== ${title} (${rows.length}) ==`); for (const r of rows.slice(0, 40)) console.log('  ' + r); if (rows.length > 40) console.log(`  ... ${rows.length - 40} more`); };
section('table entries whose file is missing on disk', out.missing);
section('enemy projectile keys drawn procedurally', out.procedural);
section('columnStrike sprites squashed >= 1.6x into their band', out.squash);
section('sprites with a sliced edge (a short near-opaque run on the frame; edge-to-edge bands excluded)', out.border);
section('near-blank sprites', out.blank);
section('tiny sources (< 128 px)', out.tiny);
section('painterly outliers in cel-shaded families', out.painterly);
section('animation loops with blank or repeated frames', out.loops);
console.log(`\nscanned ${Object.keys(stats).length} sprites`);
