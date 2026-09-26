// Puts a painted POP sky behind a gen_title_pop_keyart.mjs cut-out (ludo returns the scene with an empty sky).
// Sky: violet -> hot pink -> tangerine, a sunburst from behind the menu card, Ben-Day dots thickening to the edges.
//   node scripts/compose_title_pop_keyart.mjs <raw.png> <out.webp|png>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: <raw.png> <out>'); process.exit(1); }
const W = 1920, H = 1072, CX = 960, CY = 330;
const rays = [];
for (let k = 0; k < 28; k++) {
  const a0 = (k / 28) * Math.PI * 2, a1 = a0 + Math.PI / 28, R = 2600;
  const p = (a) => `${(CX + Math.cos(a) * R).toFixed(0)},${(CY + Math.sin(a) * R).toFixed(0)}`;
  rays.push(`<polygon points='${CX},${CY} ${p(a0)} ${p(a1)}' fill='${k % 2 ? '#ffe45c' : '#ffffff'}' opacity='${k % 2 ? 0.16 : 0.07}'/>`);
}
const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
<defs>
<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
<stop offset='0' stop-color='#1d0b45'/><stop offset='0.34' stop-color='#5a1d9e'/><stop offset='0.62' stop-color='#e8318f'/><stop offset='0.86' stop-color='#ff8a5c'/><stop offset='1' stop-color='#ffc85c'/>
</linearGradient>
<radialGradient id='glow' cx='${CX / W}' cy='${CY / H}' r='0.42'><stop offset='0' stop-color='#fff4c2' stop-opacity='0.55'/><stop offset='1' stop-color='#fff4c2' stop-opacity='0'/></radialGradient>
<pattern id='dots' width='14' height='14' patternUnits='userSpaceOnUse'><circle cx='7' cy='7' r='2.4' fill='#1d0b45'/></pattern>
<radialGradient id='edge' cx='0.5' cy='0.4' r='0.75'><stop offset='0.45' stop-color='#fff' stop-opacity='0'/><stop offset='1' stop-color='#fff' stop-opacity='0.5'/></radialGradient>
<mask id='edgeMask'><rect width='${W}' height='${H}' fill='url(%23edge)'/></mask>
</defs>
<rect width='${W}' height='${H}' fill='url(#sky)'/>
${rays.join('')}
<rect width='${W}' height='${H}' fill='url(#glow)'/>
<rect width='${W}' height='${H}' fill='url(#dots)' mask='url(#edgeMask)'/>
</svg>`.replace('%23', '#');
const sky = await sharp(Buffer.from(svg)).png().toBuffer();
const art = await sharp(src).ensureAlpha().resize(W, H, { fit: 'cover' }).png().toBuffer();
let img = sharp(sky).composite([{ input: art }]);
const tmp = out + '.tmp' + (out.endsWith('.png') ? '.png' : '.webp');
if (out.endsWith('.png')) await img.png().toFile(tmp); else await img.webp({ quality: 84 }).toFile(tmp);
fs.renameSync(tmp, out);
console.log(`wrote ${out} ${(fs.statSync(out).size / 1024).toFixed(0)} KB ${W}x${H}`);
