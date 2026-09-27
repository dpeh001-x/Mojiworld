// POP-PUNK TREASURE CHESTS (v0.30.x chest-pop, redesigned). Per user: "work on the chest sprites open and unopened to make them
// look more pop and punk style", then of a sticker pass: "remove the stars and lightning, what i meant was the whole design of the
// chest and the outline, redo" - direction "C - chubby cartoon". scripts/gen_chest_pop.mjs: ONE new chest design (a puffy rounded
// lid wider than the body, a fat hand-inked outline, glossy highlights, a round keyhole) in wood, and silver / gold made from it by
// changing only the materials; each open chest made from its closed one.
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
// the pre-pop content boxes (trim threshold 4) on the 768 canvas: [left, top, width, height]
const BOX = { chest_wood: [75, 147, 616, 464], chest_wood_open: [48, 0, 673, 768], chest_silver: [51, 180, 663, 481],
  chest_silver_open: [0, 124, 768, 644], chest_gold: [76, 189, 615, 426], chest_gold_open: [0, 102, 768, 666] };
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const rows = [], masks = {};
for (const [key, [L, T, W, H]] of Object.entries(BOX)) {
  const f = path.join(DIR, key + '.webp');
  if (!fs.existsSync(f)) { rows.push({ key, missing: true }); continue; }
  const buf = fs.readFileSync(f), m = await sharp(buf).metadata();
  const { data: tb, info: t } = await sharp(buf).trim({ threshold: 4 }).toBuffer({ resolveWithObject: true });
  const l = -t.trimOffsetLeft, top = -t.trimOffsetTop, bottom = top + t.height, right = l + t.width;
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let pink = 0; for (let i = 0; i < data.length; i += 4) { const r = data[i], g = data[i + 1], b = data[i + 2]; if (data[i + 3] >= 200 && r > 180 && g < 90 && b > 90 && b < 200) pink++; }
  const s = await sharp(tb).resize(128, 128, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  masks[key] = Uint8Array.from({ length: 128 * 128 }, (_, i) => (s[i * 4 + 3] > 128 ? 1 : 0));
  rows.push({ key, size: m.width + 'x' + m.height, bottom, oldBottom: T + H, inside: l >= L - 2 && top >= T - 2 && right <= L + W + 2 && bottom <= T + H + 2, pink });
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] & b[k]) i++; if (a[k] | b[k]) u++; } return i / u; };
check(rows.every((r) => !r.missing && r.size === '768x768'), 'all six chest sprites (three tiers, closed and open) are present at 768 x 768', rows.map((r) => r.key + ' ' + (r.size || 'missing')));
check(rows.every((r) => r.inside && Math.abs(r.bottom - r.oldBottom) <= 2), 'each keeps its content box - same bottom row, nothing outside - so chests draw the same size and sit on the same spot',
  rows.filter((r) => !(r.inside && Math.abs(r.bottom - r.oldBottom) <= 2)));
check(rows.every((r) => r.pink < 100), 'no stickers: no hot-pink star decals (the sticker pass carried 1,200-3,900 hot-pink pixels per chest)', rows.map((r) => r.key + ' ' + r.pink));
const closed = ['chest_wood', 'chest_silver', 'chest_gold'];
const pairs = masks.chest_wood && masks.chest_silver && masks.chest_gold ? [[0, 1], [0, 2], [1, 2]].map(([a, b]) => iou(masks[closed[a]], masks[closed[b]])) : [0];
check(Math.min(...pairs) >= 0.98, `the three closed tiers share ONE design - silhouette overlap ${pairs.map((x) => x.toFixed(3)).join(' / ')} >= 0.98 (the original three shapes: 0.93-0.95)`);
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
