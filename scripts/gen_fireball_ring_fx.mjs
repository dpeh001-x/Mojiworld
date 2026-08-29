#!/usr/bin/env node
// Fireball cast incantation ring (ludo.ai):
//   /assets/image/edit of the ICE SPIKE rune ring -> staged fireball_ring.webp
//
//   node scripts/gen_fireball_ring_fx.mjs              # dry run
//   node scripts/gen_fireball_ring_fx.mjs --generate   # needs LUDO_API_KEY
//   node scripts/gen_fireball_ring_fx.mjs --install    # staged -> Sprites/fx/
//   flags: --tries N (default 3)
//
// v0.30.x — per user (screenshot of the cast swirl): "generate a better sprite
// to replace this fireball skill something that has more magical incantation
// symbols similar to ice spike's, then wire it with rotation". The reference
// is Ice_spike_1.webp — the blue rune circle the Ice Spike cast rotates around
// the caster. The fire ring is generated as an EDIT of that exact image, the
// same identity-preserving trick the Regulus pounce rebuild proved out: the
// circle geometry, framing and read carry over by construction, and the prompt
// only has to change the palette and densify the glyphs. The engine supplies
// the rotation (the sprite must NOT bake any).
import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REF = join(ROOT, 'Sprites', 'fx', 'Ice_spike_1.webp');
const STAGE = join(ROOT, 'scripts', '_style_pack', 'fireball_ring');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const TRIES = Math.max(1, Number(arg('--tries') || 3));
const SIZE = 768;

const PROMPT =
  'Redraw this exact same magical incantation circle — same circular ring ' +
  'composition, same flat 2D game-sprite style, same centred framing — but ' +
  'as a FIRE spell circle instead of ice: blazing saturated oranges, golds ' +
  'and reds with a white-hot glowing centre hub, and MORE arcane incantation ' +
  'symbols than the original — a dense outer ring of fiery runic glyphs and ' +
  'sigils spaced evenly around the band, a second inner ring of smaller ' +
  'runes, and thin rune-inscribed spokes. Small flame licks and embers curl ' +
  'off the outer rim. The circle is viewed flat face-on, perfectly round and ' +
  'PERFECTLY CENTRED (it will be spun by the game engine, so it must be ' +
  'rotationally balanced — no arrow, no direction marker, no baked motion ' +
  'blur). Fully transparent background. NO character, NO text, NO background.';

if (has('--install')) {
  if (!existsSync(join(STAGE, 'fireball_ring.webp'))) { console.error('ABORT: nothing staged'); process.exit(1); }
  await copyFile(join(STAGE, 'fireball_ring.webp'), join(ROOT, 'Sprites', 'fx', 'fireball_ring.webp'));
  console.log('installed -> Sprites/fx/fireball_ring.webp (static — no frame-index entry needed)');
  process.exit(0);
}
if (!has('--generate')) {
  console.log('# Fireball incantation ring — edit of the Ice Spike ring\n');
  console.log(PROMPT + '\n');
  console.log('# Re-run with --generate (needs LUDO_API_KEY), review, then --install.');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const fetchBuf = async (u) => {
  const r = await fetch(u, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
};
await mkdir(STAGE, { recursive: true });
const refUri = 'data:image/png;base64,' + (await sharp(await readFile(REF)).png().toBuffer()).toString('base64');

// Roundness gate: the ring must stay a centred circle or the engine's spin
// wobbles it. Content bbox must be near-square and near-centred.
const roundness = async (buf) => {
  const { info } = await sharp(buf).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const cx = -info.trimOffsetLeft + w / 2, cy = -info.trimOffsetTop + h / 2;
  return { ar: w / h, offC: Math.hypot(cx - SIZE / 2, cy - SIZE / 2) };
};

let best = null, bestScore = 1e9;
for (let attempt = 1; attempt <= TRIES; attempt++) {
  const res = await fetch(`${API}/assets/image/edit`, {
    method: 'POST', signal: AbortSignal.timeout(600000),
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: refUri, prompt: PROMPT, n: 1, augment_prompt: false }),
  });
  if (!res.ok) { console.log(`roll ${attempt}: ${res.status}`); continue; }
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) { console.log(`roll ${attempt}: no url`); continue; }
  const img = await sharp(await fetchBuf(url)).ensureAlpha()
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 94 }).toBuffer();
  const r = await roundness(img);
  const score = Math.abs(r.ar - 1) * 1000 + r.offC;
  console.log(`roll ${attempt}: aspect ${r.ar.toFixed(3)}, centre offset ${r.offC.toFixed(0)}px, score ${score.toFixed(0)}`);
  await writeFile(join(STAGE, `cand_${attempt}.webp`), img);
  if (score < bestScore) { bestScore = score; best = img; }
  if (Math.abs(r.ar - 1) < 0.03 && r.offC < 20) break;   // round and centred — done
}
if (!best) { console.error('ABORT: no candidate'); process.exit(2); }
await writeFile(join(STAGE, 'fireball_ring.webp'), best);
console.log('kept best -> fireball_ring.webp  (review, then --install)');
