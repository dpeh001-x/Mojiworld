// Where every World Map node stands (v0.30.656). Per user, supplying the unglazed painting itself:
// "just use this but make sure the map nodes are placed accurately at where they should be along the
// world map, make sure good spacing, minimal overlap, accurate".
//
//   node scripts/gen_worldmap_pins.mjs [--links <nodes.json>] [--debug]
//
// The pins were authored over years of edit-mode drags against an EMPTY diagram, so they say nothing
// about the ground that later appeared under them: the Magma Foundry sat on open grass, Block-land
// in the sea, half the graveyard inside the bastion. This re-derives all eighty from the painting.
//
// Each map is assigned to a REGION of the art - the ice field, the volcano, the brick town, the moor
// with its tombs, the graveyard, the bastion, the rift, the central plain, the eastern jungle, the
// candy band, the lower-right rocks, the eastern islets, the beach, or the open sea for the maps
// that ARE open sea. Regions are ellipses measured off the painting; a node is then held inside its
// ellipse AND on ground of the right kind (land for a town, water for a trench), so nothing floats
// and nothing drowns.
//
// Inside that, a relaxation does the spacing: every pair closer than MIN_SEP pushes apart, portal
// links pull weakly so connected maps stay neighbours, and the whole thing is finally rescaled to
// fill the authoring box exactly - which is what keeps the diagram's canvas at 1529x889 and so keeps
// the painting registered to the pins that sit on it.
//
// Output is a guarded-setter block in the file's own convention, appended last so it wins.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUND = path.join(ROOT, 'backgrounds', 'worldmap_bg_v6.webp');
const OUT = path.join(ROOT, 'scripts', '_tmp_wm_pins.js');

// The diagram's own geometry. _wmComputePositions spreads authored pins by 1.20 about their bounding
// box and then adds these margins, so a pin at authored (0,0) lands at (90,62) and the canvas ends up
// 1.2*span + 180 wide. Fixing the canvas at 1529x889 fixes the box the pins may occupy, and that box
// is what the painting is stretched across.
const CANVAS_W = 1529, CANVAS_H = 889, SPREAD = 1.20, M_X = 90, M_TOP = 62, M_BOT = 84;
const BOX = { x0: M_X, y0: M_TOP, x1: CANVAS_W - M_X, y1: CANVAS_H - M_BOT };
const MIN_SEP = 82;          // how close two node discs may ever come
// A region is a statement about which part of the world a map belongs to, not a fence. Held hard at
// the ellipse, the crowded regions - eleven maps in the eastern woods, seven on the moor - could not
// spread and left pairs sitting 40px apart. Nodes may drift this far past their ellipse, with a
// spring pulling them back, so crowding resolves into the neighbouring ground instead of into
// another node. Land-or-water is still absolute: that one is a fence.
const SOFT = 1.32;
const ITERS = 1400;

// Regions measured off the painting, in canvas pixels: [cx, cy, rx, ry, ground]
const REGIONS = {
  ice:       [372, 152, 168,  76, 'land'],   // the glass-shard steppe, upper left
  volcano:   [218, 398, 128,  92, 'land'],   // black rock and lava channels
  bricks:    [345, 662, 182, 108, 'land'],   // the toy-brick town
  sand:      [300, 788, 150,  34, 'land'],   // the beach below it
  sweet:     [455, 516,  86,  92, 'land'],   // the open band east of the lava
  moor:      [752, 168, 162,  84, 'land'],   // tombs and the lantern way-station
  graveyard:[1212, 182, 188,  98, 'land'],   // mossy headstones under twisted trees
  heartland: [618, 424, 128, 120, 'land'],   // the central plain
  bastion:  [1000, 434, 138,  88, 'land'],   // the walled fortress
  rift:      [806, 682, 142,  92, 'land'],   // the torn violet ground
  jungle:   [1108, 686, 200, 116, 'land'],   // the wooded east and its towns
  // The four Bloom Reaches maps need to sit together or the region-name pass drops the family: it
  // asks for two placed maps inside 300px before it will name a territory, and splitting Verdant
  // Haven and Hollow into the central plain cost the world one of its ten names.
  thicket:  [1247, 536, 120, 106, 'land'],   // the wooded shoulder east of the bastion
  rocks:    [1306, 712, 132,  98, 'land'],   // the pale boulder field
  isles:    [1416, 424,  96, 150, 'land'],   // the islets off the east coast
  sea:      [ 765, 445, 720, 400, 'water'],  // anywhere the painting is open water
};

