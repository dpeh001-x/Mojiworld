#!/usr/bin/env node
// v0.30.1303: a zodiac domain's grade (a 'color' re-hue, a 'multiply' sink and a sky gradient, each over the whole screen
// every frame - 3 of the 12.4 screens a zodiac fight paints a frame) is baked into its backdrop, and the two rune
// pillars that stand between the backdrop and the grade are re-graded in their own rectangles. The test renders
// drawBackground twice in one task - baked, and the old way (window._lxNoFillSkip) - at camera positions with one pillar,
// the other or none on screen, in phase 1 and phase 3, and compares every pixel. It also checks the passes are gone, the
// bake is reused frame to frame, re-made for a new phase, and released when the player leaves the domain.
//   node scripts/zod_grade_bake_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10621), MAP = process.env.MAP || 'zod_leo';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawBackground === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async (MAP) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._god = true; player.level = 120;
    loadMap(MAP, 300);
    const o = { ver: GAME_VERSION, runs: [] };
    for (let i = 0; i < 150; i++) {
      await sleep(200);
      for (const ov of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(ov); if (e && e.classList.contains('on')) e.classList.remove('on'); }
      const pil = LX_OBJECTS && LX_OBJECTS.column_pillar, z = _lxZodSignNow();
      if (_pickBGImage() && pil && pil.complete && pil.naturalWidth && z && _lxZodBoss(z)) break;
    }
    const z = _lxZodSignNow(), boss = z && _lxZodBoss(z);
    o.ready = !!(_pickBGImage() && z && boss);
    if (!o.ready) return o;
    const ww = game.mapData.worldWidth || 2000, pil = LX_OBJECTS.column_pillar, dw = pil.naturalWidth / pil.naturalHeight * 360;
    // drawBackground on its own, as the frame calls it; counts full-screen fills, and 'color' / 'multiply' fills by area
    const render = (old) => {
      window._lxNoFillSkip = old;
      const P = CanvasRenderingContext2D.prototype, fr = P.fillRect; const st = { full: 0, blendFull: 0, blendPx: 0 };
      P.fillRect = function (x, y, w, h) {
        if (this === ctx) { if (w >= W && h >= H) { st.full++; if (this.globalCompositeOperation === 'color' || this.globalCompositeOperation === 'multiply') st.blendFull++; } }
        return fr.apply(this, arguments); };
      try {
        ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(-30, -30, W + 60, H + 60);
        drawBackground();
      } finally { P.fillRect = fr; window._lxNoFillSkip = false; }
      const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(canvas, 0, 0);
      return { st, graded: !!(_LX_ZOD.gbg), px: x.getImageData(0, 0, c.width, c.height).data };
    };
    const compare = (a, b) => { let d2 = 0, d8 = 0, max = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > max) max = d; if (d > 2) d2++; if (d > 8) d8++; } return { d2, d8, max, n: a.length / 4 }; };
    render(false); render(true);   // warm: the sigil mint, the bake, the pillar feather
    const cams = [0, Math.round(ww * 0.5 - W / 2), Math.max(0, ww - W)];
    let bakeRef = null, reused = true;
    for (const ph of [1, 3]) {
      boss.phase = ph;
      for (const cx of cams) {
        game.camera.x = cx;
        // the stage animates on performance.now() (the sigil turns, the stars twinkle): both renders read one instant
        const _pn = performance.now, _t = _pn.call(performance); performance.now = () => _t;
        let a, b; try { a = render(false); b = render(true); } finally { performance.now = _pn; }
        if (ph === 1) { if (!bakeRef) bakeRef = _LX_ZOD.gbg; else if (_LX_ZOD.gbg !== bakeRef) reused = false; }
        const pillars = [Math.round(ww * 0.12), Math.round(ww * 0.88)].filter((px) => { const sx = px - cx; return !(sx < -dw || sx > W + dw); }).length;
        o.runs.push({ ph, cx, pillars, newFull: a.st.full, oldFull: b.st.full, newBlend: a.st.blendFull, oldBlend: b.st.blendFull, graded: a.graded, ...compare(a.px, b.px) });
      }
    }
    o.reused = reused; o.phaseKey = _LX_ZOD.gbgKey;
    boss.phase = 1;
    loadMap('forest', 300); await sleep(1500); drawBackground();
    o.released = !_LX_ZOD.gbg;
    return o;
  }, MAP);
  console.log(`build ${r.ver}  map ${MAP}  ready ${r.ready}`);
  for (const x of r.runs || []) console.log(`  phase ${x.ph} cam ${x.cx} (${x.pillars} pillar${x.pillars === 1 ? '' : 's'}): full-screen fills ${x.newFull} (was ${x.oldFull}), colour/multiply ${x.newBlend} (was ${x.oldBlend}); ${x.d2} px differ by >2, ${x.d8} by >8, max ${x.max}`);
  const R = r.runs || [];
  ok('the domain is up (backdrop, pillars, boss)', r.ready);
  // (a pillar's re-grade is three fillRects of the whole screen CLIPPED to its rectangle, so the hook counts them too)
  ok('the three full-screen grade passes are gone (a visible pillar re-grades only its own rectangle)', R.length && R.every((x) => x.graded && x.oldBlend === 2 && x.newBlend === 2 * x.pillars && x.newFull === x.oldFull - 4 + 3 * x.pillars), R.map((x) => x.newFull + '/' + x.oldFull).join(' '));
  // grading before the blit instead of after it is exact for the multiply and the sky (affine), and for the colour blend
  // everywhere but where it clips; with 8-bit rounding at each step, measured on Leo / Scorpio / Aquarius: at most 0.5% of
  // pixels 3-8 levels apart, and isolated pixels on the art's sharpest edges up to 17
  ok('...and the picture matches the old grade, pillars included (isolated edge pixels within 32 levels)', R.length && R.every((x) => x.d2 <= x.n * 0.01 && x.d8 <= x.n * 0.0005 && x.max <= 32), R.map((x) => x.d2 + '/' + x.d8 + ' max ' + x.max).join(' | '));
  ok('cameras with one pillar and with both pillars on screen are among the runs', R.some((x) => x.pillars === 1) && R.some((x) => x.pillars === 2), R.map((x) => x.pillars).join(''));
  ok('the bake is reused frame to frame, and re-made for a new phase', r.reused && /\|3\|/.test(r.phaseKey || ''), `reused ${r.reused}, last key ${r.phaseKey}`);
  ok('leaving the domain releases the bake', r.released === true);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
