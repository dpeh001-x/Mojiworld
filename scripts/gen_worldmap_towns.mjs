// The World Map's towns (v0.30.655). Per user, after v0.30.654: "the new towns look weird, perhaps
// you could regenerate a whole new image, the town need to be accurate to how they look in game".
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_towns.mjs [--fresh] [--only <key>]
//
// Both halves of that are answered here, and the route to them was measured rather than guessed.
//
// ACCURATE TO THE GAME. All twenty maps were loaded in a browser and screenshotted before a line of
// this was written, and every prompt below describes what that screenshot shows: Everdawn Central is
// half-timbered under cherry blossom, the Megamall is a glass-roofed arcade, the Azure Academia is
// white-and-blue cathedral spires round a fountain, Frostbite Hollow is those same spires frosted
// over, Hera's Abode is a furnished room inside a floating bubble, the Shadow-Woven Hood is a dark
// street of red paper lanterns, Queen's Hollow is Mooma's honeycomb chamber. A generic village at
// the right coordinates is still the wrong town.
//
// A WHOLE NEW IMAGE was tried first and it cannot carry this. Asked for a continent WITH twenty
// described settlements, the generator paints the first few clauses and fills the rest of the map
// with identical red-roofed villages - three separate takes, all three the same failure. The prompt
// is simply longer than it follows.
//
// So each town is generated ALONE, as a sprite on a transparent background, and painted onto the
// continent at the coordinates of the node that names it. This is not what v0.30.654 did: that cut
// squares out of a second landscape, which dragged foreign grass along with every village and read
// as stickers no amount of rim-matching could fix. A sprite has no ground to bring - it lands on the
// continent's own terrain - and it is pulled through the same dusk glaze the ground was, so it
// stands in the same light.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'backgrounds', 'worldmap_bg_v4.webp');   // the continent, terrain only
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v5.webp');
const W = 1536, H = 896;                 // the ground
const NW = 1529, NH = 889;               // the node field the game authors its wmX/wmY against
const CENTRE_MAX_LUM = 66, CENTRE_MAX_P98 = 150;
const DUSK = [0x13, 0x10, 0x26], DUSK_A = 0.30;       // the ground's own glaze, applied to each town
const LIFT = 1.26;      // a town stands a little brighter than the terrain it is built on

const SHARED = ' seen from directly above, painted in a cute storybook game-map style, tiny and'
  + ' compact. Isolated on a fully transparent background - no ground, no grass, no base plate, no'
  + ' shadow, no text, no frame, no border, no characters, no people.';

