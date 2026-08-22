// WORLD MAP BACKDROP — the painted nebula plate is what the rectangle shows.
// ============================================================================
// Per user (with a screenshot of the map): "Generate a much better background
// for the world map rectangular portion".
//
// The rectangle the nodes sit in is an SVG whose backdrop is a rasterised
// <image> built by _wmBgRasterURL. Before this it was a procedural canvas
// (gradient blobs + random dots); backgrounds/worldmap_bg.webp was referenced
// only by the modal FRAME's CSS, where three 0.85-opacity gradients buried it.
// So "is the painted plate visible" cannot be checked in CSS -- it has to be
// checked in the raster. Sampling its pixels does that: a real painting has
// its luminance field correlates with the plate file; a procedural sky does not.
// Run: node scripts/worldmap_plate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9501;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'PlateTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.click('button:has-text("Skip prologue")').catch(() => {});
await page.waitForTimeout(1000);
for (let i = 0; i < 12; i++) {
  const on = await page.evaluate(() => { const o = document.getElementById('story-beat-overlay'); return !!(o && o.classList.contains('on')); });
  if (!on) break;
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
}
await page.evaluate(() => { const o = document.getElementById('story-beat-overlay'); if (o) o.classList.remove('on'); game.paused = false; toggleWorldMap(); });
await page.waitForTimeout(3000);

const R = await page.evaluate(async () => {
  const { W, H } = _wmComputePositions();
  const url = _wmBgRasterURL(W, H);
  // decode the raster and measure it
  const img = new Image(); img.src = url;
  await new Promise(r => { img.onload = r; img.onerror = r; });
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  // colour variance across a coarse grid + mean luminance
  let n = 0, sr = 0, sg = 0, sb = 0, srr = 0, sgg = 0, sbb = 0, lum = 0;
  for (let y = 0; y < cv.height; y += 8) for (let x = 0; x < cv.width; x += 8) {
    const i = (y * cv.width + x) * 4; const r = d[i], g = d[i+1], b = d[i+2];
    n++; sr += r; sg += g; sb += b; srr += r*r; sgg += g*g; sbb += b*b; lum += 0.2126*r + 0.7152*g + 0.0722*b;
  }
  const v = (s, ss) => Math.sqrt(Math.max(0, ss/n - (s/n)*(s/n)));
  // Does the raster actually carry the plate? Correlate its luminance field with
  // the plate file's on a coarse grid. (A first version compared colour
  // VARIANCE and had it backwards: the old procedural sky, with hard-edged
  // random stars and a bright core flare, scores HIGHER variance than a soft
  // painting. Variance measures sharpness, not provenance.)
  const plate = new Image(); plate.src = 'backgrounds/worldmap_bg.webp';
  await new Promise(r => { plate.onload = r; plate.onerror = r; });
  let corr = null;
  if (plate.naturalWidth) {
    const pc = document.createElement('canvas'); pc.width = cv.width; pc.height = cv.height;
    const pg = pc.getContext('2d');
    const sc = Math.max(cv.width / plate.naturalWidth, cv.height / plate.naturalHeight);
    const dw = plate.naturalWidth * sc, dh = plate.naturalHeight * sc;
    pg.drawImage(plate, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
    const pd = pg.getImageData(0, 0, pc.width, pc.height).data;
    const A = [], B = [];
    for (let y = 8; y < cv.height - 8; y += 12) for (let x = 8; x < cv.width - 8; x += 12) {
      const i = (y * cv.width + x) * 4;
      A.push(0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]);
      B.push(0.2126*pd[i] + 0.7152*pd[i+1] + 0.0722*pd[i+2]);
    }
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    const ma = mean(A), mb = mean(B);
    let num = 0, da = 0, db = 0;
    for (let k = 0; k < A.length; k++) { num += (A[k]-ma)*(B[k]-mb); da += (A[k]-ma)**2; db += (B[k]-mb)**2; }
    corr = num / Math.sqrt(da * db || 1);
  }
  const svg = document.querySelector('#worldmap-modal svg');
  const bgImgEl = svg ? svg.querySelector('image') : null;
  return {
    W, H, rasterW: cv.width, rasterH: cv.height,
    stdR: +v(sr, srr).toFixed(1), stdG: +v(sg, sgg).toFixed(1), stdB: +v(sb, sbb).toFixed(1),
    meanLum: +(lum / n).toFixed(1), corr: corr == null ? null : +corr.toFixed(3),
    plateReady: (typeof _wmPlate !== 'undefined') ? !!_wmPlate._lxReady : null,
    rasterAttached: !!bgImgEl && (bgImgEl.getAttribute('href') || '').startsWith('data:image/png'),
    hostTagged: !!document.querySelector('[data-wm-diagram="1"]'),
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });
const stdAvg = (R.stdR + R.stdG + R.stdB) / 3;
ok('the diagram backdrop raster is built and attached', R.rasterAttached && R.rasterW > 0, `${R.rasterW}x${R.rasterH}`);
ok('the painted plate decoded and was used', R.plateReady === true, `plateReady=${R.plateReady}`);
ok('the raster IS the painted plate (luminance correlates with the file)', R.corr != null && R.corr >= 0.7,
   `correlation with backgrounds/worldmap_bg.webp = ${R.corr} (procedural sky measures ~0)`);
ok('it stays dark enough for node labels to read', R.meanLum < 95, `mean luminance ${R.meanLum}/255`);
ok('it is not a black slab either', R.meanLum > 25, `mean luminance ${R.meanLum}/255`);
ok('a live diagram re-renders when the plate lands late', R.hostTagged, `host tagged for re-render: ${R.hostTagged}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
