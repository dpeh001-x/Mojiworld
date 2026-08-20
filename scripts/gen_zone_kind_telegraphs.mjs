// Kind-level zone telegraph sprites: swing, smash, dash (ludo.ai text->sprite).
//
// Per user: "so there should be no hit plain hit boxes, ensure that." The
// v0.29.932 pillars covered boss columns; these three cover the remaining
// zone kinds so no drawn zone anywhere falls back to a plain rectangle. They
// are kind-level (not per-boss) on purpose: a swing zone is the same READ on
// every boss, and the boss's identity is already carried by its body, its
// pillar art and the strike beam. Horizontal compositions; the dash lane's
// chevrons point RIGHT and the draw mirrors it for leftward dashes.
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

const TAIL = ', ominous but clearly a warning marker not an explosion, vibrant cartoon fantasy '
  + 'style, crisp thick outline, transparent background, no text';

const JOBS = [
  { file: 'tg_swing.webp', w: 512, h: 288,
    prompt: 'game vfx sprite, wide rectangular DANGER ZONE warning FRAME for an incoming heavy melee swing: '
      + 'ONLY a glowing amber-red border frame and one large ghostly claw-slash arc of thin translucent '
      + 'energy lines, the center MUST be empty transparent nothing, hollow open middle, no fill, no '
      + 'backdrop, just the frame and the wispy slash arc lines floating in emptiness' },
  { file: 'tg_smash.webp', w: 512, h: 160,
    prompt: 'game vfx sprite, ONE isolated long thin horizontal molten crack line: a single glowing '
      + 'orange lava fissure with jagged branching cracks running the full width, small floating rock '
      + 'chips and embers directly above it, everything above and below the crack line MUST be empty '
      + 'transparent nothing, no ground plane, no scenery, just the isolated glowing crack floating in emptiness' },
  { file: 'tg_dash.webp', w: 512, h: 224,
    prompt: 'game vfx sprite, long horizontal CHARGE LANE warning corridor: a translucent red-orange energy '
      + 'tunnel with large bold chevron arrows all pointing to the RIGHT along its length, speed streak '
      + 'lines, hard glowing top and bottom edge rails, hoofprint dust motes inside, '
      + 'semi-transparent wispy core so the background shows through' },
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
                               n: 1, augment_prompt: false, prompt: job.prompt + TAIL }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      const raw = await fetchBuf(url);
      let content;
      try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      // Zones are stretched rects — fill the frame so edge rails reach the rim.
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
      if (+pct < 8) console.warn(`   WARNING: ${job.file} is nearly opaque — inspect it`);
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
console.log('all kind telegraphs generated');
