// Live test: VOID-ENTRY EYE ZOOM QUALITY (per user: "Guguma eyes at void entry
// seem to be very pixelated and poor quality").
//
// The zoom ends at scale(6.5) on a 841x971 sprite, so the question is simply:
// how many SOURCE pixels are behind each SCREEN pixel at the peak? Two numbers
// are measured through the real overlay, on the real animation:
//   magnification = rendered px / natural px   (>1 means the bitmap is being
//                   stretched; that is invented, not authored, detail)
//   sharpness     = mean |Laplacian| over the eye region of the screenshot
//                   (a standard focus metric — soft upscales score low)
//   node scripts/void_intro_zoom_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const OUT = process.env.LX_SHOT_DIR || '.';

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
// 1600x900 — a representative desktop. The bigger the window, the worse an
// under-resolved source looks, so testing small would flatter the bug.
const page = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _playVoidIntro === 'function', null, { timeout: 120000 });
await page.evaluate(() => {
  const hide = () => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; };
  hide(); setInterval(hide, 80);
});
await page.waitForTimeout(2500);
// let the hi-res source (if this build has one) finish decoding before the run
await page.waitForFunction(() => {
  const im = new Image(); im.src = 'Sprites/npc/Guguma_hi.webp';
  return true;
}, null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1500);

const run = await page.evaluate(() => new Promise((resolve) => {
  const out = {};
  const img = document.getElementById('void-intro-guguma');
  _playVoidIntro();
  // Frame timing THROUGH the zoom. A 3364x3884 source rasters a much bigger
  // layer than a 841x971 one, so the fix has to be proven cheap, not assumed:
  // sample rAF intervals across the 1000ms zoom window (starts at t+1000).
  const iv = [];
  let last = 0;
  const tick = (t) => {
    if (last) iv.push(t - last);
    last = t;
    if (t - t0 < 2150) requestAnimationFrame(tick);
  };
  const t0 = performance.now();
  setTimeout(() => { last = 0; requestAnimationFrame(tick); }, 1000);
  // hold 1000ms, then the 1000ms zoom — sample at the peak
  setTimeout(() => {
    const r = img.getBoundingClientRect();
    out.natural = { w: img.naturalWidth, h: img.naturalHeight };
    out.src = (img.currentSrc || img.src).split('/').pop();
    out.peakRect = { w: Math.round(r.width), h: Math.round(r.height) };
    out.magnification = +(r.height / img.naturalHeight).toFixed(2);
    const s = iv.slice().sort((a, b) => a - b);
    out.frames = iv.length;
    out.medianMs = s.length ? +s[s.length >> 1].toFixed(1) : -1;
    out.worstMs = s.length ? +s[s.length - 1].toFixed(1) : -1;
    resolve(out);
  }, 2150);
}));

// screenshot at the peak of a SECOND run so the numbers above and the pixels
// below describe the same moment
await page.evaluate(() => _playVoidIntro());
await page.waitForTimeout(2150);
const shotPath = `${OUT}/void_zoom_peak.png`;
await page.screenshot({ path: shotPath });

// sharpness: mean |Laplacian| over the centre 640x360 (the eyes fill it at peak)
const img = sharp(shotPath).extract({ left: 480, top: 270, width: 640, height: 360 }).greyscale();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
let acc = 0, n = 0;
for (let y = 1; y < info.height - 1; y++) for (let x = 1; x < info.width - 1; x++) {
  const i = y * info.width + x;
  const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - info.width] - data[i + info.width];
  acc += Math.abs(lap); n++;
}
const sharpness = +(acc / n).toFixed(3);

console.log('source     :', run.src, `${run.natural.w}x${run.natural.h}`);
console.log('peak rect  :', `${run.peakRect.w}x${run.peakRect.h}`);
console.log('MAGNIFY    :', run.magnification + 'x  (source px stretched per screen px at the zoom peak)');
console.log('SHARPNESS  :', sharpness, ' (mean |Laplacian| over the eye region)');
console.log('FRAMES     :', `${run.frames} in the zoom window, median ${run.medianMs}ms, worst ${run.worstMs}ms`);

ok('the zoom reaches its peak framing', run.peakRect.h > 1000, run.peakRect);
ok('the void intro uses the HIGH-RESOLUTION source for the zoom',
  /_hi\./.test(run.src || ''), { src: run.src });
ok('bitmap magnification at the peak stays under 2x (was 3.9x on the 841x971 sprite)',
  run.magnification < 2.0, { magnification: run.magnification });
ok('eye-region sharpness clears the soft-upscale floor',
  sharpness >= 1.2, { sharpness });
ok('the bigger texture costs no frames — the zoom still runs smooth',
  run.medianMs > 0 && run.medianMs <= 20 && run.worstMs <= 60,
  { medianMs: run.medianMs, worstMs: run.worstMs });
// FAIL-OPEN: a build without the hi-res (or a slow/blocked fetch) must still
// show the ordinary Guguma — never a blank hold, and never the emoji fallback
// the <img> onerror would swap in if a 404 URL were assigned.
const ctx2 = await b.newContext({ viewport: { width: 1600, height: 900 } });
const page2 = await ctx2.newPage();
await page2.route('**/Guguma_hi.webp', route => route.abort());
await page2.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _playVoidIntro === 'function', null, { timeout: 120000 });
await page2.waitForTimeout(2000);
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const img = document.getElementById('void-intro-guguma');
  const fb = document.getElementById('void-intro-fallback');
  _playVoidIntro();
  setTimeout(() => resolve({
    src: (img.currentSrc || img.src).split('/').pop(),
    shown: img.style.display !== 'none' && img.naturalWidth > 0,
    zoomed: img.classList.contains('eyezoom'),
    emojiFallback: fb && fb.style.display === 'block',
  }), 2150);
}));
ok('FAIL-OPEN: a blocked hi-res leaves the ordinary sprite zooming, not a blank or the emoji',
  fo.shown && fo.zoomed && /^Guguma\.webp$/.test(fo.src) && !fo.emojiFallback, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
