// Key art for the DEATH OVERLAY (the "oops!" screen), per user: "This page is rather bare generate
// something AAA standard for this, make it sensational".
// =============================================================================
// The overlay had no art of its own at all - a radial black wash, a 132 px cartoon tombstone and
// three lines of text. (The painted graveyard from v0.30.474 belongs to the Amnesiac's STORY BEAT,
// a different overlay, and is nearly empty by design: measured 11.7/255 through the middle.)
//
// This one has to do two jobs at once, so both are gated rather than hoped for:
//   DARK WHERE THE WORDS GO - the centre band carries the title, the prose and the toll, so its mean
//     luminance must stay under CENTRE_MAX; art too bright for white text is pulled down or refused.
//   NOT EMPTY EVERYWHERE ELSE - the complaint was bareness, so the outer thirds must actually carry
//     painted content: an EDGE_MIN floor on the top and bottom bands, and a contrast floor so a flat
//     wash cannot pass by being uniformly dim.
//
//   LUDO_API_KEY=... node scripts/gen_death_keyart.mjs [--keep]
// =============================================================================
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'ui', 'death_keyart.webp');
const W = 1920, H = 1080;
const CENTRE_MAX = 34;     // mean luminance of the middle band - the prose sits here
const EDGE_MIN = 16;       // mean luminance of the top+bottom bands - below this it is a black rectangle
const EDGE_SD_MIN = 12;    // and it must have structure, not be a flat dim wash

const PROMPT = [
  'Cinematic AAA game-over key art: a vast, silent necropolis at night seen in wide shot.',
  'A colossal cracked stone monument and a row of weathered grave markers rise from deep rolling fog',
  'along the bottom of the frame, silhouetted. High above, a narrow tear of cold violet light splits',
  'the black sky and spills a single pale shaft of moonlight down through the mist, with faint',
  'volumetric god rays and drifting ash motes catching the light. Deep near-black indigo, cold violet',
  'and ash grey only. Painterly, atmospheric, melancholy and grand, heavy vignette.',
  'CRITICAL: the entire middle band of the image must stay almost pure darkness and completely empty -',
  'no objects, no light source, no focal point through the centre, because text is laid over it.',
  'All detail belongs at the very bottom and the very top edges. No text, no letters, no characters,',
  'no people, no skulls, no logos, no UI.',
].join(' ');

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 2026-09-11: /assets/image answers 202 with a JOB ({id, status, poll_after_ms}); the finished job at
// GET /assets/jobs/<id> carries result: [{url}]. A job that is never polled is still PAID.
async function pollJob(job) {
  const t0 = Date.now();
  let wait = Math.min(15000, Math.max(2000, Number(job.poll_after_ms) || 5000));
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job ' + job.id + ' still running after 15 min');
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { wait = Math.min(30000, Math.round(wait * 1.7)); continue; }
    if (!r.ok) throw new Error('job HTTP ' + r.status);
    const j = await r.json();
    if (j.status === 'succeeded' || j.status === 'completed') return j;
    if (j.status === 'failed' || j.status === 'error' || j.status === 'cancelled') throw new Error('job ' + j.status);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || wait));
  }
}
async function makeImage(prompt) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url && !(j.result && j.result.url))) j = await pollJob(j);
      const url = j.url || (j.result && j.result.url) || (Array.isArray(j.result) && j.result[0] && j.result[0].url);
      if (!url) throw new Error('no url in response: ' + JSON.stringify(j).slice(0, 160));
      const dl = await fetch(url, { signal: AbortSignal.timeout(150000) });
      if (!dl.ok) throw new Error('download HTTP ' + dl.status);
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 20000) throw new Error('suspiciously small (' + buf.length + 'B)');
      console.log(`  attempt ${attempt}: ${(buf.length / 1024).toFixed(0)} KB`);
      return buf;
    } catch (e) { last = e; console.log('  attempt ' + attempt + ' failed: ' + e.message); await sleep(2000 * attempt); }
  }
  throw last;
}
// the API returns a cut-out, and greyscale() reads transparency as black - flatten FIRST or every
// measurement below describes an image that will not be what ships (this cost a pass on the v0.30.474 art)
const flatten = (buf) => sharp(buf).resize(W, H, { fit: 'cover' }).flatten({ background: '#05030c' }).png().toBuffer();
async function bands(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const band = (y0, y1) => {
    let s = 0, ss = 0, n = 0;
    for (let y = Math.floor(y0 * h); y < Math.floor(y1 * h); y++) for (let x = 0; x < w; x++) { const v = data[y * w + x]; s += v; ss += v * v; n++; }
    const m = s / n;
    return { mean: m, sd: Math.sqrt(Math.max(0, ss / n - m * m)) };
  };
  return { centre: band(0.30, 0.68), top: band(0, 0.22), bottom: band(0.74, 1) };
}

let buf = await flatten(await makeImage(PROMPT));
let b = await bands(buf);
console.log(`  centre ${b.centre.mean.toFixed(1)} (max ${CENTRE_MAX})   top ${b.top.mean.toFixed(1)}/sd ${b.top.sd.toFixed(1)}   bottom ${b.bottom.mean.toFixed(1)}/sd ${b.bottom.sd.toFixed(1)}`);
if (b.centre.mean > CENTRE_MAX) {
  const k = Math.max(0.35, CENTRE_MAX / b.centre.mean);
  console.log(`  centre too bright for the prose - pulling by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).png().toBuffer();
  b = await bands(buf);
  console.log(`  after: centre ${b.centre.mean.toFixed(1)}  top ${b.top.mean.toFixed(1)}  bottom ${b.bottom.mean.toFixed(1)}`);
}
const edgeMean = Math.max(b.top.mean, b.bottom.mean), edgeSd = Math.max(b.top.sd, b.bottom.sd);
if (b.centre.mean > CENTRE_MAX + 5) { console.error('REFUSING: the centre is still too bright to carry white text.'); process.exit(1); }
if (edgeMean < EDGE_MIN) { console.error(`REFUSING: the edges mean ${edgeMean.toFixed(1)} - that is a black rectangle, which is the complaint.`); process.exit(1); }
if (edgeSd < EDGE_SD_MIN) { console.error(`REFUSING: edge detail sd ${edgeSd.toFixed(1)} - a flat dim wash, nothing painted in it.`); process.exit(1); }
const out = await sharp(buf).webp({ quality: 88 }).toBuffer();
fs.writeFileSync(OUT + '.tmp', out); fs.renameSync(OUT + '.tmp', OUT);
console.log(`wrote ${path.relative(ROOT, OUT)} - ${(out.length / 1024).toFixed(0)} KB, ${W}x${H}`);