// Every visible map, and the part of the world it belongs to.
const ASSIGN = {
  glasswindSteppe: 'ice', glasswindSteppe2: 'ice', glasswindHamlet: 'ice', frozenPeak: 'ice', frostbiteHollow: 'ice',
  magmaFoundry: 'volcano', magmaFoundry2: 'volcano', lavaCavern: 'volcano', sundered_forge: 'volcano', fieryHideout: 'volcano',
  blockland_grove: 'bricks', blockland_quarry: 'bricks', blockland_dunes: 'bricks', blockland_citadel: 'bricks',
  blockland_meadow: 'bricks', blockland_outpost: 'bricks', blockland_apex: 'bricks',
  sunsetBeach: 'sand',
  candyCanyon: 'sweet', honeycombHollow: 'sweet', bubblegumSwamp: 'sweet', duneSands: 'sweet',
  hollowSepulchre: 'moor', hollowSepulchre2: 'moor', wayfarersLantern: 'moor', wayfarersLantern1: 'moor',
  wayfarersLantern2: 'moor', cryptHollow: 'moor', ossuarySprawl: 'moor',
  boneGraveyard: 'graveyard', boneGraveyard2: 'graveyard', boneGraveyard3: 'graveyard', ancient: 'graveyard', gloomsporeVerge: 'graveyard',
  town: 'heartland', everdawn_megamall: 'heartland', forest: 'heartland', slimeCave: 'heartland', mushroom: 'heartland',
  bloomhaven: 'thicket', thornspireThicket: 'thicket', verdantHaven: 'thicket', verdantHollow: 'thicket',
  bastion: 'bastion', bastionRampart: 'bastion', bastionThrone: 'bastion', azureAbode: 'bastion', stardustAtrium: 'bastion',
  distortedThreshold: 'rift', fracturedReflection: 'rift', confusedVigil: 'rift', gravitosArena: 'rift',
  interdimensionalAscension: 'rift', zodiacHall: 'rift',
  emeraldVillage: 'jungle', jadeGrove: 'jungle',
  wildflowerPlains: 'jungle', skyGarden: 'jungle', azureAcademia: 'jungle', hiddenPagoda: 'jungle',
  shadowWovenHood: 'jungle', reachOfVermillion: 'jungle', boss: 'jungle',
  graniteBluffs: 'rocks', sauroSlope: 'rocks', krookThrone: 'rocks',
  celestialSpire: 'isles', stormCrest: 'isles', thunderPlateau: 'isles', sanctum: 'isles',
  abyssalTrench: 'sea', coralReef: 'sea', tidalLagoon: 'sea', tidepoolShoals: 'sea', kelpForest: 'sea',
  bubbleGrotto: 'sea', octopusGrotto: 'sea', witheringTide: 'sea', witheringTide2: 'sea', pearlBathhouse: 'sea',
};

// The ten sea maps are seeded by ray-casting outward from the middle of the world on evenly spaced
// bearings and stopping in the middle of the first open water each ray finds. Hand-picked spots do
// not survive: the southern ocean lies below the authoring box entirely, so half of them landed on
// the beach. A ring found from the painting itself cannot make that mistake.
const SEA_ORDER = ['tidalLagoon', 'pearlBathhouse', 'abyssalTrench', 'coralReef', 'tidepoolShoals',
  'kelpForest', 'witheringTide2', 'witheringTide', 'bubbleGrotto', 'octopusGrotto'];

