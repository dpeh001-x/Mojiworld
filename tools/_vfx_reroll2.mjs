#!/usr/bin/env node
// Reroll the 2 defective VFX: dash_streak (character contamination) and
// gravity_well (background plate + artifact). Hardened prompts.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const PRE = 'Game VFX sprite for a cute 2D side-scroller RPG in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground tile, NO background plate, NO square or rectangular backdrop of any kind. ' +
  'ABSOLUTELY NO TEXT. STYLE: soft painterly cel-shaded ANIME style with a bold clean DARK OUTLINE around the main shapes, glossy highlights, vibrant saturated colors, additive glow. ' +
  'NOT pixel-art, NOT chunky western-cartoon, NOT watercolor. ' +
  'CRITICAL: the effect is PURE ABSTRACT ENERGY — ABSOLUTELY NO character, NO person, NO figure, NO face, NO body, NO creature, NO object other than the energy itself. ' +
  'Centered at ~70% scale with generous empty transparent margins on all sides; nothing cropped at any edge. ';

const ITEMS = {
  'dash_streak.webp':  PRE + 'ONLY an abstract horizontal SPEED-DASH motion streak firing LEFT-TO-RIGHT: layered white-to-violet motion-blur energy lines and a sweeping afterimage swoosh that tapers to a sharp point on the right, a few small speed sparkles — nothing else in the image.',
  'gravity_well.webp': PRE + 'ONLY a swirling PURPLE gravity-well vortex seen TOP-DOWN: a perfectly circular flat disc of concentric violet energy rings spiralling inward to a bright glowing white core, wispy lavender streaks dragged toward the centre, soft glow fading to FULL TRANSPARENCY at the circular rim — a round vortex floating on pure transparency, nothing else in the image.',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [file, prompt] of Object.entries(ITEMS)) {
  process.stdout.write('  ' + file + ' ... ');
  let done = false, last;
  for (let a = 1; a <= 4 && !done; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) throw new Error('402'); throw new Error(res.status + ': ' + t.slice(0, 120)); }
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const r2 = await fetch(url, { signal: AbortSignal.timeout(120000) });
      const buf = Buffer.from(await r2.arrayBuffer());
      await writeFile(join(root, 'Sprites', 'vfx', file),
        await sharp(buf).resize(768, 768, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92 }).toBuffer());
      console.log('OK'); done = true; await sleep(500);
    } catch (e) { last = e; if (/402/.test(e.message)) { console.log('OUT OF CREDITS'); process.exit(3); } if (a < 4) await sleep(3000 * a); }
  }
  if (!done) { console.log('FAIL: ' + (last && last.message)); process.exit(2); }
}
