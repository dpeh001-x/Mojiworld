// WORLD-MAP BIOME AUDIT — does each pin stand on ground its own map is made of?
// ============================================================================
// Per user (v0.30.678, pointing at the map): "the fiery hideout is placed right at the icy region
// which is incorrect. analyse the map nodes and shift it very minimally to the biome they belong".
//
// Seventeen of the eighty pins were on ground that contradicted them, and NONE of it was visible
// from the source: the pin is an authored (wmX, wmY) pair, the ground under it is a painting. This
// script is the thing that made the mismatch checkable, and it is worth keeping because any future
// pin edit can put a map back on the wrong ground silently.
//
// Two independent sources, neither of them an opinion:
//
//   1. WHAT A MAP IS MADE OF comes from its own in-game backdrop id. `bg: 'sauroSlope'` is basalt —
//      it is the fire chain's backdrop (lavaCavern -> sauroSlope -> krookThrone), which is why "The
//      Fiery Hideout", which shares it, belongs on the volcano. `sandDune` is desert, `isUnderwater`
//      is sea, and so on through BG below.
//
//   2. WHAT IS UNDER THE PIN comes from the shipped plate, classified by colour. The three grounds
//      that carry a biome — the ice cap, the volcano, the rift crater — are taken as the LARGEST
//      CONNECTED BLOB of their colour rather than as an ellipse drawn around them. That distinction
//      did real work: the castle walls are as pale as snow and the moor is as dark as basalt, so an
//      ellipse round either swallows ground it should not or clips ground it should. An earlier pass
//      built on ellipses "fixed" The Fiery Hideout with a 14px move onto another part of the same
//      ice sheet, and reported success.
//
// Only STRONG ground counts as a contradiction. Grass, sand and bare stone read as "somewhere", not
// as a biome, so a pin on them is fine wherever its own biome happens to be — the layout is a route
// map first (see the v0.30.663 note in the game file) and this audit must not argue with that.
//
// Run:  node scripts/worldmap_biome_audit.mjs [port]
// Exits 1 if any pin except the two documented holdouts stands on contradicting ground.
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 9571);

// Storm Crest and Gloomspore Verge are in the sea and stay there: the layout spreads the authored
// pins about their own bounding box and stretches the painting across the result, so these two —
// which hold the left and right edges — set the scale for all eighty. Moving either rescales
// everything. See the v0.30.678 note in mojiworld_game.html.
const HOLDOUTS = new Set(['stormCrest', 'gloomsporeVerge']);

// each map's backdrop id -> what that map is made of
const BG = {
  frozenPeak: 'ice', frostbiteHollow: 'ice', interdimensionalAscension: 'ice', glasswindSteppe: 'ice',
  glasswindSteppe2: 'ice', glasswindHamlet: 'ice',
  magmaFoundry: 'fire', magmaFoundry2: 'fire', lavaCavern: 'fire', sundered_forge: 'fire',
  sauroSlope: 'fire', krookThrone: 'fire',
  sandDune: 'desert',
  sunsetCoast: 'coast', tidepoolShoals: 'coast', witheringTide: 'coast', witheringTide2: 'coast', tidalLagoon: 'coast',
  coralReef: 'sea', abyssalTrench: 'sea', kelpForest: 'sea', bubbleGrotto: 'sea', octopusGrotto: 'sea',
  gelwaterGrotto: 'sea', pearlBathhouse: 'sea',
  candyland: 'candy', bubblegum: 'candy', honeycombHollow: 'candy',
  crypt: 'grave', boneDeep: 'grave', boneLich: 'grave', hollowSepulchre: 'grave', hollowSepulchre2: 'grave',
  forest: 'wood', verdant: 'wood', verdantDeep: 'wood', fungalHollow: 'wood', jadeGrove: 'wood',
  emeraldVillage: 'wood', reachOfVermillion: 'wood', shadowWovenHood: 'wood', hiddenPagoda: 'wood', skyGarden: 'wood',
  wildflowerPlains: 'plain', thunderPlateau: 'plain', graniteBluffs: 'plain',
  everdawnCentral: 'plain', everdawnMegamall: 'plain',
  wayfarersLantern: 'moor', wayfarersLantern1: 'moor', wayfarersLantern2: 'moor',
  blockland: 'brickland', blockland1: 'brickland', blocklandLegosaurus: 'brickland',
  bastion: 'keep', bastionThrone: 'keep', bastionRampart: 'keep', azureAcademia: 'keep', azureAbode: 'keep',
  distortedThreshold: 'rift', fracturedReflection: 'rift', confusedVigil: 'rift', gravitosArena: 'rift', zodiacSanctum: 'rift',
  galaxy: 'sky', celestialAtrium: 'sky', aetherion: 'sky',
};
// which kind of map each signature ground belongs to
const SIG = { snow: (k) => k === 'ice' || k === 'sky', fire: (k) => k === 'fire',
              brick: (k) => k === 'brickland', rift: (k) => k === 'rift', sea: (k) => k === 'sea' };

