// The quake telegraph's plume must render at the sprite's authored aspect.
//
// Sprites/vfx/quake_ring.webp is 768x768 with 739x560 of opaque content
// (aspect 0.7578) sitting flush to the canvas bottom. It is a SIDE-ON dust
// plume, not the top-down ring the manifest comment used to claim, so drawing
// it into a flat ellipse box squashes it into a smear. This intercepts the real
// ctx.drawImage call during drawHazards and measures what was actually painted,
// rather than re-deriving the maths that produced it.
// Run: node scripts/quake_ring_aspect_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
// --allow-file-access-from-files: this test getImageData()s the loaded sprite to
// measure its opaque box live, and a file:// image taints the canvas without it.
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawHazards === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 60;
  try { loadMap('blockland_apex'); } catch (e) {}
});
await page.waitForTimeout(7000);

const r = await page.evaluate(async () => {
  // content box of the source art, measured live so the test cannot drift from
  // the asset the game actually loads
  const src = _lxVfxFrame('quakeRing');
  const cc = document.createElement('canvas');
  cc.width = src.naturalWidth || src.width; cc.height = src.naturalHeight || src.height;
  const cx2 = cc.getContext('2d'); cx2.drawImage(src, 0, 0);
  const px = cx2.getImageData(0, 0, cc.width, cc.height).data;
  let x0 = cc.width, y0 = cc.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cc.height; y++) for (let x = 0; x < cc.width; x++) {
    if (px[(y * cc.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const srcW = x1 - x0 + 1, srcH = y1 - y0 + 1;

  game.paused = true;
  game.projectiles.length = 0; game.monsters.length = 0; game.hazards.length = 0;
  const gy = (game.mapData && game.mapData.worldHeight ? game.mapData.worldHeight - 60 : 680);
  const h = { type: 'mob_quake', cx: player.x + player.w / 2, x: player.x - 280,
    y: gy - 30, w: 560, h: 50, life: 4, maxLife: 90, damage: 400, stun: 700, colorTele: '#ff8844' };
  game.hazards.push(h);

  // Identify the plume by SOURCE URL, not by object identity. quakeRing is a
  // 9-frame growth sequence, so the frame on screen is usually not the one
  // _lxVfxFrame handed back a moment earlier - matching on identity silently
  // recorded zero calls and the test passed its way into a false negative.
  const calls = [];
  const keep = ctx.drawImage;
  ctx.drawImage = function (img, ...a) {
    const u = (img && (img.currentSrc || img.src)) || '';
    if (/quake_ring/i.test(u)) {
      calls.push({ args: a.length >= 8 ? a.slice(4) : a, sw: img.naturalWidth || img.width, sh: img.naturalHeight || img.height, u: u.split('/').pop() });
    }
    return keep.apply(ctx, [img, ...a]);
  };
  try { drawHazards(); } catch (e) {}
  ctx.drawImage = keep;

  const out = { srcCanvas: [cc.width, cc.height], srcContent: [srcW, srcH],
    srcAspect: srcH / srcW, nCalls: calls.length, groundY: h.y + 16 };
  if (calls.length) {
    const c0 = calls[0];
    const [dx, dy, dw, dh] = c0.args;
    out.frame = c0.u;
    out.srcWH = [c0.sw, c0.sh];
    out.drawn = { dx: Math.round(dx), dy: Math.round(dy), dw: Math.round(dw), dh: Math.round(dh) };
    // The invariant that does not depend on which frame is up: the source canvas
    // must be painted undistorted. Every frame is square, and the content inside
    // grows upward from a baseline that is flush to the canvas bottom in all 9,
    // so an undistorted square draw preserves BOTH the authored aspect and the
    // growth animation. Cropping to the per-frame content box would flatten the
    // growth into a billow-in-place.
    out.srcRatio = c0.sh / c0.sw;
    out.dstRatio = dh / dw;
    out.distortion = out.dstRatio / out.srcRatio;
    // content base = canvas bottom (0.9987 of the canvas in every frame)
    out.contentBottomY = dy + dh * 0.9987;
    out.baseOffset = out.contentBottomY - (h.y + 16);
  }

  // --- PLUME ONLY: sweep the whole telegraph and record every frame used ----
  // The 9-frame set erupts and then becomes an expanding debris ring: 0-2 are
  // the plume, 3 adds a smoke torus, 4-8 spread the ring. Sampling one instant
  // proves nothing here, because the old bug was that the frame came from a
  // free-running wall clock - it could look right on any given tick.
  const seen = [];
  for (let life = h.maxLife; life >= 0; life -= 3) {
    game.hazards.length = 0;
    game.hazards.push({ ...h, life });
    const k2 = ctx.drawImage;
    ctx.drawImage = function (img, ...a) {
      const u = (img && (img.currentSrc || img.src)) || '';
      if (/quake_ring/i.test(u)) seen.push(u.split('/').pop());
      return k2.apply(ctx, [img, ...a]);
    };
    try { drawHazards(); } catch (e) {}
    ctx.drawImage = k2;
  }
  out.framesSeen = [...new Set(seen)].sort();
  out.ringFrames = out.framesSeen.filter((f) => {
    const m = f.match(/quake_ring_(\d+)\./);
    return m && +m[1] >= 3;
  });
  out.samples = seen.length;
  return out;
});
await browser.close();

console.log(`  static art ${r.srcCanvas.join('x')} canvas, ${r.srcContent.join('x')} content, aspect ${r.srcAspect.toFixed(4)}`);
if (r.drawn) {
  console.log(`  frame drawn: ${r.frame} (${r.srcWH.join('x')})`);
  console.log(`  drawn  dx${r.drawn.dx} dy${r.drawn.dy} ${r.drawn.dw}x${r.drawn.dh}`);
  console.log(`  src h/w ${r.srcRatio.toFixed(4)} vs dst h/w ${r.dstRatio.toFixed(4)}  ->  distortion ${r.distortion.toFixed(4)} (1.0 = undistorted)`);
  console.log(`  plume base sits ${r.baseOffset.toFixed(1)}px below the ground line`);
}

console.log(`  frames used across the whole telegraph (${r.samples} samples): ${JSON.stringify(r.framesSeen)}`);

check(r.nCalls >= 1, 'the plume sprite is actually drawn during the telegraph', r.nCalls);
check(r.samples > 0, 'the sweep actually sampled draws (else the ring check is vacuous)', r.samples);
check(r.ringFrames.length === 0, 'no debris-ring frame (3-8) is ever used — plume only', r.ringFrames);
if (r.drawn) {
  check(Math.abs(r.distortion - 1) <= 0.02, 'the source canvas is painted undistorted (not squashed)', { srcRatio: r.srcRatio, dstRatio: r.dstRatio, distortion: r.distortion });
  check(r.baseOffset >= -8 && r.baseOffset <= 14, 'the plume base sits on the ground line, not buried below it', r.baseOffset);
}
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
