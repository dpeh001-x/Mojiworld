#!/usr/bin/env node
// Potion / consumable item sprites (ludo.ai) — v0.26.x
// =============================================================================
// One sprite per POTION_ITEMS entry. Filenames match _itemKey(it) (the item's
// NAME, lowercased, non-alnum -> '_'), so the existing itemIconHtml()/_itemSprite
// path picks them up once registered in LX_ITEMS. Output -> Sprites/items/<key>.png.
// Box-free via the "die-cut sticker, the OBJECT itself, no app-icon tile" framing.
//
//   node scripts/generate_potion_sprites.mjs                 # dry-run
//   node scripts/generate_potion_sprites.mjs --only elixir --generate
//   node scripts/generate_potion_sprites.mjs --generate      # all (skip-existing)
//   flags: --force --only a,b
// Needs LUDO_API_KEY.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'items');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX = 'A die-cut STICKER of the SUBJECT described below — the object ITSELF as a transparent-PNG game-item sprite with a clean cutout edge and nothing behind it. ' +
  'This is NOT an app icon and NOT on a square tile or card: ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO border, NO panel, NO background fill or gradient, NO ground, NO scene, NO hands or character. FULLY TRANSPARENT background (alpha only). ' +
  'Clean simple chibi-anime game-item style: bold simple shapes with a thin EVEN ~2px solid BLACK outline (uniform weight, NOT thick or chunky), vibrant flat colors, light cel shading, a glossy glass highlight. ' +
  'Centered upright, about 82% of the square image. ABSOLUTELY NO TEXT: no letters, numbers, words or watermark. Subject: ';

// key (= _itemKey of the POTION_ITEMS name) -> subject prompt
const POT = {
  small_red_potion:   'a SMALL round glass potion vial with a cork stopper, filled with glowing bright-RED healing liquid, a soft red shine',
  medium_red_potion:  'a MEDIUM rounded glass potion flask with a cork stopper, filled with glowing bright-RED healing liquid, a red glow',
  large_red_potion:   'a LARGE ornate glass potion bottle with a cork stopper, brimming with glowing deep-RED healing liquid, a strong red glow',
  small_blue_potion:  'a SMALL round glass potion vial with a cork stopper, filled with glowing bright-BLUE mana liquid, a soft blue shine',
  medium_blue_potion: 'a MEDIUM rounded glass potion flask with a cork stopper, filled with glowing bright-BLUE mana liquid, a blue glow',
  large_blue_potion:  'a LARGE ornate glass potion bottle with a cork stopper, brimming with glowing deep-BLUE mana liquid, a strong blue glow',
  elixir:             'a fancy ornate glass elixir bottle with a golden cap, filled with shimmering rainbow-gold liquid, sparkling golden stars around it',
  status_cure_remedy: 'a small medicine glass vial/flask with a cork stopper, filled with glowing GREEN remedy liquid with a few light bubbles',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(POT);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').some((o) => k === o || k.startsWith(o)));
if (!keys.length) { console.error('No matching potions.'); process.exit(1); }
if (!has('--generate')) {
  console.log(`# ${keys.length} potion sprites -> Sprites/items/<key>.png (${SIZE}x${SIZE})\n`);
  for (const k of keys) console.log('  ' + k);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flags: --force --only a,b');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const bp = join(OUT_DIR, `${k}.png`);
  if (!force && await exists(bp)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + POT[k] + '.' }),
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

console.log(`Generating ${keys.length} potion sprites (force:${force})...`);
let made = 0, skipped = 0, failed = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skipped++; console.log('skip'); } else { made++; console.log('OK'); await sleep(400); } }
  catch (e) { failed++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) { console.log('*** OUT OF CREDITS ***'); process.exit(3); } }
}
console.log(`Done. ${made} made, ${skipped} skipped, ${failed} failed.`);
process.exit(failed ? 2 : 0);
