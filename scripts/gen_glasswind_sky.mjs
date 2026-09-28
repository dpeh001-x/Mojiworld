// GLASSWIND SKY PASS - put a painted sky behind a cut-out Glasswind landscape from gen_glasswind_backdrop.mjs.
// ludo returns those landscapes with the sky removed; this flattens one onto a mood gradient (sky above, dark navy
// ground band below) and asks /assets/image/edit to repaint ONLY the gradient as a painted sky (n=2 per job).
// The edit endpoint returns full opaque 1344x768 images.
//   LUDO_API_KEY=... node scripts/gen_glasswind_sky.mjs <dir> '[["a_roll1_xxx.png","a","A1"],["b_roll1_xxx.png","b","B1"]]'
//   -> <dir>/<tag>_flat.png (the input) and <dir>/<tag>_sky1.png, <tag>_sky2.png
// Shipped: A1_sky1 -> Glasswind Steppe, B1_sky1 -> Razor Plains.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); const fs = require('node:fs'); const path = require('node:path');
const API = 'https://api.ludo.ai/api', KEY = process.env.LUDO_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [DIR, JOBS] = [process.argv[2], JSON.parse(process.argv[3])];   // [[file, mood, tag], ...]
const MOOD = {
  a: { top: '#f6d9a8', mid: '#a9dcea', sky: 'a clear early-morning sky: pale gold low near the horizon rising into soft aqua and light blue at the top, a few thin wispy clouds lit gold by a low sun on the left' },
  b: { top: '#141a4a', mid: '#2c3f86', sky: 'a deep indigo night sky full of small stars, with a sweeping ribbon of green and violet aurora across it' },
  c: { top: '#8aa2bf', mid: '#dfe8f2', sky: 'a dramatic bright windstorm sky of towering white and slate-blue clouds torn sideways by the wind, with shafts of sunlight' },
};
async function ludo(route, body) {
  const res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(300000), body: JSON.stringify(body) });
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 200)}`);
  let j = JSON.parse(txt);
  if (res.status === 202 && j.id) { const id = j.id; let w = Number(j.poll_after_ms) || 5000;
    for (let i = 0; ; i++) { if (i > 90) throw new Error('timeout'); await sleep(Math.max(4000, w));
      let r; try { r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) }); } catch (e) { continue; }
      if (r.status === 429) continue; const k = await r.json();
      if (k.status === 'succeeded') { j = k.result; break; } if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status + ' ' + JSON.stringify(k.error || '').slice(0, 150));
      w = Number(k.poll_after_ms) || w; } }
  return j;
}
async function cov(buf) { const { data } = await sharp(buf).ensureAlpha().resize(160, 90, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }); let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 245) n++; return n / 14400; }
await Promise.all(JOBS.map(async ([file, mood, tag]) => {
  const src = path.join(DIR, file), m = await sharp(src).metadata(), W = m.width, H = m.height, M = MOOD[mood];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${M.top}"/><stop offset="0.62" stop-color="${M.mid}"/><stop offset="0.74" stop-color="#1f3f5c"/><stop offset="1" stop-color="#10233a"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;
  const flat = await sharp(Buffer.from(svg)).composite([{ input: await sharp(src).ensureAlpha().png().toBuffer() }]).png().toBuffer();
  fs.writeFileSync(path.join(DIR, `${tag}_flat.png`), flat);
  const uri = 'data:image/png;base64,' + (await sharp(flat).resize(1536, null).png().toBuffer()).toString('base64');
  const prompt = `Keep the frozen glass landscape, its dunes, arches, spires, the distant mansion and the dark ground band EXACTLY as they are. `
    + `Repaint ONLY the plain smooth gradient sky as ${M.sky}, in the same painterly anime game-background style. `
    + `The image must stay a full opaque rectangle painted edge to edge, no transparency, no text, no characters.`;
  try {
    const d = await ludo('assets/image/edit', { image: uri, prompt, n: 2 });
    const list = Array.isArray(d) ? d : [d]; let i = 0;
    for (const it of list) { if (!it || !it.url) continue; i++;
      const buf = Buffer.from(await (await fetch(it.url)).arrayBuffer()), mm = await sharp(buf).metadata(), c = await cov(buf);
      fs.writeFileSync(path.join(DIR, `${tag}_sky${i}.png`), await sharp(buf).png().toBuffer());
      console.log(`${tag}_sky${i}: ${mm.width}x${mm.height} ${(c * 100).toFixed(0)}% opaque`); }
  } catch (e) { console.log(tag, 'failed', e.message); }
}));
