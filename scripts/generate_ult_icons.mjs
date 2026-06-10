#!/usr/bin/env node
// Lv-50 ULTIMATE skill-bar ICONS — clean emblem, NO box/frame (ludo.ai)
// =============================================================================
// The game loads skill icons from Sprites/skills/<id>.png (256x256), emoji
// fallback. The existing set has a rounded-square BOX + background fill; per
// user these icons must be FRAME-LESS — a single bold emblem floating on a
// fully transparent background with clean edges (like a starburst sticker).
// One icon per Lv-50 ultimate (<master>_ult).
//
//   node scripts/generate_ult_icons.mjs                 # dry-run
//   node scripts/generate_ult_icons.mjs --only lich --generate
//   node scripts/generate_ult_icons.mjs --generate      # all 17 (skip-existing)
//   flags: --force --only a,b,c
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'skills');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// Hard anti-box + anti-text + transparent-edge prefix.
const PREFIX = 'Mobile game SKILL ICON — a single bold emblem that clearly depicts the skill, floating FREE on a FULLY TRANSPARENT background (alpha only). ' +
  'ABSOLUTELY NO frame, NO border, NO box, NO rounded-square, NO circle badge, NO panel, NO background fill or gradient, NO ground, NO scene — ONLY the emblem itself with clean transparent edges all around it. ' +
  'Chibi anime style: thick dark outline around the emblem, vibrant saturated colors, soft cel shading, bright additive glow. ' +
  'Strong centered composition filling about 85% of the square canvas with a small transparent margin. ' +
  'ABSOLUTELY NO TEXT: no letters, numbers, words, runes-as-writing or watermark. Bold, clean, instantly readable at small size. ';

const ICON = {
  warlord_ult:      'a golden war-banner emblem on a spear, the cloth blank, bursting with heroic gold rally-light and sparks',
  doombringer_ult:  'a colossal dark iron greatsword emblem wreathed in crimson-and-violet ruin energy, molten cracks along the blade',
  crusader_ult:     'a radiant golden holy shield emblem haloed in divine dawn-light, a small cross motif, blessed sparkles',
  dragoon_ult:      'two crossed azure dragon-lance spears emblem crackling with blue draconic lightning',
  shadowlord_ult:   'a crowned violet shadow-silhouette emblem with a fan of dark clone after-images and umbral wisps',
  shinobi_ult:      'two crossed glowing katana blades emblem over a crimson paper talisman, motion-slash arcs',
  nightreaper_ult:  'a blood-red crescent eclipse emblem with a curved soul-scythe and dripping crimson energy',
  phantom_ult:      'a swirling violet void-rift singularity emblem with two crossed spectral daggers',
  sage_ult:         'a blazing comet emblem streaking over a glowing arcane fire-sigil, molten embers',
  elementalist_ult: 'a four-element orb emblem swirling fire, ice, lightning and violet arcane energy together',
  lich_ult:         'a ghostly green skull emblem crowned in emerald soul-flame, drifting necrotic wisps',
  hexmaster_ult:    'a purple evil-eye hex sigil emblem with branching curse tendrils and dark-frost',
  archbishop_ult:   'a radiant golden grail-and-halo emblem with a fleur-de-lis and a beam of holy light',
  marksman_ult:     'a sharp focus-reticle crosshair emblem locking onto a glinting energy bullet, cold blue glow',
  ballista_ult:     'a heavy siege-ballista bolt emblem crackling with fiery energy, drawn taut',
  beastmaster_ult:  'a fierce amber spirit dire-wolf head emblem, bared fangs, wild glowing energy',
  skyhunter_ult:    'a cyan wind-cyclone emblem with a wind-charged arrow at its eye, gusty spiral streaks',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(ICON);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching icons.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} ultimate icons -> Sprites/skills/<id>.png (${SIZE}x${SIZE}, frame-less)\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const bp = join(OUT_DIR, `${k}.png`);
  if (!force && await exists(bp)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + ICON[k] + '.' }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(bp, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} ultimate icons (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(500); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
