// The faint backing behind a boon pick card (v0.30.722). Per user: "THere should be a faint
// backdrop to the powerup like poker cards".
//
//   LUDO_API_KEY=... node scripts/gen_boon_card_back.mjs
//
// A playing card is never a flat panel — it has a printed ground you read THROUGH the pips. That is
// the job here: a damask the eye registers as card stock and never as content. So it is authored
// portrait (the card's own shape), symmetrical about both axes so no corner of it fights the
// layout, and pushed far darker than any plate in this file — the card carries a boon name, an
// italic effect line, a roll bar and a banner, and every one of them sits directly on top of it.
//
// The luminance ceiling is the strictest in the repo for that reason, and the script refuses to
// write anything above it rather than leaving the call to taste.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'ui', 'boon_card_back.webp');
const W = 460, H = 620;          // the card's portrait shape; blitted with cover-fit
const MAX_LUM = 26;              // 0-255. Text sits on ALL of this, not just a band of it.

const PROMPT = [
  'A faint ornamental card back, in the manner of an antique playing card, painted as a game',
  'interface texture. Symmetrical about both axes. Fine gold filigree damask on near-black:',
  'interlacing scrollwork and a small central rosette, with a slim double border rule following the',
  'edges. Extremely low contrast — the gold is barely brighter than the ground, as if printed in',
  'worn ink and seen in dim light. No text, no numbers, no suits, no pips, no figures, no emblem,',
  'no bright highlight anywhere. Flat and even, no vignette, no light source. Delicate, restrained,',
  'uniform detail across the whole surface, subtle grain.',
].join(' ');

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function pollJob(id) {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) continue;
    const j = await r.json();
    const st = j && (j.status || j.state);
    if (st === 'succeeded' || st === 'completed' || st === 'done') return j;
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(j).slice(0, 200));
  }
  throw new Error('job timed out');
}
const urlOf = (d) => (Array.isArray(d) ? d[0]?.url
  : (d?.url || d?.images?.[0]?.url || d?.image_url
     || (Array.isArray(d?.result) ? d.result[0]?.url : d?.result?.url)));

async function makeImage(prompt) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        // image_type MUST be 'sprite' — 'concept_art' and 'background' are both rejected with a 400.
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_3_4', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      let url = urlOf(j);
      if (!url) {
        const jobId = j && (j.job_id || j.jobId || j.id);
        if (!jobId) throw new Error('no url and no job id: ' + JSON.stringify(j).slice(0, 200));
        j = await pollJob(jobId);
        url = urlOf(j);
      }
      if (!url) throw new Error('no image url in response: ' + JSON.stringify(j).slice(0, 200));
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (!buf || buf.length < 2000) throw new Error('image too small');
      return buf;
    } catch (e) { lastErr = e; console.log(`  attempt ${attempt} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 2500 * attempt)); }
  }
  throw lastErr;
}

const lumOf = async (buf) => (await sharp(buf).greyscale().stats()).channels[0].mean;

console.log('Boon card back — requesting art…');
let buf = await makeImage(PROMPT);
let lum = await lumOf(buf);
console.log(`  mean luminance: ${lum.toFixed(1)} (max ${MAX_LUM})`);
if (lum > MAX_LUM) {
  const k = Math.max(0.08, MAX_LUM / lum);
  console.log(`  too bright to sit under a whole card of copy — pulling by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  lum = await lumOf(buf);
  console.log(`  after: ${lum.toFixed(1)}`);
}
if (lum > MAX_LUM + 3) { console.error('REFUSING: still too bright to read text over.'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tmp = OUT + '.tmp';
await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 86 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const meta = await sharp(OUT).metadata();
const finalLum = await lumOf(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${meta.width}x${meta.height}  mean lum ${finalLum.toFixed(1)}`);
if (finalLum > MAX_LUM + 3) { console.error('REFUSING: written file is too bright.'); process.exit(1); }
console.log('OK');
