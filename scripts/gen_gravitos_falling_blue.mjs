// gen_gravitos_falling_blue.mjs — Gravitos-only BLUE falling meteor + blue
// ground marker rune, via ludo.ai. Drop-in siblings of the shared red sprites
// (kept separate so player Mage/Sage meteors + other bosses stay red).
//
//   node scripts/gen_gravitos_falling_blue.mjs meteor          # gen meteor candidates
//   node scripts/gen_gravitos_falling_blue.mjs marker          # gen marker candidates
//   node scripts/gen_gravitos_falling_blue.mjs meteor --install K
//   node scripts/gen_gravitos_falling_blue.mjs marker --install K
//
// Needs LUDO_API_KEY. Candidates go to scratchpad (rejects never committed).
import sharp from 'sharp';
import { writeFile, mkdir, readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const REPO = process.cwd();
const SCRATCH = process.env.BLUE_PREVIEW_DIR
  || 'C:/Users/Xenon/AppData/Local/Temp/claude/C--Users-Xenon-Desktop-Mojiworld/9083e3fe-54a2-484f-aa5b-becd472911d2/scratchpad/grav_blue';

const TARGETS = {
  meteor: {
    dest: `${REPO}/Sprites/projectiles/p_meteor_blue.webp`,
    W: 680, H: 680, ar: 'ar_1_1',
    prompt:
      'A MASSIVE, devastating falling meteor for a 2D anime action game — an ' +
      'overwhelmingly powerful attack plummeting straight DOWN. A huge dense ' +
      'molten rock ball core cracked open with blazing white-hot blue fissures ' +
      'and a searing plasma-bright center, topped by a towering roaring plume of ' +
      'intense electric-blue and cyan fire rising ABOVE it, wreathed in crackling ' +
      'blue lightning and shattered ice shards. Vibrant electric blue, cyan and ' +
      'teal with deep navy rock, brilliant white-hot core and glowing energy ' +
      'veins. Epic, imposing, high-impact, destructive. Thick bold cel-shaded ' +
      'outline, dramatic volumetric glow and bloom, vertical composition (flame ' +
      'on top, rock below), single object centered, full transparent background, ' +
      'no text, no border, no background panel.',
  },
  marker: {
    dest: `${REPO}/Sprites/fx/meteor_marker_blue.webp`,
    W: 1088, H: 512, ar: 'ar_16_9',
    prompt:
      'A glowing magic impact-warning rune circle laid FLAT on the ground in ' +
      'perspective (seen from above at a low angle, a wide flattened ellipse), ' +
      'for a 2D anime action game. Ancient arcane sigil ring with runes and ' +
      'jagged spikes around the rim, a bright searing white-blue plasma glow at ' +
      'the center, radiating cracks of electric-blue energy. Vibrant electric ' +
      'blue, cyan and teal with deep navy stone and brilliant white-hot core. ' +
      'Ominous, powerful, high-energy telegraph. Thick bold cel-shaded outline, ' +
      'dramatic glow and bloom, single object centered, full transparent ' +
      'background, no text, no border, no background panel.',
  },
};

const [target, ...rest] = process.argv.slice(2);
const T = TARGETS[target];
if (!T) { console.error('usage: gen_gravitos_falling_blue.mjs <meteor|marker> [--install K]'); process.exit(1); }
const installIdx = rest.includes('--install') ? Number(rest[rest.indexOf('--install') + 1]) : null;
const dir = `${SCRATCH}/${target}`;

async function fit(raw) {
  let c; try { c = await sharp(raw).trim({ threshold: 14 }).toBuffer(); } catch { c = raw; }
  const inner = await sharp(c).resize(Math.round(T.W * 0.94), Math.round(T.H * 0.94), { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: T.W, height: T.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]).webp({ quality: 92 }).toBuffer();
}

async function install(k) {
  const src = `${dir}/cand_${k}.webp`;
  if (!existsSync(src)) { console.error(`no candidate ${k} at ${src}`); process.exit(1); }
  const buf = await readFile(src);
  const m = await sharp(buf).metadata();
  if (m.width !== T.W || m.height !== T.H) { console.error(`bad dims ${m.width}x${m.height}`); process.exit(1); }
  const tmp = T.dest + '.tmp';
  await mkdir(T.dest.replace(/\/[^/]+$/, ''), { recursive: true });
  await writeFile(tmp, buf);
  await sharp(tmp).metadata();
  await rename(tmp, T.dest);
  console.log(`installed ${target} candidate ${k} -> ${T.dest.replace(REPO + '/', '')}`);
}

async function generate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
  const N = Number(process.env.BLUE_N || 4);
  await mkdir(dir, { recursive: true });
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: T.ar, n: N, augment_prompt: false, prompt: T.prompt }),
  });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const urls = (Array.isArray(data) ? data : (data?.images || [])).map(x => x?.url || x).filter(Boolean);
  if (!urls.length && data?.url) urls.push(data.url);
  if (!urls.length) throw new Error('no urls: ' + JSON.stringify(data).slice(0, 200));
  let i = 0;
  for (const url of urls) {
    i++;
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    await writeFile(`${dir}/cand_${i}.webp`, await fit(Buffer.from(await r.arrayBuffer())));
    console.log(`${target} cand_${i}.webp`);
  }
  console.log(`\n${i} candidates in ${dir}\nInstall: node scripts/gen_gravitos_falling_blue.mjs ${target} --install <K>`);
}

if (installIdx != null) install(installIdx);
else generate().catch(e => { console.error('FAIL:', e.message); process.exit(2); });
