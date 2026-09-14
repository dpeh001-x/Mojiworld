// The map pin is spherical from the mid down - and still Guguma.
// ============================================================================
//   1. MID + BOTTOM IS A CIRCLE: rms deviation < 3% of the radius (shipped: 8.1%)
//   2. THE UNDERSIDE IS FULL: it reaches > 0.85 of the radius (shipped: 0.74)
//   3. HIS TOP IS STILL HIS: the top half deviates from that circle MORE than the
//      bottom half - i.e. the cut did not shave his tuft and crown into a ball
//   4. CONTROL: the shipped pin fails check 1, so the measure discriminates
//   5. THE NEEDLE SURVIVED: the silhouette narrows to a spike under the head
//   6. THE ATLAS CARRIES IT: the packed 1f4cd cell is the installed icon
// Run: node scripts/pin_ball_test.mjs
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
sharp.cache(false);
const ROOT = 'C:/Users/dpeh0/Mojiworld';
sharp.cache(false);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

async function shape(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, rows = [];
  for (let y = 0; y < H; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 80) { if (l < 0) l = x; r = x; }
    rows.push(l < 0 ? null : { l, r, w: r - l + 1 });
  }
  const live = rows.filter(Boolean);
  const maxW = Math.max(...live.map((r) => r.w));
  const widestY = rows.findIndex((r) => r && r.w === maxW);
  let bot = widestY;
  for (let y = widestY; y < H; y++) { if (!rows[y] || rows[y].w < maxW * 0.45) break; bot = y; }
  let top = rows.findIndex(Boolean);
  const R = maxW / 2;
  const band = (a, b) => {
    let sum = 0, n = 0, worst = 0;
    for (let y = a; y <= b; y++) {
      if (!rows[y]) continue;
      const dy = y - widestY; if (Math.abs(dy) >= R) continue;
      const e = Math.abs(rows[y].w / 2 - Math.sqrt(R * R - dy * dy)) / R;
      sum += e * e; n++; if (e > worst) worst = e;
    }
    return { rms: Math.sqrt(sum / Math.max(1, n)), worst };
  };
  const lower = band(widestY, bot), upper = band(top, widestY - 1);
  // the needle: the narrowest live row below the head, and how far the art runs past the head
  let spike = maxW, deepest = bot;
  for (let y = bot + 1; y < H; y++) if (rows[y]) { spike = Math.min(spike, rows[y].w); deepest = y; }
  return { maxW, R, widestY, top, bot, lower, upper, spike, deepest, H };
}

const built = readFileSync(ROOT + '/Sprites/ui/emoji/1f4cd.webp');
const shipped = execFileSync('git', ['show', 'origin/main:Sprites/ui/emoji/1f4cd.webp'], { cwd: ROOT, maxBuffer: 32 << 20 });
const A = await shape(built), B = await shape(shipped);
console.log('  new:     ' + JSON.stringify({ rms: +(A.lower.rms * 100).toFixed(1), worst: +(A.lower.worst * 100).toFixed(1), reach: +((A.bot - A.widestY) / A.R).toFixed(2), topRms: +(A.upper.rms * 100).toFixed(1) }));
console.log('  shipped: ' + JSON.stringify({ rms: +(B.lower.rms * 100).toFixed(1), worst: +(B.lower.worst * 100).toFixed(1), reach: +((B.bot - B.widestY) / B.R).toFixed(2), topRms: +(B.upper.rms * 100).toFixed(1) }));

ok('MID + BOTTOM IS A CIRCLE: under 3% rms deviation from the circle through its widest row',
  A.lower.rms < 0.03 && A.lower.worst < 0.06, `rms ${(A.lower.rms * 100).toFixed(1)}%, worst ${(A.lower.worst * 100).toFixed(1)}% (shipped: ${(B.lower.rms * 100).toFixed(1)}% / ${(B.lower.worst * 100).toFixed(1)}%)`);
ok('THE UNDERSIDE IS FULL: it reaches past 0.85 of the radius',
  (A.bot - A.widestY) / A.R > 0.85, `${((A.bot - A.widestY) / A.R).toFixed(2)} of the radius (shipped: ${((B.bot - B.widestY) / B.R).toFixed(2)})`);
ok('HIS TOP IS STILL HIS: the crown and tuft are not cut to the circle',
  A.upper.rms > A.lower.rms * 1.5, `top ${(A.upper.rms * 100).toFixed(1)}% vs bottom ${(A.lower.rms * 100).toFixed(1)}% deviation`);
ok('CONTROL: the shipped pin fails the circle check, so the measure discriminates',
  B.lower.rms > 0.06, `shipped rms ${(B.lower.rms * 100).toFixed(1)}%`);
ok('THE NEEDLE SURVIVED: the silhouette narrows to a spike below the head',
  A.spike < A.maxW * 0.35 && A.deepest > A.bot + 4, `narrowest ${A.spike}px of a ${A.maxW}px head, running ${A.deepest - A.bot}px below it`);

// the atlas the game actually draws
global.window = {};
// eslint-disable-next-line no-eval
eval(readFileSync(ROOT + '/data/emoji_atlas.js', 'utf8'));
const AT = window.LX_EMOJI_ATLAS, idx = AT.map['1f4cd'];
const cell = await sharp(ROOT + '/Sprites/ui/emoji_atlas.webp')
  .extract({ left: (idx % AT.cols) * AT.cell, top: Math.floor(idx / AT.cols) * AT.cell, width: AT.cell, height: AT.cell })
  .ensureAlpha().raw().toBuffer();
const iconAtCell = await sharp(built).resize(AT.cell, AT.cell).ensureAlpha().raw().toBuffer();
let diff = 0;
for (let i = 3; i < cell.length; i += 4) if (Math.abs(cell[i] - iconAtCell[i]) > 40) diff++;
ok('THE ATLAS CARRIES IT: the packed cell is the new pin, and the map is intact',
  diff < AT.cell * AT.cell * 0.02 && Object.keys(AT.map).length === 386,
  `cell ${idx} differs on ${diff} of ${AT.cell * AT.cell} px, ${Object.keys(AT.map).length} icons in the map`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
