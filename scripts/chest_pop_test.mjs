// POP-PUNK TREASURE CHESTS (v0.30.x chest-pop, redesigned). Per user: "work on the chest sprites open and unopened to make them
// look more pop and punk style", then of a sticker pass: "remove the stars and lightning, what i meant was the whole design of the
// chest and the outline, redo" - direction "C - chubby cartoon". scripts/gen_chest_pop.mjs: ONE new chest design (a puffy rounded
// lid wider than the body, a fat hand-inked outline, glossy highlights, a round keyhole) in wood, and silver / gold made from it by
// changing only the materials; each open chest made from its closed one. Then (per user) "for the gold chest can make it look more
// grand": the gold pair is a royal version - crown crest, ruby lock, filigree, red velvet - in a larger box with the same bottom row.
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
// the content boxes (trim threshold 4) on the 768 canvas: [left, top, width, height]; wood / silver keep the pre-pop boxes, the grand
// gold pair has larger ones with the same bottom row
const BOX = { chest_wood: [75, 147, 616, 464], chest_wood_open: [48, 0, 673, 768], chest_silver: [51, 180, 663, 481],
  chest_silver_open: [0, 124, 768, 644], chest_gold: [24, 60, 720, 555], chest_gold_open: [0, 0, 768, 768] };
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
  rows.push({ key, size: m.width + 'x' + m.height, h: t.height, bottom, oldBottom: T + H, inside: l >= L - 2 && top >= T - 2 && right <= L + W + 2 && bottom <= T + H + 2, pink });
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] & b[k]) i++; if (a[k] | b[k]) u++; } return i / u; };
check(rows.every((r) => !r.missing && r.size === '768x768'), 'all six chest sprites (three tiers, closed and open) are present at 768 x 768', rows.map((r) => r.key + ' ' + (r.size || 'missing')));
check(rows.every((r) => r.inside && Math.abs(r.bottom - r.oldBottom) <= 2), 'each keeps its content box - same bottom row, nothing outside - so chests draw the same size and sit on the same spot',
  rows.filter((r) => !(r.inside && Math.abs(r.bottom - r.oldBottom) <= 2)));
check(rows.every((r) => r.pink < 100), 'no stickers: no hot-pink star decals (the sticker pass carried 1,200-3,900 hot-pink pixels per chest)', rows.map((r) => r.key + ' ' + r.pink));
const ws = masks.chest_wood && masks.chest_silver ? iou(masks.chest_wood, masks.chest_silver) : 0;
const hOf = (k) => (rows.find((r) => r.key === k) || {}).h || 0;
check(ws >= 0.98, `the wood and silver chests share ONE design - silhouette overlap ${ws.toFixed(3)} >= 0.98 (the original shapes: 0.93)`);
check(hOf('chest_gold') >= 1.12 * Math.max(hOf('chest_wood'), hOf('chest_silver')), `the gold chest is the grand one - it stands at least 12% taller than the others (${hOf('chest_gold')} vs ${Math.max(hOf('chest_wood'), hOf('chest_silver'))} px; before it was the smallest)`);
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
