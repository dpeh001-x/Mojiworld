// What does a machine with NO GRAPHICS CARD actually experience?
//
// Chromium falls back to software rasterisation when the GPU is unavailable.
// The cost model inverts: fill rate, globalAlpha, composite modes, shadowBlur
// and large scaled blits dominate, while GPU readbacks get cheaper. A
// main-thread CPU profile cannot see any of it — rasterisation happens off the
// JS thread — so the honest measure is END-TO-END FRAME TIME with the GPU off.
//
// Reports the frame-time distribution, and (with --probe) how much each
// expensive canvas feature costs on THIS renderer, so tuning targets the
// operations that are actually slow here rather than the ones that are slow on
// a GPU.
//   node scripts/perf_swrender_frames.mjs [file.html] [--map=town] [--secs=8] [--fill] [--gpu] [--probe]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--')) || 'mojiworld_game.html';
const MAP = (args.find(a => a.startsWith('--map=')) || '').split('=')[1] || 'town';
const SECS = +((args.find(a => a.startsWith('--secs=')) || '').split('=')[1] || 8);
const FILL = args.includes('--fill');
const GPU = args.includes('--gpu');
const PROBE = args.includes('--probe');
const URL = 'file:///' + path.join(ROOT, file).split(path.sep).join('/');

const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--allow-file-access-from-files'].concat(
    GPU ? [] : ['--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing']),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });

const setup = await page.evaluate(async ({ MAP, FILL }) => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 25000))]); } catch (e) {}
  loadMap(MAP);
  player.cls = 'warrior'; player.level = 60; player._god = true; game.paused = false;
  if (FILL) {
    const cap = (game.mapData.monsterCap || 20);
    const t = (game.mapData.spawns || []).map(s => s.type).filter(Boolean);
    let g = 0;
    while (game.monsters.length < cap && t.length && g++ < 400) {
      try { spawnMonster(200 + (g * 97) % 1600, 300, t[g % t.length], false, false); } catch (e) { break; }
    }
  }
  if (typeof _lxNextFrame === 'function') _lxNextFrame();
  return { map: MAP, monsters: game.monsters.length, npcs: (game.npcs || []).length };
}, { MAP, FILL });

await page.waitForTimeout(3000);   // settle: let decodes / bakes land first
await page.evaluate(() => {
  window.__ft = []; let last = performance.now();
  const t = () => { const n = performance.now(); window.__ft.push(n - last); last = n; requestAnimationFrame(t); };
  requestAnimationFrame(t);
});
await page.waitForTimeout(SECS * 1000);

const out = await page.evaluate(() => {
  const raw = window.__ft.slice(5);
  const f = raw.slice().sort((a, b) => a - b);
  const p = q => f.length ? +f[Math.min(f.length - 1, Math.floor(f.length * q))].toFixed(2) : 0;
  return { frames: f.length, median: p(0.5), p95: p(0.95), p99: p(0.99),
           over16: +(raw.filter(x => x > 16.7).length / raw.length * 100).toFixed(1),
           over33: +(raw.filter(x => x > 33.3).length / raw.length * 100).toFixed(1) };
});

console.log(`\n${GPU ? 'GPU' : 'SOFTWARE (no GPU)'}   scene: ${setup.map}   monsters ${setup.monsters}   npcs ${setup.npcs}`);
console.log(`frames ${out.frames}   median ${out.median}ms   p95 ${out.p95}ms   p99 ${out.p99}ms`);
console.log(`below 60fps: ${out.over16}%   below 30fps: ${out.over33}%`);

if (PROBE) {
  // Micro-bench the canvas features that behave very differently in software.
  // Same work each time, so the numbers are directly comparable to one another.
  const b = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
    const g = c.getContext('2d');
    const spr = document.createElement('canvas'); spr.width = 128; spr.height = 128;
    const sg = spr.getContext('2d'); sg.fillStyle = '#c85'; sg.fillRect(0, 0, 128, 128);
    const N = 2000;
    const time = (fn) => { const t0 = performance.now(); fn(); return +(performance.now() - t0).toFixed(1); };
    const res = {};
    res.blit_1to1        = time(() => { for (let i = 0; i < N; i++) g.drawImage(spr, i % 1000, 0); });
    res.blit_scaled      = time(() => { for (let i = 0; i < N; i++) g.drawImage(spr, i % 1000, 0, 40, 40); });
    res.blit_alpha       = time(() => { g.globalAlpha = 0.5; for (let i = 0; i < N; i++) g.drawImage(spr, i % 1000, 0); g.globalAlpha = 1; });
    res.blit_lighter     = time(() => { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < N; i++) g.drawImage(spr, i % 1000, 0); g.globalCompositeOperation = 'source-over'; });
    res.blit_shadow      = time(() => { g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; for (let i = 0; i < N / 10; i++) g.drawImage(spr, i % 1000, 0); g.shadowBlur = 0; });
    res.fillRect         = time(() => { g.fillStyle = '#456'; for (let i = 0; i < N; i++) g.fillRect(i % 1000, 0, 128, 128); });
    res.arc_fill         = time(() => { g.fillStyle = '#456'; for (let i = 0; i < N; i++) { g.beginPath(); g.arc(i % 1000, 100, 20, 0, 6.283); g.fill(); } });
    res.radialGradient   = time(() => { for (let i = 0; i < N / 10; i++) { const rg = g.createRadialGradient(100, 100, 0, 100, 100, 60); rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(40, 40, 120, 120); } });
    res.filter_blur      = time(() => { g.filter = 'blur(3px)'; for (let i = 0; i < N / 100; i++) g.drawImage(spr, i % 1000, 0); g.filter = 'none'; });
    return { N, res };
  });
  console.log(`\ncanvas feature cost on this renderer (${b.N} ops unless noted):`);
  const rows = Object.entries(b.res).sort((a, b2) => b2[1] - a[1]);
  const base = b.res.blit_1to1 || 1;
  for (const [k, v] of rows) {
    const note = /shadow|radial|filter/.test(k) ? '  (÷10 or ÷100 ops)' : '';
    console.log('  ' + k.padEnd(18) + String(v).padStart(8) + 'ms' + ('  ' + (v / base).toFixed(1) + '× a plain blit').padStart(22) + note);
  }
}
await browser.close();
