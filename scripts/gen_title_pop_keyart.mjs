// A POP render of the title key art, per user: "the background image can be swapped out with a more POP render".
// =============================================================================
// Same party and layout as gen_title_keyart.mjs (heroes + Guguma lower left, landmark right, centre calm for
// the menu card), redrawn loud: bold ink outlines, flat saturated colour, halftone, the app icon's hot pink /
// acid yellow / cyan. Writes samples only; nothing in backgrounds/ is touched until --pick.
//
//   LUDO_API_KEY=... KEYART_OUT=<dir> node scripts/gen_title_pop_keyart.mjs [a b c]
//   LUDO_API_KEY=... KEYART_OUT=<dir> node scripts/gen_title_pop_keyart.mjs --pick=a
// =============================================================================
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = path.join(ROOT, 'backgrounds', 'title_keyart_pop.webp');
const SAMPLE_DIR = process.env.KEYART_OUT || path.join(ROOT, 'scripts', '_tmp_keyart');
const W = 1920, H = 1072;
const TAG = process.env.KEYART_TAG || '';
const GROUND = { r: 12, g: 8, b: 20 };

const PARTY = 'Four chibi heroes with oversized rounded hair and small bodies stand together - a warrior in a red cloak '
  + 'with a short sword, a mage in a wide blue pointed hat holding a glowing staff, a hooded rogue in dark grey, and an '
  + 'archer in green with a bow - and beside them GUGUMA, a plump round yellow canary chick with a small orange beak and '
  + 'big friendly black eyes, knee-high to the heroes.';
const LAYOUT = 'Composition: the heroes and the chick are SMALL and huddled together at the FAR LEFT EDGE, taking up only the '
  + 'leftmost quarter of the image, seen from behind; the landmark is small at the FAR RIGHT EDGE; the whole MIDDLE HALF '
  + 'of the image is empty open sky above a simple low meadow, because a menu card covers it.';
const FULL = 'No text, no letters, no logo, no watermark, no UI, no frame or border. A FULL RECTANGULAR image, completely '
  + 'opaque, painted from corner to corner including the whole sky - not a sticker, not a cut-out, no empty background.';

