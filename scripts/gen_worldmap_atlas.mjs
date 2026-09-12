// The World Map's ground, take three (v0.30.653). Per user: "It can be still further improved,
// especially the background."
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_atlas.mjs [--fresh]
//
// v0.30.651 fixed the right problem (four stacked nebulae fighting the nodes) and overcorrected: the
// plate it produced measures mean 8/255, which is not a background so much as an absence. This one
// keeps every value under the legibility gate but puts something there to look at, borrowing what
// MapleStory's own world plate actually does:
//
//   * a SEA rather than a void - deep teal-indigo with depth banding, so the field has a material;
//   * a chart GRID - faint meridians and parallels, curved to the globe, the thing that says "this
//     is a document about a place" rather than "this is space";
//   * a CLOUD VIGNETTE at the edge instead of a hard rectangle, which is MapleStory's frame;
//   * painted TEXTURE from the model, used as a mask over our own palette so no value is its own.
//
// The gate is unchanged and still refuses: the centre mean and its brightest 2% both have to clear,
// because the node field sits over the whole surface and one bloom behind one node kills the read.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v3.webp');
const RAW = path.join(ROOT, 'scripts', '_tmp_wm_atlas_raw.webp');   // gitignored; re-runs cost no credits
const W = 1536, H = 896;
const CENTRE_MAX_LUM = 40;     // a little more room than v2's 34 - this ground is meant to be seen
const CENTRE_MAX_P98 = 104;

const PROMPT = [
  'A painted antique sea chart for a fantasy world map, seen from above. Deep teal and midnight blue',
  'water with soft depth banding and gentle painted swells, like watercolour on dark paper. Faint',
  'pale-gold hairline meridians and parallels curving across it. Around the outer edge only: soft',
  'pale mist and cloud, dissolving the corners. The middle two thirds must stay calm, even and',
  'almost featureless - no islands, no landmass, no compass rose, no ships, no text, no icons, no',
  'bright highlights, no focal point. Extremely low contrast, matte, fine paper grain. Elegant,',
  'restrained, cinematic - the quiet ground a map of markers is drawn on.',
].join(' ');

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function makeImage(prompt) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      const jobId = j && (j.job_id || j.jobId || j.id || (j.job && j.job.id));
      if (jobId) {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const jr = await fetch(`${API}/assets/jobs/${jobId}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
          if (!jr.ok) continue;
          const js = await jr.json();
          const st = String(js.status || js.state || '').toLowerCase();
          if (st === 'succeeded' || st === 'success' || st === 'completed' || st === 'done') { j = js.result || js.output || js; break; }
          if (st === 'failed' || st === 'error' || st === 'cancelled') throw new Error('job failed: ' + JSON.stringify(js).slice(0, 160));
          if (i % 4 === 0) console.log(`  job ${st || '?'}…`);
        }
      }
      const pick = (o) => {
        if (!o) return null;
        if (typeof o === 'string' && /^https?:/.test(o)) return o;
        if (Array.isArray(o)) { for (const x of o) { const u = pick(x); if (u) return u; } return null; }
        if (typeof o === 'object') {
          for (const k of ['url', 'image_url', 'imageUrl', 'uri', 'src']) if (typeof o[k] === 'string' && /^https?:/.test(o[k])) return o[k];
          for (const k of ['images', 'assets', 'data', 'result', 'output', 'files']) { const u = pick(o[k]); if (u) return u; }
        }
        return null;
      };
      const url = pick(j);
      if (!url) throw new Error('no image url in response: ' + JSON.stringify(j).slice(0, 220));
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (!buf || buf.length < 2000) throw new Error('image too small');
      return buf;
    } catch (e) { lastErr = e; console.log(`  attempt ${attempt} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 2500 * attempt)); }
  }
  throw lastErr;
}

async function centreStats(buf) {
  const meta = await sharp(buf).metadata();
  const top = Math.floor(meta.height * 0.14), h = Math.floor(meta.height * 0.72);
  const left = Math.floor(meta.width * 0.12), w = Math.floor(meta.width * 0.76);
  const raw = await sharp(buf).flatten({ background: '#000' }).extract({ left, top, width: w, height: h }).greyscale().raw().toBuffer();
  let sum = 0; const hist = new Array(256).fill(0);
  for (let i = 0; i < raw.length; i++) { sum += raw[i]; hist[raw[i]]++; }
  let acc = 0, p98 = 255; const target = raw.length * 0.98;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) { p98 = v; break; } }
  return { mean: sum / raw.length, p98 };
}

