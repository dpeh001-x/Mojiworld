// POTHOLE VISIBILITY - are the pits actually easier to see?
// =============================================================================
// The point of the change is legibility, so the headline assertion is a real
// pixel measurement, not a wiring check: clear the canvas to a dark ground
// tone, call the game's own drawPotholes(), and count how many pixels it
// paints BRIGHTER than that ground. The old renderer only ever painted black
// on dark, so it scores 0 by construction.
//   1. ASSETS   both sprites exist, 256x256, with alpha and a bright rim
//   2. WIRING   registered, and the right biome variant per map
//   3. VISIBLE  drawPotholes() paints bright rim pixels on dark ground
//   4. SAFE     the procedural fallback still exists for the pre-decode frames
// Run: node scripts/pothole_visibility_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SPRITES = ['pothole_earth', 'pothole_crypt'];

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const sharp = require('sharp');
for (const k of SPRITES) {
  const p = path.join(ROOT, 'Sprites', 'objects', `${k}.webp`);
  ok(`${k}.webp exists`, fs.existsSync(p), fs.existsSync(p) ? `${fs.statSync(p).size} bytes` : 'missing');
  if (!fs.existsSync(p)) continue;
  // The v1 art was CUT OFF: the ring ran straight off the canvas, 106/107
  // opaque pixels sitting on the left/right border. Any opaque pixel on the
  // border means the shape was sliced rather than framed.
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const A = (x, y) => data[(y * w + x) * ch + 3];
  let border = 0;
  for (let x = 0; x < w; x++) { if (A(x, 0) > 40) border++; if (A(x, h - 1) > 40) border++; }
  for (let y = 0; y < h; y++) { if (A(0, y) > 40) border++; if (A(w - 1, y) > 40) border++; }
  ok(`${k} is not cut off at the canvas edge`, border === 0, `${border} opaque px on the border`);
}

const PORT = 9124;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const live = await page.evaluate(async (SPRITES) => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }

  // ---- assets, as the game sees them ----
  const imgs = {};
  for (const k of SPRITES) imgs[k] = (typeof LX_OBJECTS !== 'undefined') ? LX_OBJECTS[k] : null;
  ok('both sprites are registered in LX_OBJECTS', SPRITES.every(k => !!imgs[k]),
     SPRITES.map(k => `${k}=${imgs[k] ? 'yes' : 'NO'}`).join(' '));
  // give them a moment to decode
  for (let i = 0; i < 100; i++) {
    if (SPRITES.every(k => imgs[k] && imgs[k].complete && imgs[k].naturalWidth)) break;
    await new Promise(r => setTimeout(r, 100));
  }
  ok('both sprites decode', SPRITES.every(k => imgs[k] && imgs[k].naturalWidth > 0),
     SPRITES.map(k => `${k}=${imgs[k] ? imgs[k].naturalWidth + 'x' + imgs[k].naturalHeight : 'none'}`).join(' '));

  // Each sprite must actually contain a BRIGHT rim, or it cannot read on dark
  // ground no matter how it is drawn.
  const rimOf = (k) => {
    const im = imgs[k]; if (!im || !im.naturalWidth) return 0;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, 128, 128);
    const d = x.getImageData(0, 0, 128, 128).data;
    let bright = 0, opaque = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      opaque++;
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (lum > 140) bright++;
    }
    return opaque ? bright / opaque : 0;
  };
  for (const k of SPRITES) {
    const f = rimOf(k);
    ok(`${k} has a bright rim`, f > 0.10, `${(f * 100).toFixed(1)}% of opaque pixels are bright`);
  }

  // ---- biome selection ----
  // Read through typeof: on a build without the change this global does not
  // exist, and the assertions should FAIL rather than crash the whole run.
  const BY_MAP = (typeof _POTHOLE_SPRITE_BY_MAP !== 'undefined') ? _POTHOLE_SPRITE_BY_MAP : {};
  ok('crypt maps use the crypt variant',
     ['cryptHollow', 'boneGraveyard2', 'hollowSepulchre2'].every(m => BY_MAP[m] === 'pothole_crypt'),
     JSON.stringify(BY_MAP));
  ok('sand / thicket maps fall through to the earth variant',
     Object.keys(BY_MAP).length > 0 && !BY_MAP.duneSands && !BY_MAP.thornspireThicket);
  // every map that declares potholes must resolve to a real, registered sprite
  const pitMaps = Object.keys(MAPS).filter(m => Array.isArray(MAPS[m] && MAPS[m].potholes) && MAPS[m].potholes.length);
  const resolved = pitMaps.map(m => (MAPS[m].potholeSprite || BY_MAP[m] || 'pothole_earth'));
  ok('every pothole map resolves to a registered sprite',
     pitMaps.length === 5 && resolved.every(k => !!(typeof LX_OBJECTS !== 'undefined' && LX_OBJECTS[k])),
     pitMaps.map((m, i) => `${m}->${resolved[i]}`).join('  '));

  // ---- THE MEASUREMENT ----
  // Paint a dark ground, run the game's own renderer over it, and count pixels
  // brighter than that ground. Black-on-dark scores zero.
  const measure = (mapId) => {
    loadMap(mapId);
    game.currentMap = mapId;
    const pit = game.mapData.potholes[0];
    game.camera.x = pit.x + pit.w / 2 - W / 2;
    game.camera.y = 0;
    const GROUND = [26, 46, 38];                 // the thicket floor tone
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgb(${GROUND.join(',')})`;
    ctx.fillRect(0, 0, W, H);
    drawPotholes();
    const g = (game.mapData.platforms || []).find(p => p.type === 'ground');
    const gy = g ? g.y : 480;
    const bx = Math.round(W / 2 - 90), by = Math.round(gy - 70);
    const d = ctx.getImageData(bx, by, 180, 110).data;
    ctx.restore();
    const gl = 0.2126 * GROUND[0] + 0.7152 * GROUND[1] + 0.0722 * GROUND[2];
    let brighter = 0, darker = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (lum > gl + 25) brighter++;
      else if (lum < gl - 25) darker++;
    }
    return { brighter, darker };
  };
  const thicket = measure('thornspireThicket');
  ok('the thicket pit paints bright pixels on dark ground (it used to paint none)',
     thicket.brighter > 400, `${thicket.brighter} bright px, ${thicket.darker} dark px`);
  const crypt = measure('cryptHollow');
  ok('the crypt pit paints bright pixels too', crypt.brighter > 400,
     `${crypt.brighter} bright px, ${crypt.darker} dark px`);
  // the dark opening must still be there — a pit that is all rim reads as a rug
  ok('the pit still has a dark opening', thicket.darker > 200, `${thicket.darker} dark px`);

  return out;
}, SPRITES);

for (const r of live) res.push(r);
// The fallback must survive in source, or a slow decode shows nothing at all.
const src = fs.readFileSync(path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html'), 'utf8');
ok('the procedural fallback is still present', src.includes('rgba(0,0,0,0.55)'));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