// ---------------------------------------------------------------- the painting
const W = 1529, H = 889, RBOX = 13;
const PLATE = path.join(ROOT, 'backgrounds', 'worldmap_bg_v7.webp');
const { data } = await sharp(PLATE).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
const CLS = ['rock', 'snow', 'rift', 'lava', 'water', 'grass', 'sand', 'stone', 'other', 'brick'];
function classify(r, g, b) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn;
  let h = 0;
  if (d) {
    const R = r / 255, G = g / 255, B = b / 255;
    h = (mx === R ? ((G - B) / d + 6) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60;
  }
  const s = mx ? d / mx : 0, v = mx;
  if (v < 0.26) return 'rock';
  if (s < 0.16 && v > 0.78) return 'snow';
  if (s < 0.30 && v > 0.62 && (h < 60 || h > 300)) return 'snow';
  if (h >= 255 && h <= 320 && s > 0.22) return 'rift';
  if ((h < 32 || h > 350) && s > 0.55 && v > 0.55) return 'lava';
  if (h >= 32 && h <= 55 && s > 0.55 && v > 0.60) return 'lava';
  if (h >= 150 && h <= 230 && s > 0.24 && v < 0.80) return 'water';
  if (h >= 60 && h <= 160 && s > 0.22) return 'grass';
  if (h >= 28 && h <= 62 && s > 0.14) return 'sand';
  if (s < 0.22) return 'stone';
  return 'other';
}
const raw = new Uint8Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 3) raw[i] = CLS.indexOf(classify(data[p], data[p + 1], data[p + 2]));

// the sea, flooded in from the border, so the dark cloud in the corner stops reading as basalt
const land = new Uint8Array(W * H).fill(1);
{
  const seaish = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    seaish[i] = (b >= r - 6 && Math.max(r, g, b) / 255 < 0.78 && Math.max(r, g, b) - Math.min(r, g, b) > 12) ? 1 : 0;
  }
  const st = []; const seen = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) st.push(x, W * (H - 1) + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const i = st.pop(); if (seen[i] || !seaish[i]) continue;
    seen[i] = 1; land[i] = 0;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1);
    if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
}
function fillHoles(m) {
  const seen = new Uint8Array(W * H); const st = [];
  for (let x = 0; x < W; x++) st.push(x, W * (H - 1) + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const i = st.pop(); if (seen[i] || m[i]) continue;
    seen[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1);
    if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
  for (let i = 0; i < W * H; i++) if (!m[i] && !seen[i]) m[i] = 1;
  return m;
}
// the biggest connected blob of a class, dilated so keylines do not shatter it, then hole-filled
function biggestBlob(classes, grow = 3) {
  const K = classes.map((c) => CLS.indexOf(c));
  const on = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!land[i] || !K.includes(raw[i])) continue;
    for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      on[Y * W + X] = 1;
    }
  }
  const lab = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0;
  for (let i0 = 0; i0 < W * H; i0++) {
    if (!on[i0] || lab[i0] >= 0) continue;
    const st = [i0]; let n = 0; lab[i0] = i0;
    while (st.length) {
      const j = st.pop(); n++;
      const x = j % W, y = (j / W) | 0;
      if (x > 0 && on[j - 1] && lab[j - 1] < 0) { lab[j - 1] = i0; st.push(j - 1); }
      if (x < W - 1 && on[j + 1] && lab[j + 1] < 0) { lab[j + 1] = i0; st.push(j + 1); }
      if (y > 0 && on[j - W] && lab[j - W] < 0) { lab[j - W] = i0; st.push(j - W); }
      if (y < H - 1 && on[j + W] && lab[j + W] < 0) { lab[j + W] = i0; st.push(j + W); }
    }
    if (n > bestN) { bestN = n; best = i0; }
  }
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (lab[i] === best) m[i] = 1;
  return fillHoles(m);
}
// the cap is snow AND the pale sheets a colour test calls water; real sea is already masked out
const ICECAP = biggestBlob(['snow', 'water']);
const VOLCANO = biggestBlob(['rock']);
const CRATER = biggestBlob(['rift']);
// the toy field: the brick colours the painting uses are primary, so a colour test reads red bricks
// as lava and blue ones as water. Take it as the biggest blob of those inside the toy quarter.
const BRICKS = (() => {
  const m = new Uint8Array(W * H);
  for (let y = 490; y < 810; y++) for (let x = 120; x < 600; x++) {
    const i = y * W + x;
    if (land[i] && (raw[i] === CLS.indexOf('lava') || raw[i] === CLS.indexOf('water'))) m[i] = 1;
  }
  return fillHoles(m);
})();
// final per-pixel class: the signature grounds only exist where the painting actually paints them
const cls = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  if (!land[i]) { cls[i] = 255; continue; }
  let c = CLS[raw[i]];
  if (BRICKS[i] && (c === 'lava' || c === 'water')) c = 'brick';
  else if (c === 'water' && ICECAP[i]) c = 'snow';
  if (c === 'snow' && !ICECAP[i]) c = 'stone';
  else if (c === 'rock' && !VOLCANO[i]) c = 'stone';
  else if (c === 'rift' && !CRATER[i]) c = 'stone';
  else if (c === 'lava' && !VOLCANO[i]) c = 'sand';
  cls[i] = CLS.indexOf(c);
}
function sample(x, y) {
  const x0 = Math.max(0, Math.round(x) - RBOX), x1 = Math.min(W - 1, Math.round(x) + RBOX);
  const y0 = Math.max(0, Math.round(y) - RBOX), y1 = Math.min(H - 1, Math.round(y) + RBOX);
  const t = Object.create(null); let tot = 0, lnd = 0, other = 0;
  for (let y2 = y0; y2 <= y1; y2++) for (let x2 = x0; x2 <= x1; x2++) {
    tot++;
    const c = cls[y2 * W + x2];
    if (c === 255) continue;
    lnd++;
    if (CLS[c] === 'other') { other++; continue; }
    t[CLS[c]] = (t[CLS[c]] || 0) + 1;
  }
  // the painting is drawn with a heavy keyline; counting it as ground would let an outline-heavy
  // spot read as whatever class survived the dilution
  const den = Math.max(1, lnd - other);
  for (const k in t) t[k] /= den;
  return { share: t, land: lnd / (tot || 1) };
}
function signature(p) {
  const s = sample(p[0], p[1]);
  if (s.land < 0.45) return 'sea';
  if ((s.share.snow || 0) >= 0.45) return 'snow';
  if (((s.share.rock || 0) + (s.share.lava || 0)) >= 0.45) return 'fire';
  if ((s.share.brick || 0) >= 0.30) return 'brick';
  if ((s.share.rift || 0) >= 0.30) return 'rift';
  return null;
}