// ---- the ground ------------------------------------------------------------------------------
const { data: gd, info: gi } = await sharp(GROUND).removeAlpha().resize(CANVAS_W, CANVAS_H, { fit: 'fill' })
  .raw().toBuffer({ resolveWithObject: true });
const GW = gi.width, GH = gi.height;
// Water in this painting is teal: blue and green both clearly over red, and never bright. Everything
// else - grass, snow, lava, brick, stone - is somewhere a node may stand.
const water = new Uint8Array(GW * GH);
for (let i = 0, p = 0; i < gd.length; i += 3, p++) {
  const r = gd[i], g = gd[i + 1], b = gd[i + 2];
  water[p] = (b > r + 22 && g > r + 10 && b > 70) ? 1 : 0;
}
// Erode the coastline a little so nothing is pinned exactly on the waterline, in either direction.
const shrink = (mask, n) => {
  let cur = mask;
  for (let k = 0; k < n; k++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
      const i = y * GW + x;
      next[i] = cur[i] && cur[i - 1] && cur[i + 1] && cur[i - GW] && cur[i + GW] ? 1 : 0;
    }
    cur = next;
  }
  return cur;
};
const land = new Uint8Array(GW * GH);
for (let i = 0; i < water.length; i++) land[i] = water[i] ? 0 : 1;
// Three passes, not more: the eastern islets are small enough that a heavier erode eats them, and
// they are the only standing ground the sky maps have.
const LAND = shrink(land, 3);
// The rivers are water too, and the first pass happily moored the Abyssal Trench in one. Only the
// component reachable from the edge of the world is sea; everything else is a stream. The flood runs
// on the UNERODED mask - erosion clears the outermost pixels, which are exactly where it must start.
const ocean = new Uint8Array(water.length);
{
  const q = []; const seen = new Uint8Array(water.length);
  for (let x = 0; x < GW; x++) { q.push([x, 0], [x, GH - 1]); }
  for (let y = 0; y < GH; y++) { q.push([0, y], [GW - 1, y]); }
  while (q.length) {
    const [x, y] = q.pop(); if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
    const i = y * GW + x; if (seen[i]) continue; seen[i] = 1;
    if (!water[i]) continue;
    ocean[i] = 1; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}
// Ten passes, not three: rivers reach the sea, so the flood above swims right up them and a berth
// found there moors the Abyssal Trench in a stream. A river is about twenty pixels across on this
// canvas and the open sea is hundreds, so eroding hard leaves exactly the water a sea map wants.
const WATER = shrink(ocean, 10);
if (process.argv.includes('--ocean')) { let c=0; for(let y=62;y<=805;y++) for(let x=90;x<=1439;x++) if (WATER[y*GW+x]) c++; console.log('ocean inside the box:', c, 'px'); }
const okAt = (kind, x, y) => {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= GW || yi >= GH) return false;
  return (kind === 'water' ? WATER : LAND)[yi * GW + xi] === 1;
};
console.log(`ground: ${(100 * LAND.reduce((a, b) => a + b, 0) / LAND.length).toFixed(0)}% standable land, ` +
  `${(100 * WATER.reduce((a, b) => a + b, 0) / WATER.length).toFixed(0)}% open water`);

// ---- the nodes -------------------------------------------------------------------------------
const linksArg = (() => { const i = process.argv.indexOf('--links'); return i < 0 ? null : process.argv[i + 1]; })();
let LINKS = [];
if (linksArg && fs.existsSync(linksArg)) {
  const dump = JSON.parse(fs.readFileSync(linksArg, 'utf8'));
  LINKS = (dump.links || []).filter(([a, b]) => ASSIGN[a] && ASSIGN[b]);
  const missing = Object.keys(dump.maps || {}).filter((id) => !ASSIGN[id]);
  const extra = Object.keys(ASSIGN).filter((id) => !(dump.maps || {})[id]);
  if (missing.length) console.log(`  NOT ASSIGNED (will keep their old pin): ${missing.join(', ')}`);
  if (extra.length) console.log(`  assigned but not on the diagram: ${extra.join(', ')}`);
}
console.log(`${Object.keys(ASSIGN).length} nodes, ${LINKS.length} portal links`);