let art;
if (fs.existsSync(RAW) && !process.argv.includes('--fresh')) {
  console.log('World Map atlas ground - reusing the saved art (pass --fresh to re-request)');
  art = fs.readFileSync(RAW);
} else {
  console.log('World Map atlas ground - requesting art...');
  art = await makeImage(PROMPT);
  fs.writeFileSync(RAW, art);
}

// ---- our own sea, our own grid, our own mist. The art only supplies texture. ----
const merid = [];
for (let i = 1; i < 10; i++) {                       // parallels: flattened ellipses, like a globe's
  const ry = (i / 10) * H * 0.62;
  merid.push(`<ellipse cx="${W / 2}" cy="${H / 2}" rx="${(W * 0.52).toFixed(0)}" ry="${ry.toFixed(0)}" fill="none" stroke="#d8c79a" stroke-opacity="0.05" stroke-width="1"/>`);
}
for (let i = 0; i < 12; i++) {                       // meridians: arcs bowing from pole to pole
  const t = (i / 12) * Math.PI * 2;
  const rx = Math.abs(Math.cos(t)) * W * 0.52;
  merid.push(`<ellipse cx="${W / 2}" cy="${H / 2}" rx="${rx.toFixed(0)}" ry="${(H * 0.62).toFixed(0)}" fill="none" stroke="#d8c79a" stroke-opacity="0.045" stroke-width="1"/>`);
}
const GROUND = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="sea" cx="50%" cy="46%" r="78%">
      <stop offset="0%" stop-color="#16304a"/>
      <stop offset="38%" stop-color="#112742"/>
      <stop offset="72%" stop-color="#0b1a31"/>
      <stop offset="100%" stop-color="#050d1c"/>
    </radialGradient>
    <radialGradient id="mist" cx="50%" cy="50%" r="52%">
      <stop offset="0%" stop-color="#cfe6ff" stop-opacity="0"/>
      <stop offset="72%" stop-color="#cfe6ff" stop-opacity="0"/>
      <stop offset="88%" stop-color="#b9d6f2" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#dcecff" stop-opacity="0.10"/>
    </radialGradient>
    <radialGradient id="deep" cx="50%" cy="44%" r="42%">
      <stop offset="0%" stop-color="#071224" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#071224" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sea)"/>
  ${merid.join('')}
  <rect width="100%" height="100%" fill="url(#deep)"/>
  <rect width="100%" height="100%" fill="url(#mist)"/>
</svg>`);

// the model's painting, used only for its texture: greyscale, centred on mid, at a whisper
const texAlpha = await sharp(art).resize(W, H, { fit: 'cover', position: 'centre' })
  .ensureAlpha().extractChannel('alpha').raw().toBuffer();
const tex = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 190, g: 214, b: 236 } } })
  .joinChannel(await sharp(texAlpha, { raw: { width: W, height: H, channels: 1 } }).linear(0.22, 0).png().toBuffer())
  .png().toBuffer();

let buf = await sharp(GROUND).composite([{ input: tex, blend: 'over' }]).png().toBuffer();
let st = await centreStats(buf);
console.log(`  centre mean ${st.mean.toFixed(1)} (max ${CENTRE_MAX_LUM}), brightest 2% ${st.p98} (max ${CENTRE_MAX_P98})`);
if (st.mean > CENTRE_MAX_LUM || st.p98 > CENTRE_MAX_P98) {
  const k = Math.max(0.25, Math.min(CENTRE_MAX_LUM / st.mean, CENTRE_MAX_P98 / st.p98));
  console.log(`  pulling by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  st = await centreStats(buf);
  console.log(`  after: mean ${st.mean.toFixed(1)}, brightest 2% ${st.p98}`);
}
if (st.mean > CENTRE_MAX_LUM + 4 || st.p98 > CENTRE_MAX_P98 + 20) {
  console.error('REFUSING: the centre is still too bright to put a node field on.'); process.exit(1);
}
if (st.mean < 12) { console.error(`REFUSING: mean ${st.mean.toFixed(1)} - that is an absence, not a background.`); process.exit(1); }

const tmp = OUT + '.tmp';
await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const fin = await centreStats(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB  centre mean ${fin.mean.toFixed(1)}, p98 ${fin.p98}`);
console.log('OK');
