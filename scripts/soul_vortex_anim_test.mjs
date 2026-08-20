// The Soul Vortex pool draws its whole hurtbox and animates smoothly, per user
// "generate a better sprite and animation for soul vortex, the animation could
// be smoother as well".
//
// Three defects this guards, all measured on the previous build:
//   1. The frame modulus was the literal 9 while the loader has asked the frame
//      index for the real count since v0.29.519 — so a longer set would have
//      silently played only its first nine frames.
//   2. The renderer scaled the draw box by baked content fractions (0.76 x 0.46)
//      taken from the STATIC sprite, but the ANIMATED frames measured 0.60 x
//      0.37-0.43 of their canvas. The animated pool — which is what is on screen
//      for all but the first few decode frames — therefore drew ~20% narrower
//      than the region that actually damages, the same class of mismatch
//      v0.29.671 fixed for the static art only.
//   3. Frame content height swung +/-16% across the set, so the pool rescaled
//      every loop: visible size-jitter, read as choppiness.
//
// So this grades the SHIPPED FRAMES (identical canvas, content filling it) and
// the LIVE DRAW (the blit rect equals the hurtbox rect), never a literal — a
// future re-bake that reintroduces padding or a per-frame rescale fails here.
// Run: node scripts/soul_vortex_anim_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readdirSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

// ---------- the art on disk ----------
const ANIM = path.join(ROOT, 'Sprites', 'fx', 'anim');
const files = readdirSync(ANIM).filter((f) => /^soul_vortex_\d+\.webp$/.test(f))
  .sort((a, b) => (+a.match(/(\d+)/)[1]) - (+b.match(/(\d+)/)[1]));
