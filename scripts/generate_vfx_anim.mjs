#!/usr/bin/env node
// Shared Combat VFX animation runner — 9-frame looping animations for the
// Sprites/vfx/*.webp effects, via ludo.ai /assets/sprite/animate (eagle,
// True-Size). Same framework as generate_boss_projectile_anim.mjs: the motion
// prompt animates ONLY the intrinsic effect in place (bubbles pop, arcs
// crackle, smoke billows) and explicitly does NOT translate/rotate/zoom the
// sprite — the game's own render already scales/positions each hazard, so
// baked-in transform would double up. Output -> Sprites/vfx/anim/<key>_0..8.webp
//
//   node scripts/generate_vfx_anim.mjs                       # dry-run list
//   node scripts/generate_vfx_anim.mjs --only quake_ring --generate
//   node scripts/generate_vfx_anim.mjs --generate            # all 9
// Needs LUDO_API_KEY. Resumable: skips a VFX whose 9 frames already exist.
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VFX_DIR = join(repoRoot, 'Sprites', 'vfx');
const OUT_DIR = join(VFX_DIR, 'anim');
const FRAMES = 9;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const HOLD = ' The effect stays centered at the EXACT same size, position and framing — do NOT rotate, spin, translate, zoom, mirror or resize the whole sprite; animate ONLY the effect itself in place, looping smoothly and seamlessly.';
// key (== file basename) -> motion prompt
const VFX = {
  dash_streak:     { file: 'dash_streak.webp',     prompt: 'a horizontal motion speed-streak / dash trail — the streak lines flicker and pulse, a bright energy wisp flows along its length and faint sparks shed off the trailing edge.' },
  frost_beam:      { file: 'frost_beam.webp',      prompt: 'a horizontal frost / ice beam — pale-cyan frost crystals shimmer and glint, cold vapour wisps flow along the beam, and a bright icy gleam pulses through its core.' },
  gravity_well:    { file: 'gravity_well.webp',    prompt: 'a swirling purple gravity-well vortex — the violet energy churns and spirals inward, a warped starfield shimmers within, the dark core pulses and faint distortion ripples ring outward (internal swirl only, the disc itself stays put).' },
  lava_drop:       { file: 'lava_drop.webp',       prompt: 'a glob of molten lava — its glowing orange surface wobbles and jiggles with surface tension, the white-hot core pulses brighter and dimmer, and a couple of tiny embers shed off it.' },
  lava_pool:       { file: 'lava_pool.webp',       prompt: 'a molten lava layer seen from the side — the glowing surface bubbles pop and ripple, molten orange-yellow highlights slide across it, and small embers rise off the top.' },
  lightning_pillar:{ file: 'lightning_pillar.webp',prompt: 'a vertical lightning bolt column — bright electric-blue and white arcs crackle, fork and snap along its length, sparks flicker off it, and the energized core pulses brighter and dimmer.' },
  poison_cloud:    { file: 'poison_cloud.webp',    prompt: 'a floating toxic-green poison gas cloud — the cloud gently billows and roils, glossy green bubbles swell and pop, wisps of vapour curl and rise, and a sickly green glow pulses.' },
  quake_ring:      { file: 'quake_ring.webp',      prompt: 'a billowing dust-and-smoke earthquake burst — the tan and grey dust clouds churn and roll, small pebbles jitter and shake, and faint dust motes drift outward (in-place churn, no expansion).' },
  shock_ring:      { file: 'shock_ring.webp',      prompt: 'a translucent shockwave ring — energy pulses and ripples around the ring, a faint air-distortion shimmer flickers across it, and light crackles along its rim (in-place pulse, no expansion).' },
  cloudburst:      { file: 'cloudburst.webp',      prompt: 'a small cartoon storm raincloud seen from the side — the cloud puff gently billows and swells as if breathing, the raindrops beneath it streak downward and fresh droplets keep falling in a continuous seamless loop, and a faint cyan spark flickers inside the cloud body.' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const smallBaseUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames');
}

let keys = Object.keys(VFX);
const only = arg('--only'); if (only) keys = only.split(',').filter((k) => VFX[k]);
if (!keys.length) { console.error('No matching VFX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} shared combat VFX -> Sprites/vfx/anim/<key>_0..8.webp (9-frame):\n`);
  for (const k of keys) console.log(`  ${k}  (${VFX[k].file})`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${k}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  const bp = join(VFX_DIR, VFX[k].file);
  if (!(await exists(bp))) return 'nobase';
  const buf = await readFile(bp);
  const { width: W, height: H } = await sharp(buf).metadata();
  const uri = await smallBaseUri(buf);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ initial_image: uri, motion_prompt: VFX[k].prompt + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 140)}`);
      const bufs = await framesFrom(await res.json(), FRAMES);
      await mkdir(OUT_DIR, { recursive: true });
      for (let i = 0; i < bufs.length; i++) await writeFile(join(OUT_DIR, `${k}_${i}.webp`), await sharp(bufs[i]).resize(W, H, { fit: 'fill' }).webp({ quality: 92 }).toBuffer());
      return `${W}x${H}`;
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(3000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} shared-VFX animations (skip-existing: ${!force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
