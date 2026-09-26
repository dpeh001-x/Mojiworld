// Recolours the painted MOJIWORLD wordmark for the pop title menu, per user: "The MOjiworld colour can be better".
// A gradient map on luminance: the ink outline stays ink, the gold's shading and bevel are kept, only the palette
// changes. Writes Sprites/ui/mojiworld_logo_pop.webp (the original is untouched - the loading screen still wears it).
//   node scripts/gen_title_pop_logo.mjs [palette] [outFile]      palettes: lemon (default, the one shipped), sunset, candy, ice
//   node scripts/gen_title_pop_logo.mjs --sheet <out.png>         all palettes side by side on the card's violet
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'Sprites', 'ui', 'mojiworld_logo.webp');
const PAL = {
  sunset: [[0, '#0c0b10'], [70, '#1c0f33'], [105, '#c0126a'], [145, '#ff2e88'], [190, '#ff9a3c'], [225, '#ffe45c'], [255, '#fffbe6']],
  lemon: [[0, '#0c0b10'], [70, '#2a1a08'], [110, '#ff8a1f'], [165, '#ffd21f'], [215, '#ffe45c'], [255, '#ffffff']],
  candy: [[0, '#0c0b10'], [70, '#24103f'], [110, '#8a2bff'], [165, '#ff2e88'], [220, '#ff9ccb'], [255, '#ffffff']],
  ice: [[0, '#0c0b10'], [70, '#0d1a3a'], [110, '#1570ff'], [170, '#25e2ff'], [225, '#c8fbff'], [255, '#ffffff']],
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lut = (stops) => {
  const out = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    let k = 0; while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const [v0, c0] = stops[k], [v1, c1] = stops[k + 1], t = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    const a = hex(c0), b = hex(c1);
    for (let c = 0; c < 3; c++) out[v * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * t);
  }
  return out;
};
const srcBuf = () => fs.existsSync(SRC) ? fs.readFileSync(SRC) : execFileSync('git', ['show', 'origin/main:Sprites/ui/mojiworld_logo.webp'], { cwd: ROOT, maxBuffer: 1 << 26 });
async function recolour(name) {
  const { data, info } = await sharp(srcBuf()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const L = lut(PAL[name]);
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = L[y * 3]; data[i + 1] = L[y * 3 + 1]; data[i + 2] = L[y * 3 + 2];
  }
  return sharp(data, { raw: info });
}
const args = process.argv.slice(2);
if (args[0] === '--sheet') {
  const rows = [];
  const names = ['gold (now)', ...Object.keys(PAL)];
  for (const [i, n] of names.entries()) {
    const img = n.startsWith('gold') ? sharp(srcBuf()) : await recolour(n);
    const logo = await img.resize(620).png().toBuffer();
    const shadow = await sharp(logo).ensureAlpha().linear([0, 0, 0, 1], [12, 11, 16, 0]).png().toBuffer();
    rows.push({ input: shadow, left: 26, top: 16 + i * 150 + 5 }, { input: logo, left: 20, top: 16 + i * 150 },
      { input: Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='40'><text x='0' y='28' font-family='Arial' font-weight='bold' font-size='24' fill='#ffffff'>${n}</text></svg>`), left: 670, top: 16 + i * 150 + 40 });
  }
  await sharp({ create: { width: 880, height: names.length * 150 + 20, channels: 4, background: '#241540' } }).composite(rows).png().toFile(args[1]);
  console.log('sheet -> ' + args[1]);
} else {
  const name = args[0] || 'lemon', out = args[1] || path.join(ROOT, 'Sprites', 'ui', 'mojiworld_logo_pop.webp');
  if (!PAL[name]) { console.error('unknown palette ' + name); process.exit(1); }
  await (await recolour(name)).webp({ quality: 92, alphaQuality: 100 }).toFile(out + '.tmp.webp');
  fs.renameSync(out + '.tmp.webp', out);
  console.log(`wrote ${path.relative(ROOT, out)} (${name}) ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
