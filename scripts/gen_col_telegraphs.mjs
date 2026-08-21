// Boss-specific column-strike TELEGRAPH sprites (ludo.ai text->sprite).
//
// Per user: "For boss column strikes, generate boss specific sprites to
// replace the generic markouts using ludo.ai." The v0.29.918 zone telegraph
// drew every boss pillar as the same procedural fill+rim; these are per-boss
// warning pillars for the zone itself — distinct from the fx_col_* STRIKE
// beams, which fire after the telegraph and stay untouched.
//
// A telegraph must read as a WARNING, not the attack: ghostly, translucent
// core, hard bright edges, a rune ring at the base where the pillar will land.
// The draw path alpha-ramps it with the windup and keeps the white rim flare,
// so the art carries theme while the timing read stays systemic.
//
// Needs LUDO_API_KEY. Mirrors scripts/gen_gravitos_slam_fx.mjs.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY not set'); process.exit(1); }

const BASE = 'game vfx sprite, tall vertical DANGER ZONE telegraph pillar, a ghostly translucent '
  + 'column of warning light rising the full height of the frame, hard bright glowing edge '
  + 'stripes down both sides, a glowing rune ring on the ground at the base, faint chevron '
  + 'arrows flowing upward inside the column, semi-transparent wispy core so the background '
  + 'shows through, ';
const TAIL = ', ominous but clearly a warning marker not an explosion, vibrant cartoon fantasy '
  + 'style, crisp thick outline, single centered vertical column, transparent background, no text';

const JOBS = [
  { file: 'tg_col_legosaurus.webp',
    theme: 'molten toy-brick theme: lava-orange and ember-red light, tumbling translucent toy blocks and brick studs caught inside the column, cracked magma seams in the base ring' },
  { file: 'tg_col_young_confused_barnaby.webp',
    theme: 'lost-sentinel sandstone theme: dusty gold and warm amber light, drifting question-mark motes and crumbling watchtower brick fragments inside the column, worn stone sigil base ring' },
  { file: 'tg_col_towerArbiter.webp',
    theme: 'judgment-of-the-tower theme: radiant gold and white light, floating scales-of-justice glints and gavel sparks inside the column, ornate golden law-sigil base ring' },
  { file: 'tg_col_towerSovereign.webp',
    theme: 'apex starfire theme: pale cream and ice-white starlight, tiny collapsing star sparkles and thin orbit lines inside the column, regal pale-gold crown-sigil base ring' },
  { file: 'tg_col_zodiac.webp',
    theme: 'zodiac constellation theme: deep violet and indigo arcane light, faint star constellations and small zodiac glyph sparkles inside the column, glowing astrological wheel base ring' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function gen(job) {
  const W = 288, H = 512;
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      // tall ratio first; some image_types reject it — square fallback, and the
      // resize below re-imposes the pillar shape.
      const ratio = attempt >= 3 ? 'ar_1_1' : 'ar_9_16';
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ratio,
                               n: 1, augment_prompt: false, prompt: BASE + job.theme + TAIL }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url in response');
      const raw = await fetchBuf(url);
      let content;
      try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      // The zone is a stretched rect, so fill the frame: fit 'fill' on purpose —
      // a pillar reads fine stretched, and edge stripes must reach the rim.
      const inner = await sharp(content)
        .resize(W, H, { fit: 'fill', withoutEnlargement: false })
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
      console.log(`ok -> ${job.file} ${W}x${H} ${out.length}b, transparent ${pct}% (ratio ${ratio})`);
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
console.log('all telegraph sprites generated');
