// The planted standard is drawn at its own aspect, pre-scaled, and without the pool.
// ============================================================================
// Per user: "regenerate the sprite for this banner it should be much nicer and
// aesthetic and fit the game better, remove the weird glow around it" and "it
// should not looked squished as well".
//
// The art is a separate deliverable (reviewed by eye). This test pins the
// RENDERER, which is what made the old art squished and fringed and would do
// the same to the new art:
//
//   1. NO SQUISH: the drawImage call's dw/dh ratio equals the loaded image's
//      natural aspect within 2%. Baseline draws 92x150 (0.61) regardless of
//      the image (0.26 old / 0.34 new) -> fails.
//   2. PRE-SCALED SOURCE: the first argument to that drawImage is a cached
//      canvas produced by _lxProjScaled, not the raw Image. Baseline passes the
//      raw Image -> fails. This is the mechanism that removes the red fringe
//      (a 4.6x single-step bilinear shrink of a hard cutout).
//   3. NO POOL: no createRadialGradient with the pool's exact signature
//      (r0 = 2, r1 = h.w * 0.9) is issued on the main context while the banner
//      is the only hazard. Baseline issues one per frame -> fails.
//   4. CONTROL: the banner is genuinely being drawn (>= 1 matching drawImage
//      per frame), so the two rows above are not vacuously true.
//   5. the asset on disk has the pole base flush with its bottom edge (the
//      renderer anchors the image bottom to the floor line, so a padded
//      bottom would float the standard).
// Run: node scripts/warlord_banner_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/warlord_banner_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp'); sharp.cache(false);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

// ---- 5. asset: pole base flush with the bottom edge -------------------------
{
  const p = path.join(ROOT, 'Sprites', 'fx', 'warlord_banner_planted.webp');
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bottom = 0; for (let x = 0; x < info.width; x++) if (data[((info.height - 1) * info.width + x) * 4 + 3] > 128) bottom++;
  ok('asset: pole base is flush with the bottom edge (honest floor anchor)', bottom > 0,
     `${info.width}x${info.height}, ${bottom} opaque px on the bottom row`);
}

const PORT = Number(process.env.PORT || 11421);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
// loop() parks until the loading overlay carries .fade.
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1500);
  const img = LX_FX && LX_FX.warlord_banner_planted;
  for (let i = 0; i < 100 && !(img && img.complete && img.naturalWidth > 0); i++) await sleep(100);
  if (!(img && img.naturalWidth > 0)) return { err: 'banner image never decoded' };
  const natAr = img.naturalWidth / img.naturalHeight;

  game.hazards.length = 0; game.monsters.length = 0;
  const W0 = 92, H0 = 150;
  const cx = player.x + player.w / 2 + 40, footY = player.y + player.h;
  game.hazards.push({ type: 'warlord_banner', cx, x: cx - W0 / 2, y: footY - H0, w: W0, h: H0, footY,
                      life: 900, maxLife: 900, _dieAt: (game.time | 0) + 900 });

  // Spies on the MAIN context only.
  const P = CanvasRenderingContext2D.prototype;
  const oDraw = P.drawImage, oGrad = P.createRadialGradient;
  const draws = [], pools = [];
  P.drawImage = function (...a) {
    if (this === ctx) {
      const src = a[0];
      const cache = img._lxProjCache ? Object.values(img._lxProjCache) : [];
      const isBanner = src === img || cache.includes(src);
      if (isBanner && a.length === 5) draws.push({ preScaled: src !== img, dw: a[3], dh: a[4] });
    }
    return oDraw.apply(this, a);
  };
  P.createRadialGradient = function (...a) {
    if (this === ctx && a[2] === 2 && Math.abs(a[5] - W0 * 0.9) < 0.01) pools.push(1);
    return oGrad.apply(this, a);
  };
  for (let i = 0; i < 12; i++) { game.paused = false; await sleep(40); }
  P.drawImage = oDraw; P.createRadialGradient = oGrad;
  const _h = game.hazards[0];
  const _clip = _h ? { x: _h.cx - game.camera.x - 90, y: _h.footY - ((game.camera && game.camera.y) || 0) - 190, w: 180, h: 215 } : null;
  game.hazards.length = 0;
  const d = draws[draws.length - 1] || null;
  return { natAr: +natAr.toFixed(4), natural: img.naturalWidth + 'x' + img.naturalHeight, frames: 12,
           draws: draws.length, preScaled: draws.filter((x) => x.preScaled).length,
           drawAr: d ? +(d.dw / d.dh).toFixed(4) : null, dw: d ? d.dw : null, dh: d ? d.dh : null,
           pools: pools.length, clip: _clip };
});
if (process.env.LX_SHOT && R.clip) {
  // keep the banner alive for the shot, then clip around it (canvas px -> viewport via the wrapper scale)
  await page.evaluate(() => { const cx = player.x + player.w / 2 + 40, footY = player.y + player.h; game.hazards.push({ type: 'warlord_banner', cx, x: cx - 46, y: footY - 150, w: 92, h: 150, footY, life: 900, maxLife: 900, _dieAt: (game.time | 0) + 900 }); game.paused = false; });
  await page.waitForTimeout(400);
  const sc = await page.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, k: r.width / c.width }; });
  await page.screenshot({ path: process.env.LX_SHOT, clip: { x: sc.x + R.clip.x * sc.k, y: sc.y + R.clip.y * sc.k, width: R.clip.w * sc.k, height: R.clip.h * sc.k } });
  console.log('  shot -> ' + process.env.LX_SHOT);
}
await browser.close(); server.kill();

if (R.err) ok('the banner rendered at all', false, R.err);
else {
  console.log(`  image ${R.natural} (aspect ${R.natAr})   drawn ${R.dw}x${R.dh} (aspect ${R.drawAr})   draws ${R.draws}/${R.frames} frames, pre-scaled ${R.preScaled}, pool gradients ${R.pools}`);
  ok('CONTROL: the banner is being drawn every frame', R.draws >= 8, `${R.draws} banner draws in ${R.frames} frames`);
  ok('no squish: drawn aspect equals the image\'s natural aspect (within 2%)',
     R.drawAr != null && Math.abs(R.drawAr - R.natAr) / R.natAr < 0.02,
     `drawn ${R.drawAr} vs natural ${R.natAr} (baseline forces 92x150 = 0.613)`);
  ok('the source is the cached pre-scaled canvas, not the raw image (fringe mechanism removed)',
     R.draws > 0 && R.preScaled === R.draws, `${R.preScaled}/${R.draws} draws pre-scaled`);
  ok('the warm base pool is gone (no radial gradient with its signature)', R.pools === 0,
     `${R.pools} pool gradients in ${R.frames} frames (baseline: one per frame)`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
