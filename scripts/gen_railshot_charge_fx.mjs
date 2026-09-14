// The Railshot overcharge effect, per user: "make a good sprite for additional effects on ludo.ai".
// =============================================================================
// Railshot gains a hold-to-charge (up to +150% damage and a longer rail). The charge needs something
// to look at while it builds and something to punctuate the release, so this authors ONE sprite used
// for both: a tight convergence of energy rings pulled inward to a white-hot core, drawn head-on so it
// reads at any rotation. It is scaled by the charge level at draw time and again at release.
//
// Gated, not eyeballed:
//   TRANSPARENT     the sprite is composited over the world, so a filled background is a hard fail -
//                   the corners must be clear and the frame must be mostly empty
//   CENTRED + ROUND it is drawn at the bow and at the muzzle, so the ink must sit in the middle and be
//                   roughly as wide as it is tall, or it slides off the anchor when scaled
//   COOL            Railshot's beam is #66ccff / #aaddff; art that comes back warm would clash with
//                   the beam it is supposed to belong to, so hue is measured
//
//   LUDO_API_KEY=... node scripts/gen_railshot_charge_fx.mjs [--keep]
// =============================================================================
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'fx', 'railshot_charge.webp');
// 1024, not 512: the overcharge is drawn up to ~760 px wide at a full draw, and a 512 source went
// soft at that size. The gates below are resolution-independent.
const SIZE = Number((process.argv.find((a) => a.startsWith('--size=')) || '--size=1024').slice(7));
const KEEP = process.argv.includes('--keep');

const PROMPT = [
  'Game VFX sprite, fully transparent background, alpha only - no scene, no floor, no character, no',
  'text, no watermark, no border. ONE centred effect: a violent railgun overcharge at the instant before',
  'firing - four dense concentric rings of electric energy crushing inward onto a blinding white-hot',
  'core that flares outward in a star, with MANY thick forked lightning bolts arcing between every ring,',
  'crackling filaments filling the space inside the rings, and bright sparks and motes spiralling in.',
  'Packed with detail and energy, overwhelming and powerful, not a thin empty ring. Ice blue and cyan',
  '(#66ccff, #aaddff) with a pure white centre. Crisp cel-shaded anime game art, bold clean edges,',
  'high contrast, glowing. Perfectly centred, circular overall silhouette, generous empty margin on',
  'all four sides. No background wash, no rectangle, no card, no frame.',
].join(' ');

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 2026-09-11: /assets/image answers 202 with a JOB; the finished job at GET /assets/jobs/<id> carries
// result: [{url}]. An unpolled job is still paid for.
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
async function makeImage() {
  let last = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite-vfx', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: PROMPT }),
      });
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url && !(j.result && j.result.url))) j = await pollJob(j);
      const url = j.url || (j.result && j.result.url) || (Array.isArray(j.result) && j.result[0] && j.result[0].url);
      if (!url) throw new Error('no url in response: ' + JSON.stringify(j).slice(0, 160));
      const dl = await fetch(url, { signal: AbortSignal.timeout(150000) });
      if (!dl.ok) throw new Error('download HTTP ' + dl.status);
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < 8000) throw new Error('suspiciously small (' + buf.length + 'B)');
      const img = await sharp(buf).ensureAlpha().resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      const m = await measure(img);
      console.log(`  attempt ${attempt}: transparent ${m.clearPct.toFixed(0)}%  corners ${m.cornerInk.toFixed(1)}%  aspect ${m.aspect.toFixed(2)}  cool ${m.coolPct.toFixed(0)}%  centre off ${m.centreOff.toFixed(2)}`);
      const why = [];
      if (m.clearPct < 40) why.push('only ' + m.clearPct.toFixed(0) + '% of the frame is clear - it came back as a filled card');
      // and the opposite failure: a thin open ring reads as weak at the size this is drawn. The first
      // 1024 roll came back sparser than the 512 it replaced, which is how this gate got written.
      if (m.inkPct < 20) why.push('only ' + m.inkPct.toFixed(0) + '% ink - a thin empty ring, not an overcharge');
      if (m.cornerInk > 2) why.push('ink in the corners (' + m.cornerInk.toFixed(1) + '%) - there is a background or a frame');
      if (m.aspect < 0.72 || m.aspect > 1.38) why.push('silhouette aspect ' + m.aspect.toFixed(2) + ' - not round enough to sit on an anchor');
      if (m.coolPct < 55) why.push('only ' + m.coolPct.toFixed(0) + '% of the ink is cool - it would clash with the cyan beam');
      if (m.centreOff > 0.16) why.push('ink centre is ' + (m.centreOff * 100).toFixed(0) + '% off frame centre');
      if (!why.length) return img;
      console.log('    rejected: ' + why.join('; '));
      if (KEEP) fs.writeFileSync(path.join(ROOT, 'scripts', '_tmp_railcharge_try' + attempt + '.png'), img);
      last = new Error(why[0]);
    } catch (e) { last = e; console.log('  attempt ' + attempt + ' failed: ' + e.message); }
    await sleep(1500 * attempt);
  }
  throw last;
}
async function measure(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let clear = 0, ink = 0, cool = 0, corner = 0, cornerTot = 0;
  let x0 = W, x1 = -1, y0 = H, y1 = -1, sx = 0, sy = 0;
  const CORNER = Math.round(W * 0.14);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, a = data[i + 3];
    const inCorner = (x < CORNER || x >= W - CORNER) && (y < CORNER || y >= H - CORNER);
    if (inCorner) { cornerTot++; if (a > 40) corner++; }
    if (a <= 24) { clear++; continue; }
    ink++; sx += x; sy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (b >= r) cool++;                                  // blue at least as strong as red = cool
  }
  const bw = Math.max(1, x1 - x0 + 1), bh = Math.max(1, y1 - y0 + 1);
  return {
    clearPct: 100 * clear / (W * H),
    inkPct: 100 * ink / (W * H),
    cornerInk: 100 * corner / Math.max(1, cornerTot),
    aspect: bw / bh,
    coolPct: ink ? 100 * cool / ink : 0,
    centreOff: ink ? Math.hypot(sx / ink - W / 2, sy / ink - H / 2) / W : 1,
  };
}

const img = await makeImage();
const out = await sharp(img).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toBuffer();
fs.writeFileSync(OUT + '.tmp', out); fs.renameSync(OUT + '.tmp', OUT);
console.log(`wrote ${path.relative(ROOT, OUT)} - ${(out.length / 1024).toFixed(0)} KB, ${SIZE}x${SIZE}`);
