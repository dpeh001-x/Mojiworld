#!/usr/bin/env node
// Monster special-skill VFX sprites — ludo.ai text→sprite (static, ground-projected)
// =============================================================================
// Beautifies the procedural hazard renderers (gravity well, frost beam, poison
// cloud, shockwave, lightning pillar) with authored sprites. Output ->
// Sprites/vfx/<file>.webp, loaded by LX_VFX; the renderers blit when ready and
// fall back to the procedural drawing otherwise. Static single images — the
// in-game render already rotates / expands / squashes them for motion.
//
//   node scripts/generate_mob_vfx.mjs                  # dry-run list
//   node scripts/generate_mob_vfx.mjs --only gravity_well --generate
//   node scripts/generate_mob_vfx.mjs --generate       # all 5
//   flags: --force --only a,b
// Needs LUDO_API_KEY. Resumable: skips a file that already exists.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const VFX_DIR = join(repoRoot, 'Sprites', 'vfx');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX = 'Chibi anime game VFX sprite for a 2D platformer in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no character, no ground tile. 768x768 square canvas. ' +
  'ABSOLUTELY NO TEXT of any kind: no letters, words, numbers, runes or watermark — wordless imagery only. ' +
  'Soft painterly cel-shaded anime style, bold clean edges, vibrant saturated colors, additive glow. ' +
  'CRITICAL FRAMING: the ENTIRE effect must sit fully inside the frame, centered, at roughly 70% scale, ' +
  'with a generous EMPTY TRANSPARENT MARGIN on all four sides — nothing may touch, run off, or be cropped ' +
  'at the canvas edges. Must read clearly at small in-game size. ';

// file (Sprites/vfx/<file>.webp) -> prompt. Keys mirror LX_VFX entries.
const VFX = {
  gravity_well:     'a swirling PURPLE gravity-well vortex seen TOP-DOWN (looking straight down at the ground): concentric violet energy rings spiralling inward to a bright glowing core, wispy lavender streaks dragged toward the centre, a circular flat disc shape.',
  frost_beam:       'a horizontal pale-blue FROST BEAM / ice cone firing LEFT-TO-RIGHT: a tapering jet of icy energy with jagged frost shards, crystalline glints and drifting cold mist, sharp leading edge on the right.',
  poison_cloud:     'a bubbling TOXIC POISON puddle seen TOP-DOWN: a sickly green-and-lime gradient pool with rising round bubbles and a faint noxious haze above it, a circular flat disc shape.',
  shock_ring:       'an expanding GROUND SHOCKWAVE RING seen TOP-DOWN: a bold tan-and-gold leading ring of kicked-up dust and rock with a fainter outer halo and cracked-earth glow, mostly EMPTY in the centre (a ring, not a disc).',
  lightning_pillar: 'a vertical ELECTRIC LIGHTNING PILLAR striking downward: a jagged white-blue bolt inside a glowing yellow energy column with crackling forked arcs and bright sparks, tall and narrow.',
  quake_ring:       'an expanding GROUND-QUAKE shockwave seen TOP-DOWN: concentric cracked-earth rings with rising dust and tumbling rubble, a warm orange-tan seismic glow, mostly EMPTY in the centre (a ring, not a disc).',
  dash_streak:      'a horizontal SPEED-DASH motion streak firing LEFT-TO-RIGHT: sharp white-to-violet motion-blur lines and a sweeping afterimage swoosh that tapers to a point on the right, strong sense of fast lunging movement.',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(VFX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching VFX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} monster-skill VFX -> Sprites/vfx/<file>.webp:\n`);
  for (const k of keys) console.log(`  ${k}.webp`);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function genOne(k) {
  const dest = join(VFX_DIR, `${k}.webp`);
  if (!force && await exists(dest)) return 'skip';
  // v0.26.x — retry transient network failures (the createImage POST or the
  // image-URL fetch occasionally drops with "fetch failed"). 4 attempts w/ backoff.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + VFX[k] }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(VFX_DIR, { recursive: true });
      // ANTI-CUTOFF: trim to the actual drawn content, then CONTAIN it
      // (aspect-preserving) onto a transparent 768² canvas at ~82%, centered — so
      // the effect always has a clean transparent margin and never touches / is
      // clipped at the canvas edge, regardless of how ludo framed the raw output.
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }])
        .webp({ quality: 92 }).toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} monster-skill VFX (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; const c = e && e.cause; console.log(`FAIL: ${e.message}${c ? ' | cause: ' + (c.code || c.errno || c.message || c) : ''}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