// A sixth field pins a town by hand, in ground pixels, and skips the search. Three need it. Two are
// pinned by the game INSIDE the bastion's walls, where the placer can only refuse: Hera's Abode
// FLOATS, so a bubble over the courtyard is the truest thing on this map, and Frozen Peak is walked
// to the moor's edge north of the wall, the nearest ground a mountain can stand on. The third,
// Queen's Hollow, passed every test on its own coastline and still read as a ball dropped in the
// sea - the footprint check knows what is land, not what looks like it is standing on it.
//   key                nx    ny   px   what that map actually looks like when you stand in it
const TOWNS = [
  ['town',              798,  427, 122, 'One small fantasy market town of brown-tiled half-timbered houses with cream walls and dark beams, a pink cherry blossom tree over them and a little market stall'],
  ['megamall',          714,  375,  94, 'One small fantasy shopping arcade: a long pavilion with a pale glass roof, cream and pastel pink walls, striped awnings over its stalls and potted plants'],
  ['stardustAtrium',    913,  325,  80, 'One small domed hall of deep indigo and silver, its dome patterned with stars, a slim observatory tower beside it'],
  ['frozenPeak',       1012,  343,  98, 'One small snow-capped rocky peak with dark green pine trees and a little wooden lodge with a snowy roof', [1032, 292]],
  ['azureAbode',       1014,  433,  76, 'One iridescent floating soap-bubble sphere with a tiny cosy furnished pink room visible inside it', [1024, 440]],
  ['azureAcademia',    1030,  522,  94, 'One small fantasy academy: a white and pale-blue building with pointed cathedral spires and a blue tiled dome around a little round fountain'],
  ['frostbiteHollow',  1126,  459,  78, 'One small pale-blue cathedral spire and chapel frosted over, snow heaped on its roofs and icicles along its eaves'],
  ['skyGarden',        1148,  562,  88, 'Two or three small terraced garden platforms of green hedges standing on a puff of white cloud, one slim tree on the top terrace'],
  ['wildflowerPlains', 1123,  643,  82, 'One tiny hamlet of two cottages in a meadow of magenta and violet wildflowers with a pink blossom tree'],
  ['queensHollow',     1230,  763,  80, 'One small chamber of amber honeycomb hexagons opening in a mound, with a single giant pink-red mushroom cap growing from it', [1204, 736]],
  ['fungalHollow',      983,  604,  78, 'A cluster of giant red-capped white-spotted mushrooms over a mossy teal-green hollow, with two tiny round doors in the stems'],
  ['shadowWovenHood',   850,  658,  80, 'One small night-time street: three dark tiled roofs of a Japanese village hung with glowing red paper lanterns, and a small stone gate'],
  ['hiddenPagoda',      730,  607,  78, 'One small three-tiered pagoda with deep violet roofs and dark timber, a stone lantern at its foot'],
  ['jadeGrove',         959,  696,  74, 'One small wooden arched bridge over misty jade-green water, a little green-roofed pagoda beside it and two cherry trees'],
  ['emeraldVillage',    886,  774,  92, 'One small village of wooden stilt huts with mossy green roofs, hanging paper lanterns, broad jungle leaves and a pink blossom tree'],
  ['reachOfVermillion', 992,  805,  80, 'One small hall of red lacquered columns under a golden tiled roof, wide stone steps in front of it'],
  ['candyCanyon',       383,  542,  86, 'One small candy village: cliffs of pink frosting, biscuit platforms, a gummy bear and two striped lollipops'],
  ['honeycombHollow',   311,  462,  76, 'One small bright amber beehive of hexagon cells built into a mound, honey dripping from its lower combs'],
  ['frostedMansion',    505,  105,  80, 'One tall Victorian mansion with steep purple-blue roofs, a turret and lit yellow windows, snow heaped on its eaves'],
  ['fieryHideout',      266,  102,  74, 'One small cave mouth set in pink and magenta crystal rock, tall rose-coloured crystals standing around it'],
];

async function makeSprite(prompt) {
  const key = process.env.LUDO_API_KEY; if (!key) throw new Error('LUDO_API_KEY not set');
  // The service moved its prefix under us mid-session (/api/v1 began answering 404 while /api served
  // the same route), so the base is resolved at call time instead of hardcoded.
  const BASES = ['https://api.ludo.ai/api', 'https://api.ludo.ai/api/v1'];
  let API = null, lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let res = null;
      for (const b of (API ? [API] : BASES)) {
        res = await fetch(`${b}/assets/image`, {
          method: 'POST',
          headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(150000),
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }),
        });
        if (res.status !== 404) { API = b; break; }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      let j = await res.json();
      const jobId = j && (j.job_id || j.jobId || j.id || (j.job && j.job.id));
      if (jobId) {
        for (let i = 0; i < 72; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const jr = await fetch(`${API}/assets/jobs/${jobId}`, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(60000) });
          if (!jr.ok) continue;
          const js = await jr.json();
          const st = String(js.status || js.state || '').toLowerCase();
          if (/^(succeeded|success|completed|done)$/.test(st)) { j = js.result || js.output || js; break; }
          if (/^(failed|error|cancelled)$/.test(st)) throw new Error('job failed: ' + JSON.stringify(js).slice(0, 200));
        }
      }
      const pick = (o) => {
        if (!o) return null;
        if (typeof o === 'string' && /^https?:/.test(o)) return o;
        if (Array.isArray(o)) { for (const x of o) { const u = pick(x); if (u) return u; } return null; }
        if (typeof o === 'object') {
          for (const k of ['url', 'image_url', 'imageUrl', 'uri', 'src']) if (typeof o[k] === 'string' && /^https?:/.test(o[k])) return o[k];
          for (const k of ['images', 'assets', 'data', 'result', 'output', 'files']) { const u = pick(o[k]); if (u) return u; }
        }
        return null;
      };
      const url = pick(j); if (!url) throw new Error('no image url: ' + JSON.stringify(j).slice(0, 240));
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      if (!buf || buf.length < 2000) throw new Error('image too small');
      return buf;
    } catch (e) { lastErr = e; console.log(`    attempt ${attempt} failed: ${e.message}`); await new Promise((r) => setTimeout(r, 2500 * attempt)); }
  }
  throw lastErr;
}

