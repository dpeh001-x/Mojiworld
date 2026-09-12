// The World Map's ground, take five (v0.30.654): the same painted continent, now with its towns on
// it. Per user: "can you add in the small towns such as emerald village, azure and shadow etc."
//
//   LUDO_API_KEY=... node scripts/gen_worldmap_towns.mjs [--fresh]
//
// The obvious approach - ask the generator for a world WITH its settlements - was tried first and
// measured: it paints four or five handsome villages wherever it likes and quietly drops half the
// biome layout to make room. Both halves of that are fatal here. The towns have to sit under the
// pins that name them (the node field is authored in mojiworld_game.html as wmX/wmY on a 1529x889
// canvas), and the biomes have to stay where v0.30.653 put them.
//
// So the two jobs are split. The generated sheet is used only as a SOURCE OF MOTIFS - six painted
// settlement clusters cut out of it - and each one is stamped onto the shipped ground at the real
// coordinates of the map node it belongs to, tinted to that place's own colour. Emerald Village is
// green-roofed because it is Emerald Village; The Azure Academia is blue; the Shadow-Woven Hood is
// violet and sits beside the rift, because that is where the game pins it.
//
// Every stamp is fitted to the ground it lands on: the destination's mean colour drives a per-channel
// gain on the motif so the grass under a cut-out matches the grass around it, an elliptical feather
// hides the cut, and a soft contact shadow seats it. Anywhere the ground is already busy (the
// bastion's walls, the volcano) or is open sea, the placer walks the stamp to the quietest land
// within 48px instead of painting over it.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = path.join(ROOT, 'backgrounds', 'worldmap_bg_v4.webp');   // the continent, unchanged
const OUT = path.join(ROOT, 'backgrounds', 'worldmap_bg_v5.webp');
const SHEET = path.join(ROOT, 'scripts', '_tmp_wm_towns_src.webp');   // the motif sheet (cached)
const W = 1536, H = 896;                 // the ground
const NW = 1529, NH = 889;               // the node field the game authors its wmX/wmY against
const CENTRE_MAX_LUM = 66, CENTRE_MAX_P98 = 150;

// The sheet prompt. It asks for a world, but only its villages are ever used, so it asks for many
// of them on plain ground rather than for a composition.
const SHEET_PROMPT = [
  'A hand-painted top-down fantasy world map illustration for a cute 2D MMO, in the style of a',
  'storybook atlas: chunky stylised terrain, clean readable shapes, warm saturated colour, soft',
  'painted shading, thin winding roads joining the settlements, no grid.',
  'Scattered across a green continent, many small villages: tiny clusters of two or three stylised',
  'houses with steep tiled roofs, a chapel with a bell tower, a lodge among trees, a frost-roofed',
  'manor on ice, a lantern-lit way-station on dark stone. Each cluster small and separate, standing',
  'clear of the others on open ground with grass around it.',
  'No text, no labels, no letters, no numbers, no icons, no map pins, no markers, no UI, no',
  'characters, no people, no monsters, no borders, no compass rose. Nothing shiny or glowing. Even,',
  'gentle lighting with no single bright focal point.',
].join(' ');

// Cut boxes into the 1536x896 sheet. Each is one settlement plus a margin of its own ground, which
// is what the feather needs to blend into a new one.
const MOTIFS = {
  hamlet3: [1148, 246, 150, 128],   // three steep red roofs round a green
  chapel:  [1240, 250, 118, 122],   // a chapel with a bell tower
  lodge:   [1090, 566, 120, 120],   // one long house among trees, a path past it
  cluster: [1218, 558, 142, 140],   // three dark-roofed houses, close together
  manor:   [ 376,  74, 132, 148],   // the frost-roofed manor on ice
  station: [ 980,  66, 150, 130],   // the lantern-lit way-station on dark stone
};

