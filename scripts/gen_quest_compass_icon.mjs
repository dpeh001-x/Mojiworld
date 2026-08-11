#!/usr/bin/env node
// Cute compass LOGO for the quest-guide HUD (ludo.ai text->sprite).
// Output -> Sprites/ui/quest_compass.webp, shown at ~20 px inside #qnav-key.
//   node scripts/gen_quest_compass_icon.mjs            # dry-run (prints prompt)
//   node scripts/gen_quest_compass_icon.mjs --generate # needs LUDO_API_KEY
//   flags: --force
//
// Sized for 20 px, not for a gallery: the prompt asks for ONE bold silhouette
// and forbids fine detail, because anything smaller than a few source pixels
// per screen pixel turns to mush at HUD scale. Output is 192x192 — big enough
// for a 2x display and small enough that the HUD does not pay for it.
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'ui');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

const PREFIX = 'Chibi anime game UI ICON in the Mojiworld aesthetic. ' +
  'Pure transparent background, alpha only — no scene, no ground, no text, no watermark, no border frame. ' +
  '768x768 square canvas. Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors. ' +
  'ONE single centered object at ~68% scale with generous empty transparent margin on all sides — nothing cropped. ' +
  'Designed to stay readable when shrunk to a TINY 20 pixel HUD icon: one strong silhouette, chunky shapes, ' +
  'high contrast, NO fine detail, NO thin lines, NO small text or tick marks. ';
const DESC =
  'an adorable CUTE MAGIC COMPASS: a plump round pocket compass with a warm antique-gold case and a soft ' +
  'glowing cream-white dial, a single bold ruby-red needle pointing up-right, a tiny sparkle glint on the glass, ' +
  'and a gentle amber magical glow around the rim. Friendly storybook charm, cozy and inviting, ' +
  'slightly rounded chibi proportions. Gold and warm amber palette to match a fantasy quest HUD.';

const dest = join(DIR, 'quest_compass.webp');
const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# quest_compass.webp -> Sprites/ui/\n');
  console.log(PREFIX + DESC);
  console.log('\n# Re-run with --generate (needs LUDO_API_KEY). Flag: --force');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function genOne() {
  if (!force && await exists(dest)) return 'skip';
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + DESC }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 192, INNER = Math.round(CANVAS * 0.94);   // already margin-trimmed above
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}
console.log(await genOne(), '->', dest);
