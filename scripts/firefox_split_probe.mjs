// Is Firefox's 1.5s frame spent in JS, or in style/layout/paint?
// ============================================================================
// The canvas profile accounted for 12ms of a 6398ms Firefox window, and both
// engines issue identical per-frame call counts. So the cost is neither "more
// drawing" nor "slower drawing" — it is somewhere outside the 2D context.
//
// This splits the frame in two:
//   selfMs  — wall time inside the game's own rAF callback (JS)
//   gapMs   — wall time from the end of that callback to the start of the next
//             (style, layout, paint, composite: the browser's half)
//
// and then inventories the DOM features Firefox is known to be slow at, so a
// large gapMs points at something specific rather than at "rendering".
// Run: node scripts/firefox_split_probe.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10881);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

// Wrap rAF before any game code registers one, so the game's own callback is
// the thing being timed.
const INSTALL = () => {
  window.__lxRaf = { self: [], gap: [] };
  let lastEnd = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => {
    const s = performance.now();
    if (lastEnd) window.__lxRaf.gap.push(s - lastEnd);
    try { return cb(t); } finally {
      lastEnd = performance.now();
      window.__lxRaf.self.push(lastEnd - s);
    }
  });
};

const SURVEY = () => new Promise((done) => {
  window.__lxRaf.self.length = 0; window.__lxRaf.gap.length = 0;
  const t0 = performance.now();
  const wait = () => {
    if (performance.now() - t0 < 5000) return setTimeout(wait, 100);
    const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[b.length >> 1].toFixed(2); };
    const sum = (a) => +a.reduce((x, y) => x + y, 0).toFixed(0);

    // What is actually on screen, and what expensive features are live on it.
    const vis = [...document.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const cs = getComputedStyle(e);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    });
    const feat = { backdropFilter: [], filter: [], boxShadow: [], animation: [], textShadow: [], mixBlend: [] };
    for (const e of vis) {
      const cs = getComputedStyle(e);
      const id = (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
      const r = e.getBoundingClientRect();
      const area = Math.round(r.width * r.height);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      if (bf && bf !== 'none') feat.backdropFilter.push(`${id} ${bf.slice(0, 28)} ${area}px2`);
      if (cs.filter && cs.filter !== 'none') feat.filter.push(`${id} ${cs.filter.slice(0, 28)} ${area}px2`);
      if (cs.boxShadow && cs.boxShadow !== 'none') feat.boxShadow.push(`${id} ${area}px2`);
      if (cs.animationName && cs.animationName !== 'none') feat.animation.push(`${id} ${cs.animationName} ${area}px2`);
      if (cs.textShadow && cs.textShadow !== 'none') feat.textShadow.push(id);
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') feat.mixBlend.push(`${id} ${cs.mixBlendMode}`);
    }
    const cvs = [...document.querySelectorAll('canvas')].map((c) => `${c.id || '(anon)'} ${c.width}x${c.height}`);
    done({
      selfMed: med(window.__lxRaf.self), gapMed: med(window.__lxRaf.gap),
      selfSum: sum(window.__lxRaf.self), gapSum: sum(window.__lxRaf.gap),
      frames: window.__lxRaf.self.length,
      nodes: document.querySelectorAll('*').length, visible: vis.length,
      canvases: cvs,
      dpr: window.devicePixelRatio,
      feat: Object.fromEntries(Object.entries(feat).map(([k, v]) => [k, { n: v.length, top: v.slice(0, 6) }])),
    });
  };
  wait();
});

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(INSTALL);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const R = await page.evaluate(SURVEY);
  await page.close();
  return { name, ...R };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: true })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name}   ${r.frames} frames / 5s   dpr ${r.dpr}`);
  console.log(`  JS in game rAF callback : median ${r.selfMed}ms   total ${r.selfSum}ms`);
  console.log(`  browser style/paint gap : median ${r.gapMed}ms   total ${r.gapSum}ms   <-- the browser's half`);
  console.log(`  DOM ${r.nodes} nodes (${r.visible} visible)   canvases: ${r.canvases.join(' | ')}`);
  for (const [k, v] of Object.entries(r.feat)) {
    if (v.n) console.log(`  ${k}: ${v.n}   ${v.top.join('  |  ')}`);
  }
}