// Every settlement the game pins, at its own node's coordinates, at a size that says what it is, in
// the colour its name promises. Wilderness nodes (Dune Sands, Bubblegum Swamp, Tidal Lagoon, the
// grottoes, the crypt) are deliberately absent - they are terrain, and the ground already paints it.
//        name                        nx    ny   px  motif      tint       flip
const TOWNS = [
  ['Everdawn Central',                798,  427, 116, 'chapel',  '#d8a94e', 0],
  ['Everdawn Megamall',               714,  375,  94, 'hamlet3', '#c9b06a', 1],
  ['Stardust Atrium',                 913,  325,  78, 'chapel',  '#8290d8', 1],
  ['Frozen Peak',                    1012,  343,  74, 'manor',   '#93c3da', 0],
  ["Hera's Floating Abode",          1014,  433,  72, 'station', '#cfc07a', 0],
  ['The Azure Academia',             1030,  522,  86, 'chapel',  '#3f74d2', 0],
  ['Frostbite Hollow',               1126,  459,  70, 'cluster', '#7aaaca', 1],
  ['Sky Garden',                     1148,  562,  74, 'lodge',   '#6fa882', 0],
  ['Wildflower Plains',              1123,  643,  66, 'hamlet3', '#c07ab8', 1],
  ["Queen's Hollow",                 1230,  763,  76, 'chapel',  '#8f4fa8', 0],
  ['Fungal Hollow',                   983,  604,  70, 'cluster', '#9a6fc0', 0],
  ['The Shadow-Woven Hood',           850,  658,  74, 'lodge',   '#4a2f6e', 1],
  ['The Hidden Pagoda',               730,  607,  72, 'station', '#a83c30', 0],
  ['The Jade Grove',                  959,  696,  68, 'lodge',   '#4c9a7c', 0],
  ['Emerald Village',                 886,  774,  88, 'hamlet3', '#4f9a68', 0],
  ['The Reach of Vermillion',         992,  805,  76, 'cluster', '#b0382c', 1],
  ['Sweet Candy Canyon',              383,  542,  80, 'hamlet3', '#d46aa8', 0],
  ['Honeycomb Hollow',                311,  462,  72, 'cluster', '#d99a2a', 1],
  ['Frosted Mansion',                 505,  105,  74, 'manor',   '#8fc2e2', 0],
  ['The Fiery Hideout',               266,  102,  64, 'station', '#c8562a', 1],
];
const RADII = [0, 20, 34, 50, 68, 88, 110];   // how far a town may be walked from its own pin
const TINT_A = 0.62;        // how far a stamp's ROOFS are pulled toward its place's hue
const FEATHER = 0.42;       // the outer fraction of the ellipse that fades out

