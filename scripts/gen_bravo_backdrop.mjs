// Backdrop art for Bravo's Blessing card (v0.30.461). Per user: "make an aesthetic background image
// for this, beautify this UI even more".
//
//   LUDO_API_KEY=... node scripts/gen_bravo_backdrop.mjs
//
// A modal backdrop is not a poster: text sits on top of it, so it is authored DARK, low-contrast and
// centre-quiet on purpose — detail lives at the edges where nothing is written. The card also lays a
// scrim over it, so anything bright here fights the copy rather than supporting it. Verified after
// writing: the centre band's mean luminance must stay low enough for white text to clear a
// comfortable contrast ratio, and the script REFUSES to ship art that fails that.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'ui', 'bravo_backdrop.webp');
const W = 1024, H = 640;                     // ~1.6:1, the card's shape; blitted with cover-fit
const CENTRE_MAX_LUM = 62;                   // 0-255 mean over the middle band where the copy sits

const PROMPT = [
  'A dark, moody fantasy interface backdrop for a reward screen. Deep indigo and near-black violet',
  'gradient, softly vignetted so the centre is quiet and almost empty. Around the outer edges:',
  'faint golden constellation lines, drifting motes of warm light, and the suggestion of an immense',
  'stone spire stair receding into shadow. A muted rose-gold glow low in the corners. Painterly,',
  'atmospheric, very low contrast, no text, no characters, no icons, no bright focal point, nothing',
  'in the middle third — the middle must stay dark and uncluttered. Subtle film grain, elegant,',
  'restrained, cinematic key art background.',
].join(' ');

const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function makeImage(prompt) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      const j = await res.json();
      const url = Array.isArray(j) ? (j[0] && j[0].url) : (j && (j.url || (j.images && j.images[0] && j.images[0].url)));
      if (!url) throw new Error('no image url in response: ' + JSON.stringify(j).slice(0, 200));
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (!buf || buf.length < 2000) throw new Error('image too small');
      return buf;
    } catch (e) { lastErr = e; console.log(`  attempt ${attempt} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 2500 * attempt)); }
  }
  throw lastErr;
}

// Mean luminance of the middle band — where the heading, the tray and the three offers sit.
async function centreLuminance(buf) {
  const img = sharp(buf);
  const meta = await img.metadata();
  const bandTop = Math.floor(meta.height * 0.18), bandH = Math.floor(meta.height * 0.64);
  const bandLeft = Math.floor(meta.width * 0.10), bandW = Math.floor(meta.width * 0.80);
  const st = await sharp(buf).extract({ left: bandLeft, top: bandTop, width: bandW, height: bandH }).greyscale().stats();
  return st.channels[0].mean;
}

console.log('Bravo backdrop — requesting art…');
let buf = await makeImage(PROMPT);
let lum = await centreLuminance(buf);
console.log(`  centre-band mean luminance: ${lum.toFixed(1)} (max ${CENTRE_MAX_LUM})`);

// Darken toward the target rather than re-rolling forever: a linear pull keeps the art's character
// and is exactly what the in-game scrim would otherwise have to do at runtime, every frame.
if (lum > CENTRE_MAX_LUM) {
  const k = Math.max(0.25, CENTRE_MAX_LUM / lum);
  console.log(`  too bright for text — pulling luminance by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  lum = await centreLuminance(buf);
  console.log(`  after: ${lum.toFixed(1)}`);
}
if (lum > CENTRE_MAX_LUM + 6) { console.error('REFUSING: centre band still too bright for white copy.'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tmp = OUT + '.tmp';
await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 88 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const final = await sharp(OUT).metadata();
const finalLum = await centreLuminance(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${final.width}x${final.height}  centre lum ${finalLum.toFixed(1)}`);
if (finalLum > CENTRE_MAX_LUM + 6) { console.error('REFUSING: written file is too bright.'); process.exit(1); }
console.log('OK');