// ---- the sprites (cached; a re-run costs nothing) ---------------------------------------------
const spritePath = (k) => path.join(ROOT, 'scripts', `_tmp_wm_town_${k}.png`);
const only = (() => { const i = process.argv.indexOf('--only'); return i < 0 ? null : process.argv[i + 1]; })();
for (const [key, , , , prompt] of TOWNS) {
  const f = spritePath(key);
  if (fs.existsSync(f) && !process.argv.includes('--fresh') && !(only && only === key)) continue;
  if (only && only !== key) continue;
  console.log(`  drawing ${key}...`);
  fs.writeFileSync(f, await makeSprite(prompt + SHARED));
}

// ---- the ground ------------------------------------------------------------------------------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const LUM = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const rd = async (f) => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const base = await rd(BASE);
if (base.w !== W || base.h !== H) throw new Error(`ground is ${base.w}x${base.h}, expected ${W}x${H}`);

function ellipseStats(img, cx, cy, rx, ry) {
  let n = 0, R = 0, G = 0, B = 0; const ls = [];
  for (let y = Math.max(0, Math.round(cy - ry)); y < Math.min(img.h, cy + ry); y += 2) {
    for (let x = Math.max(0, Math.round(cx - rx)); x < Math.min(img.w, cx + rx); x += 2) {
      const u = (x - cx) / rx, v = (y - cy) / ry; if (u * u + v * v > 1) continue;
      const i = (y * img.w + x) * 3; R += img.d[i]; G += img.d[i + 1]; B += img.d[i + 2];
      ls.push(LUM(img.d[i], img.d[i + 1], img.d[i + 2])); n++;
    }
  }
  if (!n) return { r: 0, g: 0, b: 0, lum: 0, sd: 0, n: 0 };
  const lum = ls.reduce((a, b2) => a + b2, 0) / n;
  const sd = Math.sqrt(ls.reduce((a, b2) => a + (b2 - lum) ** 2, 0) / n);
  return { r: R / n, g: G / n, b: B / n, lum, sd, n };
}
const isSea = (p) => p.b > p.r + 14 && p.b > p.g + 6 && p.lum < 62;

// Where a town may NOT be built. Colour cannot find the bastion - its courtyard is the same grass as
// the plain outside it - so the ground is reduced to a coarse grid of edge energy (painted terrain
// is smooth, built things are not), the busiest eighth is blocked, and then the holes are filled:
// any cell unreachable from the edge of the map without crossing a blocked one is enclosed BY
// structure, which is what a courtyard, a crater floor and the middle of the brick town all are.
const CELL = 16, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
const blocked = new Uint8Array(GW * GH);
{
  const eg = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    let sum = 0, cnt = 0;
    for (let y = gy * CELL; y < Math.min(H - 1, (gy + 1) * CELL); y++) for (let x = gx * CELL; x < Math.min(W - 1, (gx + 1) * CELL); x++) {
      const i = (y * W + x) * 3, l = LUM(base.d[i], base.d[i + 1], base.d[i + 2]);
      const ix = (y * W + x + 1) * 3, iy = ((y + 1) * W + x) * 3;
      sum += Math.abs(l - LUM(base.d[ix], base.d[ix + 1], base.d[ix + 2])) + Math.abs(l - LUM(base.d[iy], base.d[iy + 1], base.d[iy + 2]));
      cnt++;
    }
    eg[gy * GW + gx] = cnt ? sum / cnt : 0;
  }
  const sorted = Float32Array.from(eg).sort();
  const HOT = sorted[Math.floor(sorted.length * 0.88)];    // relative, so it survives a new ground
  for (let i = 0; i < eg.length; i++) if (eg[i] >= HOT) blocked[i] = 1;
  const grown = blocked.slice();                           // close single-cell gaps so the fill cannot leak
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    if (blocked[gy * GW + gx]) continue;
    if (blocked[gy * GW + gx - 1] && blocked[gy * GW + gx + 1] && blocked[(gy - 1) * GW + gx] && blocked[(gy + 1) * GW + gx]) grown[gy * GW + gx] = 1;
  }
  blocked.set(grown);
  const open = new Uint8Array(GW * GH), q = [];
  for (let gx = 0; gx < GW; gx++) { q.push([gx, 0], [gx, GH - 1]); }
  for (let gy = 0; gy < GH; gy++) { q.push([0, gy], [GW - 1, gy]); }
  while (q.length) {
    const [x, y] = q.pop(); if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
    const i = y * GW + x; if (open[i] || blocked[i]) continue;
    open[i] = 1; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let enclosed = 0;
  for (let i = 0; i < blocked.length; i++) if (!blocked[i] && !open[i]) { blocked[i] = 1; enclosed++; }
  const nb = blocked.reduce((a, b) => a + b, 0);
  console.log(`  keep-out: ${nb} of ${blocked.length} cells, ${(100 * nb / blocked.length).toFixed(0)}% of the map (${enclosed} enclosed by structure)`);
}
function blockedFrac(cx, cy, rx, ry) {
  let hit = 0, n2 = 0;
  for (let y = cy - ry; y <= cy + ry; y += CELL / 2) for (let x = cx - rx; x <= cx + rx; x += CELL / 2) {
    const u = (x - cx) / rx, v = (y - cy) / ry; if (u * u + v * v > 1) continue;
    const gx = clamp(Math.floor(x / CELL), 0, GW - 1), gy = clamp(Math.floor(y / CELL), 0, GH - 1);
    hit += blocked[gy * GW + gx]; n2++;
  }
  return n2 ? hit / n2 : 1;
}