async function makeImage(prompt) {
  const key = process.env.LUDO_API_KEY; if (!key) throw new Error('LUDO_API_KEY not set');
  const API = 'https://api.ludo.ai/api/v1';
  const res = await fetch(`${API}/assets/image`, {
    method: 'POST',
    headers: { Authorization: `ApiKey ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(150000),
    body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 1, augment_prompt: false, prompt }),
  });
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
      if (i % 4 === 0) console.log(`  job ${st || '?'}…`);
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
}

// ---- the sheet -------------------------------------------------------------------------------
const GLAZE = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="v" cx="50%" cy="48%" r="76%">
    <stop offset="0%" stop-color="#0a0a1e" stop-opacity="0.30"/>
    <stop offset="58%" stop-color="#0a0a1e" stop-opacity="0.42"/>
    <stop offset="100%" stop-color="#05040f" stop-opacity="0.80"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="#131026" opacity="0.30"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`);
if (!fs.existsSync(SHEET) || process.argv.includes('--fresh')) {
  console.log('World Map towns - requesting the motif sheet...');
  const art = await makeImage(SHEET_PROMPT);
  // glazed exactly like the ground it will be cut into, so a stamp needs no value correction
  const g = await sharp(art).resize(W, H, { fit: 'cover', position: 'centre' })
    .composite([{ input: GLAZE, blend: 'over' }]).webp({ quality: 92 }).toBuffer();
  fs.writeFileSync(SHEET, g);
} else console.log('World Map towns - reusing the saved motif sheet (pass --fresh to re-request)');

const rd = async (f) => { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const base = await rd(BASE), sheet = await rd(SHEET);
if (base.w !== W || base.h !== H) throw new Error(`ground is ${base.w}x${base.h}, expected ${W}x${H}`);
if (sheet.w !== W || sheet.h !== H) throw new Error(`sheet is ${sheet.w}x${sheet.h}, expected ${W}x${H}`);

// ---- helpers ---------------------------------------------------------------------------------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const LUM = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
function ellipseStats(img, cx, cy, rx, ry) {         // mean colour + luminance spread inside an ellipse
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
function ringStats(img, cx, cy, rx, ry) {            // the rim of a footprint - where the seam will be
  let n2 = 0, R = 0, G = 0, B = 0;
  for (let y = Math.max(0, Math.round(cy - ry)); y < Math.min(img.h, cy + ry); y++) {
    for (let x = Math.max(0, Math.round(cx - rx)); x < Math.min(img.w, cx + rx); x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry, d2 = u * u + v * v;
      if (d2 > 1 || d2 < 0.52) continue;
      const i = (y * img.w + x) * 3; R += img.d[i]; G += img.d[i + 1]; B += img.d[i + 2]; n2++;
    }
  }
  return n2 ? { r: R / n2, g: G / n2, b: B / n2, n: n2 } : { r: 0, g: 0, b: 0, n: 0 };
}
function bilinear(img, x, y) {                        // sample the sheet between pixels
  const x0 = clamp(Math.floor(x), 0, img.w - 1), y0 = clamp(Math.floor(y), 0, img.h - 1);
  const x1 = Math.min(x0 + 1, img.w - 1), y1 = Math.min(y0 + 1, img.h - 1);
  const fx = clamp(x - x0, 0, 1), fy = clamp(y - y0, 0, 1);
  const o = (xx, yy) => (yy * img.w + xx) * 3; const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = img.d[o(x0, y0) + c] * (1 - fx) + img.d[o(x1, y0) + c] * fx;
    const b = img.d[o(x0, y1) + c] * (1 - fx) + img.d[o(x1, y1) + c] * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
  return out;
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---- where a town may NOT be built ------------------------------------------------------------
// Colour is not enough to find the bastion: its courtyard is the same grass as the plain outside it,
// so a "quietest patch" search happily drops a hamlet inside the walls. Structure is what to look
// for, so the ground is reduced to a coarse grid of edge energy - painted terrain is smooth, built
// things are not - and every busy cell is blocked. Then the holes are filled: any cell that cannot
// be reached from the edge of the map without crossing a blocked one is enclosed BY structure, which
// is exactly what a courtyard, a crater floor and the middle of the toy-brick town all are.
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
  // An absolute threshold does not survive a regenerated ground - a slightly busier painting blocks
  // the whole map. The busiest sixth of it is blocked instead, which is the same statement ("this is
  // where the structure is") expressed in a way that holds whatever the next ground looks like.
  const sorted = Float32Array.from(eg).sort();
  const HOT = sorted[Math.floor(sorted.length * 0.88)];
  console.log(`  structure: cells run ${sorted[0].toFixed(1)} to ${sorted[sorted.length - 1].toFixed(1)}, blocking at ${HOT.toFixed(1)}`);
  for (let i = 0; i < eg.length; i++) if (eg[i] >= HOT) blocked[i] = 1;
  const grown = blocked.slice();                     // close single-cell gaps so the fill cannot leak
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    if (blocked[gy * GW + gx]) continue;
    const h = blocked[gy * GW + gx - 1] && blocked[gy * GW + gx + 1];
    const v = blocked[(gy - 1) * GW + gx] && blocked[(gy + 1) * GW + gx];
    if (h && v) grown[gy * GW + gx] = 1;
  }
  blocked.set(grown);
  const open = new Uint8Array(GW * GH), q = [];      // flood the free space inwards from the border
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
  if (process.argv.includes('--debug')) {
    const dbg = Buffer.from(base.d);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!blocked[Math.floor(y / CELL) * GW + Math.floor(x / CELL)]) continue;
      const i = (y * W + x) * 3; dbg[i] = Math.min(255, dbg[i] + 70);
    }
    await sharp(dbg, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(ROOT, 'scripts', '_tmp_wm_keepout.png'));
    console.log('  wrote scripts/_tmp_wm_keepout.png');
  }
}
function blockedFrac(cx, cy, rx, ry) {               // how much of a footprint lands on something built
  let hit = 0, n2 = 0;
  for (let y = cy - ry; y <= cy + ry; y += CELL / 2) for (let x = cx - rx; x <= cx + rx; x += CELL / 2) {
    const u = (x - cx) / rx, v = (y - cy) / ry; if (u * u + v * v > 1) continue;
    const gx = clamp(Math.floor(x / CELL), 0, GW - 1), gy = clamp(Math.floor(y / CELL), 0, GH - 1);
    hit += blocked[gy * GW + gx]; n2++;
  }
  return n2 ? hit / n2 : 1;
}

// ---- place, then stamp -----------------------------------------------------------------------
const cov = new Float32Array(W * H);          // how much of each pixel a stamp owns; the gate uses it
const placed = [], report = [];
for (const [nm, nx, ny, px, key, tintHex, flip] of TOWNS) {
  const box = MOTIFS[key]; if (!box) throw new Error('no motif ' + key);
  const [bl, bt, bw, bh] = box;
  const tw = px, th = Math.round(px * bh / bw), rx = tw / 2, ry = th / 2;
  const x0 = Math.round(nx * W / NW), y0 = Math.round(ny * H / NH);

  // Walk to open land near the pin: never the sea, never on top of something already built, never
  // on top of a town already placed. Distance from the pin is a cost, because a town that strays too
  // far stops being an explanation of the marker above it.
  let best = null;
  for (const rad of RADII) {
    for (let a = 0; a < (rad ? 12 : 1); a++) {
      const th2 = a * Math.PI / 6;
      const cx = clamp(x0 + Math.round(Math.cos(th2) * rad), Math.ceil(rx) + 2, W - Math.ceil(rx) - 3);
      const cy = clamp(y0 + Math.round(Math.sin(th2) * rad), Math.ceil(ry) + 2, H - Math.ceil(ry) - 3);
      const p = ellipseStats(base, cx, cy, rx, ry);
      if (!p.n || isSea(p)) continue;
      const bf = blockedFrac(cx, cy, rx * 1.3, ry * 1.3);   // the margin is in the test, not in the map
      if (bf > 0.12) continue;
      if (placed.some((q) => Math.hypot(q.cx - cx, q.cy - cy) < (q.rx + rx) * 0.86)) continue;
      const score = bf * 90 + p.sd * 0.5 + rad * 0.34;
      if (!best || score < best.score) best = { cx, cy, p, score, rad, bf };
    }
  }
  // Two of the game's nodes are pinned inside the bastion's walls. There is no honest place to put a
  // village for them, and a lodge painted across a battlement is worse than no lodge at all - the
  // fortress is the built form at those pins, and it is already painted.
  if (!best) { report.push([nm, '-', `skipped: nothing open within ${RADII[RADII.length - 1]}px of the pin`]); continue; }
  const { cx, cy, p } = best;
  placed.push({ cx, cy, rx, ry });

  const s = ellipseStats(sheet, bl + bw / 2, bt + bh / 2, bw / 2, bh / 2);
  // Match the RIM, not the whole footprint. Matching means made every stamp a shade brighter than
  // its surroundings - a village and the grass it stands on averaged against grass alone - and the
  // feather then drew that difference as a visible oval. Matching the rim puts the seam at zero and
  // leaves the buildings as much brighter than their own ground as the painter made them.
  const pR = ringStats(base, cx, cy, rx, ry), sR = ringStats(sheet, bl + bw / 2, bt + bh / 2, bw / 2, bh / 2);
  const tgt = (dc, sc) => clamp(dc / Math.max(6, sc), 0.70, 1.45);
  const gain = [tgt(pR.r, sR.r), tgt(pR.g, sR.g), tgt(pR.b, sR.b)];
  const sRing = LUM(sR.r * gain[0], sR.g * gain[1], sR.b * gain[2]);
  // A hue, not a lamp. The tint is normalised to its own luminance first, so recolouring a roof
  // changes what colour it is and nothing else; the earlier version multiplied brightness by the
  // tint and every village lit up like a brazier.
  const th0 = hex(tintHex), tLum = Math.max(24, LUM(th0[0], th0[1], th0[2]));
  const tint = [th0[0] / tLum, th0[1] / tLum, th0[2] / tLum];

  // contact shadow first, so the stamp sits on it
  const sx0 = Math.round(cx + 2), sy0 = Math.round(cy + th * 0.17), srx = rx * 1.02, sry = ry * 0.84;
  for (let y = Math.max(0, Math.round(sy0 - sry)); y < Math.min(H, sy0 + sry); y++) {
    for (let x = Math.max(0, Math.round(sx0 - srx)); x < Math.min(W, sx0 + srx); x++) {
      const u = (x - sx0) / srx, v = (y - sy0) / sry; const d = Math.hypot(u, v); if (d >= 1) continue;
      const a = smooth(1 - d) * 0.26, i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) base.d[i + c] = clamp(Math.round(base.d[i + c] * (1 - a) + [10, 8, 22][c] * a), 0, 255);
    }
  }

  for (let y = Math.max(0, Math.round(cy - ry)); y < Math.min(H, cy + ry); y++) {
    for (let x = Math.max(0, Math.round(cx - rx)); x < Math.min(W, cx + rx); x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry; const d = Math.hypot(u, v); if (d >= 1) continue;
      const a = smooth((1 - d) / FEATHER);
      const sxp = bl + (u * 0.5 + 0.5) * bw, syp = bt + (v * 0.5 + 0.5) * bh;
      const col = bilinear(sheet, flip ? bl + bw - (sxp - bl) : sxp, syp);
      const gv = [col[0] * gain[0], col[1] * gain[1], col[2] * gain[2]];
      const lm = LUM(gv[0], gv[1], gv[2]);
      // Only what stands ABOVE the ground it sits on takes the place's colour: roofs and walls, not
      // the grass that came with the cut-out. Tinting a whole stamp turned each village into a
      // coloured oval, which is the one thing a painted map must never look like.
      const wT = clamp((lm - sRing - 22) / 46, 0, 1) * TINT_A;
      const i = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        let val = sRing + (gv[c] - sRing) * 1.12;               // a touch more contrast than the cut-out
        val = val * (1 - wT) + clamp(lm * tint[c], 0, 255) * wT;
        base.d[i + c] = clamp(Math.round(base.d[i + c] * (1 - a) + val * a), 0, 255);
      }
      const ci = y * W + x; if (a > cov[ci]) cov[ci] = a;
    }
  }
  report.push([nm, `${cx},${cy}`, `${key}${flip ? ' (mirrored)' : ''} ${tw}x${th}${best.rad ? `  moved ${best.rad}px` : ''}`]);
}

