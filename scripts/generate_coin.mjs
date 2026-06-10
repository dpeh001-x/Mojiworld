#!/usr/bin/env node
// Mojicoin icon — a gold coin with a macaron imprinted in the centre (ludo.ai).
//   node scripts/generate_coin.mjs --generate   (needs LUDO_API_KEY)  flags: --force
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(repoRoot, 'Sprites', 'items', 'mojicoin.png');
const SIZE = 256;
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

const PROMPT = 'A die-cut STICKER of a single game-currency COIN — the coin object ITSELF as a transparent-PNG sprite with a clean cutout edge and nothing behind it. ' +
  'NOT an app icon, NOT on a square tile or card: NO rounded-square, NO tile, NO frame, NO border, NO panel, NO background fill, NO scene. FULLY TRANSPARENT background (alpha only). ' +
  'Clean simple chibi-anime game-item style: bold shapes, a thin even ~2px black outline, vibrant flat gold colors, light cel shading and a glossy highlight. NO TEXT, no letters, no numbers. Centered, about 82% of the square image. ' +
  'Subject: a shiny round GOLD coin seen perfectly face-on (front view, circular), with a cute round French MACARON cookie embossed/imprinted in the very centre of the coin face, a decorative ridged golden rim around the edge, warm gold shading and a bright glossy shine.';

if (!has('--generate')) { console.log('# mojicoin -> Sprites/items/mojicoin.png\n# Re-run with --generate (needs LUDO_API_KEY).'); process.exit(0); }
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(u) { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
if (!has('--force') && await exists(OUT)) { console.log('exists; use --force to overwrite.'); process.exit(0); }
let last;
for (let a = 1; a <= 4; a++) {
  try {
    const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }) });
    if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 140));
    const data = await res.json();
    const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
    if (!url) throw new Error('no url');
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, await sharp(await fetchBuf(url)).resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    console.log('OK -> Sprites/items/mojicoin.png'); process.exit(0);
  } catch (e) { last = e; if (a < 4) await new Promise(s => setTimeout(s, 3000 * a)); }
}
console.error('FAIL: ' + last.message); process.exit(2);