// ---- prepare one town: trim to its own ink, size it, and pull it into the ground's light --------
const cache = new Map();
async function prepared(key, px, destLum, lift) {
  const ck = `${key}|${px}`;
  if (!cache.has(ck)) {
    const src = sharp(spritePath(key)).ensureAlpha();
    const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 26) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) throw new Error(`${key}: the sprite is empty`);
    const cut = await sharp(spritePath(key)).ensureAlpha()
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize({ width: px, kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    cache.set(ck, cut);
  }
  const { data: rgba, info: ri } = cache.get(ck);
  let sum = 0, n = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 128) { sum += LUM(rgba[i], rgba[i + 1], rgba[i + 2]); n++; }
  const mean = n ? sum / n : 1;
  // The sprite is drawn in daylight and the continent is glazed to dusk. Same wash, then a gain that
  // sets the town a touch above the terrain it stands on - that ratio is what makes it read as built.
  const gain = clamp((destLum * lift) / Math.max(6, mean), 0.30, 1.70);
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    for (let c = 0; c < 3; c++) out[i + c] = clamp(Math.round((out[i + c] * (1 - DUSK_A) + DUSK[c] * DUSK_A) * gain), 0, 255);
  }
  return { buf: out, w: ri.width, h: ri.height };
}

function centreStats(buf) {
  const top = Math.floor(H * 0.14), hh = Math.floor(H * 0.72), left = Math.floor(W * 0.12), ww = Math.floor(W * 0.76);
  let sum = 0, n = 0; const hist = new Array(256).fill(0);
  for (let y = top; y < top + hh; y++) for (let x = left; x < left + ww; x++) {
    const i = (y * W + x) * 3, l = Math.round(LUM(buf[i], buf[i + 1], buf[i + 2]));
    sum += l; hist[l]++; n++;
  }
  let acc = 0, p98 = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.98) { p98 = v; break; } }
  return { mean: sum / n, p98 };
}

