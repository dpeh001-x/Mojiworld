#!/usr/bin/env node
// A backdrop for the Mojiworld app icon that survives being 32 pixels wide.
//
// Per user, with a screenshot of the desktop shortcut: "improve on the background art for the
// mojiworld icon".
//
// WHAT IS WRONG WITH THE ONE THERE. assets/icon_bg.png is a lovely painted candy-forest cinematic -
// 1064x646, a treasure chest under blossom trees - and the icon uses it by cropping a 512 square out
// of the middle with `fit: cover`. At icon sizes that crop is nothing but a dark magenta smear: the
// scene's readable content (the chest, the tree shapes) is outside the crop, and what is left is
// mid-value mush sitting at almost the same lightness as Guguma's own shading. Rendered at 16, 24,
// 32 and 48px - which is what a desktop shortcut actually is - the bird reads and the background
// says nothing at all.
//
// SO THE BRIEF IS A COMPOSITION BRIEF, not a subject one. An icon backdrop has to be built from two
// or three shapes that survive a 16x downsample, with its value structure arranged around the
// subject: dark at the corners so the rounded square has an edge, bright in the middle so a yellow
// bird has something to be bright against. That is what this asks for, and the negatives are there
// because detail is exactly what the current one has too much of.
//
//   node scripts/gen_icon_backdrop_ludo.mjs                    # print the prompt
//   node scripts/gen_icon_backdrop_ludo.mjs --generate         # needs LUDO_API_KEY
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = join(ROOT, 'scripts', '_tmp_icon_bg');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const KEY = process.env.LUDO_API_KEY;
const argv = process.argv.slice(2), has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const PROMPT = [
  'A square background plate for a game app ICON. No characters, no creatures, no people.',
  'Composition, in three big shapes only:',
  '(1) a deep indigo and violet NIGHT SKY filling the frame, darkest in the four corners;',
  '(2) a large warm GOLDEN DAWN GLOW low in the centre - a broad soft sunrise bloom rising from the',
  'horizon, brightest in the middle of the square, fading out well before the edges;',
  '(3) a simple almost-black SILHOUETTE of a floating island along the bottom third - one clean',
  'rounded landmass with two or three suggested treetops, read as a single dark shape.',
  'A handful of small bright stars in the upper corners. Nothing else.',
  'THIS WILL BE SEEN AT 32 PIXELS. Big flat shapes with clean edges and strong light-to-dark contrast.',
  'NO fine detail, NO texture, NO leaves, NO branches, NO rocks, NO bricks, NO grass blades,',
  'NO clouds with detail, NO lens flare, NO particles, NO sparkles, NO haze, NO blur, NO gradient mush,',
  'NO text, NO letters, NO watermark, NO logo, NO border, NO frame, NO UI panel, NO vignette ring.',
  'Flat painted fantasy game art, rich saturated colour, the centre clearly brighter than the corners.',
].join(' ');

if (!has('--generate')) { console.log(PROMPT + '\n\n--generate (needs LUDO_API_KEY) [--rolls N]'); process.exit(0); }

const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
// the finished job hands the image back under result, and result can be an ARRAY - which is how
// the first three rolls came back 'succeeded' with nothing read out of them.
const urlOf = (d) => { if (!d) return null;
  if (Array.isArray(d)) return d[0] && (d[0].url || d[0]);
  return d.url || d.image_url || (d.images && d.images[0] && (d.images[0].url || d.images[0]))
      || (Array.isArray(d.result) ? (d.result[0] && (d.result[0].url || d.result[0])) : (d.result && d.result.url))
      || (Array.isArray(d.assets) && d.assets[0] && (d.assets[0].url || d.assets[0]))
      || (Array.isArray(d.urls) && d.urls[0]) || null; };
async function poll(res) {
  if (res.status === 402) { console.error('OUT OF LUDO CREDITS'); process.exit(3); }
  if (!res.ok && res.status !== 202) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
  let data = await res.json();
  const id = data && (data.job_id || data.jobId || data.id);
  if (urlOf(data)) return data;
  if (!id) return data;
  for (let i = 0; i < 180; i++) {
    await new Promise((s) => setTimeout(s, 5000));
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) continue;
    data = await r.json();
    const st = String(data.status || data.state || '').toLowerCase();
    if (st === 'failed' || st === 'error') throw new Error('job failed: ' + JSON.stringify(data).slice(0, 260));
    const merged = (data.result && !Array.isArray(data.result)) ? Object.assign({}, data, data.result) : data;
    if (urlOf(merged) || st === 'completed' || st === 'succeeded' || st === 'done') return merged;
  }
  throw new Error('job did not finish');
}

if (!KEY) { console.error('LUDO_API_KEY required'); process.exit(1); }
await mkdir(KEEP, { recursive: true });
// recover a job that already finished (the first rolls succeeded server-side; no need to pay twice)
const JOB = arg('--job');
if (JOB) {
  const r = await fetch(API + '/assets/jobs/' + JOB, { headers: { Authorization: 'ApiKey ' + KEY } });
  const d = await r.json();
  const u = urlOf((d.result && !Array.isArray(d.result)) ? Object.assign({}, d, d.result) : d);
  if (!u) { console.log(JSON.stringify(d).slice(0, 900)); process.exit(1); }
  let k = 1; while (existsSync(join(KEEP, 'roll' + k + '.png'))) k++;
  await writeFile(join(KEEP, 'roll' + k + '.png'), await sharp(await fetchBuf(u)).png().toBuffer());
  console.log('recovered job ' + JOB + ' -> roll' + k + '.png');
  process.exit(0);
}
const rolls = Number(arg('--rolls') || 3);
let start = 1; while (existsSync(join(KEEP, `roll${start}.png`))) start++;
for (let r = start; r < start + rolls; r++) {
  process.stdout.write(`roll ${r} ... `);
  try {
    const d = await poll(await fetch(`${API}/assets/image`, {
      method: 'POST', signal: AbortSignal.timeout(600000),
      headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
    }));
    const u = urlOf(d);
    if (!u) { console.log('no url: ' + JSON.stringify(d).slice(0, 180)); continue; }
    await writeFile(join(KEEP, `roll${r}.png`), await sharp(await fetchBuf(u)).png().toBuffer());
    console.log('ok');
  } catch (e) { console.log('FAILED ' + e.message); }
}
console.log('candidates in ' + KEEP);
