// How much surface memory does the bake retain?
// ============================================================================
// The main thread is idle at 1fps, so the stall is in the compositor. The one
// thing this game does at unusual scale is allocate a CANVAS PER BAKED SPRITE
// FRAME (_lxBitmapToCanvas), plus the decoded ImageBitmaps behind them.
//
// A 1656x1516 frame is 10MB of RGBA. Shrunk to a 1104 long edge it is still
// 4.5MB. Several hundred of those is gigabytes of surface memory — which
// Firefox backs differently from Chromium and which would stall presentation
// while leaving JS untouched, exactly the signature measured.
//
// This counts and sizes every canvas and every ImageBitmap the page creates,
// so the number is observed rather than estimated.
// Run: node scripts/firefox_surfaces.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10893);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const INSTALL = () => {
  window.__lxS = { canvases: [], bitmaps: [], closed: 0 };
  const ce = document.createElement.bind(document);
  document.createElement = function (tag, ...r) {
    const el = ce(tag, ...r);
    if (String(tag).toLowerCase() === 'canvas') window.__lxS.canvases.push(el);
    return el;
  };
  const cib = window.createImageBitmap;
  if (cib) window.createImageBitmap = function (...a) {
    return cib.apply(window, a).then((b) => {
      window.__lxS.bitmaps.push({ w: b.width, h: b.height });
      const oc = b.close && b.close.bind(b);
      if (oc) b.close = () => { window.__lxS.closed++; return oc(); };
      return b;
    });
  };
};

const REPORT = () => {
  const S = window.__lxS;
  // Only canvases still reachable carry surface memory; the array pins them
  // all, so this is the CREATED total — stated as such rather than implied.
  let px = 0, big = 0;
  const sizes = [];
  for (const c of S.canvases) { const a = c.width * c.height; px += a; if (a > 250000) big++; sizes.push(a); }
  sizes.sort((a, b) => b - a);
  let bpx = 0;
  for (const b of S.bitmaps) bpx += b.w * b.h;
  return {
    nCanvas: S.canvases.length, canvasMB: +(px * 4 / 1048576).toFixed(0), bigCanvas: big,
    top5: sizes.slice(0, 5).map((a) => Math.round(a / 1000) + 'k px'),
    nBitmap: S.bitmaps.length, bitmapMB: +(bpx * 4 / 1048576).toFixed(0), closed: S.closed,
  };
};

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(INSTALL);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(14000);
  const R = await page.evaluate(REPORT);
  await page.close();
  return { name, ...R };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: true })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name}`);
  console.log(`  canvases created : ${r.nCanvas}  (${r.bigCanvas} larger than 500x500)   ~${r.canvasMB} MB of RGBA backing`);
  console.log(`  largest          : ${r.top5.join(', ')}`);
  console.log(`  ImageBitmaps     : ${r.nBitmap}  ~${r.bitmapMB} MB   (closed: ${r.closed})`);
  console.log(`  TOTAL surface    : ~${r.canvasMB + r.bitmapMB} MB`);
}
