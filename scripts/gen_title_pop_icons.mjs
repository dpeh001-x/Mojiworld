// Pop sticker icons for the title menu (New Game, Co-op, Settings, Save Backups), per user: "perhaps we can do
// something to the rectangular modal and icons" + "the ornate gold frame can be changed to more pop punk style".
// The painted gold badges (Sprites/ui/menu/menu_*.webp) are left in place; these are new files beside them.
//   LUDO_API_KEY=... ICON_OUT=<dir> node scripts/gen_title_pop_icons.mjs [newgame coop settings backups]
//   ICON_OUT=<dir> node scripts/gen_title_pop_icons.mjs --pick   (copies <dir>/pop_*.webp into Sprites/ui/menu/)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.ICON_OUT || path.join(ROOT, 'scripts', '_tmp_pop_icons');
const FINAL_DIR = path.join(ROOT, 'Sprites', 'ui', 'menu');
const SIZE = 256;
const STYLE = 'pop art sticker icon, thick bold black ink outline, flat bright colours in hot pink, acid yellow and '
  + 'cyan, a little halftone dot shading, cute and punchy, centred, game menu icon, no text, no letters, transparent background';
const ICONS = {
  newgame: `A single magic feather quill pen with a sparkle star at its tip, ${STYLE}`,
  coop: `Two cute cartoon hands doing a high five with a small starburst between them, ${STYLE}`,
  settings: `A single chunky cog gear with a round hole in the middle, ${STYLE}`,
  backups: `A single small treasure chest with a lightning bolt on its lid, ${STYLE}`,
  // the Continue card's class badge (was the gold class crest), per user: "for the class icon it could be more fitting"
  class_warrior: `A single short sword crossed over a round shield, ${STYLE}`,
  class_mage: `A single wizard hat with a star on it and a small glowing magic wand, ${STYLE}`,
  class_rogue: `A single curved dagger with a small skull charm on the hilt, ${STYLE}`,
  class_archer: `A single wooden bow with an arrow nocked, ${STYLE}`,
};

if (process.argv.includes('--pick')) {
  for (const k of Object.keys(ICONS)) {
    const src = path.join(OUT, `pop_${k}.webp`);
    if (!fs.existsSync(src)) { console.error('missing ' + src); process.exit(1); }
    const dst = path.join(FINAL_DIR, `menu_pop_${k}.webp`);
    fs.copyFileSync(src, dst + '.tmp'); fs.renameSync(dst + '.tmp', dst);
    console.log('wrote ' + path.relative(ROOT, dst));
  }
  process.exit(0);
}
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }) });
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
      return Buffer.from(await dl.arrayBuffer());
    } catch (e) { last = e; if (e.fatal) throw e; console.log('    attempt ' + attempt + ' failed: ' + e.message); await sleep(2500 * attempt); }
  }
  throw last;
}
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2).filter((a) => ICONS[a]);
await Promise.all((want.length ? want : Object.keys(ICONS)).map(async (k) => {
  const raw = await makeImage(ICONS[k]);
  fs.writeFileSync(path.join(OUT, `pop_${k}_raw.png`), raw);
  // trim the empty margin, then contain at ~88% on a transparent square
  const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 8 }).toBuffer();
  const inner = Math.round(SIZE * 0.88);
  const fit = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  const out = path.join(OUT, `pop_${k}.webp`);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fit, gravity: 'centre' }]).webp({ quality: 90, alphaQuality: 90 }).toFile(out + '.tmp.webp');
  fs.renameSync(out + '.tmp.webp', out);
  console.log(`[${k}] -> ${out}`);
}));
