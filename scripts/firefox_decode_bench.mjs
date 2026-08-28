// Does the double-decode cost Firefox the frame?
// ============================================================================
// _lxBitmapOffThread re-FETCHES every sprite URL to get a Blob and then calls
// createImageBitmap on it — so each sprite is downloaded twice and decoded
// twice (once as the <img>, once from the Blob). The comment in the game says
// that was measured as a WIN on Chromium (41.5ms of main-thread block from an
// <img>, 0.1ms from a Blob). Nobody measured it on Firefox.
//
// This measures, per engine, on real game sprites:
//   imgMs   — createImageBitmap(<img>, opts)   wall time
//   blobMs  — fetch -> blob -> createImageBitmap(blob, opts)   wall time
//   jank    — the WORST delay suffered by a 4ms heartbeat timer while each
//             runs. That is the number that matters: it is main-thread block,
//             i.e. the thing the player sees as a freeze.
// Run: node scripts/firefox_decode_bench.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10887);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const URLS = [
  'Sprites/objects/azure_large_waterfountain.webp',
  'Sprites/fx/anim/qte_break_3.webp',
  'Sprites/bosses/attack/gravitospunch_3.webp',
  'Sprites/bosses/attack/gravitos2star_3.webp',
  'Sprites/bosses/attack/gravitos2star_4.webp',
  'Sprites/bosses/attack/gravitos2star_5.webp',
];

const BENCH = async (urls) => {
  // A heartbeat that SHOULD fire every 4ms. However late it actually runs is
  // main-thread block — the only honest measure of a freeze.
  let worst = 0, hb = 0, last = performance.now();
  const beat = () => { const n = performance.now(); const d = n - last - 4; if (d > worst) worst = d; last = n; hb = setTimeout(beat, 4); };
  const arm = () => { worst = 0; last = performance.now(); hb = setTimeout(beat, 4); };
  const stop = () => { clearTimeout(hb); return +worst.toFixed(1); };

  const loadImg = (u) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u + '?v=' + Math.random();
  });
  const out = [];
  for (const u of urls) {
    const im = await loadImg(u);
    const w = im.naturalWidth, h = im.naturalHeight;
    const long = Math.max(w, h), cap = Math.min(long, 1104);
    const s = cap / long;
    const opts = { resizeWidth: Math.round(w * s), resizeHeight: Math.round(h * s), resizeQuality: 'high' };

    // A — straight from the <img>
    arm();
    let t = performance.now();
    let b1 = await createImageBitmap(im, opts);
    const imgMs = +(performance.now() - t).toFixed(1), imgJank = stop();
    b1.close && b1.close();

    // B — the game's path: refetch to a Blob, then decode that
    const im2 = await loadImg(u);
    arm();
    t = performance.now();
    const blob = await fetch(im2.src).then((r) => r.blob());
    const fetchMs = +(performance.now() - t).toFixed(1);
    let b2 = await createImageBitmap(blob, opts);
    const blobMs = +(performance.now() - t).toFixed(1), blobJank = stop();
    b2.close && b2.close();

    out.push({ u: u.split('/').pop(), px: w + 'x' + h, imgMs, imgJank, fetchMs, blobMs, blobJank });
  }
  return out;
};

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.goto(`http://localhost:${PORT}/blank.html`, { waitUntil: 'load' }).catch(async () => {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  });
  const R = await page.evaluate(BENCH, URLS);
  await page.close();
  return { name, rows: R };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: true })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 240)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name}`);
  console.log('   from <img>          the game\'s blob path');
  console.log('    ms    jank      fetch     ms    jank   sprite');
  for (const x of r.rows) {
    console.log(`  ${String(x.imgMs).padStart(6)} ${String(x.imgJank).padStart(6)}   ${String(x.fetchMs).padStart(6)} ${String(x.blobMs).padStart(6)} ${String(x.blobJank).padStart(6)}   ${x.u} ${x.px}`);
  }
  const sum = (k) => r.rows.reduce((a, x) => a + x[k], 0).toFixed(0);
  console.log(`  TOTAL  img ${sum('imgMs')}ms (jank ${sum('imgJank')})   blob ${sum('blobMs')}ms (jank ${sum('blobJank')})`);
}
