// Generates the desktop app icon set for the Steam/Electron build from the
// canonical Mojiworld icon (assets/mojiworld_icon_512.png):
//   steam/build/icon.ico — multi-size ICO (PNG-compressed entries, Vista+)
//   steam/build/icon.png — 512px PNG for the Linux/Steam Deck build
// Usage: node scripts/gen_app_icon.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const SRC = 'assets/mojiworld_icon_512.png';
const OUT_DIR = 'steam/build';
const SIZES = [16, 24, 32, 48, 64, 128, 256];

mkdirSync(OUT_DIR, { recursive: true });

const pngs = [];
for (const size of SIZES) {
  const buf = await sharp(SRC)
    .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  pngs.push({ size, buf });
}

// ICO container: ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes each) + payloads.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);

const entries = [];
let offset = 6 + 16 * pngs.length;
for (const { size, buf } of pngs) {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
  e.writeUInt8(size === 256 ? 0 : size, 1); // height
  e.writeUInt8(0, 2);  // palette count
  e.writeUInt8(0, 3);  // reserved
  e.writeUInt16LE(1, 4);  // color planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  entries.push(e);
}

const ico = Buffer.concat([header, ...entries, ...pngs.map(p => p.buf)]);
writeFileSync(`${OUT_DIR}/icon.ico`, ico);

await sharp(SRC).resize(512, 512).png().toFile(`${OUT_DIR}/icon.png`);

console.log(`wrote ${OUT_DIR}/icon.ico (${ico.length} bytes, sizes ${SIZES.join('/')})`);
console.log(`wrote ${OUT_DIR}/icon.png (512px)`);