// ---- build ------------------------------------------------------------------------------------
const RADII = [0, 16, 28, 42, 58, 76, 96];   // how far a town may be walked from its own pin
async function build(lift) {
  const ground = Buffer.from(base.d);
  const placed = [], report = [], layers = [];
  for (const [key, nx, ny, px, , at] of TOWNS) {
    const probe = await prepared(key, px, 60, lift);
    const sw = probe.w, sh = probe.h, rx = sw / 2, ry = sh / 2;
    const x0 = Math.round(nx * W / NW), y0 = Math.round(ny * H / NH);
    // A town is judged by its FOOTPRINT, not its silhouette - a spire may overhang a wall, its base
    // may not - so the land and keep-out tests use the lower third of the sprite.
    const fy = (cy) => cy + sh * 0.16, fry = Math.max(8, sh * 0.34);
    let best = null;
    if (at) {                                   // hand-pinned: the search has nothing useful to say
      const cx = clamp(at[0], Math.ceil(rx) + 2, W - Math.ceil(rx) - 3);
      const cy = clamp(at[1], Math.ceil(ry) + 2, H - Math.ceil(ry) - 3);
      best = { cx, cy, p: ellipseStats(base, cx, fy(cy), rx * 0.92, fry), score: 0, rad: 0, held: true };
    }
    for (const rad of (at ? [] : RADII)) {
      for (let a = 0; a < (rad ? 12 : 1); a++) {
        const th = a * Math.PI / 6;
        const cx = clamp(x0 + Math.round(Math.cos(th) * rad), Math.ceil(rx) + 2, W - Math.ceil(rx) - 3);
        const cy = clamp(y0 + Math.round(Math.sin(th) * rad), Math.ceil(ry) + 2, H - Math.ceil(ry) - 3);
        const p = ellipseStats(base, cx, fy(cy), rx * 0.92, fry);
        if (!p.n || isSea(p)) continue;
        const bf = blockedFrac(cx, fy(cy), rx, fry * 1.25);
        if (bf > 0.17) continue;
        if (placed.some((q) => Math.abs(q.cx - cx) < (q.sw + sw) * 0.44 && Math.abs(q.cy - cy) < (q.sh + sh) * 0.42)) continue;
        // Distance from the pin is the dominant cost: a town that strays stops explaining the marker
        // above it, so a slightly busier spot nearby beats a perfect one far away.
        const score = bf * 70 + p.sd * 0.4 + rad * 0.85;
        if (!best || score < best.score) best = { cx, cy, p, score, rad };
      }
    }
    // Two of the game's nodes are pinned inside the bastion's walls. There is no honest place to put
    // a town for them, and a lodge painted across a battlement is worse than none - the fortress is
    // the built form at those pins, and it is already painted.
    if (!best) { report.push([key, '-', `skipped: nothing open within ${RADII[RADII.length - 1]}px of the pin`]); continue; }
    const { cx, cy, p } = best;
    placed.push({ cx, cy, sw, sh });

    const sprite = await prepared(key, px, p.lum, lift);
    const shx = cx, shy = Math.round(cy + sh * 0.30), srx = sw * 0.44, sry = Math.max(5, sh * 0.15);
    for (let y = Math.max(0, Math.round(shy - sry)); y < Math.min(H, shy + sry); y++) {
      for (let x = Math.max(0, Math.round(shx - srx)); x < Math.min(W, shx + srx); x++) {
        const u = (x - shx) / srx, v = (y - shy) / sry, d = Math.hypot(u, v); if (d >= 1) continue;
        const t = 1 - d, a = t * t * (3 - 2 * t) * 0.34, i = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) ground[i + c] = clamp(Math.round(ground[i + c] * (1 - a) + [9, 7, 20][c] * a), 0, 255);
      }
    }
    layers.push({ input: sprite.buf, raw: { width: sprite.w, height: sprite.h, channels: 4 },
      left: Math.round(cx - sprite.w / 2), top: Math.round(cy - sprite.h / 2) });
    report.push([key, `${cx},${cy}`, `${sprite.w}x${sprite.h}${best.held ? '  hand-pinned' : best.rad ? `  moved ${best.rad}px` : ''}`]);
  }
  const png = await sharp(ground, { raw: { width: W, height: H, channels: 3 } }).composite(layers).png().toBuffer();
  const flat = await sharp(png).removeAlpha().raw().toBuffer();
  return { png, st: centreStats(flat), report, n: layers.length };
}

let lift = LIFT, out = await build(lift);
for (let pass = 0; pass < 4 && (out.st.mean > CENTRE_MAX_LUM || out.st.p98 > CENTRE_MAX_P98); pass++) {
  lift *= 0.88;
  console.log(`  centre mean ${out.st.mean.toFixed(1)} / p98 ${out.st.p98} - rebuilding with the towns ${(lift / LIFT * 100).toFixed(0)}% as bright`);
  out = await build(lift);
}
console.log(`  centre mean ${out.st.mean.toFixed(1)} (max ${CENTRE_MAX_LUM}), brightest 2% ${out.st.p98} (max ${CENTRE_MAX_P98})`);
if (out.st.mean > CENTRE_MAX_LUM + 6 || out.st.p98 > CENTRE_MAX_P98 + 20) { console.error('REFUSING: too loud in the middle for a node field.'); process.exit(1); }

const tmp = OUT + '.tmp';
await sharp(out.png).webp({ quality: 86 }).toFile(tmp);
if (fs.statSync(tmp).size < 20000) throw new Error('output suspiciously small');
fs.renameSync(tmp, OUT);
for (const [k, at, how] of out.report) console.log('  ' + k.padEnd(20) + String(at).padStart(9) + '  ' + how);
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB  ${out.n} towns`);
console.log('OK');
