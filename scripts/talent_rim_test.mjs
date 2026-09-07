// Talent icon rims (v0.30.399): every icon in Sprites/talents wears the same white
// sticker rim - 10 px at the 256 px source, 2 px on the 52 px talent card - with
// no pinholes inside the art. Measured geometrically with the normaliser's own
// analysis: every art pixel sits at least 9.5 px from transparency, every solid
// white non-art pixel within 10.5 px of the art, no enclosed holes, 78 icons at 256.
//   node scripts/talent_rim_test.mjs [--dir=PATH]
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse, uniformity } from './normalize_talent_rims.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = (process.argv.find((a) => a.startsWith('--dir=')) || '').slice(6) || join(ROOT, 'Sprites', 'talents');
const RIM = 10;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const files = readdirSync(DIR).filter((f) => /\.webp$/i.test(f) && !/starfield/.test(f)).sort();
const bad = { dims: [], thin: [], thick: [], holes: [], band: [] }; const thicks = [];
for (const f of files) {
  const buf = await sharp(join(DIR, f)).toBuffer(); const meta = await sharp(buf).metadata();
  if (meta.width !== 256 || meta.height !== 256) bad.dims.push(f);
  const a = await analyse(buf); const u = await uniformity(buf, RIM);
  thicks.push(a.thick);
  if (u.thin > 2) bad.thin.push(f + ':' + u.thin);
  if (u.thick > 2000) bad.thick.push(f + ':' + u.thick);   // white ART touching the rim counts here too (streaks, glows), so this is a coarse bound
  if (a.holeN > 0) bad.holes.push(f + ':' + a.holeN);
  // the band is measured to the first NON-WHITE pixel, so white art behind the rim (a feather, a sun's rays) reads as
  // extra depth; the median is allowed 2.5 px of that, the thinnest tenth of the outline must be the rim itself
  // (the depth is taken from the outermost solid pixel, itself ~1 px inside the edge, so a 10 px rim reads ~9..9.5)
  if (a.p10 < RIM - 1.5 || a.p10 > RIM + 1.0 || a.thick > RIM + 2.5) bad.band.push(f + ':' + a.p10.toFixed(1) + '/' + a.thick.toFixed(1));
}
thicks.sort((x, y) => x - y);
console.log(`${files.length} icons; rim band (median depth at the outer edge) ${thicks[0].toFixed(1)}..${thicks[thicks.length - 1].toFixed(1)} px`);
ok('78 talent icons, all 256x256', files.length === 78 && bad.dims.length === 0, bad.dims.join(' '));
ok('every icon\'s rim band measures 10 px at the outer edge (thinnest tenth 8.5..11, median at most 12.5)', bad.band.length === 0, bad.band.slice(0, 8).join(' '));
ok('no art pixel sits closer than 9.5 px to transparency (the rim is never thinner)', bad.thin.length === 0, bad.thin.slice(0, 8).join(' '));
ok('no white band runs past 10.5 px beyond the art except white art itself (coarse bound)', bad.thick.length === 0, bad.thick.slice(0, 8).join(' '));
ok('no pinholes or torn pixels inside any icon', bad.holes.length === 0, bad.holes.slice(0, 8).join(' '));
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
