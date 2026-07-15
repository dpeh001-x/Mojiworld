#!/usr/bin/env node
// Regenerate 3 beam VFX sprites (ludo.ai text->sprite, /assets/image · image_type:sprite).
// =============================================================================
//   • fx_col_blockrexy   -> Sprites/fx/fx_col_blockrexy.webp     (Rexy lava column, 256x1024)
//   • fx_col_blightelder -> Sprites/fx/fx_col_blightelder.webp   (Blight Elder pillar, 256x1024)
//   • p_starbeam         -> Sprites/projectiles/p_starbeam.png   (Leo star-beam lance, 768^2)
//
//   node scripts/regen_beam_sprites.mjs                    # dry-run (print prompts)
//   node scripts/regen_beam_sprites.mjs --generate         # regen all three (backs up old)
//   node scripts/regen_beam_sprites.mjs --only p_starbeam --generate
// Needs LUDO_API_KEY. Existing files are backed up to <dir>/_backup_beam/ first.
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Vertical-column VFX prefix: transparent, bandable pillar, NO hard outline.
const COL_PREFIX =
  'Game VFX sprite for a 2D RPG (Mojiworld aesthetic). Pure transparent background, ' +
  'alpha only — no scene, no ground, no character, no frame, no panel, ABSOLUTELY NO ' +
  'TEXT. A single VERTICAL COLUMN / pillar of energy centered horizontally and filling ' +
  'the canvas from TOP TO BOTTOM, with soft translucent falloff on the LEFT and RIGHT ' +
  'edges so it reads as light (not a solid slab), and a bright hot core down the ' +
  'centerline (~30% width). Top ~5% and bottom ~5% fade to transparent. Painterly ' +
  'glowing VFX with a faint inner edge glow — NO hard black outline, NO bounding box, ' +
  'NO rectangular halo. Keep the detail BANDABLE (repeating/flowing vertical motifs) ' +
  'so it survives a strong vertical stretch. ';

// Directional projectile VFX prefix: isolated bolt, points right, NO hard outline.
const PROJ_PREFIX =
  'Game VFX projectile sprite for a 2D RPG (Mojiworld aesthetic). Pure transparent ' +
  'background, alpha only — no scene, no ground, no character, no frame, no panel, ' +
  'ABSOLUTELY NO TEXT. The projectile is fully ISOLATED on 100% empty alpha — NO ' +
  'colored backdrop, NO box or border behind it. Painterly glowing energy VFX, soft ' +
  'additive glow, faint inner edge glow — NO hard black outline, NO rectangular halo. ' +
  'Centered with a clean transparent margin on all sides. ';

const ITEMS = {
  fx_col_blockrexy: {
    dest: join(repoRoot, 'Sprites', 'fx', 'fx_col_blockrexy.webp'),
    fmt: 'webp', kind: 'column', prefix: COL_PREFIX,
    prompt:
      'A roaring pillar of fiery molten brick and lava, brick-fire orange (#ff8844) — ' +
      'chunks of glowing cracked toy-bricks tumbling upward inside an updraft of orange ' +
      'flame, ember sparks streaming up, a white-hot core. Aggressive, blocky, volcanic — ' +
      "the block-king Rexy's eruption.",
  },
  fx_col_blightelder: {
    dest: join(repoRoot, 'Sprites', 'fx', 'fx_col_blightelder.webp'),
    fmt: 'webp', kind: 'column', prefix: COL_PREFIX,
    prompt:
      'A blighted pillar of rotting nature-green (#88cc66) — rising spores and drifting ' +
      'fungal motes wound through creeping vines and withered curling leaves, a sickly ' +
      'luminous green core, faint drifting decay-mist. Organic, corrupted, overgrown — ' +
      "the Verge's rotten heart erupting.",
  },
  p_starbeam: {
    dest: join(repoRoot, 'Sprites', 'projectiles', 'p_starbeam.png'),
    fmt: 'png', kind: 'proj', prefix: PROJ_PREFIX, cleanAlpha: true,
    prompt:
      'A radiant golden cosmic BEAM-BOLT lance (Leo) pointing toward the RIGHT — a sleek, ' +
      'CLEAN horizontal shaft of brilliant golden starlight with a smooth white-hot core ' +
      'tapering to a sharp leading tip on the right, a few crisp sparkle star-motes, a warm ' +
      'radiant gold glow. Cosmic, sharp, luminous, and SIMPLE. ' +
      'CRITICAL: absolutely NO drop shadow, NO cast shadow, NO grey shadow blob under or ' +
      'behind the bolt; NO dark grey smudge, NO muddy halo. Keep the alpha 100% CLEAN — no ' +
      'noise, no speckle, no stray dots, no grungy texture, no rough dirty edges. Crisp, ' +
      'smooth anti-aliased edges on pure empty transparency. Bright and clean, not dark.',
  },
};

