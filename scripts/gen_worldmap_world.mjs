// The World Map's ground, take four (v0.30.653). Per user, with a reference image of a bright
// illustrated top-down RPG map: "make the background something like this but accurate to the in game
// contents and in game map".
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_world.mjs [--fresh]
//
// This is not a texture or a chart any more - it is the world itself, painted, and it has to agree
// with where the game's regions actually are. The node positions are authored in mojiworld_game.html
// (wmX/wmY) and the ten territories v0.30.652 derives from the map names sit at known places on the
// 1529x889 field, so the prompt names each biome WITH its position: the Magma Foundry's volcano is
// upper-left-of-centre because that is where those maps are pinned, Block-land's toy bricks are
// bottom-left because that is where Block-land is, and so on. Get that wrong and the art fights the
// markers instead of explaining them.
//
// Because the reference is bright and our markers are light-on-dark, the painting is glazed after
// generation: a warm dusk wash that pulls the whole thing into one value range and keeps the node
// emblems, their names and the lanes on top of it readable. The gate below refuses art that is too
// loud in the middle, exactly as the last two grounds did - the failure mode never changed.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v4.webp');
const RAW = path.join(ROOT, 'scripts', '_tmp_wm_world_raw.webp');
const W = 1536, H = 896;
const CENTRE_MAX_LUM = 66;      // a painted world may be seen; it still may not shout
const CENTRE_MAX_P98 = 150;

// The layout below is read off the live map: territory centroids from _wmComputePositions, expressed
// as ninths of the canvas so the prompt can place them.
const PROMPT = [
  'A hand-painted top-down fantasy world map illustration for a cute 2D MMO, in the style of a',
  'storybook atlas: chunky stylised terrain, clean readable shapes, warm saturated colour, soft',
  'painted shading, thin rivers and winding roads, no grid.',
  'LAYOUT, and it must follow this: a broad green continent filling the frame, ringed by teal sea and',
  'soft cloud at the very edges.',
  'Upper-left: pale windswept ice-blue steppe with glass shards and thin snow.',
  'Left of centre: a smoking volcanic foundry of black rock, lava channels and iron chimneys.',
  'Lower-left: a bright toybox land of oversized coloured building bricks and foam blocks.',
  'Centre: a great walled stone bastion with courtyards and banners, on a green plain.',
  'Lower-centre: a torn violet rift in the ground, unstable light leaking from it.',
  'Upper-centre: pale tombs and a lantern-lit way-station on a dark moor.',
  'Upper-right: a mossy graveyard of broken headstones under twisted trees.',
  'Right: lush flowering jungle and blossom groves.',
  'Lower-right: drowned marshland and flooded ruins in dark green water.',
  'No text, no labels, no letters, no icons, no map pins, no markers, no UI, no characters, no',
  'people, no monsters, no borders, no compass rose. Nothing shiny or glowing. Even, gentle lighting',
  'with no single bright focal point - every part of this is background that markers will be drawn on.',
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
        for (let i = 0; i < 72; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const jr = await fetch(`${API}/assets/jobs/${jobId}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
          if (!jr.ok) continue;
          const js = await jr.json();
          const st = String(js.status || js.state || '').toLowerCase();
          if (st === 'succeeded' || st === 'success' || st === 'completed' || st === 'done') { j = js.result || js.output || js; break; }
          if (st === 'failed' || st === 'error' || st === 'cancelled') throw new Error('job failed: ' + JSON.stringify(js).slice(0, 200));
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
      if (!url) throw new Error('no image url in response: ' + JSON.stringify(j).slice(0, 240));
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
  console.log('World Map world-ground - reusing the saved art (pass --fresh to re-request)');
  art = fs.readFileSync(RAW);
} else {
  console.log('World Map world-ground - requesting art...');
  art = await makeImage(PROMPT);
  fs.writeFileSync(RAW, art);
}
const meta0 = await sharp(art).metadata();
console.log(`  art ${meta0.width}x${meta0.height}`);

// Glaze: one warm dusk wash plus a soft edge vignette, so a bright painting becomes a ground that
// 109 markers can sit on. This is Ghost of Tsushima's move - treat the art, not the type.
const GLAZE = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="v" cx="50%" cy="48%" r="76%">
      <stop offset="0%" stop-color="#0a0a1e" stop-opacity="0.30"/>
      <stop offset="58%" stop-color="#0a0a1e" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#05040f" stop-opacity="0.80"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#131026" opacity="0.30"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`);

let buf = await sharp(art).resize(W, H, { fit: 'cover', position: 'centre' })
  .composite([{ input: GLAZE, blend: 'over' }]).png().toBuffer();
let st = await centreStats(buf);
console.log(`  glazed: centre mean ${st.mean.toFixed(1)} (max ${CENTRE_MAX_LUM}), brightest 2% ${st.p98} (max ${CENTRE_MAX_P98})`);
if (st.mean > CENTRE_MAX_LUM || st.p98 > CENTRE_MAX_P98) {
  const k = Math.max(0.25, Math.min(CENTRE_MAX_LUM / st.mean, CENTRE_MAX_P98 / st.p98));
  console.log(`  pulling by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  st = await centreStats(buf);
  console.log(`  after: mean ${st.mean.toFixed(1)}, brightest 2% ${st.p98}`);
}
if (st.mean > CENTRE_MAX_LUM + 6) { console.error('REFUSING: too loud in the middle for a node field.'); process.exit(1); }

const tmp = OUT + '.tmp';
await sharp(buf).webp({ quality: 86 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const fin = await centreStats(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB  centre mean ${fin.mean.toFixed(1)}, p98 ${fin.p98}`);
console.log('OK');
