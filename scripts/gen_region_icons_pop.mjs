// Pop-punk AREA ICONS (final-polish region-pop), one per world-map node, from scripts/region_icon_briefs.json. Per user: "regenerate
// the 83 area icons in pop punk style and make sure they are accurate (the maps should match the monsters in it)". Each brief was
// written from the map's own backdrop and its spawn list (e.g. Sauro Slope = its volcanic slope + the orange fire lizard that spawns
// there, not a generic dinosaur). Writes TWO candidates per id to scripts/_tmp_region_icons/ (gitignored) for vetting; the chosen
// one is copied to Sprites/world/regions/<id>.webp by hand. Shipped picks: option 1, except boss and boneGraveyard3 (option 2).
//   LUDO_API_KEY=... node scripts/gen_region_icons_pop.mjs [id ...]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const key = process.env.LUDO_API_KEY; if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = 'https://api.ludo.ai/api';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const OUT = path.join(HERE, '_tmp_region_icons');
const BRIEFS = JSON.parse(fs.readFileSync(path.join(HERE, 'region_icon_briefs.json'), 'utf8'));
const STYLE = 'a single compact game map icon emblem, pop punk cartoon sticker style, thick bold black ink outline around the whole shape, flat saturated '
  + 'cel shading with crisp glossy white highlights, punchy vivid colours, one or two tiny white sparkle stars, clean vector sticker look, chunky and cute, '
  + 'readable at a small size, the whole emblem fully inside the frame and centred with a wide empty margin on every side, nothing cropped, '
  + 'no drop shadow, no cast shadow, no ground plane, no glow halo, no halftone dots, no background scene, no frame, no badge, no text, no letters, transparent background';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollJob(job) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    if (Date.now() - t0 > 900000) throw new Error('job timeout');
    await sleep(wait);
    let r; try { r = await fetch(`${API}/assets/jobs/${job.id}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) }); } catch (e) { wait = Math.min(30000, wait * 1.5); continue; }   // a network blip while polling is not a failed job
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
  for (let attempt = 1; attempt <= 6; attempt++) {
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
      return Promise.all(urls.map(async (u) => { let d; for (let t = 1; ; t++) { try { d = await fetch(u, { signal: AbortSignal.timeout(150000) }); break; } catch (e) { if (t >= 5) throw e; await sleep(4000 * t); } } if (!d.ok) throw new Error('download ' + d.status); return Buffer.from(await d.arrayBuffer()); }));
    } catch (e) { last = e; if (e.fatal) throw e; console.log('    attempt ' + attempt + ' failed: ' + e.message); await sleep(8000 * attempt); }
  }
  throw last;
}
async function edgeOpaque(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let hits = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (x > 1 && y > 1 && x < info.width - 2 && y < info.height - 2) continue; if (data[(y * info.width + x) * 4 + 3] > 40) hits++; }
  return hits;
}
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2).filter((a) => BRIEFS[a]);
const todo = (want.length ? want : Object.keys(BRIEFS)).filter((id) => want.length || !(fs.existsSync(path.join(OUT, id + '_1.webp')) && fs.existsSync(path.join(OUT, id + '_2.webp'))));
const report = fs.existsSync(path.join(OUT, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'report.json'), 'utf8')) : {};
const CONC = 3; let next = 0, done = 0;
await Promise.all(Array.from({ length: CONC }, async (_, w) => {
  await sleep(w * 1500);
  while (next < todo.length) {
    const id = todo[next++];
    try {
      const raws = await makeImages(`${BRIEFS[id]}. ${STYLE}.`, 2);
      report[id] = [];
      for (let c = 0; c < raws.length; c++) {
        fs.writeFileSync(path.join(OUT, `${id}_${c + 1}_raw.png`), raws[c]);
        const edge = await edgeOpaque(raws[c]);
        const trimmed = await sharp(raws[c]).ensureAlpha().trim({ threshold: 8 }).toBuffer();
        const fit = await sharp(trimmed).resize(220, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
        await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: fit, gravity: 'centre' }]).webp({ quality: 92, alphaQuality: 95 }).toFile(path.join(OUT, `${id}_${c + 1}.webp`));
        report[id].push({ cand: c + 1, edgePx: edge });
      }
      done++; console.log(`[${done}/${todo.length}] ${id} ${JSON.stringify(report[id])}`);
      fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
    } catch (e) { console.log(`FAILED ${id}: ${e.message}`); if (e.fatal) process.exit(2); }
  }
}));
console.log('done');
