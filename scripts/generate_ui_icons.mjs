#!/usr/bin/env node
// UI icon sprites — ludo.ai text→sprite (static, icon-style)
// =============================================================================
// Generic game-UI icons (first use: the Block/Parry shield on the A skill
// button + logo uses). Output -> Sprites/ui/<key>.png. Same hard-learned
// prompt recipe as generate_dash_fx.mjs: short subject-first prompt, compact
// style tail, explicit no-character negations (long "cute RPG" prefixes make
// the sprite model return chibi characters).
//
//   node scripts/generate_ui_icons.mjs                    # dry-run list
//   node scripts/generate_ui_icons.mjs --generate         # all
//   node scripts/generate_ui_icons.mjs --only block_shield --generate
//   flags: --force --only a,b
// Needs LUDO_API_KEY. Resumable: skips a file that already exists.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI_DIR = join(repoRoot, 'Sprites', 'ui');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const SUFFIX = ' game UI icon for a 2D side-scroller, cel-shaded anime style with bold dark outlines, glossy highlights, vibrant saturated colors, single object icon only, centered, no character, no person, no creature, no hands, no text, fully inside the frame with empty margin on all sides, transparent background';

// file (Sprites/ui/<key>.png) -> prompt.
const ICONS = {
  // v2 per user: simpler, more cel-shaded, more generic, kite-shaped —
  // dropped the ornate gem/cross/rivets vocabulary entirely.
  block_shield: 'A single simple kite shield game icon facing forward, classic kite shape with a rounded top edge tapering to a point at the bottom, flat steel blue-grey fill with one plain gold border trim, minimal detail, clean bold simple shapes, flat cel shading with a single highlight,',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`fetch ${r.status}`); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(ICONS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching icons.'); process.exit(1); }

if (!has('--generate')) {
  console.log(`# ${keys.length} UI icons -> Sprites/ui/<key>.png:\n`);
  for (const k of keys) console.log(`  ${k}.png`);
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
  const dest = join(UI_DIR, `${k}.png`);
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: ICONS[k] + SUFFIX }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      await mkdir(UI_DIR, { recursive: true });
      // trim to drawn content, contain at ~88% on a transparent 512² canvas
      // (icons render small — tighter fill than the 82% VFX margin).
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 512, INNER = Math.round(CANVAS * 0.88);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }])
        .png().toBuffer();
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Generating ${keys.length} UI icons (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(800); } }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