const apiKey = process.env.LUDO_API_KEY;
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(ITEMS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').includes(k));
if (!keys.length) { console.error('No matching item. Valid: ' + Object.keys(ITEMS).join(', ')); process.exit(1); }

if (!has('--generate')) {
  console.log('# DRY RUN — regen_beam_sprites. Prompts (add --generate to run):\n');
  for (const k of keys) console.log('## ' + k + '  ->  ' + ITEMS[k].dest + '\n' + ITEMS[k].prefix + ITEMS[k].prompt + '\n');
  process.exit(0);
}
if (!apiKey) { console.error('LUDO_API_KEY env var is required for --generate.'); process.exit(1); }

// v0.29.76 — ludo bakes a grey drop-shadow / muddy haze under bright VFX even on
// "transparent". For an additive-glow bolt that's pure error: fade each pixel's
// alpha by a GOLD-AWARE score so neutral-grey shadow goes transparent while the
// warm-gold beam (and its white-hot core) stay. Neutral pixels must be bright to
// survive; warm pixels survive at any decent brightness.
async function cleanGlowAlpha(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const c = info.channels;
  for (let i = 0; i < data.length; i += c) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b);
    const warm = Math.max(0, r - b);                 // gold => high; grey => ~0
    const score = mx * 0.55 + warm * 0.9;            // grey needs high mx; gold survives easily
    let f = (score - 70) / (150 - 70); f = f < 0 ? 0 : f > 1 ? 1 : f;
    data[i + 3] = Math.round(data[i + 3] * f);
  }
  return await sharp(data, { raw: { width: info.width, height: info.height, channels: c } }).png().toBuffer();
}

async function shape(raw, kind, fmt, cleanAlpha) {
  let src = raw;
  if (cleanAlpha) src = await cleanGlowAlpha(raw);
  let content; try { content = await sharp(src).trim().toBuffer(); } catch { content = src; }
  if (kind === 'column') {
    // Beam: stretch the trimmed column to fill a tall 256x1024 box (the engine
    // stretches to the beam box anyway; a full-height source reads cleanest).
    const pipe = sharp(content).resize(256, 1024, { fit: 'fill' });
    return await (fmt === 'webp' ? pipe.webp({ quality: 92, alphaQuality: 100 }) : pipe.png()).toBuffer();
  }
  // Projectile: contain at ~82% onto a clean transparent 768^2 canvas (matches
  // the other projectile bases; the engine orients/scales it in flight).
  const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
  const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  const pipe = sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]);
  return await (fmt === 'webp' ? pipe.webp({ quality: 92, alphaQuality: 100 }) : pipe.png()).toBuffer();
}

async function genOne(k) {
  const { dest, prompt, fmt, kind, prefix } = ITEMS[k];
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: prefix + prompt }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(`image ${res.status}: ${t.slice(0, 160)}`); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error(`no url: ${JSON.stringify(data).slice(0, 140)}`);
      const raw = await fetchBuf(url);
      const out = await shape(raw, kind, fmt, ITEMS[k].cleanAlpha);
      // Verify it decodes at a sane size before overwriting.
      const meta = await sharp(out).metadata();
      if (!meta.width || !meta.height) throw new Error('output failed to decode');
      // Backup the existing file, then atomic write (.tmp -> rename).
      const dir = dirname(dest);
      await mkdir(dir, { recursive: true });
      if (await exists(dest)) { const bdir = join(dir, '_backup_beam'); await mkdir(bdir, { recursive: true }); await copyFile(dest, join(bdir, basename(dest))); }
      const tmp = dest + '.tmp';
      await writeFile(tmp, out);
      const { rename } = await import('node:fs/promises');
      await rename(tmp, dest);
      return `${meta.width}x${meta.height}`;
    } catch (e) { lastErr = e; if (/402/.test(e.message)) throw e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}

console.log(`Regenerating ${keys.length} beam sprite(s)...`);
let made = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await genOne(k); made++; console.log(`OK ${r}`); await sleep(800); }
  catch (e) { failed++; console.log(`FAIL: ${e.message}`); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${failed} failed.`);
process.exit(failed ? 2 : 0);
