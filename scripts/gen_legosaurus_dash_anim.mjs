// Legosaurus BRACE-DASH attack frames (ludo.ai sprite/animate, eagle).
// Base: Sprites/bosses/legosaurus.webp (940x546 = 0.51MP, under the 1MP cap,
// sent unpadded). Output: 9 frames to the given dir as legosaurusdash_0..8.webp.
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
// usage: node scripts/gen_legosaurus_dash_anim.mjs   (needs LUDO_API_KEY)
const OUTDIR = process.argv[2] || 'Sprites/bosses/attack';
const key = process.env.LUDO_API_KEY;
if (!key) { console.error('LUDO_API_KEY required'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';

const PROMPT =
  'The blocky toy tyrannosaurus CROUCHES DOWN LOW and holds perfectly still in a coiled braced stance, ' +
  'head lowered, legs compressed like springs, red eyes flaring brighter — then EXPLODES forward into a ' +
  'ferocious full-speed dash lunge, body stretched horizontal, legs driving hard, jaw open, with speed ' +
  'lines and small scattering toy bricks trailing behind it. The character stays fully inside the frame ' +
  'at the SAME SCALE throughout — no zooming, no cropping, feet on the same ground line. Same blocky ' +
  'LEGO-brick art style, same colors, side view facing right.';

const base = await readFile('Sprites/bosses/legosaurus.webp');
const png = await sharp(base).png().toBuffer();
const meta = await sharp(png).metadata();
console.log('base', meta.width + 'x' + meta.height, ((meta.width * meta.height) / 1e6).toFixed(2) + 'MP');

const res = await fetch(`${API}/assets/sprite/animate`, {
  method: 'POST', headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
  signal: AbortSignal.timeout(300000),
  body: JSON.stringify({ initial_image: 'data:image/png;base64,' + png.toString('base64'),
    motion_prompt: PROMPT, frames: 9, frame_size: -9, model: 'eagle',
    individual_frames: true, loop: false, image_type: 'sprite' }),
});
if (!res.ok) throw new Error(`animate ${res.status}: ${(await res.text()).slice(0, 180)}`);
const data = await res.json();
const grab = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };
let cells = [];
if (data.spritesheet_url && data.num_cols && data.num_rows) {
  const sheet = await grab(data.spritesheet_url), sm = await sharp(sheet).metadata();
  const cw = Math.floor(sm.width / data.num_cols), chh = Math.floor(sm.height / data.num_rows);
  // grid guard — an out-of-range extract takes libvips down natively (0xC0000409)
  if (!(cw > 0 && chh > 0) || cw * data.num_cols > sm.width + 1 || chh * data.num_rows > sm.height + 1) {
    throw new Error(`bad sheet grid: ${sm.width}x${sm.height} / ${data.num_cols}x${data.num_rows}`);
  }
  console.log(`sheet ${sm.width}x${sm.height} = ${data.num_cols}x${data.num_rows} cells of ${cw}x${chh}`);
  for (let r = 0; r < data.num_rows && cells.length < 9; r++)
    for (let c = 0; c < data.num_cols && cells.length < 9; c++)
      cells.push(await sharp(sheet).extract({ left: c * cw, top: r * chh, width: cw, height: chh }).png().toBuffer());
} else { for (const u of (data.individual_frame_urls || []).slice(0, 9)) cells.push(await grab(u)); }
if (cells.length < 9) throw new Error('got ' + cells.length + ' frames');

await mkdir(OUTDIR, { recursive: true });
for (let i = 0; i < 9; i++) {
  const out = await sharp(cells[i]).resize(meta.width, meta.height, { fit: 'fill' }).webp({ quality: 88 }).toBuffer();
  await writeFile(join(OUTDIR, `legosaurusdash_${i}.webp`), out);
}
console.log('wrote 9 frames ->', OUTDIR);
