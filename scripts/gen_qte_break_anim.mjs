#!/usr/bin/env node
// QTE_BREAK 9-frame shatter animation from the chosen still (candidate 3),
// via ludo.ai /assets/sprite/animate — the same path the mage bolt used.
//
// The existing set is 9 frames at 952x952 (qte_break_0..8). A still alone
// would freeze the effect, so the pick has to be animated before it ships.
// Every frame is composited into ONE shared 952 box so the burst cannot
// jitter between frames.
//   node scripts/gen_qte_break_anim.mjs             # dry-run
//   node scripts/gen_qte_break_anim.mjs --generate  # needs LUDO_API_KEY
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(repoRoot, 'scripts', '_style_pack', 'qte_break', 'qte_break_c3.webp');
const OUT_DIR = join(repoRoot, 'scripts', '_style_pack', 'qte_break_anim');
const FRAMES = 9, SIZE = 952;
const MOTION =
  'A single shatter burst expanding outward: the white-hot core flashes bright and blooms, the golden glass shards ' +
  'fly outward away from the centre and spread apart, the impact ring expands and thins, and everything fades as it ' +
  'travels. The burst stays CENTRED in frame the whole time — no drifting, no rotation, no camera move, no new objects ' +
  'entering. Clean stylised energy shatter on a fully transparent background.';

if (!process.argv.includes('--generate')) {
  console.log('qte_break — 9 frames @ ' + SIZE + ' from ' + BASE.replace(repoRoot, '.'));
  console.log('\n' + MOTION);
  console.log('\nRe-run with --generate (needs LUDO_API_KEY). Writes candidates only; install is separate.');
  process.exit(0);
}
if (!existsSync(BASE)) { console.error('base still missing: ' + BASE); process.exit(1); }
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

async function fetchBuf(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('fetch ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
// Lifted verbatim from gen_bolt_anim.mjs rather than re-derived: despite
// individual_frames:true the endpoint answers with a SPRITESHEET
// ({spritesheet_url, num_cols, num_rows}) and only sometimes with
// individual_frame_urls. A hand-written {frames:[]} reader sees zero frames.
async function framesFrom(data, n) {
  if (data.spritesheet_url && data.num_cols && data.num_rows) {
    const cols = data.num_cols, rows = data.num_rows;
    const sheet = await fetchBuf(data.spritesheet_url), meta = await sharp(sheet).metadata();
    const cw = Math.floor(meta.width / cols), ch = Math.floor(meta.height / rows), o = [];
    for (let r = 0; r < rows && o.length < n; r++) for (let c = 0; c < cols && o.length < n; c++)
      o.push(await sharp(sheet).extract({ left: c * cw, top: r * ch, width: cw, height: ch }).png().toBuffer());
    if (o.length >= n) return o;
  }
  const urls = data.individual_frame_urls || [];
  if (urls.length >= n) { const o = []; for (let i = 0; i < n; i++) o.push(await fetchBuf(urls[i])); return o; }
  throw new Error('no usable frames in response: ' + JSON.stringify(data).slice(0, 200));
}
const normalise = (buf) => sharp(buf)
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 92 }).toBuffer();

await mkdir(OUT_DIR, { recursive: true });
const uri = 'data:image/png;base64,' +
  (await sharp(await readFile(BASE)).resize(990, 990, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()).toString('base64');
let last;
for (let attempt = 1; attempt <= 4; attempt++) {
  try {
    process.stdout.write('animate qte_break attempt ' + attempt + ' ... ');
    const res = await fetch(`${API}/assets/sprite/animate`, {
      method: 'POST',
      headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(600000),
      body: JSON.stringify({ initial_image: uri, motion_prompt: MOTION, frames: FRAMES, frame_size: -9, model: 'eagle', individual_frames: true }),
    });
    if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 160));
    const bufs = await framesFrom(await res.json(), FRAMES);
    for (let i = 0; i < FRAMES; i++) await writeFile(join(OUT_DIR, `qte_break_${i}.webp`), await normalise(bufs[i]));
    console.log('OK — wrote ' + FRAMES + ' frames to scripts/_style_pack/qte_break_anim/');
    process.exit(0);
  } catch (e) {
    last = e; console.log('fail: ' + String(e.message).slice(0, 140));
    if (attempt < 4) await new Promise((s) => setTimeout(s, 5000 * attempt));
  }
}
console.error('FAILED: ' + (last && last.message));
process.exit(1);
