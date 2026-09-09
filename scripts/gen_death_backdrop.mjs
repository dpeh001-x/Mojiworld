// Backdrop art for the Amnesiac's death beat (v0.30.472). Per user: "generate a nice apt background
// for this when dead, also improve on the fonts".
//
//   LUDO_API_KEY=... node scripts/gen_death_backdrop.mjs
//
// The death beat is a full-screen overlay with a centred column of serif text on it, so this is
// authored the same way the Bravo backdrop was: DARK, low-contrast, and deliberately empty through
// the middle, with what little there is pushed to the edges. It also has a second job the Bravo card
// did not — the death panel underneath (the tombstone, "oops!", the coin and EXP losses, the respawn
// timer) was reading straight through the old translucent gradient and colliding with the prose.
// The centre-band luminance is measured after generating and the script REFUSES art too bright to
// carry white text.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Sprites', 'ui', 'death_backdrop.webp');
const W = 1600, H = 900;                     // 16:9 — this one covers the whole screen, not a card
const CENTRE_MAX_LUM = 40;                   // stricter than the Bravo card: nothing sits between
                                             // this art and the text, and it must also hide the
                                             // death panel behind it

const PROMPT = [
  'A sombre, funereal fantasy backdrop. Near-black indigo and cold violet, very softly vignetted so',
  'the middle is almost empty darkness. Around the far edges only: a few pale ash motes drifting',
  'upward, the faintest suggestion of weathered stone grave markers lost in fog at the very bottom',
  'corners, and a single cold shaft of moonlight falling from the upper left, dim and diffuse.',
  'A hint of dead violet mist along the lower edge. Painterly, atmospheric, extremely low contrast,',
  'melancholy and quiet. No text, no characters, no skulls, no icons, no bright focal point, and',
  'absolutely nothing in the middle third — the centre must stay dark and uncluttered. Subtle grain,',
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

// The API returns a CUT-OUT sprite with a transparent ground, and greyscale() reads transparent
// pixels as black — so measuring the raw result scored a confident 10/255 for an image that would
// have rendered as a white void over the death panel. Everything is flattened onto the opaque
// backdrop colour FIRST, so both the measurement and the shipped file describe the same pixels.
const GROUND = { r: 9, g: 6, b: 20 };
async function flatten(buf) { return sharp(buf).flatten({ background: GROUND }).toBuffer(); }
async function centreLuminance(buf) {
  const meta = await sharp(buf).metadata();
  const st = await sharp(buf).extract({
    left: Math.floor(meta.width * 0.12), top: Math.floor(meta.height * 0.20),
    width: Math.floor(meta.width * 0.76), height: Math.floor(meta.height * 0.60),
  }).greyscale().stats();
  return st.channels[0].mean;
}

console.log('Death backdrop — requesting art…');
let buf = await flatten(await makeImage(PROMPT));
let lum = await centreLuminance(buf);
console.log(`  centre-band mean luminance: ${lum.toFixed(1)} (max ${CENTRE_MAX_LUM})`);
if (lum > CENTRE_MAX_LUM) {
  const k = Math.max(0.2, CENTRE_MAX_LUM / lum);
  console.log(`  too bright for the prose — pulling luminance by x${k.toFixed(2)}`);
  buf = await sharp(buf).linear(k, 0).toBuffer();
  lum = await centreLuminance(buf);
  console.log(`  after: ${lum.toFixed(1)}`);
}
if (lum > CENTRE_MAX_LUM + 5) { console.error('REFUSING: centre band still too bright.'); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const tmp = OUT + '.tmp';
await sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' }).webp({ quality: 86 }).toFile(tmp);
fs.renameSync(tmp, OUT);
const meta = await sharp(OUT).metadata();
const finalLum = await centreLuminance(fs.readFileSync(OUT));
console.log(`wrote ${path.relative(ROOT, OUT)}  ${meta.width}x${meta.height}  centre lum ${finalLum.toFixed(1)}`);
if (finalLum > CENTRE_MAX_LUM + 5) { console.error('REFUSING: written file is too bright.'); process.exit(1); }
console.log('OK');
