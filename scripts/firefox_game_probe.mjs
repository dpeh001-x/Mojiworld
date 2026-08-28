// Boot the real game in Firefox and in Chromium; compare.
// ============================================================================
// The capability probe cleared my first theory (Firefox 153 DOES honour the
// createImageBitmap resize options, and ctx.filter works), so this stops
// guessing and boots the actual page in both engines, recording:
//   - page errors / console errors        ("sprites will not load")
//   - failed requests + their status
//   - how many sprite <img>s reached naturalWidth > 0
//   - frame time over a fixed wall-clock window   ("very lag")
// Run: node scripts/firefox_game_probe.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/') + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10877);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [], failed = [], slow = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  page.on('requestfailed', r => failed.push(r.url().split('/').slice(-2).join('/') + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url().split('/').slice(-2).join('/') + ' :: HTTP ' + r.status()); });

  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  const tLoad = Date.now() - t0;
  await page.waitForTimeout(12000);   // let the sprite preload settle

  const R = await page.evaluate(() => new Promise((done) => {
    // Sprites are new Image() objects that never enter the DOM, so
    // document.images saw only 13. The resource timeline sees every one.
    const imgs = performance.getEntriesByType('resource')
      .filter(e => /[.](webp|png|jpg|gif)([?#]|$)/i.test(e.name));
    const bytes = imgs.reduce((a, e) => a + (e.encodedBodySize || 0), 0);
    const netMs = imgs.reduce((a, e) => a + (e.duration || 0), 0);

    // Frame time over a 4s wall-clock window, sampled from rAF deltas.
    const d = []; let last = performance.now(); const end = last + 4000;
    const tick = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else {
      d.sort((a, b) => a - b);
      done({ imgTotal: imgs.length, bytes, netMs: +netMs.toFixed(0),
             frames: d.length,
             median: +d[d.length >> 1].toFixed(2),
             p95: +d[Math.floor(d.length * 0.95)].toFixed(2),
             worst: +d[d.length - 1].toFixed(2) });
    } };
    requestAnimationFrame(tick);
  }));
  await page.close();
  return { name, tLoad, ...R, errs: [...new Set(errs)].slice(0, 8), failed: [...new Set(failed)].slice(0, 8) };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !!process.env.LX_HEADLESS })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: !!process.env.LX_HEADLESS })]]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed ${e.message}`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0,200)}`); }
  await b.close();
}
server.kill();
for (const r of out) {
  console.log(`\n### ${r.name}`);
  console.log(`  load ${r.tLoad}ms | ${r.imgTotal} image requests | ${(r.bytes/1048576).toFixed(1)}MB | ${r.netMs}ms summed fetch`);
  console.log(`  frame ms  median ${r.median}  p95 ${r.p95}  worst ${r.worst}   (${r.frames} frames in 4s = ${(r.frames/4).toFixed(0)} fps)`);
  if (r.errs.length)   console.log('  ERRORS:\n    ' + r.errs.join('\n    '));
  if (r.failed.length) console.log('  FAILED REQ:\n    ' + r.failed.join('\n    '));
}
