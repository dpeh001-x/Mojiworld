// Art for Bravo's Blessing (v0.30.719). Per user: "The design is good but the art can be improved,
// can generate better art and thematic for this".
//
//   LUDO_API_KEY=... node scripts/gen_bravo_art.mjs
//
// Supersedes gen_bravo_backdrop.mjs, which authored the backdrop alone and against a card that no
// longer exists. Two things were wrong with the old plate once v0.30.718 rebuilt the card as a
// centred shrine:
//
//   * it was ASYMMETRIC. Its one piece of real subject — an immense spire stair — sat hard right,
//     which read fine under three rectangles in a row and reads as a lopsided room behind three
//     arches and a plinth on a centre line.
//   * it had nothing to say about the moment. A blessing granted at a threshold wants a threshold:
//     a sanctum you have climbed to, not a stairwell you are still in.
//
// So the backdrop is a vaulted sanctum seen head-on, its vanishing point dead centre, detail carried
// by the ribs and votive light down the two edges where the card writes nothing.
//
// And a second asset the old script had no reason to make: the three picks were a flat CSS gradient.
// bravo_arch.webp is a painted stone-and-velvet panel laid inside each arch, so the shrine is made
// of material rather than of linear-gradient().
//
// Both are authored DARK and centre-quiet on purpose — copy sits on top of both — and both are
// measured after generation against a luminance ceiling the script REFUSES to ship past.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  {
    name: 'backdrop',
    out: path.join(ROOT, 'Sprites', 'ui', 'bravo_backdrop.webp'),
    w: 1024, h: 640,            // ~1.6:1, the card's shape; blitted with cover-fit
    ar: 'ar_16_9',
    maxLum: 62,                 // 0-255 mean over the middle band where the copy sits
    // The band the card actually writes into: heading, plinth, three arches.
    band: { top: 0.18, height: 0.64, left: 0.10, width: 0.80 },
    prompt: [
      'A dark, symmetrical fantasy sanctum interior, painted as a game interface backdrop.',
      'Seen straight on, perfectly centred, one-point perspective with the vanishing point in the',
      'exact middle of the frame. Deep indigo and near-black violet stone. Tall ribbed vault arches',
      'recede down BOTH sides of the frame in mirrored pairs, carved with faint gold filigree.',
      'Warm votive candlelight and slow drifting embers hug the left and right edges only.',
      'A muted rose-gold haze gathers low in both bottom corners. High above, a dim shaft of pale',
      'light falls through an unseen oculus, diffuse and cold. The middle third of the image is',
      'empty darkness — no object, no figure, no light source, nothing at all in the centre.',
      'Painterly, atmospheric, very low contrast, reverent and still. No text, no characters,',
      'no icons, no bright focal point. Subtle film grain, elegant, restrained, cinematic key art.',
    ].join(' '),
  },
  {
    name: 'arch',
    out: path.join(ROOT, 'Sprites', 'ui', 'bravo_arch.webp'),
    w: 420, h: 560,             // taller than wide — it lines the inside of one arch
    ar: 'ar_3_4',
    maxLum: 54,                 // stricter: a boon name and its effect line sit directly on this
    // Nearly the whole panel is written over, so the whole panel is measured.
    band: { top: 0.10, height: 0.84, left: 0.08, width: 0.84 },
    prompt: [
      'A dark vertical panel of deep violet velvet stretched inside a carved stone niche, painted as',
      'a game interface texture. Soft folds of aubergine and plum cloth catch a faint warm highlight',
      'near the top and fall into near-black at the bottom. Fine gold filigree traces the stone edge',
      'at the very left and right margins only. A whisper of pale dust motes. Absolutely no object,',
      'emblem, figure or symbol anywhere — the middle must be plain fabric and shadow. Painterly,',
      'seamless, extremely low contrast, muted, subtle film grain, restrained interface material.',
    ].join(' '),
  },
];

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

// The image endpoint answers with a job now (see the 2026-09-11 change); poll it out.
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

async function makeImage(prompt, ar) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        // image_type MUST be 'sprite' — 'concept_art' and 'background' are both rejected with a 400.
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ar, n: 1, augment_prompt: false, prompt }),
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

async function bandLuminance(buf, band) {
  const meta = await sharp(buf).metadata();
  const st = await sharp(buf).extract({
    left: Math.floor(meta.width * band.left), top: Math.floor(meta.height * band.top),
    width: Math.floor(meta.width * band.width), height: Math.floor(meta.height * band.height),
  }).greyscale().stats();
  return st.channels[0].mean;
}

let failed = 0;
for (const t of TARGETS) {
  console.log(`\nBravo ${t.name} — requesting art…`);
  let buf = await makeImage(t.prompt, t.ar);
  let lum = await bandLuminance(buf, t.band);
  console.log(`  band mean luminance: ${lum.toFixed(1)} (max ${t.maxLum})`);
  // Darken toward the target rather than re-rolling forever: a linear pull keeps the art's
  // character, and it is exactly what the in-game scrim would otherwise do every frame.
  if (lum > t.maxLum) {
    const k = Math.max(0.25, t.maxLum / lum);
    console.log(`  too bright for copy — pulling luminance by x${k.toFixed(2)}`);
    buf = await sharp(buf).linear(k, 0).toBuffer();
    lum = await bandLuminance(buf, t.band);
    console.log(`  after: ${lum.toFixed(1)}`);
  }
  if (lum > t.maxLum + 6) { console.error(`REFUSING ${t.name}: still too bright for the copy on it.`); failed++; continue; }
  fs.mkdirSync(path.dirname(t.out), { recursive: true });
  const tmp = t.out + '.tmp';
  await sharp(buf).resize(t.w, t.h, { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toFile(tmp);
  fs.renameSync(tmp, t.out);
  const final = await sharp(t.out).metadata();
  const finalLum = await bandLuminance(fs.readFileSync(t.out), t.band);
  console.log(`  wrote ${path.relative(ROOT, t.out)}  ${final.width}x${final.height}  band lum ${finalLum.toFixed(1)}`);
  if (finalLum > t.maxLum + 6) { console.error(`REFUSING ${t.name}: written file is too bright.`); failed++; }
}
if (failed) { console.error(`\n${failed} target(s) refused.`); process.exit(1); }
console.log('\nOK');
