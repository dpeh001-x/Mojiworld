#!/usr/bin/env node
// Which sprites does the edge table NOT cover?
// ============================================================================
// data/sprite_edges.js answers _lxEdgesTouched without touching a canvas. A
// MISS falls through to a live probe - a synchronous GPU->CPU readback that
// v0.29.707 measured at ~24ms for a cold 768px image, and which the deferral
// queue then has to spread over later frames. So every uncovered sprite is a
// frame the player can feel, the first time that art appears.
//
// The table is generated, so a miss means art landed after the last bake. That
// is the ordinary case in this repo: art drops constantly.
//
//   node scripts/sprite_edges_coverage_test.mjs          # summary + offenders
//   node scripts/sprite_edges_coverage_test.mjs --list   # every missing key
// ============================================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = process.argv.includes('--list');

const src = readFileSync(join(root, 'data', 'sprite_edges.js'), 'utf8');
const T = JSON.parse(src.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/m)[1]);

// The SAME scope the generator uses. A first version of this walked all of
// Sprites/ and reported 779 uncovered files, almost all of them UI, talent and
// skill icons that gen_sprite_edges.mjs deliberately never bakes because they
// are not edge-feathered sprites. That number could never reach zero, which
// would have made this a permanently red gate — the exact failure mode that let
// edge_probe_defer_test rot unnoticed. Keep these two lists in step.
const DIRS = ['monsters', 'bosses', 'objects', 'npc', 'fx', 'vfx', 'projectiles', 'summons'];
const SKIP = (n) => n.startsWith('_') || /backup/i.test(n) || /^pre_\d/.test(n) || n === 'Todo list';
function walk(dir, rel, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP(e.name)) continue;
    const p = join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(p, r, acc);
    else if (/\.(webp|png)$/i.test(e.name)) acc.push(r);
  }
  return acc;
}
const disk = [];
for (const d of DIRS) {
  const p = join(root, 'Sprites', d);
  if (existsSync(p)) walk(p, d, disk);
}
const missing = disk.filter((k) => !(k in T));
const stale = Object.keys(T).filter((k) => !disk.includes(k));

console.log(`  ${disk.length} sprites on disk, ${Object.keys(T).length} table entries`);
console.log(`  ${missing.length} on disk but NOT in the table — each costs a live probe the first time it draws`);
console.log(`  ${stale.length} table entries with no file on disk (harmless, just dead weight)\n`);

const byDir = {};
for (const m of missing) {
  const d = m.split('/').slice(0, -1).join('/') || '(root)';
  byDir[d] = (byDir[d] || 0) + 1;
}
const rows = Object.entries(byDir).sort((a, b) => b[1] - a[1]);
if (rows.length) {
  console.log('  uncovered, by directory:');
  for (const [d, n] of rows.slice(0, 20)) console.log('    ' + String(n).padStart(4) + '  ' + d);
}
if (LIST) { console.log('\n  every missing key:'); for (const m of missing) console.log('    ' + m); }
if (missing.length) console.log('\n  regenerate with the sprite-edges baker so these answer from the table.');
process.exitCode = missing.length ? 1 : 0;
