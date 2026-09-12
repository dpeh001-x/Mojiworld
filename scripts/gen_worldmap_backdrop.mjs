// Backdrop art for the World Map (v0.30.651). Per user, on the map screen: "generate a more
// appropriate background and improve on the buttons the design and interface art".
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_backdrop.mjs
//
// The World Map is the hardest backdrop in the game to get right, because unlike a card or a reward
// screen there is no safe corner: 109 painted node emblems, their names and a web of lanes sit over
// the WHOLE surface. So this one is authored darker and flatter than any other backdrop here - a
// deep field with its structure at the very edges and almost nothing in the middle two thirds. The
// old plate was a bright magenta-and-violet nebula with blooms right through the centre, and three
// more coloured gradients were layered on top of it; the nodes had to fight all four.
//
// Verified after writing, and the script REFUSES to ship art that fails: the centre band's mean
// luminance must stay low enough that a white place name clears it, and - the one that actually
// bit the old plate - the brightest 2% of the centre must stay dark too, because a single bright
// bloom behind a node is what kills the read even when the average looks fine.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v2.webp');
const W = 1536, H = 896;                     // the diagram's own 1529x889, rounded to even
const CENTRE_MAX_LUM = 34;                   // 0-255 mean over the middle, where the node field sits
const CENTRE_MAX_P98 = 96;                   // and its brightest 2% - no blooms behind the nodes

const PROMPT = [
  'A dark celestial star-chart backdrop for a fantasy game world map. Deep near-black indigo and',
  'midnight blue, very softly vignetted, with the centre almost completely empty and unlit.',
  'Around the outer edges only: faint cool dust lanes, a scattering of small distant stars, and the',
  'barest suggestion of an antique astronomical chart - thin concentric rings and a few hairline',
  'meridian arcs in dim pale gold, drawn like engraving on old glass. No bright nebula blooms, no',
  'magenta, no strong colour, no focal point, nothing in the middle two thirds. Extremely low',
  'contrast, matte, subtle film grain. No text, no characters, no icons, no planets, no constellation',
  'figures. Restrained, elegant, cinematic - a quiet ground for markers to sit on.',
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
      // v0.30.x — the API answers 202 + a job for image work now; poll it out.
      // the API answers { id, task_type, status: queued|running, ... } - the job id is plain `id`
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

// The middle, where the node field lives: mean, and the brightest 2%.
async function centreStats(buf) {
  const meta = await sharp(buf).metadata();
  const top = Math.floor(meta.height * 0.14), h = Math.floor(meta.height * 0.72);
  const left = Math.floor(meta.width * 0.12), w = Math.floor(meta.width * 0.76);
  const raw = await sharp(buf).extract({ left, top, width: w, height: h }).greyscale().raw().toBuffer();
  let sum = 0; const hist = new Array(256).fill(0);
  for (let i = 0; i < raw.length; i++) { sum += raw[i]; hist[raw[i]]++; }
  const mean = sum / raw.length;
  let acc = 0, p98 = 255;
  const target = raw.length * 0.98;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) { p98 = v; break; } }
  return { mean, p98 };
}

const RAW = path.join(ROOT, 'scripts', '_tmp_wm_backdrop_raw.webp');   // gitignored: re-runs cost no credits
let buf;
if (fs.existsSync(RAW) && !process.argv.includes('--fresh')) {
  console.log('World Map backdrop - reusing the saved art (pass --fresh to re-request)');
  buf = fs.readFileSync(RAW);
} else {
  console.log('World Map backdrop - requesting art...');
  buf = await makeImage(PROMPT);
  fs.writeFileSync(RAW, buf);
}
// The model answers with INK ON TRANSPARENCY - a chart drawn in dark strokes, which is the exact
// inverse of what a dark UI needs. So the art is used as a MASK rather than as a picture: its ink
// becomes the light. Underneath goes our own ground - a deep indigo field, vignetted, with the
// centre left alone - and the chart arcs are laid over it in dim pale gold at a whisper of opacity.
// The result is bespoke to this screen and cannot be too bright, because every value in it is ours.
const GROUND = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="f" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="#100a26"/>
      <stop offset="46%" stop-color="#0b0720"/>
      <stop offset="78%" stop-color="#060415"/>
      <stop offset="100%" stop-color="#03020c"/>
    </radialGradient>
    <radialGradient id="g" cx="50%" cy="44%" r="46%">
      <stop offset="0%" stop-color="#2a2060" stop-opacity="0.30"/>
      <stop offset="60%" stop-color="#1a1442" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0a0722" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#f)"/>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);

// the ink, turned into light: greyscale -> negate -> use as the alpha of a pale gold wash
const meta0 = await sharp(buf).metadata();
const inkAlpha = await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' })
  .ensureAlpha().extractChannel('alpha').raw().toBuffer();   // RAW: the join below reads it as one plane
const gold = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 214, g: 196, b: 150 } } })
  .joinChannel(await sharp(inkAlpha, { raw: { width: W, height: H, channels: 1 } })
    .linear(0.34, 0).png().toBuffer())     // 34% of the ink's own coverage: a whisper, not a print
  .png().toBuffer();
buf = await sharp(GROUND).composite([{ input: gold, blend: 'over' }]).png().toBuffer();
console.log(`  art ${meta0.width}x${meta0.height} used as a chart mask over our own ground`);

let st = await centreStats(buf);
console.log(`  centre mean ${st.mean.toFixed(1)} (max ${CENTRE_MAX_LUM}), brightest 2% ${st.p98} (max ${CENTRE_MAX_P98})`);

// Pull it down rather than re-rolling: a linear pull keeps the art's character, and it is exactly
// what a runtime scrim would otherwise have to do on every frame.
if (st.mean > CENTRE_MAX_LUM || st.p98 > CENTRE_MAX_P98) {
  const k = Math.max(0.18, Math.min(CENTRE_MAX_LUM / st.mean, CENTRE_MAX_P98 / st.p98));
  console.log(`  too bright for a map surface — pulling by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  st = await centreStats(buf);
  console.log(`  after: mean ${st.mean.toFixed(1)}, brightest 2% ${st.p98}`);
}
if (st.mean > CENTRE_MAX_LUM + 4 || st.p98 > CENTRE_MAX_P98 + 20) {
  console.error('REFUSING: the centre is still too bright to put a node field on.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tmp = OUT + '.tmp';
await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 86 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const meta = await sharp(OUT).metadata();
const fin = await centreStats(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${meta.width}x${meta.height}  ${Math.round(fs.statSync(OUT).size / 1024)} KB  centre mean ${fin.mean.toFixed(1)}, p98 ${fin.p98}`);
if (fin.mean > CENTRE_MAX_LUM + 4) { console.error('REFUSING: the written file is too bright.'); process.exit(1); }
console.log('OK');
