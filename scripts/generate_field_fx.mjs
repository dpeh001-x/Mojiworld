#!/usr/bin/env node
// Ground-field VFX sprites — ludo.ai text→sprite (static, wide band)
// =============================================================================
// Art for wide horizontal ground fields (first use: the priest/bishop
// Celestial Aurora heal zone, a 550×100 band that previously rendered as a
// plain gold fillRect). Output -> Sprites/vfx/<key>.webp.
//
//   node scripts/generate_field_fx.mjs                 # dry-run list
//   node scripts/generate_field_fx.mjs --generate
//   flags: --force --only a,b
// Needs LUDO_API_KEY. Resumable: skips a file that already exists.
//
// ASPECT: these draw at ~5.5:1, so they are generated WIDE (16:9) and composed
// onto a 2:1 canvas. The art is deliberately specified as soft horizontal
// bands/rays with no hard focal detail, so the final horizontal stretch to the
// hazard's real width is invisible — the usual failure mode for field art is a
// centred emblem that smears when stretched.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// Sprites/vfx/<key>.webp — the manifest convention shared with quake_ring,
// lava_pool etc. (see the LX_VFX `files` map in mojiworld_game.html).
const FX_DIR = join(repoRoot, 'Sprites', 'vfx');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const SUFFIX = ' wide horizontal ground-effect band for a 2D side-scroller game, simple flat cel-shaded anime style, soft glow, minimal detail, no central emblem, no character, no person, no creature, no text, the effect spans the full width and fades out softly at the left and right ends, nothing clipped by the frame edge, transparent background';

const FX = {
  aurora_field: 'A soft golden-white holy light field lying flat on the ground, gentle vertical light rays rising from a bright horizontal base line, a few small four-pointed sparkles floating above it, warm gold and cream colors,',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(FX);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching FX.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} field VFX -> Sprites/vfx/<key>.webp:\n`);
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
  const dest = join(FX_DIR, `${k}.webp`);
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt: FX[k] + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(FX_DIR, { recursive: true });
      // trim to drawn content, then fit onto a 1024×512 (2:1) transparent
      // canvas at 96% width — the renderer stretches this to the hazard box.
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CW = 1024, CH = 512;
      const inner = await sharp(content).resize(Math.round(CW * 0.96), Math.round(CH * 0.9), { fit: 'inside' }).png().toBuffer();
      const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }])
        .webp({ quality: 88 }).toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} field VFX (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
