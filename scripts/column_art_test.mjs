// COLUMN STRIKE ART READS AS LIGHT. Per user, with a screenshot of Path's Bane's Tomb Column: "the weird green column
// ... ensure that it is made much nicer and check if other monsters are using the same or similar style of art".
// His beam was a hard-edged rectangle of flat green stripes over a fully opaque near-black band (62% of its opaque
// pixels dark) that also ran into its image border; the audit found the Tomb Hexer's beam a bare thread (4% of its
// central band filled) and Archon's, the Sovereign's and Barnaby's plain bars. All five were regenerated through
// scripts/gen_boss_column_fx.mjs. drawProjectiles stretches this art to 1.6x the column width and its full height,
// so these are properties of the files themselves:
//   - THE FIVE: no opaque pixel on any border, no dark slab (<= 10% dark - the Hexer's deep-purple edge shading is 6), a real shaft (>= 70% of the central band)
//   - THE FAMILY: no fx_col_* is a dark slab (<= 40% dark - Legosaurus's bricks sit at 38) or a bare thread (>= 20%)
//   node scripts/column_art_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const sharp = require('sharp');
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
const FX = path.join(ROOT, 'Sprites', 'fx');
async function metrics(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  let border = 0, op = 0, dark = 0, band = 0, bandN = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C, a = data[i + 3];
    if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && a > 16) border++;
    const inBand = x > W * 0.3 && x < W * 0.7 && y > H * 0.1 && y < H * 0.9;
    if (inBand) bandN++;
    if (a > 128) { op++; if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < 70) dark++; if (inBand) band++; }
  }
  return { border, darkPct: +(100 * dark / Math.max(1, op)).toFixed(1), bandPct: +(100 * band / Math.max(1, bandN)).toFixed(1) };
}
const FIVE = ['pathsbane', 'archon', 'sovereign', 'tombhexer', 'barnaby'];
for (const k of FIVE) {
  const m = await metrics(path.join(FX, `fx_col_${k}.webp`));
  check(m.border === 0, `${k}: no opaque pixel touches the image border (a stretched beam shows a hard cut there)`, m);
  check(m.darkPct <= 10, `${k}: reads as light, not a dark slab (<= 10% of its opaque pixels dark; the old Path's Bane beam was 62)`, m);
  check(m.bandPct >= 70, `${k}: a real shaft, not a thread (>= 70% of its central band filled)`, m);
}
const all = fs.readdirSync(FX).filter((n) => /^fx_col_.*\.webp$/.test(n)).sort();
const bad = [];
for (const n of all) { const m = await metrics(path.join(FX, n)); if (m.darkPct > 40 || m.bandPct < 20) bad.push({ n, ...m }); }
check(all.length >= 15 && bad.length === 0, `the family (${all.length} column arts): none is a dark slab or a bare thread`, bad);
// the casters still name these files
const src = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const named = FIVE.filter((k) => src.includes(`sprite:'fx_col_${k}'`) || src.includes(`fx_col_${k}:`));
check(named.length === FIVE.length, 'the game still names all five (casters + LX_FX registry)', named);
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
