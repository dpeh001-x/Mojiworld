// Pop-punk TALENT ICONS (per user: "make Sprites/talents more pop punk style as well"). Same subjects as
// generate_talent_icons.mjs (its TALENT table is read from that file, so the two never drift), redrawn in the
// house pop-punk sticker style the area icons use: thick black ink outline, flat saturated cel colour, glossy
// highlights. Writes TWO candidates per id to scripts/_tmp_talent_pop/ (gitignored) for vetting; --pick copies a
// choice to Sprites/talents/<id>.webp at the 86% fill generate_talent_icons.mjs uses. Then run
// normalize_talent_rims.mjs on the picked ids so every icon keeps the uniform 2 px (on the card) white rim.
//   LUDO_API_KEY=... node scripts/gen_talent_icons_pop.mjs [id ...]          generate candidates
//   node scripts/gen_talent_icons_pop.mjs --pick id=1,id2=2 ...               ship picks
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..');
const OUT = process.env.TALENT_POP_OUT || path.join(HERE, '_tmp_talent_pop');
const SRC = fs.readFileSync(path.join(HERE, 'generate_talent_icons.mjs'), 'utf8');
const TALENT = (() => { const a = SRC.indexOf('const TALENT = {'), b = SRC.indexOf('\n};', a); return new Function('return ' + SRC.slice(a + 'const TALENT = '.length, b + 2))(); })();
const STYLE = 'a single die-cut sticker icon, pop punk cartoon style, thick bold black ink outline around the whole shape and its inner details, '
  + 'flat cel shading in the subject\'s OWN natural colours (keep its real materials: steel stays steel, blood stays crimson, scales stay green), made bold and saturated, '
  + 'crisp glossy white highlights, strong contrast, no rainbow, no neon, no extra colours added, '
  + 'one or two tiny white sparkle stars, clean vector sticker look, chunky and bold, readable at a small size, the whole subject fully inside the frame '
  + 'and centred with a wide empty margin on every side, nothing cropped, no drop shadow, no ground, no glow halo, no halftone dots, no background scene, '
  + 'no frame, no badge, no circle or tile behind it, no text, no letters, transparent background. The subject: ';
// optional per-id emphasis for a re-roll, e.g. TALENT_POP_EXTRA={"m_deathward":"the red glow is the main colour"}
const EXTRA = process.env.TALENT_POP_EXTRA ? JSON.parse(process.env.TALENT_POP_EXTRA) : {};
const SIZE = 256, FILL = 0.86, CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
async function normalize(buf) {   // trim to the real alpha bounds, letterbox to 86% and pad - as generate_talent_icons.mjs does
  const inner = Math.round(SIZE * FILL), pad = Math.round((SIZE - inner) / 2);
  const fitted = await sharp(await sharp(buf).trim({ threshold: 4 }).toBuffer()).resize(inner, inner, { fit: 'contain', background: CLEAR }).toBuffer();
  return sharp(fitted).extend({ top: pad, bottom: pad, left: pad, right: pad, background: CLEAR }).webp({ lossless: true, alphaQuality: 100, effort: 6 }).toBuffer();
}
const argv = process.argv.slice(2);
if (argv[0] === '--pick') {
  for (const p of argv.slice(1).join(',').split(',').filter(Boolean)) {
    const [id, n] = p.split('='); const src = path.join(OUT, `${id}_${n}.png`);
    if (!TALENT[id] || !fs.existsSync(src)) { console.error('no candidate ' + src); process.exit(1); }
    const dst = path.join(ROOT, 'Sprites', 'talents', id + '.webp');
    fs.writeFileSync(dst + '.tmp', await normalize(fs.readFileSync(src))); fs.renameSync(dst + '.tmp', dst);
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
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n, augment_prompt: false, prompt }) });
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
const ids = argv.length ? argv : Object.keys(TALENT);
for (const id of ids) {
  if (!TALENT[id]) { console.log('skip unknown', id); continue; }
  if (fs.existsSync(path.join(OUT, `${id}_2.png`))) { console.log('have', id); continue; }
  process.stdout.write(id + ' ... ');
  const bufs = await makeImages(STYLE + TALENT[id] + (EXTRA[id] ? ', ' + EXTRA[id] : '') + '.', 2);
  for (let i = 0; i < bufs.length; i++) fs.writeFileSync(path.join(OUT, `${id}_${i + 1}.png`), await sharp(bufs[i]).png().toBuffer());
  console.log(bufs.length + ' candidates');
}
