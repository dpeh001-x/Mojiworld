// The World Map's ground (v0.30.656). The painting, as painted - no towns on it and no glaze over
// it. Per user, supplying the image itself: "just use this".
//
// Every ground from v0.30.651 to v0.30.655 was darkened before it shipped, because 80 light-on-dark
// markers stand on it and a bright painting swallows them. That treatment is gone: the user picked
// this image and it ships as this image. The legibility it used to buy is now bought in the renderer
// instead, by the reading scrim under the node field in mojiworld_game.html - the layer that can pay
// for it without touching the art. The brightness gate is therefore gone too; it would refuse this
// file, and refusing the user's own choice is not what a gate is for.
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_world.mjs --variants 3     # request N, write a sheet
//   LUDO_API_KEY=... node scripts/gen_worldmap_world.mjs --use 2          # glaze candidate N, ship it
//   node scripts/gen_worldmap_world.mjs                                   # reuse the saved art
//
// Two things have to be true at once and they pull against each other.
//
// GEOGRAPHY. The node field is authored in mojiworld_game.html as wmX/wmY on a 1529x889 canvas, so
// every region already has a place: the Magma Foundry's maps are pinned left of centre, Block-land's
// bottom-left, The Bastion dead centre, the rift below it, the graveyard upper-right. Art that
// disagrees with the markers fights them instead of explaining them, so the prompt below names each
// zone WITH its position, in the order a reader scans.
//
// THE TOWNS THEMSELVES. Every settlement in the prompt is described from what that map actually
// looks like when you stand in it - all twenty were loaded in a browser and screenshotted before
// this was written (scripts/_tmp_town_shots.mjs, throwaway). Everdawn Central is half-timbered under
// cherry blossom because that is its backdrop; the Megamall is a glass-roofed arcade; the Azure
// Academia is white-and-blue cathedral spires round a fountain and Frostbite Hollow is those same
// spires frosted over; Hera's Abode is a room inside a floating soap bubble; the Shadow-Woven Hood
// is a dark street of red paper lanterns. A generic village painted at the right coordinates is
// still the wrong town.
//
// An earlier pass (v0.30.654) cut villages out of a second generated image and composited them onto
// this ground at the exact node coordinates. The placement was right and the result still read as
// stickers - matched at the rim, feathered, shadowed, and obviously pasted. A painting has one light
// and one hand; the towns have to be painted INTO it, which is what this does.
//
// Because the markers are light-on-dark, the painting is glazed after generation: a warm dusk wash
// that pulls it into one value range. The gate refuses art too loud in the middle, as every ground
// since v0.30.651 has.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v6.webp');
const RAW = path.join(ROOT, 'scripts', '_tmp_wm_world5_raw.webp');
const W = 1536, H = 896;
// Measured and reported, never enforced - see the header.

const PROMPT = [
  'A hand-painted top-down fantasy world map illustration for a cute 2D MMO, in the style of a',
  'storybook atlas: chunky stylised terrain, clean readable shapes, warm saturated colour, soft',
  'painted shading, thin rivers and winding roads linking the settlements, no grid.',
  'One broad continent filling the frame, ringed by teal sea and soft cloud at the very edges.',
  'Every place below is a real location and must be painted where it is listed and as it is',
  'described. Settlements are SMALL - a handful of rooftops each, a thumbnail on the map - and none',
  'is larger than the fortress at the centre.',
  'FAR UPPER-LEFT: a pale ice-blue steppe of windswept snow and standing glass shards, with a cave',
  'mouth of pink crystal rock at the corner.',
  'UPPER-LEFT: a tall Victorian mansion with steep purple roofs and lit yellow windows, alone in',
  'deep snow.',
  'LEFT OF CENTRE: a smoking volcanic foundry of black rock, orange lava channels and iron chimneys.',
  'MIDDLE-LEFT, top to bottom: pale sand dunes; a bright amber honeycomb hive of hexagon cells; a',
  'bubblegum-pink swamp; a candy canyon of pink frosting cliffs, biscuits and gummy sweets; a calm',
  'blue lagoon; a green grotto pool.',
  'LOWER-LEFT: a toybox land of oversized coloured building bricks and foam blocks.',
  'CENTRE: a great walled stone bastion with courtyards and banners on a green plain. Just west of',
  'it, a town of brown-tiled half-timbered houses under pink cherry blossom, and beside that a long',
  'glass-roofed arcade with striped awnings. Directly above the bastion, a domed hall of indigo and',
  'silver patterned with stars.',
  'RIGHT OF THE BASTION, top to bottom: a snow-capped pine peak; one soap-bubble sphere floating',
  'above the grass with a tiny furnished room inside it; a white-and-blue academy of pointed',
  'cathedral spires around a fountain; those same pale spires again, frosted and snowed over; and',
  'terraced garden platforms standing on cloud.',
  'LOWER CENTRE, left to right: a violet-roofed pagoda; a dark street of tiled roofs hung with red',
  'paper lanterns; a cluster of giant red-capped mushrooms; a wooden bridge over misty jade-green',
  'water beside a small pagoda; a green village of wooden stilt huts and hanging lanterns in dense',
  'jungle; a hall of red lacquered columns.',
  'BETWEEN THOSE AND THE BASTION: a torn violet rift in the ground, unstable light leaking from it.',
  'UPPER-CENTRE: pale tombs and a lantern-lit way-station on a dark moor.',
  'UPPER-RIGHT: a mossy graveyard of broken headstones under twisted trees.',
  'RIGHT: a meadow of magenta and violet wildflowers with pink-blossom trees.',
  'LOWER-RIGHT: drowned marshland and flooded ruins in dark green water, and an amber honeycomb',
  'chamber on the coast.',
  'No text, no labels, no letters, no numbers, no icons, no map pins, no markers, no UI, no',
  'characters, no people, no monsters, no borders, no compass rose. Nothing shiny or glowing. Even,',
  'gentle lighting with no single bright focal point - all of this is background that markers will',
  'be drawn on top of.',
].join(' ');

