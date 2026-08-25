// Live test: THE BACKING STORE MATCHES THE SCREEN.
//
// Per user, on King Krook: "somehow looks very pixelated". He is not - the
// whole framebuffer was. The game renders a fixed 960x560 canvas and CSS-scales
// the wrapper to fill the viewport, but the backing store only counted
// devicePixelRatio, so on an ordinary 1080p monitor (DPR 1) it stayed 960x560
// while being displayed across ~1850 device px: a 1.93x upscale of every pixel,
// hardened by image-rendering:-webkit-optimize-contrast.
//
// The invariant this pins: a game pixel must never be blown up much past 1
// device pixel. It is measured off the DOM (canvas.width vs the CSS box), which
// is independent of what happens to be drawn - the first cut of this
// investigation measured the LOADING MASCOT and produced confident nonsense.
//   node scripts/render_scale_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8901; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];

const probe = async (w, h, opts = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dsf || 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (opts.rscale != null) await page.addInitScript((s) => { try { localStorage.setItem('lx_render_scale', String(s)); } catch (e) {} }, opts.rscale);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxTargetDpr === 'function', null, { timeout: 120000 });
  await page.waitForTimeout(900);
  const read = () => page.evaluate(() => {
    const cv = document.querySelector('canvas'); const r = cv.getBoundingClientRect();
    return { backingW: cv.width, backingH: cv.height, cssW: Math.round(r.width), cssH: Math.round(r.height),
      dpr: _LX_DPR, dev: window.devicePixelRatio, fit: +_lxFitScale().toFixed(3),
      upscale: +((r.width * window.devicePixelRatio) / cv.width).toFixed(3) };
  });
  const before = await read();
  let after = null;
  if (opts.resizeTo) {
    await page.setViewportSize({ width: opts.resizeTo[0], height: opts.resizeTo[1] });
    await page.waitForTimeout(700);   // the listener debounces at 220 ms
    after = await read();
  }
  await ctx.close();
  return { before, after };
};

const small = await probe(1000, 640);
const hd = await probe(1920, 1080);
const laptop = await probe(1440, 900);
const hidpi = await probe(1920, 1080, { dsf: 2 });
const override = await probe(1920, 1080, { rscale: 1 });
const resized = await probe(1000, 640, { resizeTo: [1920, 1080] });

ok('a maximised 1080p window renders at 1 device pixel per game pixel',
  hd.before.upscale <= 1.05,
  { backing: hd.before.backingW + 'x' + hd.before.backingH, css: hd.before.cssW + 'x' + hd.before.cssH,
    upscale: hd.before.upscale + 'x', wasBefore: '1.93x', dpr: hd.before.dpr });

ok('a 1440x900 laptop window does too',
  laptop.before.upscale <= 1.05,
  { backing: laptop.before.backingW + 'x' + laptop.before.backingH, upscale: laptop.before.upscale + 'x', dpr: laptop.before.dpr });

ok('a window barely bigger than the 960x560 logical canvas is left nearly alone',
  small.before.dpr < 1.15 && small.before.upscale <= 1.15,
  { dpr: small.before.dpr, fit: small.before.fit, upscale: small.before.upscale + 'x',
    note: 'no free lunch spent where there is nothing to gain' });

ok('a HiDPI screen is capped at 2x rather than chasing the full device ratio',
  hidpi.before.dpr <= 2.001 && hidpi.before.dpr > 1.5,
  { dpr: hidpi.before.dpr, devicePixelRatio: hidpi.before.dev, fit: hidpi.before.fit,
    note: '4x would be 4x the fill cost for a screen already only 2x off' });

ok('lx_render_scale still overrides everything, so the escape hatch survives',
  Math.abs(override.before.dpr - 1) < 0.001 && override.before.backingW === 960,
  { dpr: override.before.dpr, backing: override.before.backingW + 'x' + override.before.backingH });

ok('resizing the window re-sizes the backing store (this is the fullscreen path)',
  resized.after && resized.after.backingW > resized.before.backingW && resized.after.upscale <= 1.05,
  { before: resized.before.backingW + 'x' + resized.before.backingH + ' @' + resized.before.upscale + 'x',
    after: resized.after && (resized.after.backingW + 'x' + resized.after.backingH + ' @' + resized.after.upscale + 'x') });

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
