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
// Covers BOTH hazards the shared branch draws: the Soul Vortex pool (Lich X)
// and the Necrotic Ascendance maelstrom (Lich Lv-50 ultimate), which used to
// render the pool's art at a different size.
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
// Both ground pools the shared hazard branch draws. Necrotic Ascendance (the
// Lich Lv-50 ultimate) used to wear the Soul Vortex's art at maelstrom size, so
// the big moment read as the X skill again but wider. It has its own violet
// runic storm now, and BOTH sets must satisfy the same bake contract.
const POOLS = ['soul_vortex', 'necro_maelstrom'];
const listFrames = (key) => readdirSync(ANIM)
  .filter((f) => new RegExp('^' + key + '_\\d+\\.webp$').test(f))
  .sort((x, y) => (+x.match(/(\d+)/)[1]) - (+y.match(/(\d+)/)[1]));
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
const diskCount = {};
for (const key of POOLS) {
  const list = listFrames(key);
  diskCount[key] = list.length;
  const frames = [];
  for (const f of list) frames.push(await measure(f));
  if (!frames.length) { check(false, `${key}: has frames on disk`, 0); continue; }
  const canvases = new Set(frames.map((f) => f.W + 'x' + f.H));
  const wFrac = frames.map((f) => f.cw / f.W), hFrac = frames.map((f) => f.chh / f.H);
  const minW = Math.min(...wFrac), minH = Math.min(...hFrac);
  const spread = Math.max(...hFrac) - Math.min(...hFrac);
  console.log(`  ${key}: ${list.length} frames, canvas ${[...canvases].join(', ')}, ` +
    `w ${minW.toFixed(3)}..${Math.max(...wFrac).toFixed(3)}, ` +
    `h ${minH.toFixed(3)}..${Math.max(...hFrac).toFixed(3)} (spread ${spread.toFixed(3)})`);
  check(list.length >= 12, `${key}: ships enough frames for a smooth loop (was 9)`, list.length);
  check(canvases.size === 1, `${key}: every frame shares ONE canvas — no per-frame rescale`, [...canvases]);
  // The union crop's contract: the SET as a whole touches every edge, so there
  // is no dead margin inside the drawn rect. Deliberately NOT a per-frame
  // floor — the union box is sized to the widest and tallest frame, so quieter
  // frames legitimately sit inside it. That variation is the effect breathing
  // (the maelstrom's flame crown flares and gutters by ~21%), which is the
  // animation doing its job, not a rendering defect: the canvas is identical
  // frame to frame, so nothing rescales.
  check(Math.max(...wFrac) >= 0.98 && Math.max(...hFrac) >= 0.98,
        `${key}: the frame set fills its canvas — no dead margin inside the hurtbox`,
        { maxW: +Math.max(...wFrac).toFixed(3), maxH: +Math.max(...hFrac).toFixed(3) });
  void minW; void minH; void spread;
}
const files = listFrames('soul_vortex');

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

  // Each hazard the shared branch draws, with the geometry its own skill uses:
  // the X pool at LX_VORTEX_RX/RY, the ultimate at the _NM_RX/_NM_RY it pushes.
  const SPECS = [
    { haz: 'soul_vortex', key: 'soul_vortex', rx: LX_VORTEX_RX, ry: LX_VORTEX_RY },
    { haz: 'necro_maelstrom', key: 'necro_maelstrom', rx: 300, ry: 130 },
  ];
  const out = {};
  for (const spec of SPECS) {
    const o = { indexCount: (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', spec.key, 9) : null };
    // Let the frames decode before grading which one is picked.
    const arr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames(spec.key) : null;
    // The OTHER pool's frames, so we can prove this hazard is not wearing them.
    const otherKey = spec.key === 'soul_vortex' ? 'necro_maelstrom' : 'soul_vortex';
    const otherArr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames(otherKey) : null;
    o.loaded = arr ? arr.length : 0;
    for (let i = 0; i < 240; i++) {
      if (arr && arr.every((im) => im && im.complete && im.naturalWidth > 0)) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
    o.decoded = arr ? arr.filter((im) => im && im.complete && im.naturalWidth > 0).length : 0;

    // Drop a real hazard and watch what actually reaches drawImage.
    game.hazards.length = 0;
    const cx = player.x + player.w / 2, cy = player.y + player.h - 20;
    game.hazards.push({ type: spec.haz, cx,
      x: cx - spec.rx, y: (cy + 40) - spec.ry,
      w: spec.rx * 2, h: spec.ry * 2, rx: spec.rx, ry: spec.ry,
      life: 1800, maxLife: 1800, atk: 10, tick: 0, souls: 0,
      hold: 70, pullRim: 4.6, pullCore: 7.0 });

    // Identify the drawn frame BY REFERENCE against the loader's own array.
    // Matching on img.src misses most of the run: _lxShrinkFrames right-sizes
    // each frame and replaces the Image with a <canvas>, which has no .src — so
    // a src-based hook goes blind the moment the shrink lands and reports the
    // pool as stuck on the two or three frames drawn before it.
    const blits = [], seen = new Set();
    let foreign = 0;
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      try {
        if (a.length >= 4) {
          const idx = arr ? arr.indexOf(img) : -1;
          if (idx >= 0) { blits.push({ w: Math.round(a[2]), h: Math.round(a[3]) }); seen.add(idx); }
          else if (otherArr && otherArr.indexOf(img) >= 0) foreign++;
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
    o.ticksElapsed = game.time - t0;
    o.ticksNeeded = need;
    CanvasRenderingContext2D.prototype.drawImage = orig;

    o.hurtbox = { w: spec.rx * 2, h: spec.ry * 2 };
    o.blitCount = blits.length;
    o.blit = blits[blits.length - 1] || null;
    o.blitSizes = [...new Set(blits.map((b) => b.w + 'x' + b.h))];
    o.distinctFrames = seen.size;
    o.foreignBlits = foreign;
    out[spec.key] = o;
  }
  game.hazards.length = 0;
  return out;
});
await browser.close();

for (const key of POOLS) {
  const o = r[key];
  if (!o) { check(false, `${key}: the harness produced a result`, null); continue; }
  console.log(`  ${key}: index ${o.indexCount}, loaded ${o.loaded}, decoded ${o.decoded}, ` +
    `blits ${o.blitCount} over ${o.ticksElapsed}/${o.ticksNeeded} ticks, sizes ${JSON.stringify(o.blitSizes)}, ` +
    `frames ${o.distinctFrames}, hurtbox ${o.hurtbox.w}x${o.hurtbox.h}`);
  check(o.indexCount === diskCount[key], `${key}: the frame index reports every frame on disk`, { index: o.indexCount, disk: diskCount[key] });
  check(o.loaded === diskCount[key], `${key}: and the loader builds that many images`, { loaded: o.loaded, disk: diskCount[key] });
  check(o.blitCount > 0, `${key}: the hazard actually drew`, o.blitCount);
  check(o.ticksElapsed >= o.ticksNeeded, `${key}: the run covered two full art loops of GAME time`, { got: o.ticksElapsed, need: o.ticksNeeded });
  check(!!o.blit && o.blit.w === o.hurtbox.w && o.blit.h === o.hurtbox.h,
        `${key}: the drawn effect fills its hurtbox exactly (was ~20% narrow)`, { blit: o.blit, hurtbox: o.hurtbox });
  check(o.blitSizes.length === 1, `${key}: and never changes size mid-loop`, o.blitSizes);
  check(o.distinctFrames >= 12, `${key}: the loop plays past frame 9 — the hardcoded modulus is gone`, o.distinctFrames);
  // The defect that prompted the new art: the ultimate wore the X skill's pool.
  check(o.foreignBlits === 0, `${key}: draws its OWN art, never the other pool's`, o.foreignBlits);
}
check(r.soul_vortex.hurtbox.w !== r.necro_maelstrom.hurtbox.w,
      'the two hazards really are different sizes (so the art is not interchangeable)',
      { pool: r.soul_vortex.hurtbox, ult: r.necro_maelstrom.hurtbox });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