// ---- the same gate the ground shipped with, applied only to what was added -------------------
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
let st = centreStats(base.d);
console.log(`  stamped: centre mean ${st.mean.toFixed(1)} (max ${CENTRE_MAX_LUM}), brightest 2% ${st.p98} (max ${CENTRE_MAX_P98})`);
for (let pass = 0; pass < 4 && (st.mean > CENTRE_MAX_LUM || st.p98 > CENTRE_MAX_P98); pass++) {
  const k = Math.max(0.55, Math.min(CENTRE_MAX_LUM / st.mean, CENTRE_MAX_P98 / st.p98));
  console.log(`  pulling the towns by x${k.toFixed(2)} (the ground itself is untouched)`);
  for (let i = 0; i < cov.length; i++) {
    const c = cov[i]; if (c < 0.004) continue;
    const o = i * 3, f = 1 - (1 - k) * c;
    for (let ch = 0; ch < 3; ch++) base.d[o + ch] = clamp(Math.round(base.d[o + ch] * f), 0, 255);
  }
  st = centreStats(base.d);
}
console.log(`  after: centre mean ${st.mean.toFixed(1)}, brightest 2% ${st.p98}`);
if (st.mean > CENTRE_MAX_LUM + 6 || st.p98 > CENTRE_MAX_P98 + 20) { console.error('REFUSING: too loud in the middle for a node field.'); process.exit(1); }

const tmp = OUT + '.tmp';
await sharp(base.d, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(tmp);
if (fs.statSync(tmp).size < 20000) throw new Error('output suspiciously small');
fs.renameSync(tmp, OUT);
for (const [nm, at, how] of report) console.log('  ' + nm.padEnd(26) + String(at).padStart(9) + '  ' + how);
console.log(`wrote ${path.relative(ROOT, OUT)}  ${W}x${H}  ${Math.round(fs.statSync(OUT).size / 1024)} KB  ${report.filter((r) => r[2]).length} towns`);
console.log('OK');