// ---------------------------------------------------------------- the live pins
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined, headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => typeof _wmComputePositions === 'function' && typeof MAPS === 'object', null, { timeout: 90000 });
const live = await page.evaluate(() => {
  const { positions, W, H } = _wmComputePositions();
  const out = {};
  for (const [id, p] of Object.entries(positions)) {
    const m = MAPS[id] || {};
    out[id] = { x: p.x, y: p.y, name: m.name || id, bg: m.bg || null, sea: !!m.isUnderwater };
  }
  return { out, W, H };
});
await browser.close().catch(() => {}); server.kill();

// ---------------------------------------------------------------- the verdict
if (Math.abs(live.W - W) > 1 || Math.abs(live.H - H) > 1) {
  console.log(`NOTE  the node canvas is ${Math.round(live.W)}x${Math.round(live.H)}, not ${W}x${H}.`);
  console.log('      The plate is stretched across whatever the authored pins span, so a pin that changed');
  console.log('      the bounding box has rescaled the art under ALL of them. Re-measure before trusting this.');
}
const rows = [];
for (const [id, n] of Object.entries(live.out)) {
  const kind = n.sea ? 'sea' : BG[n.bg];
  if (!kind) continue;
  const g = signature([n.x, n.y]);
  if (!g || SIG[g](kind)) continue;
  rows.push({ id, name: n.name, kind, on: g, at: [Math.round(n.x), Math.round(n.y)], held: HOLDOUTS.has(id) });
}
const bad = rows.filter((r) => !r.held);
console.log(`${Object.keys(live.out).length} pins checked, ${rows.length} on ground that contradicts them` +
            (rows.length ? ` (${rows.length - bad.length} documented)` : ''));
for (const r of rows) {
  console.log(`  ${r.held ? 'HELD' : 'BAD '}  ${r.name.slice(0, 36).padEnd(37)} is ${r.kind.padEnd(10)} standing on ${r.on.padEnd(6)} at ${r.at}`);
}
if (bad.length) {
  console.log('\nFAIL  a pin stands on ground its own map is not made of. Nudge it: the smallest move onto');
  console.log('      its own ground, keeping >=66px from every neighbour and adding no lane crossing. If it');
  console.log('      cannot be fixed without a large move, say so rather than moving it a little and nowhere.');
  process.exit(1);
}
console.log('\nPASS  every pin stands on ground its own map is made of, bar the documented holdouts');
