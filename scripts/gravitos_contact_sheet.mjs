// Contact sheet for a generated Gravitos cast set — the gates measure, this
// shows. Two user reports of shipped cutoffs both passed numeric checks first,
// so every set gets looked at before it lands.
//   node scripts/gravitos_contact_sheet.mjs gravitos2punch [out.png]
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
sharp.cache(false);

const KEY = process.argv[2];
if (!KEY) { console.error('usage: gravitos_contact_sheet.mjs <key> [out.png]'); process.exit(1); }
const OUT = process.argv[3] || `scripts/_tmp_sheet_${KEY}.png`;
const CELL = 250, COLS = 5, PADPX = 4;

const files = [];
for (let i = 0; i < 9; i++) {
  const p = `Sprites/bosses/attack/${KEY}_${i}.webp`;
  if (!existsSync(p)) { console.error(`missing ${p}`); process.exit(1); }
  files.push(p);
}
const rows = Math.ceil(files.length / COLS);
const W = COLS * (CELL + PADPX) + PADPX, H = rows * (CELL + PADPX) + PADPX;

// Red hairline border per cell: any body pixel touching it is a cutoff, visible
// at a glance instead of inferred from a percentage.
const comps = [];
for (let i = 0; i < files.length; i++) {
  const buf = await readFile(files[i]);
  const meta = await sharp(buf).metadata();
  const inner = await sharp(buf).resize(CELL - 2, CELL - 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const framed = await sharp({ create: { width: CELL, height: CELL, channels: 4, background: { r: 200, g: 40, b: 60, alpha: 1 } } })
    .composite([
      { input: await sharp({ create: { width: CELL - 2, height: CELL - 2, channels: 4, background: { r: 92, g: 94, b: 106, alpha: 1 } } }).png().toBuffer(), left: 1, top: 1 },
      { input: inner, left: 1, top: 1 },
    ]).png().toBuffer();
  comps.push({ input: framed, left: PADPX + (i % COLS) * (CELL + PADPX), top: PADPX + Math.floor(i / COLS) * (CELL + PADPX) });
  if (i === 0) console.log(`${KEY}: ${meta.width}x${meta.height}`);
}
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 30, g: 31, b: 38, alpha: 1 } } })
  .composite(comps).png().toFile(OUT);
console.log('->', OUT);
