#!/usr/bin/env node
// The BASE GAP of every standing prop's art, for _LX_PROP_BASE in mojiworld_game.html (per user, 2026-10-04: objects "need to shift down
// further to properly coincide with the actual floor line"). drawWorldProps plants a prop's lowest pixel row (its sprite_bbox bottom: alpha
// > 64, two in a row) on its y, then sinks it _LX_PROP_PLANT_PX plus this gap scaled to the drawn size (capped at 3 px). The gap is the art
// rows from that lowest row up to the VISIBLE base: the first row, scanning up, whose span (leftmost to rightmost pixel with alpha >= 200)
// reaches 35% of the footprint (the widest span in the art's bottom 12%). Feet, wheels and table legs span the footprint at once (gap 0);
// a round log, boots, a pointed stone narrow to a tip.
//   node scripts/gen_prop_base.mjs           print the table's rows (paste them into _LX_PROP_BASE)
//   node scripts/gen_prop_base.mjs --check   exit 1 when the game's table differs from the art
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const ROOT = process.env.MOJI_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const game = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const mp = game.slice(game.indexOf('const MAP_PROPS = {')); const keys = new Set();
for (const m of mp.slice(0, mp.indexOf('\n};')).matchAll(/key\s*:\s*'(\w+)'/g)) keys.add(m[1]);
const SRC = {}; for (const m of game.matchAll(/^\s+(\w+):\s*\{ still: '([^']+)'/gm)) SRC[m[1]] = m[2];
const t0 = game.indexOf('const _LX_PROP_BASE = {'), have = {};
if (t0 >= 0) for (const m of game.slice(t0, game.indexOf('};', t0)).matchAll(/(\w+):\s*(\d+)/g)) have[m[1]] = +m[2];
const skip = new Set(((game.match(/const _LX_PROP_NOPLANT = new Set\(\[([^\]]*)\]\)/) || [])[1] || '').match(/\w+/g) || []);
const want = {};
for (const k of [...keys].sort()) {
  if (skip.has(k)) continue;
  const f = path.join(ROOT, SRC[k] || `Sprites/objects/${k}.webp`); if (!fs.existsSync(f)) continue;
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  let bb = -1; outer: for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { bb = y; break outer; } } else run = 0; } }
  let top = 0; outer2: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 12) { top = y; break outer2; }
  const span = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (A(x, y) >= 200) { if (l < 0) l = x; r = x; } return l < 0 ? 0 : r - l + 1; };
  const q0 = Math.round(bb - (bb - top) * 0.12); let foot = 0; for (let y = q0; y <= bb; y++) foot = Math.max(foot, span(y));
  let base = bb; while (base > q0 && span(base) < foot * 0.35) base--;
  if (bb - base > 0) want[k] = bb - base;
}
if (process.argv.includes('--check')) {
  const diff = [...new Set([...Object.keys(want), ...Object.keys(have)])].filter((k) => want[k] !== have[k]);
  console.log(diff.length ? 'STALE: ' + diff.map((k) => `${k} art ${want[k] || 0} vs table ${have[k] || 0}`).join(', ') : `_LX_PROP_BASE is up to date (${Object.keys(want).length} rows)`);
  process.exit(diff.length ? 1 : 0);
}
const rows = Object.entries(want).map(([k, v]) => `${k}: ${v}`); for (let i = 0; i < rows.length; i += 6) console.log('  ' + rows.slice(i, i + 6).join(', ') + ',');