const SETS = {
  a: { label: 'Pop-art comic: Ben-Day dots, starburst sky',
    prompt: `Pop art comic book game key art. ${PARTY} They stand on a grassy ridge looking out over a valley of `
      + 'autumn trees toward a distant crystal castle spire. Thick bold black ink outlines, flat bright cel colours, '
      + 'Ben-Day halftone dots in the shading, a hot pink and violet sky with acid yellow comic starburst rays and '
      + `little sparkle stars, a cyan river. Loud, punchy, poster-like. ${LAYOUT} ${FULL}` },
  b: { label: 'Pop punk gig poster: neon sunset, speed lines',
    prompt: `Pop punk poster style fantasy game key art. ${PARTY} They stand on a hilltop above a colourful fantasy `
      + 'town with a tall glowing crystal tower. A neon sunset sky in hot pink, tangerine and electric violet with bold '
      + 'radiating comic speed-line rays, halftone dot texture, chunky black outlines, acid yellow and cyan highlights, '
      + `flat saturated colour. Energetic and fun. ${LAYOUT} ${FULL}` },
  d: { label: 'Pop-art comic, wide shot, tiny heroes',
    prompt: 'Pop art comic book game key art, a WIDE ESTABLISHING SHOT of a vast landscape. In the bottom left corner, SMALL '
      + 'and far away, four tiny chibi adventurers (a red-cloaked warrior, a mage in a blue pointed hat, a grey hooded rogue, a '
      + 'green archer) and a tiny round yellow chick stand on a grassy ledge - together they are no taller than one fifth of the '
      + 'image height. Before them a huge valley of autumn trees, a winding cyan river, and far away on the right a crystal '
      + 'castle. Thick bold black ink outlines, flat bright cel colours, Ben-Day halftone dots, a hot pink and violet sky with '
      + `acid yellow comic starburst rays and sparkle stars. Loud, punchy, poster-like. ${FULL}` },
  e: { label: 'Pop punk poster, wide shot, tiny heroes',
    prompt: 'Pop punk poster style fantasy game key art, a WIDE ESTABLISHING SHOT. Four tiny chibi adventurers and a tiny round '
      + 'yellow chick stand small in the bottom left corner on a hilltop, no taller than one fifth of the image height, looking '
      + 'across a big colourful valley to a fantasy town with a tall glowing crystal tower on the far right. A neon sunset sky in '
      + 'hot pink, tangerine and electric violet with bold radiating comic speed-line rays, halftone dot texture, chunky black '
      + `outlines, acid yellow and cyan highlights, flat saturated colour. ${FULL}` },
  c: { label: 'Glossy vinyl-toy 3D render, candy colours',
    prompt: `Glossy 3D render in the style of cute vinyl designer toys, fantasy game key art. ${PARTY} They stand `
      + 'on a round grassy hill of candy-coloured autumn trees looking toward a shiny crystal castle. Bright pop colours - '
      + 'hot pink, bubblegum, lemon yellow, turquoise - soft studio lighting, smooth plastic shading, a gradient pink and '
      + `violet sky with puffy clouds and sparkles. ${LAYOUT} ${FULL}` },
};

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pick = (process.argv.find((a) => a.startsWith('--pick=')) || '').slice(7);
if (pick) {
  const src = path.join(SAMPLE_DIR, `title_pop_${pick}.png`);
  if (!fs.existsSync(src)) { console.error('no sample ' + src); process.exit(1); }
  await sharp(src).resize(W, H, { fit: 'cover' }).webp({ quality: 84 }).toFile(FINAL + '.tmp');
  fs.renameSync(FINAL + '.tmp', FINAL);
  console.log(`wrote ${path.relative(ROOT, FINAL)} ${(fs.statSync(FINAL).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}

// 2026-09-11: /assets/image answers 202 with a JOB; poll GET /assets/jobs/<id> until succeeded -> result[0].url.
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
      const res = await fetch(`${API}/assets/image`, { method: 'POST', signal: AbortSignal.timeout(150000),
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }) });
      if (res.status === 402) throw Object.assign(new Error('out of credits'), { fatal: true });
      if (res.status === 429) { await sleep(20000); continue; }
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      if (j && j.id) console.log('    job ' + j.id);
      if (res.status === 202 || (j && j.id && j.status && !j.url)) j = await pollJob(j);
      const url = j.url || (Array.isArray(j.result) && j.result[0] && j.result[0].url) || (j.result && j.result.url);
      if (!url) throw new Error('no url: ' + JSON.stringify(j).slice(0, 160));
      const dl = await fetch(url, { signal: AbortSignal.timeout(150000) });
      if (!dl.ok) throw new Error('download HTTP ' + dl.status);
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 20000) throw new Error('suspiciously small (' + buf.length + 'B)');
      return buf;
    } catch (e) { last = e; if (e.fatal) throw e; console.log('    attempt ' + attempt + ' failed: ' + e.message); await sleep(2500 * attempt); }
  }
  throw last;
}
async function opaqueCoverage(buf) {
  const { data } = await sharp(buf).ensureAlpha().resize(160, 90, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let on = 0, n = 0;
  for (let i = 3; i < data.length; i += 4) { n++; if (data[i] > 200) on++; }
  return on / n;
}

fs.mkdirSync(SAMPLE_DIR, { recursive: true });
const want = process.argv.slice(2).filter((a) => SETS[a]);
await Promise.all((want.length ? want : Object.keys(SETS)).map(async (k) => {
  const v = SETS[k];
  let raw = null, cov = 0;
  for (let round = 1; round <= 2 && cov < 0.95; round++) {
    const cand = await makeImage(v.prompt), c = await opaqueCoverage(cand);
    console.log(`[${k}] ${v.label}: coverage ${(c * 100).toFixed(1)}%`);
    if (!raw || c > cov) { raw = cand; cov = c; }
  }
  const out = path.join(SAMPLE_DIR, `title_pop_${k}${TAG}.png`);
  fs.writeFileSync(path.join(SAMPLE_DIR, `title_pop_${k}${TAG}_raw.png`), await sharp(raw).png().toBuffer());
  await sharp(raw).flatten({ background: GROUND }).resize(W, H, { fit: 'cover' }).png().toFile(out + '.tmp.png');
  fs.renameSync(out + '.tmp.png', out);
  console.log(`[${k}] -> ${out}` + (cov < 0.95 ? '  (still a cut-out - do not use)' : ''));
}));
console.log('Samples written. Promote one with --pick=a|b|c');
