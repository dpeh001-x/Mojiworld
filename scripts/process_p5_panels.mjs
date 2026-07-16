// process_p5_panels.mjs — bake Higgsfield Persona-5 shop/enhance art into
// drop-in UI panels matching Sprites/ui/panel_p5.webp: 1200x670, full-colour
// art at uniform ~30% alpha (A mean 77/255) so it composites lightly over the
// modal's dark radial base. Atomic write (tmp -> rename).
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function writeRetry(dest, buf) {
  for (let i = 0; i < 20; i++) {
    try { await writeFile(dest, buf); return; }
    catch (e) { if (e.code === 'EBUSY' || e.code === 'EPERM') { await sleep(500); continue; } throw e; }
  }
  throw new Error('write still locked: ' + dest);
}

const SC = 'C:/Users/Xenon/AppData/Local/Temp/claude/C--Users-Xenon-Desktop-Mojiworld/9083e3fe-54a2-484f-aa5b-becd472911d2/scratchpad/p5_panels';
const W = 1200, H = 670, ALPHA = 0.20;   // v0.29.x — per user: 30% -> 20% opacity

const JOBS = [
  { src: `${SC}/shop_src.png`,    dest: 'Sprites/ui/panel_p5_shop.webp' },
  { src: `${SC}/enhance_src.png`, dest: 'Sprites/ui/panel_p5_enhance.webp' },
];

for (const { src, dest } of JOBS) {
  const rgb = await sharp(src).resize(W, H, { fit: 'cover', position: 'center' }).removeAlpha().toBuffer();
  const buf = await sharp(rgb).ensureAlpha(ALPHA).webp({ quality: 90 }).toBuffer();
  const m = await sharp(buf).metadata();  // verify decode before writing
  if (m.width !== W || m.height !== H || !m.hasAlpha) throw new Error(`bad output ${dest}: ${m.width}x${m.height} alpha=${m.hasAlpha}`);
  await writeRetry(dest, buf);
  const st = (await sharp(dest).stats()).channels.map(c => Math.round(c.mean));
  console.log(`${dest}  ${m.width}x${m.height}  means(RGBA)=${st.join(',')}`);
}
