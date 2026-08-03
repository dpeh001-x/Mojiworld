// Measure the damage number's BLACK outline in DEVICE pixels across a full
// number lifetime. lineWidth is user-space, so the real width is
// lineWidth × the current transform's horizontal scale — that product is what
// the eye sees, and what must stay constant.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof drawDamageNumbers === 'function' || typeof game === 'object', { timeout: 60000 });

const out = await page.evaluate(() => {
  const widths = { normal: [], crit: [] };
  const oStroke = ctx.strokeText.bind(ctx);
  let bucket = null;
  ctx.strokeText = function (t, x, y) {
    if (bucket && String(ctx.strokeStyle).toLowerCase() === '#000000') {
      const m = ctx.getTransform();
      widths[bucket].push(+(ctx.lineWidth * m.a).toFixed(3));
    }
    return oStroke(t, x, y);
  };
  const draw = (typeof drawDamageNumbers === 'function') ? drawDamageNumbers : null;
  if (!draw) { ctx.strokeText = oStroke; return { err: 'drawDamageNumbers not found' }; }

  for (const crit of [false, true]) {
    bucket = crit ? 'crit' : 'normal';
    const maxLife = 38;
    for (let age = 0; age < maxLife; age++) {
      game.damageNumbers = [{
        x: (game.camera ? game.camera.x : 0) + 100, y: (game.camera ? game.camera.y : 0) + 100,
        vy: -1, text: '1234', life: maxLife - age, maxLife, crit, color: '#fff', size: 14, wobbleDir: 1,
      }];
      try { draw(); } catch (e) { /* keep going */ }
    }
  }
  ctx.strokeText = oStroke;
  game.damageNumbers = [];
  return widths;
});
await browser.close();
if (out.err) { console.log(out.err); process.exit(1); }

let bad = 0;
for (const k of ['normal', 'crit']) {
  const w = out[k];
  if (!w.length) { console.log(`${k}: no samples`); bad++; continue; }
  const mn = Math.min(...w), mx = Math.max(...w);
  const drift = +(mx - mn).toFixed(3);
  if (drift > 0.25) bad++;
  console.log(`${k.padEnd(7)} n=${String(w.length).padEnd(3)} min=${mn.toFixed(2)}px  max=${mx.toFixed(2)}px  drift=${drift}px  ${drift <= 0.25 ? 'CONSTANT' : '<-- STILL VARIES'}`);
  console.log(`        first 12 frames: ${w.slice(0, 12).map((x) => x.toFixed(1)).join(', ')}`);
}
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
process.exit(bad || errs.length ? 1 : 0);