// Berths for the sea maps, found in the ocean itself rather than guessed. Ray-casting bearings out
// of the middle was tried first and it kept mooring maps in rivers or doubling two onto one pixel;
// the ocean inside the authoring box is an uneven ring, not a circle. So every ocean pixel in the
// box is clustered into as many groups as there are sea maps, which spreads the berths through the
// water that actually exists, and each centroid is then snapped onto the nearest wet pixel.
function seaBerths(k) {
  const pts = [];
  for (let y = BOX.y0; y <= BOX.y1; y += 4) for (let x = BOX.x0; x <= BOX.x1; x += 4) {
    if (WATER[Math.round(y) * GW + Math.round(x)]) pts.push([x, y]);
  }
  if (pts.length < k) throw new Error('not enough open water inside the authoring box');
  const C = [pts[0].slice()];                         // farthest-point init, so no two start together
  while (C.length < k) {
    let best = null, bd = -1;
    for (const p of pts) {
      let d = Infinity; for (const c of C) d = Math.min(d, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2);
      if (d > bd) { bd = d; best = p; }
    }
    C.push(best.slice());
  }
  for (let it = 0; it < 40; it++) {                   // Lloyd
    const sum = C.map(() => [0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < C.length; i++) { const d = (p[0] - C[i][0]) ** 2 + (p[1] - C[i][1]) ** 2; if (d < bd) { bd = d; bi = i; } }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2]++;
    }
    for (let i = 0; i < C.length; i++) if (sum[i][2]) { C[i][0] = sum[i][0] / sum[i][2]; C[i][1] = sum[i][1] / sum[i][2]; }
  }
  return C.map(([x, y]) => {                          // a centroid can fall on the land the ring wraps
    if (WATER[Math.round(y) * GW + Math.round(x)]) return { x, y };
    let best = null, bd = Infinity;
    for (const p of pts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
    return { x: best[0], y: best[1] };
  }).sort((a, b) => Math.atan2(a.y - 445, a.x - 765) - Math.atan2(b.y - 445, b.x - 765));
}

// deterministic jitter, so a re-run reproduces the same map
let _s = 20260912;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };

const ids = Object.keys(ASSIGN);
const P = {};
const byRegion = {};
// Each sea map gets its own berth on the ring. Sharing one region does not work: the open water
// inside the authoring box is a band barely wider than a node, so containment kept projecting two
// maps onto the same pixel and the repulsion had nowhere to push them.
for (const id of ids) if (ASSIGN[id] !== 'sea') (byRegion[ASSIGN[id]] = byRegion[ASSIGN[id]] || []).push(id);
const BERTHS = seaBerths(SEA_ORDER.length);
SEA_ORDER.forEach((id, i) => {
  if (ASSIGN[id] !== 'sea') return;
  const seat = BERTHS[i];
  REGIONS['sea:' + id] = [seat.x, seat.y, 86, 86, 'water'];
  ASSIGN[id] = 'sea:' + id;
  byRegion['sea:' + id] = [id];
  if (process.argv.includes('--debug')) console.log('    berth ' + id.padEnd(18) + Math.round(seat.x) + ',' + Math.round(seat.y));
});
for (const [rk, list] of Object.entries(byRegion)) {
  const [cx, cy, rx, ry] = REGIONS[rk];
  list.forEach((id, i) => {
    if (rk.startsWith('sea:')) { P[id] = { x: cx, y: cy }; return; }
    const a = (i / list.length) * Math.PI * 2 + rnd() * 0.7;
    const t = list.length === 1 ? 0 : 0.30 + 0.55 * ((i % 3) / 2);
    P[id] = { x: cx + Math.cos(a) * rx * t, y: cy + Math.sin(a) * ry * t };
  });
}

