// Telegraph sprites for the grounded Gravitos slam (ludo.ai text->sprite).
// Two beats, mirroring the gravitos_soulring convention:
//   gravitos_slamring — the gravity well he gathers at his feet during the
//                       wind-up. Square, spun like the soul ring.
//   gravitos_slamzone — the floor band that snaps onto the strike column once
//                       he has repositioned. Wide, drawn with keepAspect.
// Needs LUDO_API_KEY.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }

const JOBS = [
  {
    file: 'gravitos_slamring.webp',
    ratio: 'ar_1_1',
    w: 320, h: 320,
    prompt: 'game vfx sprite, top-down circular gravity well telegraph ring: concentric '
      + 'violet and magenta energy rings contracting inward toward a blazing white-hot core, '
      + 'jagged purple lightning arcs around the rim, small dark rocks and debris caught '
      + 'spiralling inward, heavy ominous cosmic pressure, glowing edges, vibrant cartoon '
      + 'fantasy style, crisp thick outline, centered single object, transparent background, no text',
  },
  {
    file: 'gravitos_slamzone.webp',
    ratio: 'ar_16_9',
    w: 512, h: 288,
    prompt: 'game vfx sprite, wide horizontal danger zone floor marker: a long glowing violet '
      + 'warning band cracked into dark stone ground, molten magenta fissures splitting outward '
      + 'along its length, bright purple runic edge stripes marking the strike area, dust and '
      + 'small pebbles lifting off the surface, menacing impact warning, vibrant cartoon fantasy '
      + 'style, crisp thick outline, wide flat shape, transparent background, no text',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function gen(job) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      // ar_16_9 is not accepted by every image_type; fall back to square and
      // let the trim + resize below carry the wide shape instead.
      const ratio = attempt >= 3 ? 'ar_1_1' : job.ratio;
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio,
                               n: 1, augment_prompt: false, prompt: job.prompt }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      // Read fully into a Buffer before any sharp work — Windows file locks
      // otherwise bite on the rename below.
      const raw = await fetchBuf(url);
      let content;
      try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const inner = await sharp(content)
        .resize(Math.round(job.w * 0.96), Math.round(job.h * 0.96), { fit: 'inside', withoutEnlargement: false })
        .png().toBuffer();
      const out = await sharp({ create: { width: job.w, height: job.h, channels: 4,
                                          background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      const dest = join(DIR, job.file);
      const tmp = dest + '.tmp';
      await writeFile(tmp, out);
      const { rename } = await import('node:fs/promises');
      await rename(tmp, dest);
      // report transparency so a solid-background dud is caught here, not in game
      const { data: px, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let clear = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 20) clear++;
      const pct = (100 * clear / (info.width * info.height)).toFixed(1);
      console.log(`ok -> ${job.file} ${job.w}x${job.h} ${out.length}b, transparent ${pct}% (ratio ${ratio})`);
      if (+pct < 8) console.warn(`   WARNING: ${job.file} is nearly opaque — likely a solid backdrop, inspect it`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`${job.file} attempt ${attempt}: ${e.message}`);
      if (attempt < 4) await sleep(4000 * attempt);
    }
  }
  throw lastErr;
}

for (const job of JOBS) await gen(job);
console.log('all sprites generated');
