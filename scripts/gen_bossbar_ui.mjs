// Boss HP bar furniture (ludo.ai text->sprite).
//
// Per user (screenshot of the flat purple plate): "For the boss HP bar can
// customise and make images nicer for it." Two pieces:
//   ui_bossbar_frame.webp — ornate horizontal frame with a HOLLOW centre strip
//                           where the fill shows through; decorative end caps.
//   ui_bossbar_fill.webp  — a horizontal energy ribbon, source-cropped by HP%
//                           at draw time (so it drains left-to-right losslessly).
// The procedural plate stays as the decode fallback; phase tint (p1 violet /
// p2 pink / p3 red) is applied as a translucent overlay ON TOP of the fill so
// the existing phase cue survives the art.
//
// Needs LUDO_API_KEY. Mirrors scripts/gen_col_telegraphs.mjs.
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
  { file: 'ui_bossbar_frame.webp', w: 1024, h: 112,
    prompt: 'game UI sprite, ornate BOSS HEALTH BAR FRAME, very wide thin horizontal: dark '
      + 'gunmetal and antique-gold filigree border rails along the top and bottom, elaborate '
      + 'baroque end caps on the left and right with small gothic spikes and a tiny gem, '
      + 'the long CENTER STRIP MUST be completely empty transparent nothing so a health fill '
      + 'can show through from behind, hollow open middle, elegant menacing dark-fantasy style, '
      + 'crisp clean edges, transparent background, no text' },
  { file: 'ui_bossbar_fill.webp', w: 1024, h: 64,
    prompt: 'game UI sprite, BOSS HEALTH BAR FILL texture, very wide thin horizontal ribbon: '
      + 'molten crimson-to-violet energy flowing left to right, subtle diagonal pulse streaks '
      + 'and tiny embers inside, a bright thin highlight line along the top edge, rich saturated '
      + 'edge-to-edge liquid energy band filling the whole frame corner to corner, no border, '
      + 'no frame, no text' },
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
      const ratio = attempt >= 3 ? 'ar_1_1' : 'ar_16_9';
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
      const raw = await fetchBuf(url);
      let content;
      try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const inner = await sharp(content)
        .resize(job.w, job.h, { fit: 'fill', withoutEnlargement: false })
        .png().toBuffer();
      const out = await sharp(inner).webp({ quality: 92 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      const dest = join(DIR, job.file);
      const tmp = dest + '.tmp';
      await writeFile(tmp, out);
      const { rename } = await import('node:fs/promises');
      await rename(tmp, dest);
      const { data: px, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let clear = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 20) clear++;
      const pct = (100 * clear / (info.width * info.height)).toFixed(1);
      console.log(`ok -> ${job.file} ${job.w}x${job.h} ${out.length}b, transparent ${pct}% (ratio ${ratio})`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`${job.file} attempt ${attempt}: ${e.message}`);
      if (attempt < 4) await sleep(4000 * attempt);
    }
  }
  throw lastErr;
}

for (const job of JOBS) { if (process.argv[2] && job.file.indexOf(process.argv[2]) < 0) continue; await gen(job); }
console.log('boss bar UI generated');
