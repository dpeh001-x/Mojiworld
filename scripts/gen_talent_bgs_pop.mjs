// Pop-punk TALENT CARD BACKDROPS (per user: "make Sprites/talents more pop punk style as well", backdrops included).
// Same 27 scenes as generate_talent_backgrounds.mjs (its BG table is read from that file, so the two never drift),
// redrawn as pop-punk comic plates: ink outlines, flat saturated colour in the scene's own palette, a graphic comic sky.
// Halftone only as a light accent and no neon (the house palette rule). Writes TWO candidates per id to
// scripts/_tmp_talent_bg_pop/ (gitignored); --pick trims the sprite endpoint's uniform border and cover-crops to the
// 512 x 384 card plate, exactly as generate_talent_backgrounds.mjs does.
//   LUDO_API_KEY=... node scripts/gen_talent_bgs_pop.mjs [id ...]
//   node scripts/gen_talent_bgs_pop.mjs --pick id=1,id2=2 ...
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');
const OUT = process.env.TALENT_BG_POP_OUT || path.join(HERE, '_tmp_talent_bg_pop');
const SRC = fs.readFileSync(process.env.TALENT_BG_SRC || path.join(HERE, 'generate_talent_backgrounds.mjs'), 'utf8');
const BG = (() => { const a = SRC.indexOf('const BG = {'), b = SRC.indexOf('\n};', a); return new Function('return ' + SRC.slice(a + 'const BG = '.length, b + 2))(); })();
const PREFIX = 'A pop punk comic-book fantasy ENVIRONMENT ILLUSTRATION - a wide landscape scene viewed from a distance, like a game background plate. '
  + 'The scenery fills the whole rectangular image and continues past all four edges. '
  + 'Bold black ink outlines on every shape, flat saturated cel-shaded colour in the scene\'s own palette, crisp graphic clouds, a few radiating comic '
  + 'speed-line rays in the sky, strong contrast, halftone dots only as a light accent in the deepest shadows, no neon, no rainbow colours. '
  + 'NO people, NO characters, NO creatures, NO faces, NO close-up objects in front of the camera, NO frames, NO borders, NO UI, NO logo. '
  + 'NO TEXT of any kind: no letters, numbers, words or watermark. The scene is: ';
const W = 512, H = 384;
const argv = process.argv.slice(2);
if (argv[0] === '--pick') {
  for (const p of argv.slice(1).join(',').split(',').filter(Boolean)) {
    const [id, n] = p.split('='); const src = path.join(OUT, `${id}_${n}.png`);
    if (!BG[id] || !fs.existsSync(src)) { console.error('no candidate ' + src); process.exit(1); }
    let img = sharp(fs.readFileSync(src));
    try { img = sharp(await img.trim({ threshold: 12 }).toBuffer()); } catch (e) { /* nothing to trim */ }
    const dst = path.join(ROOT, 'Sprites', 'talents', 'bg', id + '.webp');
    fs.writeFileSync(dst + '.tmp', await img.resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 82, effort: 5 }).toBuffer());
    fs.renameSync(dst + '.tmp', dst);
    console.log('picked', id, n);
  }
  process.exit(0);
}
const key = process.env.LUDO_API_KEY; if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollJob(job) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job timeout');
    await sleep(wait);
    let r; try { r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) }); } catch (e) { wait = Math.min(30000, wait * 1.5); continue; }
    if (r.status === 429) { wait = Math.min(30000, wait * 1.7); continue; }
    if (!r.ok) throw new Error('job HTTP ' + r.status);
    const j = await r.json();
    if (j.status === 'succeeded' || j.status === 'completed') return j;
    if (['failed', 'error', 'cancelled'].includes(j.status)) throw new Error('job ' + j.status);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || wait));
  }
}
async function makeImages(prompt, n) {
  let last;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, { method: 'POST', signal: AbortSignal.timeout(150000),
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_4_3', n, augment_prompt: false, prompt }) });
      if (res.status === 402) throw Object.assign(new Error('out of credits'), { fatal: true });
      if (res.status === 429) { await sleep(20000 * attempt); continue; }
      if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      if (res.status === 202 || (j && j.id && j.status && !j.url)) j = await pollJob(j);
      const urls = (Array.isArray(j.result) ? j.result : [j.result || j]).map((x) => x && x.url).filter(Boolean);
      if (!urls.length) throw new Error('no url');
      return Promise.all(urls.map(async (u) => { for (let t = 1; ; t++) { try { const d = await fetch(u, { signal: AbortSignal.timeout(150000) }); return Buffer.from(await d.arrayBuffer()); } catch (e) { if (t >= 5) throw e; await sleep(4000 * t); } } }));
    } catch (e) { last = e; if (e.fatal) throw e; console.log('    attempt ' + attempt + ' failed: ' + e.message); await sleep(8000 * attempt); }
  }
  throw last;
}
fs.mkdirSync(OUT, { recursive: true });
for (const id of (argv.length ? argv : Object.keys(BG))) {
  if (!BG[id]) { console.log('skip unknown', id); continue; }
  if (fs.existsSync(path.join(OUT, `${id}_2.png`))) { console.log('have', id); continue; }
  process.stdout.write(id + ' ... ');
  const bufs = await makeImages(PREFIX + BG[id] + '.', 2);
  for (let i = 0; i < bufs.length; i++) fs.writeFileSync(path.join(OUT, `${id}_${i + 1}.png`), await sharp(bufs[i]).png().toBuffer());
  console.log(bufs.length + ' candidates');
}