async function makeImage(prompt) {
  const key = process.env.LUDO_API_KEY; if (!key) throw new Error('LUDO_API_KEY not set');
  // The service moved its prefix under us mid-session (/api/v1 started answering 404 while /api
  // served the same route), so the base is resolved once at call time instead of hardcoded.
  const BASES = ['https://api.ludo.ai/api', 'https://api.ludo.ai/api/v1'];
  let API = null, lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let res = null;
      for (const b of (API ? [API] : BASES)) {
        res = await fetch(`${b}/assets/image`, {
          method: 'POST',
          headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(150000),
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }),
        });
        if (res.status !== 404) { API = b; break; }
      }
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

const argN = (flag) => { const i = process.argv.indexOf(flag); return i < 0 ? 0 : Number(process.argv[i + 1] || 0); };
const cand = (i) => path.join(ROOT, 'scripts', `_tmp_wm_v6_raw${i}.webp`);
const variants = argN('--variants'), use = argN('--use');
if (variants) {                                       // request N takes and lay them out to choose from
  const tiles = [];
  for (let i = 1; i <= variants; i++) {
    console.log(`candidate ${i}/${variants} - requesting art...`);
    const art = await makeImage(PROMPT);
    fs.writeFileSync(cand(i), art);
    tiles.push(await sharp(art).resize(768, 448, { fit: 'cover' }).toBuffer());
  }
  const sheet = path.join(ROOT, 'scripts', '_tmp_wm_v6_sheet.png');
  await sharp({ create: { width: 768, height: 448 * tiles.length, channels: 3, background: '#0b0b14' } })
    .composite(tiles.map((b, i) => ({ input: b, left: 0, top: i * 448 }))).png().toFile(sheet);
  console.log(`wrote ${path.relative(ROOT, sheet)} - pick one, then re-run with --use N`);
  process.exit(0);
}

let art;
if (use) {
  if (!fs.existsSync(cand(use))) throw new Error('no candidate ' + use);
  console.log(`World Map ground - using candidate ${use}`);
  art = fs.readFileSync(cand(use));
  fs.writeFileSync(RAW, art);
} else if (fs.existsSync(RAW) && !process.argv.includes('--fresh')) {
  console.log('World Map ground - reusing the saved art (pass --fresh to re-request)');
  art = fs.readFileSync(RAW);
} else {
  console.log('World Map ground - requesting art...');
  art = await makeImage(PROMPT);
  fs.writeFileSync(RAW, art);
}
const meta0 = await sharp(art).metadata();
console.log(`  art ${meta0.width}x${meta0.height}`);

const tmp = OUT + '.tmp';
await sharp(art).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 92 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const fin = await centreStats(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
console.log(`  centre mean ${fin.mean.toFixed(1)}, brightest 2% ${fin.p98} - reported, not enforced; the renderer's scrim carries legibility now`);
console.log('OK');
