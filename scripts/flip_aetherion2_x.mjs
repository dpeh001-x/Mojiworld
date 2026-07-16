// flip_aetherion2_x.mjs — mirror every aetherion2 sprite horizontally (per
// user: "For aetherion2 flip x axis"). Hardbakes the flip into the art so the
// game, animator and any other consumer all see the new facing. Git history
// is the backup. EBUSY-retry writes (AV scanner locks fresh files).
import sharp from 'sharp';
import { writeFile, readFile } from 'node:fs/promises';
import { globSync } from 'node:fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function writeRetry(dest, buf) {
  for (let i = 0; i < 20; i++) {
    try { await writeFile(dest, buf); return; }
    catch (e) { if (e.code === 'EBUSY' || e.code === 'EPERM') { await sleep(500); continue; } throw e; }
  }
  throw new Error('write still locked: ' + dest);
}

const files = [
  'Sprites/bosses/aetherion2.png',
  ...['idle', 'walk', 'attack'].flatMap(st =>
    Array.from({ length: 9 }, (_, i) => `Sprites/bosses/${st}/aetherion2_${i}.webp`)),
];

for (const f of files) {
  const src = await readFile(f);
  const meta = await sharp(src).metadata();
  const out = f.endsWith('.png')
    ? await sharp(src).flop().png().toBuffer()
    : await sharp(src).flop().webp({ quality: 95 }).toBuffer();
  const m2 = await sharp(out).metadata();
  if (m2.width !== meta.width || m2.height !== meta.height) throw new Error(`dim change on ${f}`);
  await writeRetry(f, out);
  console.log(`flopped ${f} (${meta.width}x${meta.height})`);
}
console.log('done — ' + files.length + ' files mirrored');
