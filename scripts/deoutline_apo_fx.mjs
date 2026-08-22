#!/usr/bin/env node
// Thin the black outline on the Elemental Apotheosis projectile art (per user:
// "the elemental apotheosis projectiles sprites and animation has too thick of
// a black outline, please reduce or regenerate them").
//
// WHY A PEEL AND NOT A REGENERATION: the four catastrophes' shapes are good and
// the animations are already timed to them; re-rolling 4 stills + 36 frames
// risks losing that for a problem that is purely the rim. This trims the rim
// off the art that exists, deterministically and re-runnably.
//
// WHY IT IS NOT "DELETE THE DARK PIXELS": measured on the shipped art, 80% of
// p_apo_void's opaque pixels are dark — because a SINGULARITY is a black core
// ringed in purple. A luminance filter would erase the sprite. The outline is
// distinguished by TOPOLOGY, not by colour: it is the dark band that touches
// transparency. So this peels the alpha BOUNDARY one ring at a time and only
// removes a pixel if it is dark; an enclosed dark core is never on the
// boundary, so it survives untouched. Peeling stops naturally at the first
// bright ring, which is why an over-large --rings is self-limiting rather than
// destructive.
//
//   node scripts/deoutline_apo_fx.mjs              # dry run: measure, write nothing
//   node scripts/deoutline_apo_fx.mjs --apply      # rewrite the art in place
//   flags: --rings=N (default 8)  --lum=N (default 70)  --only=<key>
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const num = (n, d) => { const v = (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1]; return v == null ? d : Number(v); };
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

const RINGS = num('rings', 8);      // max boundary rings to peel (8 chosen from a 4/8/12 visual sweep: rim gone, interiors untouched)
const LUM   = num('lum', 70);       // 0-255: "dark enough to be outline"
const KEYS  = ['p_apo_fire', 'p_apo_ice', 'p_apo_lightning', 'p_apo_void'].filter(k => !only || k.includes(only));
const FRAMES = 9;
const exists = (p) => access(p).then(() => true, () => false);
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Peel dark rings off the alpha boundary, then soften what is left so the new
// edge does not read as a cut. Returns { buf, peeled, kept, rim }.
async function deoutline(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const aIdx = (x, y) => (y * W + x) * C + 3;
  const isOpaque = (x, y) => data[aIdx(x, y)] > 40;
  const opaque0 = (() => { let n = 0; for (let i = 3; i < data.length; i += C) if (data[i] > 40) n++; return n; })();

  let peeled = 0, ringsUsed = 0;
  for (let ring = 0; ring < RINGS; ring++) {
    const kill = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isOpaque(x, y)) continue;
        // on the boundary? (4-neighbourhood; corners are covered by the next ring)
        const edge = (x === 0 || y === 0 || x === W - 1 || y === H - 1)
          || !isOpaque(x - 1, y) || !isOpaque(x + 1, y) || !isOpaque(x, y - 1) || !isOpaque(x, y + 1);
        if (!edge) continue;
        const i = (y * W + x) * C;
        if (lum(data[i], data[i + 1], data[i + 2]) >= LUM) continue;   // bright edge = the art, keep it
        kill.push(aIdx(x, y));
      }
    }
    if (!kill.length) break;
    for (const i of kill) data[i] = 0;
    peeled += kill.length;
    ringsUsed = ring + 1;
  }

  // Soften: any surviving pixel still touching transparency gets its alpha
  // halved, so the peeled edge fades instead of ending on a hard step.
  const soft = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isOpaque(x, y)) continue;
    const edge = (x === 0 || y === 0 || x === W - 1 || y === H - 1)
      || !isOpaque(x - 1, y) || !isOpaque(x + 1, y) || !isOpaque(x, y - 1) || !isOpaque(x, y + 1);
    if (edge) soft.push(aIdx(x, y));
  }
  for (const i of soft) data[i] = Math.round(data[i] * 0.55);

  const opaque1 = (() => { let n = 0; for (let i = 3; i < data.length; i += C) if (data[i] > 40) n++; return n; })();
  const out = await sharp(data, { raw: { width: W, height: H, channels: C } }).webp({ quality: 92 }).toBuffer();
  return { buf: out, peeled, ringsUsed, before: opaque0, after: opaque1 };
}

const targets = [];
for (const k of KEYS) {
  targets.push(join(ROOT, 'Sprites', 'projectiles', `${k}.webp`));
  for (let i = 0; i < FRAMES; i++) targets.push(join(ROOT, 'Sprites', 'projectiles', 'anim', `${k}_${i}.webp`));
}

console.log(`${has('--apply') ? 'APPLY' : 'DRY RUN'} — rings<=${RINGS}, dark<${LUM} — ${targets.length} files\n`);
let totalPeeled = 0, done = 0;
for (const t of targets) {
  if (!(await exists(t))) { console.log('  (absent) ' + t.split(/[\\/]/).pop()); continue; }
  const r = await deoutline(await readFile(t));
  const pct = (100 * r.peeled / Math.max(1, r.before)).toFixed(1);
  console.log(`  ${t.split(/[\\/]/).pop().padEnd(22)} rings=${r.ringsUsed}  peeled=${String(r.peeled).padStart(6)} px (${pct}% of body)  kept=${r.after}`);
  totalPeeled += r.peeled;
  if (has('--apply')) {
    await writeFile(t + '.tmp', r.buf);
    await rename(t + '.tmp', t);   // atomic, per project convention
  }
  done++;
}
console.log(`\n${done} files, ${totalPeeled} outline px ${has('--apply') ? 'removed' : 'would be removed'}.`);
if (!has('--apply')) console.log('# Re-run with --apply to write.');
