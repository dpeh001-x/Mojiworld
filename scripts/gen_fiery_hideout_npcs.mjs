#!/usr/bin/env node
// Fiery Hideout NPC sprites (ludo.ai) — Ashka (ember alchemist, potion shop)
// + Furnax (forgemaster, forging services). Output -> Sprites/npc/<key>.png
// (512x512 transparent). Matches the v0.25.811 NPC convention: full-body,
// thin black outline, transparent bg, side-scroller idle pose facing
// camera-left.
//   node scripts/gen_fiery_hideout_npcs.mjs            # dry-run
//   node scripts/gen_fiery_hideout_npcs.mjs --generate # needs LUDO_API_KEY
//   flags: --force --only ashka
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'npc');
const SIZE = 512;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PREFIX = 'A die-cut STICKER of a FULL-BODY chibi-anime game NPC character — the character ITSELF as a ' +
  'transparent-PNG sprite with a clean cutout edge and nothing behind it. ' +
  'ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO panel, NO background fill or gradient, NO ground shadow, NO scene. ' +
  'FULLY TRANSPARENT background (alpha only). Clean chibi-anime style: bold simple shapes, a thin EVEN ~2px solid BLACK outline, ' +
  'vibrant flat colors with light cel shading. Standing relaxed IDLE pose for a side-scroller, body angled slightly toward camera-LEFT, ' +
  'whole character head-to-feet visible, centered, about 85% of the square image. ABSOLUTELY NO TEXT or watermark. Subject: ';

const NPCS = {
  ashka:  'a cheerful young female EMBER ALCHEMIST with warm amber eyes and long copper-red hair in a loose braid, ' +
          'wearing a soot-dusted apricot apothecary coat with many small potion vials strapped across the chest, ' +
          'holding up one round glass potion bottle filled with glowing orange fire-liquid; tiny embers drifting off her sleeves',
  furnax: 'a burly male FORGEMASTER blacksmith with a magma-cracked dark-bronze skin glow, a thick charcoal beard with ' +
          'smouldering ember tips, heavy blackened-iron smithing apron over a bare muscular arm, one huge soot-black ' +
          'smithing hammer resting over his shoulder, small flames flickering in the apron pockets',
};

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

let keys = Object.keys(NPCS);
const only = arg('--only'); if (only) keys = keys.filter((k) => only.split(',').includes(k));
if (!has('--generate')) {
  console.log(`# ${keys.length} NPC sprites -> Sprites/npc/<key>.png (${SIZE}x${SIZE})\n`);
  for (const k of keys) console.log(`## ${k}\n${PREFIX}${NPCS[k]}\n`);
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(k) {
  const dest = join(OUT_DIR, `${k}.png`);
  if (!has('--force') && await exists(dest)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + NPCS[k] + '.' }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(dest, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
      return 'OK';
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}

console.log(`Generating ${keys.length} Fiery Hideout NPC sprites...`);
let made = 0, skip = 0, fail = 0;
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { const r = await gen(k); if (r === 'skip') { skip++; console.log('skip'); } else { made++; console.log('OK'); await sleep(500); } }
  catch (e) { fail++; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) process.exit(3); }
}
console.log(`Done. ${made} made, ${skip} skipped, ${fail} failed.`);
process.exit(fail ? 2 : 0);
