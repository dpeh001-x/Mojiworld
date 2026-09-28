#!/usr/bin/env node
// v0.30.1304: the Singularity's darkening tint (bgTint, eased per Gravitos form) is baked into its backdrop - the clip frame's
// copy, or a tinted copy of the plate - instead of painted over the whole screen every frame. drawBackground is rendered
// twice in one task, baked and the old way (window._lxNoFillSkip), with the clip paused so both see one frame, and every
// pixel is compared; then the same on the plate (no clip), and once more while the tint is still easing after a form
// change, where it must paint the old way.
//   node scripts/bg_tint_bake_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10631);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawBackground === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._god = true; player.level = 200;
    loadMap('gravitosArena', 300);
    const clear = () => { for (const id of ['grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) b.click(); }
      for (const ov of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(ov); if (e && e.classList.contains('on')) e.classList.remove('on'); } game.paused = false; };
    const o = { ver: GAME_VERSION };
    // the clip, if it plays here, fully faded in
    for (let i = 0; i < 150; i++) { await sleep(200); clear(); if (_pickBGImage() && (typeof _lxMapVideoAlpha === 'undefined' || _lxMapVideoAlpha >= 1 || i > 60)) break; }
    const render = (old) => {
      window._lxNoFillSkip = old;
      const P = CanvasRenderingContext2D.prototype, fr = P.fillRect; let full = 0;
      P.fillRect = function (x, y, w, h) { if (this === ctx && w >= W && h >= H) full++; return fr.apply(this, arguments); };
      let tinted = false;
      try {
        ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(-30, -30, W + 60, H + 60);
        drawBackground();
      } finally { P.fillRect = fr; window._lxNoFillSkip = false; }
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0);
      return { full, px: x.getImageData(0, 0, c.width, c.height).data };
    };
    const compare = (a, b) => { let d1 = 0, max = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > max) max = d; if (d > 1) d1++; } return { d1, max, n: a.length / 4 }; };
    // each drawBackground eases the tint one step, so both renders of a pair start from the same step
    // the accretion disc animates on performance.now(): both renders of a pair read one instant
    const pair = () => { const c0 = _lxGravTintCur, _pn = performance.now, _t = _pn.call(performance); performance.now = () => _t;
      let a, b; try { a = render(false); _lxGravTintCur = c0; b = render(true); } finally { performance.now = _pn; }
      return { newFull: a.full, oldFull: b.full, ...compare(a.px, b.px) }; };
    // hold the clip on one frame: drawBackground resumes a paused clip every frame (_lxMapVideoFrame), so play() is a no-op here
    const _play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    for (const v of Object.values(typeof _lxMapVideoEls !== 'undefined' ? _lxMapVideoEls : {})) { try { v && v.pause(); } catch (e) {} }
    await sleep(300);
    render(false); render(true);   // warm the bakes
    o.clip = !!_LX_SKY.vid; o.tint = 'rgba(0,0,8,' + _lxGravTintTo.toFixed(3) + ')';
    o.settled = pair();
    // the plate: this map's clip withheld for the run
    const vk = _lxMapVideoKeyFor('gravitosArena'), vsave = _LX_MAP_VIDEO[vk];
    _LX_MAP_VIDEO[vk] = null;
    try { render(false); render(true); o.plateClip = !!_LX_SKY.vid; o.plate = pair(); } finally { _LX_MAP_VIDEO[vk] = vsave; }
    // a form change: the tint eases, and paints the old way until it settles
    _lxGravTintTo = 0.62;
    o.easing = pair(); o.easingCur = _lxGravTintCur;
    HTMLMediaElement.prototype.play = _play;
    return o;
  });
  const s = r.settled, p = r.plate, e = r.easing;
  console.log(`build ${r.ver}  clip ${r.clip}  tint ${r.tint}`);
  console.log(`  clip:   full-screen fills ${s.newFull} (was ${s.oldFull}); ${s.d1} px differ by >1, max ${s.max}`);
  console.log(`  plate:  full-screen fills ${p.newFull} (was ${p.oldFull}); ${p.d1} px differ by >1, max ${p.max}`);
  console.log(`  easing: full-screen fills ${e.newFull} (was ${e.oldFull}); ${e.d1} px differ by >1, max ${e.max}  (cur ${r.easingCur})`);
  ok('a settled tint is baked in: its full-screen fill is gone', s.newFull === s.oldFull - 2 && p.newFull === p.oldFull - 2, `${s.newFull}/${s.oldFull}, plate ${p.newFull}/${p.oldFull}`);
  ok('...and the picture matches the painted tint (rounding only)', s.max <= 2 && p.max <= 2 && s.d1 <= s.n * 0.005 && p.d1 <= p.n * 0.005, `clip max ${s.max} (${s.d1} px), plate max ${p.max} (${p.d1} px)`);
  ok('the plate path was really the plate', r.plateClip === false);
  ok('while the tint eases after a form change it paints the old way, identically', e.newFull === e.oldFull - 1 && e.max === 0, `${e.newFull}/${e.oldFull}, max ${e.max}`);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
