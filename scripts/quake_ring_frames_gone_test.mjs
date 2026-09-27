#!/usr/bin/env node
// The 9 unused vfx/anim/quake_ring frames are gone (per user: "delete the unused quake ring frames") and nothing still
// points at them, while the two quake_ring stills that ARE used stay. Static.   node scripts/quake_ring_frames_gone_test.mjs
import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = process.env.QR_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const DEL = Array.from({ length: 9 }, (_, i) => `Sprites/vfx/anim/quake_ring_${i}.webp`);
ok('the 9 frames are deleted', DEL.every((f) => !existsSync(path.join(ROOT, f))));
ok('the plume\'s fallback still and the boss quake burst stay', existsSync(path.join(ROOT, 'Sprites/vfx/quake_ring.webp')) && existsSync(path.join(ROOT, 'Sprites/fx/quake_ring.webp')));
const g = rd('mojiworld_game.html');
ok('the game no longer maps quakeRing to vfx frames, and nothing draws them', !g.includes("quakeRing: 'quake_ring', quakePlume") && !g.includes("_lxVfxFrame('quakeRing')"));
ok('the offline pre-cache list does not ask for them', !DEL.some((f) => rd('data/assets_manifest.json').includes('"' + f + '"')));
ok('the frame index does not count them', !/"quake_ring": 9/.test(rd('data/sprite_frame_index.js')));
ok('the edge table has no entries for them', !rd('data/sprite_edges.js').includes('"vfx/anim/quake_ring_'));
ok('no generator would recreate them', !/^\s+quake_ring:\s*\{/m.test(rd('scripts/generate_vfx_anim.mjs')) && !rd('scripts/regen_anim_from_base.mjs').includes("quake_ring: { base: 'Sprites/vfx/quake_ring.webp', dir: 'Sprites/vfx/anim'"));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
