// POP-PUNK TREASURE CHESTS (v0.30.x chest-pop, redesigned). Per user: "work on the chest sprites open and unopened to make them
// look more pop and punk style", then of a sticker pass: "remove the stars and lightning, what i meant was the whole design of the
// chest and the outline, redo" - direction "C - chubby cartoon". scripts/gen_chest_pop.mjs: ONE new chest design (a puffy rounded
// lid wider than the body, a fat hand-inked outline, glossy highlights, a round keyhole) in wood, and silver / gold made from it by
// changing only the materials; each open chest made from its closed one. Then (per user) "for the gold chest can make it look more
// grand": the gold pair is a royal version - crown crest, ruby lock, filigree, red velvet - in a larger box with the same bottom row. And "silver one can be a little more embellished as well": engraved
// scrollwork, studs, corner guards and a blue sapphire, in a box between the two - the size climbs with the value.
//   node scripts/chest_pop_test.mjs          (CHEST_DIR=<dir> to check staged art)
// drawChests stretches the whole 768 canvas into the chest's box and plants the shadow from the art's content bottom, so each
// sprite must keep the pre-pop content box: the same bottom row (+-2 px) and nothing outside the old box.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const DIR = process.env.CHEST_DIR ? path.resolve(process.env.CHEST_DIR) : path.join(ROOT, 'Sprites', 'objects');
// the content boxes (trim threshold 4) on the 768 canvas: [left, top, width, height]; wood keeps the pre-pop boxes, silver and the grand
// gold pair has larger ones with the same bottom row
const BOX = { chest_wood: [75, 147, 616, 464], chest_wood_open: [48, 0, 673, 768], chest_silver: [40, 150, 688, 511],
  chest_silver_open: [0, 64, 768, 704], chest_gold: [24, 60, 720, 555], chest_gold_open: [0, 0, 768, 768] };
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const rows = [];
for (const [key, [L, T, W, H]] of Object.entries(BOX)) {
  const f = path.join(DIR, key + '.webp');
  if (!fs.existsSync(f)) { rows.push({ key, missing: true }); continue; }
  const buf = fs.readFileSync(f), m = await sharp(buf).metadata();
  const { info: t } = await sharp(buf).trim({ threshold: 4 }).toBuffer({ resolveWithObject: true });
  const l = -t.trimOffsetLeft, top = -t.trimOffsetTop, bottom = top + t.height, right = l + t.width;
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let blue = 0; for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (data[i + 3] >= 200 && b > 140 && b - r > 70 && b - g > 40) blue++; }
  let pink = 0; for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (data[i + 3] >= 200 && r > 180 && g < 90 && b > 90 && b < 200) pink++; }
  rows.push({ key, size: m.width + 'x' + m.height, h: t.height, blue, bottom, oldBottom: T + H, inside: l >= L - 2 && top >= T - 2 && right <= L + W + 2 && bottom <= T + H + 2, pink });
}
check(rows.every((r) => !r.missing && r.size === '768x768'), 'all six chest sprites (three tiers, closed and open) are present at 768 x 768', rows.map((r) => r.key + ' ' + (r.size || 'missing')));
check(rows.every((r) => r.inside && Math.abs(r.bottom - r.oldBottom) <= 2), 'each keeps its content box - same bottom row, nothing outside - so chests draw the same size and sit on the same spot',
  rows.filter((r) => !(r.inside && Math.abs(r.bottom - r.oldBottom) <= 2)));
check(rows.every((r) => r.pink < 100), 'no stickers: no hot-pink star decals (the sticker pass carried 1,200-3,900 hot-pink pixels per chest)', rows.map((r) => r.key + ' ' + r.pink));
const hOf = (k) => (rows.find((r) => r.key === k) || {}).h || 0;
const blueOf = (k) => (rows.find((r) => r.key === k) || {}).blue || 0;
const [hw, hs, hg] = ['chest_wood', 'chest_silver', 'chest_gold'].map(hOf);
check(hg >= 1.12 * hw && hg > hs, `the gold chest is the grand one - the tallest, at least 12% taller than wood (${hg} vs wood ${hw}, silver ${hs} px)`);
check(hs >= 1.05 * hw && hs < hg, `the silver chest sits between them - at least 5% taller than wood, shorter than gold (${hs} px; before it was 481 px, barely above wood)`);
check(blueOf('chest_silver') >= 500 && blueOf('chest_silver_open') >= 500, `the silver chest is embellished - a sapphire on its lock, closed and open (${blueOf('chest_silver')} / ${blueOf('chest_silver_open')} sapphire px; every earlier silver: 0)`);
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
