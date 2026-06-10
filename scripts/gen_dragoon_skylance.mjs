#!/usr/bin/env node
// Dragoon "Sky Lance" (G / master-signature) descending-lance VFX sprite.
// The current art is a spear pointing UP; the skill plunges DOWNWARD, so per
// user it should read as a long ornate lance with the BLADE TIP POINTING DOWN
// (falling). Output -> Sprites/fx/dragoon_skylance.png (overwrites; LX_FX key
// 'dragoon_skylance'). Anti-cutoff: trim + contain at 86% on a transparent
// 768 canvas so the long lance keeps a clean margin; 4-attempt retry.
//   node scripts/gen_dragoon_skylance.mjs            # dry-run (prints prompt)
//   node scripts/gen_dragoon_skylance.mjs --generate # needs LUDO_API_KEY (--force to overwrite)
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'fx');
const dest = join(DIR, 'dragoon_skylance.png');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

const PREFIX = 'Ornate fantasy WEAPON sprite for a 2D action game in a chibi-anime / dragon-knight aesthetic. ' +
  'A single tall slender LANCE / SPEAR shown VERTICALLY, full length, with the sharp BLADE TIP POINTING STRAIGHT DOWN ' +
  '(as if plummeting / falling downward), the blunt pommel at the top. ' +
  'Pure transparent background, alpha only — no scene, no hand, no ground, no text, no watermark. 768x768 square canvas. ' +
  'Soft painterly cel-shaded anime style, bold clean black outlines, vibrant saturated colors, additive glow on the blade edges. ' +
  'The WHOLE lance sits fully inside the frame, centered, long and narrow, at ~80% of the canvas height with a ' +
  'generous EMPTY TRANSPARENT MARGIN above, below and on both sides — nothing cropped at the edges. ';
const DESC =
  'an elite dragon-knight SKY-LANCE: a long ornate spear with a large barbed leaf-shaped spearhead of polished ' +
  'steel-blue and violet metal, glowing cyan energy along the blade edges, dragon-wing-like flared guards near the head, ' +
  'a slim engraved metal shaft tapering to a small pommel. Regal, sleek, weighty. Tip points DOWNWARD.';

const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# dragoon_skylance.png -> Sprites/fx/\n');
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
        method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PREFIX + DESC }),
      });
      if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 140)}`);
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      const raw = await fetchBuf(url);
      let content; try { content = await sharp(raw).trim().toBuffer(); } catch { content = raw; }
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.86);
      const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
      const out = await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: inner, gravity: 'center' }]).png().toBuffer();
      await mkdir(DIR, { recursive: true });
      await writeFile(dest, out);
      return 'ok';
    } catch (e) { lastErr = e; if (attempt < 4) await sleep(4000 * attempt); }
  }
  throw lastErr;
}
process.stdout.write('dragoon_skylance ... ');
try { const r = await genOne(); console.log(r === 'skip' ? 'skip' : 'OK'); process.exit(0); }
catch (e) { console.log('FAIL: ' + (e && e.message)); process.exit(2); }