const ALPHA = 24;
const measure = async (file) => {
  const { data, info } = await sharp(path.join(ANIM, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (data[(y * W + x) * C + 3] > ALPHA) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return { W, H, cw: x1 - x0 + 1, chh: y1 - y0 + 1 };
};
const frames = [];
for (const f of files) frames.push(await measure(f));
const canvases = new Set(frames.map((f) => f.W + 'x' + f.H));
const wFrac = frames.map((f) => f.cw / f.W), hFrac = frames.map((f) => f.chh / f.H);
const minW = Math.min(...wFrac), minH = Math.min(...hFrac);
const spread = Math.max(...hFrac) - Math.min(...hFrac);

console.log(`  frames: ${files.length}   canvases: ${[...canvases].join(', ')}`);
console.log(`  content width  ${minW.toFixed(3)}..${Math.max(...wFrac).toFixed(3)}`);
console.log(`  content height ${minH.toFixed(3)}..${Math.max(...hFrac).toFixed(3)}  (spread ${spread.toFixed(3)})`);

check(files.length >= 12, 'the pool ships enough frames for a smooth loop (was 9)', files.length);
check(canvases.size === 1, 'every frame shares ONE canvas — no per-frame rescale', [...canvases]);
check(minW >= 0.94 && minH >= 0.90, 'content fills its canvas, so no invisible margin inside the hurtbox',
      { minW: +minW.toFixed(3), minH: +minH.toFixed(3) });
check(spread <= 0.10, 'content height is stable across the loop (was a +/-16% pulse)', +spread.toFixed(3));

// ---------- the live draw ----------
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 90; player.hp = player.maxHp = 9e8;
  loadMap('forest');
  for (let i = 0; i < 180; i++) { if (game.currentMap === 'forest') break; await new Promise((res) => requestAnimationFrame(res)); }
  for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));

  const out = { indexCount: (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', 'soul_vortex', 9) : null };
  // Let the frames decode before grading which one is picked.
  const arr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('soul_vortex') : null;
  out.loaded = arr ? arr.length : 0;
  for (let i = 0; i < 240; i++) {
    if (arr && arr.every((im) => im && im.complete && im.naturalWidth > 0)) break;
    await new Promise((res) => requestAnimationFrame(res));
  }
  out.decoded = arr ? arr.filter((im) => im && im.complete && im.naturalWidth > 0).length : 0;

  // Drop a real pool and watch what actually reaches drawImage.
  game.hazards.length = 0;
  const cx = player.x + player.w / 2, cy = player.y + player.h - 20;
  game.hazards.push({ type: 'soul_vortex', cx,
    x: cx - LX_VORTEX_RX, y: (cy + 40) - LX_VORTEX_RY,
    w: LX_VORTEX_RX * 2, h: LX_VORTEX_RY * 2,
    life: 1800, maxLife: 1800, atk: 10, tick: 0 });

  // Identify the drawn frame BY REFERENCE against the loader's own array.
  // Matching on img.src misses most of the run: _lxShrinkFrames right-sizes
  // each frame and replaces the Image with a <canvas>, which has no .src — so
  // a src-based hook goes blind the moment the shrink lands and reports the
  // pool as stuck on the two or three frames drawn before it.
  const blits = [], seen = new Set();
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    try {
      if (a.length >= 4 && arr) {
        const idx = arr.indexOf(img);
        if (idx >= 0) { blits.push({ w: Math.round(a[2]), h: Math.round(a[3]) }); seen.add(idx); }
      }
    } catch (e) {}
    return orig.call(this, img, ...a);
  };
  game.paused = false;
  // Drive by GAME time, not by rAF count. game.time advances roughly once per
  // four rAF here, so a "96 frames" loop covered barely half of one 48-tick
  // art loop and graded the pool as stuck on two frames. The loop needs
  // 2 x (frames x 3) ticks of game time to be seen whole.
  const t0 = game.time;
  const need = (arr ? arr.length : 16) * 3 * 2 + 6;
  for (let i = 0; i < 4000 && (game.time - t0) < need; i++) {
    await new Promise((res) => requestAnimationFrame(res));
  }
  out.ticksElapsed = game.time - t0;
  out.ticksNeeded = need;
  CanvasRenderingContext2D.prototype.drawImage = orig;

  out.hurtbox = { w: LX_VORTEX_RX * 2, h: LX_VORTEX_RY * 2 };
  out.blitCount = blits.length;
  out.blit = blits[blits.length - 1] || null;
  out.blitSizes = [...new Set(blits.map((b) => b.w + 'x' + b.h))];
  out.distinctFrames = seen.size;
  out.framesSeen = [...seen].sort((a, b) => a - b);
  return out;
});
await browser.close();

console.log(`  index says ${r.indexCount} frames, loader built ${r.loaded}, decoded ${r.decoded}`);
console.log(`  blits: ${r.blitCount} over ${r.ticksElapsed}/${r.ticksNeeded} game ticks, sizes ${JSON.stringify(r.blitSizes)}, distinct frames drawn ${r.distinctFrames}`);
console.log(`  hurtbox ${JSON.stringify(r.hurtbox)}  blit ${JSON.stringify(r.blit)}`);

check(r.indexCount === files.length, 'the frame index reports every frame on disk', { index: r.indexCount, disk: files.length });
check(r.loaded === files.length, 'and the loader builds that many images', { loaded: r.loaded, disk: files.length });
check(r.blitCount > 0, 'the pool actually drew', r.blitCount);
check(r.ticksElapsed >= r.ticksNeeded, 'the run covered two full art loops of GAME time', { got: r.ticksElapsed, need: r.ticksNeeded });
check(!!r.blit && r.blit.w === r.hurtbox.w && r.blit.h === r.hurtbox.h,
      'the drawn pool fills its hurtbox exactly (was ~20% narrow)', { blit: r.blit, hurtbox: r.hurtbox });
check(r.blitSizes.length === 1, 'and never changes size mid-loop', r.blitSizes);
check(r.distinctFrames >= 12,
      'the loop plays past frame 9 — the hardcoded modulus is gone', r.distinctFrames);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