// ---- relax -----------------------------------------------------------------------------------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
function holdInside(id) {
  const p = P[id], rk = ASSIGN[id], [cx, cy, rx, ry, kind] = REGIONS[rk];
  let u = (p.x - cx) / rx, v = (p.y - cy) / ry, d = Math.hypot(u, v);
  if (d > SOFT) { p.x = cx + (u / d) * rx * SOFT; p.y = cy + (v / d) * ry * SOFT; }
  p.x = clamp(p.x, BOX.x0, BOX.x1); p.y = clamp(p.y, BOX.y0, BOX.y1);
  if (okAt(kind, p.x, p.y)) return;
  for (let r = 6; r <= 190; r += 6) {                 // nearest ground of the right kind
    for (let a = 0; a < 16; a++) {
      const th = a * Math.PI / 8;
      const nx = clamp(p.x + Math.cos(th) * r, BOX.x0, BOX.x1);
      const ny = clamp(p.y + Math.sin(th) * r, BOX.y0, BOX.y1);
      u = (nx - cx) / rx; v = (ny - cy) / ry;
      if (u * u + v * v > SOFT * SOFT) continue;
      if (!okAt(kind, nx, ny)) continue;
      p.x = nx; p.y = ny; return;
    }
  }
}
function relax(iters, amp) {
for (let it = 0; it < iters; it++) {
  const k = (1 - it / iters) * amp;                            // cool down so it settles
  const F = {}; for (const id of ids) F[id] = { x: 0, y: 0 };
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = P[ids[i]], b = P[ids[j]];
    let dx = b.x - a.x, dy = b.y - a.y;
    let d = Math.hypot(dx, dy); if (d < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d = 0.5; }
    if (d >= MIN_SEP) continue;
    const push = (MIN_SEP - d) * 0.8;
    F[ids[i]].x -= (dx / d) * push; F[ids[i]].y -= (dy / d) * push;
    F[ids[j]].x += (dx / d) * push; F[ids[j]].y += (dy / d) * push;
  }
  for (const id of ids) {                              // the spring home to its own region
    const [cx, cy, rx, ry] = REGIONS[ASSIGN[id]];
    const u = (P[id].x - cx) / rx, v = (P[id].y - cy) / ry, d = Math.hypot(u, v);
    if (d <= 1) continue;
    const pull = Math.min(14, (d - 1) * 26);
    F[id].x -= (u / d) * pull; F[id].y -= (v / d) * pull;
  }
  for (const [a, b] of LINKS) {                        // connected maps stay neighbours, weakly
    const pa = P[a], pb = P[b]; if (!pa || !pb) continue;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy);
    if (d < 240) continue;
    const pull = Math.min(18, (d - 240) * 0.02);
    F[a].x += (dx / d) * pull; F[a].y += (dy / d) * pull;
    F[b].x -= (dx / d) * pull; F[b].y -= (dy / d) * pull;
  }
  for (const id of ids) {
    P[id].x += clamp(F[id].x, -26, 26) * (0.35 + 0.45 * k) * amp;
    P[id].y += clamp(F[id].y, -26, 26) * (0.35 + 0.45 * k) * amp;
    holdInside(id);
  }
}
}

// Relax, fill the box, settle, fill again: the box-fill is a rescale, which nudges nodes off the
// ground the containment pass just put them on, so the two alternate until the rescale is a rounding
// error and both conditions hold at once.
// ---- fill the authoring box exactly ------------------------------------------------------------
// _wmComputePositions derives the canvas from the pin bounding box, so a layout that does not reach
// the box edges makes a SMALLER canvas - and the painting, which is stretched across that canvas,
// slides out of register with the pins standing on it. Normalising here is what keeps 1529x889.
function fillBox(label) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) { const p = P[id]; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  const sx = (BOX.x1 - BOX.x0) / (maxX - minX), sy = (BOX.y1 - BOX.y0) / (maxY - minY);
  if (label === 'final' || label === 0) console.log(`  filling the box (${label}): x ${(100 * (sx - 1)).toFixed(2)}%, y ${(100 * (sy - 1)).toFixed(2)}%`);
  for (const id of ids) {
    P[id].x = BOX.x0 + (P[id].x - minX) * sx;
    P[id].y = BOX.y0 + (P[id].y - minY) * sy;
    holdInside(id);
  }
  return Math.max(Math.abs(sx - 1), Math.abs(sy - 1));
}
relax(ITERS, 1);
for (let pass = 0; pass < 6; pass++) {
  const err = fillBox(pass);
  relax(pass < 2 ? 260 : 90, pass < 2 ? 0.8 : 0.35);
  if (err < 0.004 && pass > 2) break;
}
fillBox('final');
// One last gentle settle. fillBox ends by re-seating every node on valid ground, and two maps can be
// seated on the same patch; a short low-amplitude pass separates them again for the cost of leaving
// the canvas a pixel or two short of the target, which the report below prints.
relax(220, 0.30);

