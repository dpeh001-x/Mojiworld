#!/usr/bin/env node
// Death-screen tombstone sprite (ludo.ai) — replaces the 🥺 emoji on the
// death overlay with a cute chibi "R.I.P" gravestone. Output ->
// Sprites/ui/death_tombstone.png (transparent, 256x256).
//   node scripts/gen_death_tombstone.mjs            # dry-run (print prompt)
//   node scripts/gen_death_tombstone.mjs --generate # call Ludo (needs LUDO_API_KEY)
//   flags: --force  (overwrite existing)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(repoRoot, 'Sprites', 'ui');
const OUT = join(OUT_DIR, 'death_tombstone.png');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

// NOTE: unlike the item sprites, this one DELIBERATELY allows text — the two
// engraved letters "R.I.P" are the whole point.
const PROMPT =
  'A die-cut STICKER of a CUTE CHIBI cartoon GRAVESTONE / tombstone — the object ITSELF as a ' +
  'transparent-PNG game sprite with a clean cutout edge and nothing behind it. ' +
  'A rounded-top stone slab in soft grey, sitting on a small green grass mound, with the ' +
  'letters "R.I.P" clearly engraved in the centre of the stone in a simple bold dark font. ' +
  'Adorable kawaii style: rounded friendly shape, a thin EVEN ~2px solid BLACK outline, ' +
  'soft cel shading, gentle highlights, maybe one tiny flower at the base. Cheerful and cute, NOT scary or gory. ' +
  'ABSOLUTELY NO rounded-square, NO tile, NO card, NO frame, NO border, NO panel, NO background fill or gradient, ' +
  'NO scene, NO character, NO hands. FULLY TRANSPARENT background (alpha only). ' +
  'Centered upright, about 84% of the square image. The ONLY text anywhere is the engraved "R.I.P" on the stone.';

if (!has('--generate')) {
  console.log(`# death_tombstone.png -> Sprites/ui/ (${SIZE}x${SIZE})\n`);
  console.log(PROMPT);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}

const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!has('--force') && await exists(OUT)) { console.log('exists (use --force to overwrite):', OUT); process.exit(0); }

let last;
for (let a = 1; a <= 4; a++) {
  try {
    process.stdout.write(`attempt ${a} ... `);
    const res = await fetch(`${API}/assets/image`, {
      method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
    });
    if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402 OUT OF CREDITS'); throw new Error(res.status + ': ' + t.slice(0, 140)); }
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    console.log('OK ->', OUT);
    process.exit(0);
  } catch (e) { last = e; console.log('FAIL: ' + e.message); if (/402/.test(e.message)) process.exit(3); if (a < 4) await sleep(3000 * a); }
}
console.error('Giving up:', last?.message);
process.exit(2);
