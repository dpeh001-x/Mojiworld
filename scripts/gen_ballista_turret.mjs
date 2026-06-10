#!/usr/bin/env node
// Ballista "War Machine" deployable TURRET sprite (ludo.ai text->sprite).
// Output -> Sprites/summons/ballista_turret.webp (loaded by LX_SUMMON, drawn by
// drawBallistaTurrets). Anti-cutoff: trim + contain at 82% on a transparent
// 768 canvas so the whole turret keeps a clean margin; 4-attempt retry.
//   node scripts/gen_ballista_turret.mjs            # dry-run (prints prompt)
//   node scripts/gen_ballista_turret.mjs --generate # needs LUDO_API_KEY
//   flags: --force
// =============================================================================
import sharp from 'sharp';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(repoRoot, 'Sprites', 'summons');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

const PREFIX = 'Chibi anime game PROP sprite for a 2D platformer in the Mojiworld aesthetic, ' +
  'a deployable AUTO-TURRET shown in full, SIDE VIEW facing RIGHT. ' +
  'Pure transparent background, alpha only — no scene, no ground, no text, no watermark. 768x768 square canvas. ' +
  'Soft painterly cel-shaded anime style, bold black outlines, vibrant saturated colors. ' +
  'The WHOLE turret sits fully inside the frame, centered, at ~70% scale with a generous empty transparent ' +
  'margin on all sides — nothing cropped at the edges. Reads clearly at small in-game size. ';
const DESC =
  'a mounted SIEGE BALLISTA turret on a sturdy three-legged dark-steel tripod base: a heavy bronze-and-iron ' +
  'crossbow with two thick curved limbs and a taut string, a long loaded arrow-bolt pointing RIGHT, ' +
  'glowing amber-orange energy core at the pivot, riveted metal plating, warm magical glow. Heroic war-machine vibe.';

const dest = join(DIR, 'ballista_turret.webp');
const exists = async p => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }

if (!has('--generate')) {
  console.log('# ballista_turret.webp -> Sprites/summons/\n');
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
      const CANVAS = 768, INNER = Math.round(CANVAS * 0.82);
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
process.stdout.write('ballista_turret ... ');
try { const r = await genOne(); console.log(r === 'skip' ? 'skip' : 'OK'); process.exit(0); }
catch (e) { console.log('FAIL: ' + (e && e.message)); process.exit(2); }