// ---- what we got -----------------------------------------------------------------------------
let worst = Infinity, worstPair = '', tight = 0, offGround = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const d = Math.hypot(P[ids[i]].x - P[ids[j]].x, P[ids[i]].y - P[ids[j]].y);
    if (d < MIN_SEP) tight++;
    if (d < worst) { worst = d; worstPair = `${ids[i]} / ${ids[j]}`; }
  }
  const kind = REGIONS[ASSIGN[ids[i]]][4];
  if (!okAt(kind, P[ids[i]].x, P[ids[i]].y)) offGround.push(ids[i] + ` (wants ${kind})`);
}
console.log(`  closest pair ${worst.toFixed(0)}px (${worstPair}); ${tight} pairs under ${MIN_SEP}px`);
{
  let aX = Infinity, aY = Infinity, bX = -Infinity, bY = -Infinity;
  for (const id of ids) { const p = P[id]; aX = Math.min(aX, p.x); bX = Math.max(bX, p.x); aY = Math.min(aY, p.y); bY = Math.max(bY, p.y); }
  console.log(`  the diagram this makes is ${Math.round(bX - aX + M_X * 2)}x${Math.round(bY - aY + M_TOP + M_BOT)} (want ${CANVAS_W}x${CANVAS_H}; the painting is stretched across it)`);
}
console.log(offGround.length ? `  OFF ITS GROUND: ${offGround.join(', ')}` : '  every node stands on the ground its map is made of');
let far = 0; for (const [a, b] of LINKS) { if (Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y) > 620) far++; }
console.log(`  ${far} of ${LINKS.length} portal lanes run over 620px`);

// ---- emit ------------------------------------------------------------------------------------
const A = {};
for (const id of ids) A[id] = [Math.round((P[id].x - M_X) / SPREAD), Math.round((P[id].y - M_TOP) / SPREAD)];
const lines = [];
const sorted = ids.slice().sort();
for (let i = 0; i < sorted.length; i += 4) {
  lines.push('  ' + sorted.slice(i, i + 4).map((id) => `W('${id}',${A[id][0]},${A[id][1]});`).join(' '));
}
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} (${sorted.length} pins)`);

if (process.argv.includes('--debug')) {
  const R = 17;
  const dots = ids.map((id) => {
    const c = { sea: '#5ad2ff', ice: '#cfe8ff', volcano: '#ff8a3d', bricks: '#ffd24a', sand: '#e8d9a0',
      sweet: '#ff8ad0', moor: '#c9b7ff', graveyard: '#9fd08a', heartland: '#ffe08a', bastion: '#e7e2d2',
      rift: '#c77aff', jungle: '#7ce0a6', rocks: '#d9cdbb', isles: '#8fb7ff' }[ASSIGN[id]] || '#fff';
    return `<circle cx="${P[id].x.toFixed(0)}" cy="${P[id].y.toFixed(0)}" r="${R}" fill="${c}" fill-opacity="0.82" stroke="#10121c" stroke-width="3"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}">${dots}</svg>`;
  const f = path.join(ROOT, 'scripts', '_tmp_wm_pins_debug.png');
  await sharp(GROUND).resize(CANVAS_W, CANVAS_H, { fit: 'fill' }).composite([{ input: Buffer.from(svg) }]).png().toFile(f);
  console.log('  wrote ' + path.relative(ROOT, f));
}
console.log('OK');
