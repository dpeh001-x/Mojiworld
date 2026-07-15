// gen_gravitos_meteor_blue.mjs — bluish replacement for Gravitos' chaseComets
// meteor (Sprites/projectiles/p_comet.png). Two modes:
//   node scripts/gen_gravitos_meteor_blue.mjs            # generate N candidates
//   node scripts/gen_gravitos_meteor_blue.mjs --install K # install candidate K
//
// Candidates are written to the scratchpad preview dir (not the repo) so
// rejects never get committed. Install backs up the old sprite first.
// Needs LUDO_API_KEY. Renderer expects mode:'orient' → core/head points +x
// (right), trail streaking left; 768x768 transparent PNG.
import sharp from 'sharp';
import { writeFile, mkdir, readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const REPO = process.cwd();
const DEST = `${REPO}/Sprites/projectiles/p_comet.png`;
const BACKUP = `${REPO}/Sprites/projectiles/_backup/p_comet_pink_pre_blue.png`;
const PREVIEW = process.env.METEOR_PREVIEW_DIR
  || 'C:/Users/Xenon/AppData/Local/Temp/claude/C--Users-Xenon-Desktop-Mojiworld/9083e3fe-54a2-484f-aa5b-becd472911d2/scratchpad/meteor_blue';

const PROMPT =
  'A MASSIVE, devastating cosmic meteor projectile for a 2D anime action game — ' +
  'an overwhelmingly powerful attack. A huge dense molten rock core at the RIGHT ' +
  'end, cracked open with blazing white-hot blue fissures and a searing star-' +
  'bright plasma center, wrapped in a crackling orb of arcing electric-blue ' +
  'lightning and a violent shockwave ring of energy. Behind it a thick, ' +
  'turbulent comet tail of intense electric-blue and cyan fire, plasma and ' +
  'shattered ice shards streaking far to the LEFT with heavy motion blur and ' +
  'trailing sparks. Vibrant electric blue, cyan and teal with deep navy rock, ' +
  'brilliant white-hot core and glowing rune-like energy veins. Epic, imposing, ' +
  'high-impact, destructive. Thick bold cel-shaded outline, dramatic volumetric ' +
  'glow and bloom, strong horizontal motion pointing to the right, single object ' +
  'centered, full transparent background, no text, no border, no background panel.';

const args = process.argv.slice(2);
const installIdx = args.includes('--install') ? Number(args[args.indexOf('--install') + 1]) : null;

async function fitCanvas(raw) {
  let content; try { content = await sharp(raw).trim({ threshold: 14 }).toBuffer(); } catch { content = raw; }
  const CANVAS = 768, INNER = Math.round(CANVAS * 0.9);
  const inner = await sharp(content).resize(INNER, INNER, { fit: 'inside', withoutEnlargement: false }).png().toBuffer();
  return sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toBuffer();
}

async function install(k) {
  const src = `${PREVIEW}/cand_${k}.png`;
  if (!existsSync(src)) { console.error(`candidate ${k} not found at ${src}`); process.exit(1); }
  await mkdir(`${REPO}/Sprites/projectiles/_backup`, { recursive: true });
  if (existsSync(DEST) && !existsSync(BACKUP)) await copyFile(DEST, BACKUP);
  const buf = await readFile(src);
  const meta = await sharp(buf).metadata();
  if (meta.width !== 768 || meta.height !== 768) { console.error(`bad dims ${meta.width}x${meta.height}`); process.exit(1); }
  const tmp = DEST + '.tmp';
  await writeFile(tmp, buf);
  await sharp(tmp).metadata(); // verify decodable
  const { rename } = await import('node:fs/promises');
  await rename(tmp, DEST);
  console.log(`installed candidate ${k} -> Sprites/projectiles/p_comet.png (backup: ${existsSync(BACKUP) ? 'yes' : 'n/a'})`);
}

async function generate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 150000);
  const N = Number(process.env.METEOR_N || 4);
  await mkdir(PREVIEW, { recursive: true });
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: N, augment_prompt: false, prompt: PROMPT }),
  });
  if (!res.ok) throw new Error(`image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const urls = (Array.isArray(data) ? data : (data?.images || [])).map(x => x?.url || x).filter(Boolean);
  if (!urls.length && data?.url) urls.push(data.url);
  if (!urls.length) throw new Error('no urls in response: ' + JSON.stringify(data).slice(0, 200));
  let i = 0;
  for (const url of urls) {
    i++;
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    const raw = Buffer.from(await r.arrayBuffer());
    const out = await fitCanvas(raw);
    await writeFile(`${PREVIEW}/cand_${i}.png`, out);
    console.log(`cand_${i}.png written`);
  }
  console.log(`\n${i} candidates in ${PREVIEW}\nReview, then: node scripts/gen_gravitos_meteor_blue.mjs --install <K>`);
}

if (installIdx != null) install(installIdx);
else generate().catch(e => { console.error('FAIL:', e.message); process.exit(2); });
