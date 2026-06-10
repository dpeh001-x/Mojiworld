#!/usr/bin/env node
// Boss Shackle QTE VFX — base art + 9-frame animation (ludo.ai)
// =============================================================================
// One capture-sigil per QTE theme (v0.26.834/836) + one universal break burst.
// Mirrors scripts/generate_ult_skill_sprites.mjs exactly:
//   1) BASE — POST /assets/image           -> Sprites/fx/<key>.png
//   2) ANIM — POST /assets/sprite/animate  -> Sprites/fx/anim/<key>_0..8.webp
//
//   node scripts/generate_qte_fx.mjs                     # dry-run list
//   node scripts/generate_qte_fx.mjs --generate          # all, base+anim
//   flags: --base-only | --anim-only | --force | --only a,b
// Needs LUDO_API_KEY. Resumable: skips existing outputs.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FX_DIR = join(repoRoot, 'Sprites', 'fx');
const OUT_DIR = join(FX_DIR, 'anim');
const FRAMES = 9, PAD = 0.12;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX = 'Chibi anime spell-effect VFX sprite for a 2D platformer in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no character, no ground. 768x768 square canvas. ' +
  'ABSOLUTELY NO TEXT of any kind: no letters, no words, no numbers, no digits, no captions, ' +
  'no labels, no runic writing, no watermark, no logo, no UI — the artwork must be 100% wordless imagery only. ' +
  'Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors, additive glow. ' +
  'Render ONLY the effect, strong centered composition occupying ~70% of the canvas with breathing room at the edges. ' +
  'Must read clearly when scaled to 1/4 size. ';
const HOLD = ' The effect stays centered at the EXACT same size, position and framing, fully inside the frame with empty ' +
  'margins — do NOT rotate, spin, translate, zoom, crop, mirror or resize it; animate ONLY the effect shimmering/pulsing in place.';

// key -> { p: base prompt, m: motion prompt }. One sigil per QTE theme + break.
const QTE = {
  qte_chains:  { p: 'a circular binding sigil of glowing violet spectral chains coiled into a tight shackle wreath, heavy ghostly chain links interlocking around an empty center, small purple energy padlocks, wisps of indigo magic curling off the links.', m: 'a violet spectral chain wreath — the chain links shimmer and tighten, purple wisps curl, the binding glow pulses.' },
  qte_gravity: { p: 'a deep-blue gravity well sigil: concentric warping cyan orbit rings bending inward around a dark singularity core, tiny star motes spiraling toward the center, lensing distortion arcs, cold cosmic glow.', m: 'a cyan gravity-well sigil — the orbit rings warp and breathe, star motes spiral inward, the core glow pulses.' },
  qte_molten:  { p: 'a circular grip of molten lava chains, glowing ember chain links with magma cracks, dripping lava beads, licking flame wisps between the links, scorching orange-gold heat glow.', m: 'molten lava chains — the ember links glow hotter and dimmer, flame wisps flicker, lava beads drip.' },
  qte_tidal:   { p: 'a coiling ring of teal ocean water tendrils forming a circular grip, foam crests spiraling along the coils, suspended droplets and small bubbles, fresh aqua glow.', m: 'coiling teal water tendrils — the water flows along the ring, foam shimmers, droplets and bubbles drift.' },
  qte_holy:    { p: 'a radiant golden judgement seal: concentric wordless ornamental halo rings of warm light, small angelic wing flares at the sides, drifting light feathers and sparkles, divine white-gold glow.', m: 'a golden judgement seal — the halo rings pulse with warm light, sparkles drift, the wing flares shimmer.' },
  qte_spore:   { p: 'a wreath of soft pink mushroom vines and curling tendrils forming a circular snare, tiny glowing mushrooms along the vines, drifting luminous spores, gentle blossom-pink glow.', m: 'a pink spore-vine snare — the tendrils sway gently, the little mushrooms glow, luminous spores drift upward.' },
  qte_break:   { p: 'an explosive burst of shattering golden chain links flying outward from the center, broken shackle fragments mid-flight, radiant white-gold cracks of freedom light, sparks and glowing shards scattering.', m: 'shattering golden chains — the fragments glint, freedom light flares and pulses, sparks scatter outward.' },
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
async function padBuf(buf) {
  const m = await sharp(buf).metadata();
  const px = Math.round(m.width * PAD), py = Math.round(m.height * PAD);
  return sharp(buf).extend({ top: py, bottom: py, left: px, right: px, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
const smallUri = async (buf) => 'data:image/png;base64,' + (await sharp(buf).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
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

let keys = Object.keys(QTE);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.includes(o)));
if (!keys.length) { console.error('No matching QTE FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} QTE FX. BASE -> Sprites/fx/<key>.png · ANIM -> Sprites/fx/anim/<key>_0..8.webp\n`);
  for (const k of keys) console.log(`  ${k}`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force'), baseOnly = has('--base-only'), animOnly = has('--anim-only');
const ANIM_TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genBase(k) {
  const bp = join(FX_DIR, `${k}.png`);
  if (!force && await exists(bp)) return 'skip';
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ANIM_TIMEOUT),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + QTE[k].p }),
  });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
  if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
  await mkdir(FX_DIR, { recursive: true });
  await writeFile(bp, await sharp(await fetchBuf(url)).png().toBuffer());
  return 'base';
}

async function genAnim(k) {
  const done = (await Promise.all(Array.from({ length: FRAMES }, (_, i) => exists(join(OUT_DIR, `${k}_${i}.webp`))))).every(Boolean);
  if (!force && done) return 'skip';
  let bp = join(FX_DIR, `${k}.png`);
  if (!(await exists(bp))) { const alt = bp.replace(/\.png$/, '.webp'); if (await exists(alt)) bp = alt; else return 'nobase'; }
  const padded = await padBuf(await readFile(bp));
  const { width: W, height: H } = await sharp(padded).metadata();
  const uri = await smallUri(padded);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/sprite/animate`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(ANIM_TIMEOUT),
        body: JSON.stringify({ initial_image: uri, motion_prompt: QTE[k].m + HOLD, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true, loop: true, image_type: 'sprite-vfx' }),
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

console.log(`Generating ${keys.length} QTE FX (base:${!animOnly} anim:${!baseOnly} force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  try {
    if (!animOnly) { process.stdout.write(`  ${k} base ... `); const r = await genBase(k); console.log(r === 'skip' ? 'skip' : 'OK'); if (r !== 'skip') { made++; await sleep(800); } }
    if (!baseOnly) { process.stdout.write(`  ${k} anim ... `); const r = await genAnim(k); if (r === 'skip') { skipped++; console.log('skip'); } else if (r === 'nobase') { console.log('NO BASE'); } else { made++; console.log(`OK ${r}`); await sleep(800); } }
  } catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
