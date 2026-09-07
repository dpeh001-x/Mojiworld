// v0.30.416 — damage-number bitmap must match the live raster at DPR 2.
// Renders one settled number (age 20, rot 0) twice at deviceScaleFactor 2:
// through the LIVE path and through the baked BITMAP path, reads both back
// in device pixels and compares. A CSS-resolution bake upscaled by the DPR
// diverges hard (blur); a device-resolution bake matches within a few
// levels. Also screenshots both for the eye.
//   node scripts/dn_bitmap_dpr_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11101);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Dpr');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  window._prologueActive = false; game.paused = true;
  const out = { dpr: _LX_DPR, devicePixelRatio: window.devicePixelRatio, cases: [] };
  const cx = game.camera.x, cy = (game.camera.y || 0);
  // one region per case; both renders land at the same spot so the diff is 1:1
  const render = (d, useBitmap) => {
    ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0);
    ctx.fillStyle = '#1e1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (useBitmap) delete d._bk; else d._bk = null;   // null = "bake failed, stay live"
    game.damageNumbers = [d];
    drawDamageNumbers();
    const D = _LX_DPR;
    const x0 = Math.round((d.x - cx - 140) * D), y0 = Math.round((d.y - cy - 60) * D);
    return ctx.getImageData(x0, y0, Math.round(280 * D), Math.round(90 * D));
  };
  for (const kind of ['plain', 'big', 'crit']) {
    const d = { x: cx + 400, y: cy + 300, vy: 0, text: '502,586★', life: 25, maxLife: 45, size: kind === 'crit' ? 22 : 14,
      color: kind === 'crit' ? '#ffd84a' : (kind === 'big' ? '#ff8a66' : '#ffffff'), crit: kind === 'crit', big: kind === 'big' };
    const live = render(d, false), bit = render(d, true);
    const a = live.data, b = bit.data;
    let sum = 0, n = 0, hard = 0, inkedLive = 0, inkedBit = 0;
    for (let i = 0; i < a.length; i += 4) {
      const la = (a[i] + a[i + 1] + a[i + 2]) / 3, lb = (b[i] + b[i + 1] + b[i + 2]) / 3;
      if (la > 60) inkedLive++; if (lb > 60) inkedBit++;
      const dd = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      sum += dd; n++; if (dd > 120) hard++;
    }
    out.cases.push({ kind, meanDiff: +(sum / n / 3).toFixed(2), hardPct: +(hard / n * 100).toFixed(2), inkedLive, inkedBit, baked: !!(d._bk && d._bk.cv), bakeW: d._bk && d._bk.cv.width, bakeCss: d._bk && d._bk.w });
  }
  return out;
});
let shotPath = null;
if (SHOT) {
  const dataUrl = await page.evaluate(() => {
    ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0);
    ctx.fillStyle = '#1e1a2e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = game.camera.x, cy = (game.camera.y || 0);
    const mk = (x, bm) => { const d = { x: cx + x, y: cy + 300, vy: 0, text: '502,586★', life: 25, maxLife: 45, size: 22, color: '#ffd84a', crit: true }; if (!bm) d._bk = null; return d; };
    game.damageNumbers = [mk(300, false), mk(760, true)];
    drawDamageNumbers();
    const D = _LX_DPR, c2 = document.createElement('canvas'); c2.width = Math.round(1000 * D); c2.height = Math.round(120 * D);
    c2.getContext('2d').drawImage(canvas, Math.round(100 * D), Math.round(240 * D), c2.width, c2.height, 0, 0, c2.width, c2.height);
    return c2.toDataURL('image/png');
  });
  fs.writeFileSync(SHOT, Buffer.from(dataUrl.split(',')[1], 'base64'));
  shotPath = SHOT;
}
await browser.close(); server.kill();

console.log(`page DPR=${r.dpr} devicePixelRatio=${r.devicePixelRatio}`);
let fails = 0;
for (const c of r.cases) {
  // Thresholds sit between the two builds as measured at DPR 2: the CSS-res
  // bake (v0.30.415) scored meanDiff 1.47-2.69 / hard 1.08-1.96%; the
  // device-res bake scores 0.65-1.29 / 0.37-0.69%.
  const pass = c.baked && c.meanDiff < 1.4 && c.hardPct < 0.9;
  if (!pass) fails++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.kind.padEnd(5)} live-vs-bitmap meanDiff=${c.meanDiff} hard=${c.hardPct}%  inked ${c.inkedLive}/${c.inkedBit}  bake ${c.bakeW}px for ${c.bakeCss}css`);
}
if (shotPath) console.log('shot (live left, bitmap right) -> ' + shotPath);
console.log(`${r.cases.length - fails}/${r.cases.length} passed`);
process.exit(fails ? 1 : 0);
