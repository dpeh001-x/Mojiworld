#!/usr/bin/env node
// King Krook's walk REGISTRATION: where his body sits in each walk frame, and the per-frame horizontal offset that
// holds it in one place.
//
// WHY. Per user: "King krook still moves in a slip and sliding manner. He needs to move more normally". His walk
// art barely strides - short legs tucked under the belly, the cape hem on the floor - but the frames were not drawn
// on one registration: the whole figure sits at a different x in each (the belly's centre wanders over ~13% of the
// frame; forward in frames 3-4, back in 5-6). Drawn at his steady world position, that is a body lurching back and
// forth over the floor every stride while the feet barely move: the slip-and-slide. Anchoring each frame on its
// belly keeps the body travelling at his real speed, and the legs, tail and cape animate around it.
//
// THE ANCHOR is the centroid of his belly plate (the cream pixels): the one large part of him that is the same
// shape in every frame (the head turns, the tail and cape swing, the feet are hidden under the belly and the hem).
// Walk frames are registered onto the IDLE set's mean belly, so starting and stopping a walk does not jump either.
// Offsets are fractions of the frame width, + toward his snout (the art faces right; the draw mirrors them with him).
//
//   node scripts/gen_krook_walk_reg.mjs                 # print the table
//   node scripts/gen_krook_walk_reg.mjs --check [build] # exit 1 if the build's table drifted from the art
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp'); sharp.cache(false);
// The art is read from origin/main (the shipped frames: a working copy can hold stale ones), else from disk.
const SRC = process.env.KROOK_ART_DIR || null;
const art = (state, i) => {
  const rel = 'Sprites/bosses/' + state + '/kingKrook_' + i + '.webp';
  if (SRC) { const f = path.join(SRC, state, 'kingKrook_' + i + '.webp'); return existsSync(f) ? readFileSync(f) : null; }
  try { return execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 25, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) {}
  const f = path.join(ROOT, rel); return existsSync(f) ? readFileSync(f) : null;
};

async function belly(file) {
  const W = 480;
  const meta = await sharp(file).metadata();
  const H = Math.round(W * meta.height / meta.width);
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = (y * W + x) * 4, r = data[q], g = data[q + 1], b = data[q + 2], a = data[q + 3];
    // the cream belly: light and warm, not the white fur trim (b high) nor the gold crown / collar (b low)
    if (a > 200 && r > 205 && g > 185 && b > 120 && b < 215 && r - b > 28 && r - g < 40) { sx += x; n++; }
  }
  return n > 200 ? { x: sx / n / W - 0.5, n } : null;
}
const frames = async (state) => { const out = []; for (let i = 0; i < 64; i++) { const b = art(state, i); if (!b) break; out.push(await belly(b)); } return out; };
const idle = await frames('idle'), walk = await frames('walk');
if (!walk.length || walk.some((b) => !b) || !idle.length || idle.some((b) => !b)) { console.error('belly not found in every frame', { idle, walk }); process.exit(1); }
const ref = idle.reduce((s, b) => s + b.x, 0) / idle.length;
const reg = walk.map((b) => +(ref - b.x).toFixed(4));
const spread = (a) => +(Math.max(...a) - Math.min(...a)).toFixed(4);
const literal = 'const _KROOK_WALK_REG = ' + JSON.stringify(reg) + ';';
if (process.argv.includes('--check')) {
  const target = process.argv.find((a, i) => i > 1 && a !== '--check') || 'mojiworld_game.html';
  const game = readFileSync(path.resolve(ROOT, target), 'utf8');
  const ok = game.includes(literal);
  console.log(ok ? 'krook walk registration matches the art' : 'DRIFT: the build does not carry ' + literal);
  process.exit(ok ? 0 : 1);
}
console.log('idle belly x (fraction of frame, from centre):', idle.map((b) => b.x.toFixed(3)).join(' '), ' mean', ref.toFixed(3));
console.log('walk belly x:', walk.map((b) => b.x.toFixed(3)).join(' '), ' spread', spread(walk.map((b) => b.x)));
console.log('after registration, walk belly x:', walk.map((b, i) => (b.x + reg[i]).toFixed(3)).join(' '));
console.log(literal);
