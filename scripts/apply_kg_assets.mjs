// Knight GUARDIAN art drop: the approved ludo.ai loop into Sprites/.
// ============================================================================
// Run as LX_APPLY2 inside scripts/_ship_change.sh, AFTER its re-sync. That ordering is the point:
// the runner restores every tracked LX_EXTRA path from origin at the start of each round, and
// Sprites/fx/knight_guardian.webp is tracked - copied in beforehand, the old cross would be
// restored over it and shipped under a message saying it had been replaced.
//
// Source: the staging folder scripts/gen_knight_guardian_fx.mjs wrote (KG_STAGE, default
// <os tmp>/kg_stage). Every copy is read back and byte-compared, and every file is checked for ink
// on its border again here, so what ships is exactly what was reviewed and measured.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('C:/Users/dpeh0/Mojiworld/node_modules/sharp'); sharp.cache(false);

const ROOT = 'C:/Users/dpeh0/Mojiworld';
const ST = process.env.KG_STAGE || join(tmpdir(), 'kg_stage');
const pairs = [[join(ST, 'knight_guardian.webp'), join(ROOT, 'Sprites/fx/knight_guardian.webp')]];
for (let i = 0; i < 9; i++) pairs.push([join(ST, 'anim', `knight_guardian_${i}.webp`), join(ROOT, `Sprites/fx/anim/knight_guardian_${i}.webp`)]);

for (const [src] of pairs) if (!existsSync(src)) { console.error('ABORT: staged file missing: ' + src); process.exit(1); }
mkdirSync(join(ROOT, 'Sprites/fx/anim'), { recursive: true });

let copied = 0;
for (const [src, dst] of pairs) {
  const buf = readFileSync(src);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  let worst = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue;
    worst = Math.max(worst, data[(y * w + x) * ch + ch - 1]);
  }
  if (worst > 8) { console.error(`ABORT: ${src} has ink on its border (alpha ${worst})`); process.exit(1); }
  if (existsSync(dst) && Buffer.compare(readFileSync(dst), buf) === 0) continue;
  writeFileSync(dst + '.tmp', buf);
  renameSync(dst + '.tmp', dst);
  if (Buffer.compare(readFileSync(dst), buf) !== 0) { console.error('ABORT: read-back differs: ' + dst); process.exit(1); }
  copied++;
}
console.log(`applied: Guardian art in Sprites/ (${copied} of ${pairs.length} written, all ${pairs.length} byte-identical to the reviewed stage, no border ink)`);
