// Live test: A DAMAGE NUMBER'S OUTLINE IS THE SAME WEIGHT IN EVERY PHASE OF ITS LIFE.
// ============================================================================
// Per user: the outline "sometimes" renders soft instead of crisp. A number draws
// LIVE (real glyph rasterisation) while it pops in and while it fades, and blits a
// BAKED bitmap for the settled stretch between. Measured before the fix, that blit
// put a 171x90 raster into a 170.667 x 89.333 device rect at device y 344.933 --
// fractional on both axes plus a 0.998 scale, so the rasteriser resampled the whole
// bitmap and the 5 px outline came out as a smear next to a live neighbour's.
//
// This pins the two properties that make a blit unresampled: the destination lands
// on whole device pixels, and the raster is drawn at exactly its own size. Plus the
// invariant behind the original complaint -- the live path's outline is a constant
// device width whatever the pop-in / bob scale is doing.
//   node scripts/dmgnum_outline_test.mjs [build.html]
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9483';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1400));
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
await page.goto('http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html') + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawDamageNumbers === 'function', { timeout: 60000 });
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; window._lxBootGateDone = true; const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} } const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none'; try { _prologueActive = false; } catch (e) {} });
await page.waitForTimeout(6000);
const r = await page.evaluate(async () => {
  try { loadMap('forest', 300); } catch (e) {}
  await new Promise((res) => setTimeout(res, 700));
  game.paused = false;
  // x deliberately off the pixel grid: the bug is about fractional placement
  const mk = (x, life) => ({ x: x + 0.37, y: 300.61, text: '93,800', color: '#ffd84a', life, maxLife: life + 1, crit: true, size: 22, vy: 0, wobbleDir: 1 });
  const blits = [], strokes = [];
  const _di = ctx.drawImage, _st = ctx.strokeText;
  ctx.drawImage = function (im, ...a) {
    if (im && im.tagName === 'CANVAS') {
      const t = this.getTransform();
      const rec = { args: a.length, rasterW: im.width, rasterH: im.height, a: +t.a.toFixed(4) };
      if (a.length === 2) { rec.devX = +(t.a * a[0] + t.e).toFixed(4); rec.devY = +(t.d * a[1] + t.f).toFixed(4); rec.devW = im.width * t.a; rec.devH = im.height * t.d; }
      else if (a.length === 4) { rec.devX = +(t.a * a[0] + t.e).toFixed(4); rec.devY = +(t.d * a[1] + t.f).toFixed(4); rec.devW = +(t.a * a[2]).toFixed(4); rec.devH = +(t.d * a[3]).toFixed(4); }
      blits.push(rec);
    }
    return _di.apply(this, arguments);
  };
  ctx.strokeText = function (txt, x, y) {
    if (String(this.strokeStyle) === '#000000') strokes.push(+(this.lineWidth * this.getTransform().a).toFixed(3));
    return _st.apply(this, arguments);
  };
  game.damageNumbers = [mk(400, 40), mk(700, 56)];
  for (let i = 0; i < 14; i++) { drawDamageNumbers(); for (const d of game.damageNumbers) d.life--; }
  ctx.drawImage = _di; ctx.strokeText = _st;
  const whole = (v) => Math.abs(v - Math.round(v)) < 0.01;
  return {
    dpr: _LX_DPR, n: blits.length,
    offGrid: blits.filter((b) => !whole(b.devX) || !whole(b.devY)).length,
    resampled: blits.filter((b) => Math.abs(b.devW - b.rasterW) > 0.01 || Math.abs(b.devH - b.rasterH) > 0.01).length,
    sample: blits.slice(0, 3),
    outlineDev: [...new Set(strokes)].sort((a, b) => a - b),
  };
});
await browser.close(); try { _srv.kill(); } catch (e) {}
console.log(JSON.stringify(r));
ok('a settled number blits its baked raster (the phase the report calls soft exists at all)', r.n > 0, { blits: r.n });
ok('every baked blit lands on WHOLE device pixels — a fractional offset resamples the bitmap', r.n > 0 && r.offGrid === 0, { offGrid: r.offGrid + '/' + r.n, sample: r.sample });
ok('every baked blit draws the raster at exactly its own size — a 0.998 scale resamples it too', r.n > 0 && r.resampled === 0, { resampled: r.resampled + '/' + r.n, sample: r.sample });
// the live path's own invariant (v0.29.408): 5 css px cancelled against the animation scale
const spread = r.outlineDev.length ? (r.outlineDev[r.outlineDev.length - 1] - r.outlineDev[0]) : 99;
ok('the live outline is one constant device width across the pop-in and the bob', r.outlineDev.length > 0 && spread < 0.05, { widths: r.outlineDev });
ok('...and that width is the intended 5 css px at this render scale', r.outlineDev.length > 0 && Math.abs(r.outlineDev[0] - 5 * r.dpr) < 0.05, { got: r.outlineDev[0], want: +(5 * r.dpr).toFixed(3) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
