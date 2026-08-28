// WHERE do Firefox's 1536ms go?
// ============================================================================
// firefox_game_probe measured the gap (FF 1 fps / Chromium 87 fps). This one
// attributes it. Every 2D-context entry point the renderer leans on is wrapped
// with a timer and a counter, then the totals are read after a fixed window,
// in BOTH engines. Attribution, not a hunch: whatever dominates in Firefox and
// not in Chromium is the thing to fix.
//
// The wrapper itself costs something, so the number that matters is the RATIO
// between engines per method, not the absolute ms.
// Run: node scripts/firefox_frame_profile.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10879);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

// Installed BEFORE any game script runs, so nothing escapes the wrapper.
const INSTALL = () => {
  const P = CanvasRenderingContext2D.prototype;
  const acc = Object.create(null);
  window.__lxProf = acc;
  const bump = (k, dt) => {
    const a = acc[k] || (acc[k] = { n: 0, ms: 0 });
    a.n++; a.ms += dt;
  };
  for (const m of ['drawImage', 'getImageData', 'putImageData', 'fill', 'stroke',
                   'fillRect', 'fillText', 'strokeText', 'createPattern',
                   'createRadialGradient', 'createLinearGradient', 'clip', 'arc']) {
    const orig = P[m];
    if (typeof orig !== 'function') continue;
    P[m] = function (...a) {
      const t = performance.now();
      const r = orig.apply(this, a);
      bump(m, performance.now() - t);
      return r;
    };
  }
  // filter and shadowBlur are PROPERTIES. Setting them is cheap; the cost lands
  // on the next draw. So count how often a non-'none' filter / non-zero
  // shadowBlur is ACTIVE, which is what makes the following draw expensive.
  for (const [prop, isHot] of [['filter', (v) => v && v !== 'none'],
                               ['shadowBlur', (v) => !!v]]) {
    const d = Object.getOwnPropertyDescriptor(P, prop);
    if (!d || !d.set) continue;
    Object.defineProperty(P, prop, {
      configurable: true, enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(v) { if (isHot(v)) bump('SET ' + prop, 0); d.set.call(this, v); },
    });
  }
  const cib = window.createImageBitmap;
  if (cib) window.createImageBitmap = function (...a) {
    const t = performance.now();
    return cib.apply(window, a).then((b) => { bump('createImageBitmap(resolve)', performance.now() - t); return b; });
  };
};

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(INSTALL);
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const R = await page.evaluate(() => new Promise((done) => {
    for (const k in window.__lxProf) delete window.__lxProf[k];   // zero after boot
    const t0 = performance.now();
    let frames = 0;
    const tick = () => {
      frames++;
      if (performance.now() - t0 < 5000) requestAnimationFrame(tick);
      else {
        const wall = performance.now() - t0;
        const rows = Object.entries(window.__lxProf)
          .map(([k, v]) => ({ k, n: v.n, ms: +v.ms.toFixed(1), perFrame: +(v.n / frames).toFixed(1) }))
          .sort((a, b) => b.ms - a.ms);
        done({ wall: +wall.toFixed(0), frames, rows });
      }
    };
    requestAnimationFrame(tick);
  }));
  await page.close();
  return { name, ...R };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: true })],
                            ['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed ${String(e.message).slice(0, 120)}`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name} — ${r.frames} frames in ${r.wall}ms (${(r.frames / (r.wall / 1000)).toFixed(1)} fps)`);
  console.log('    ms      calls   /frame  method');
  for (const row of r.rows.slice(0, 12)) {
    console.log(`  ${String(row.ms).padStart(8)}  ${String(row.n).padStart(7)}  ${String(row.perFrame).padStart(7)}  ${row.k}`);
  }
}
if (out.length === 2) {
  const [a, b] = out;
  const mb = new Map(b.rows.map((r) => [r.k, r]));
  console.log('\n================ PER-CALL COST, FIREFOX vs CHROMIUM ================');
  for (const r of a.rows.slice(0, 10)) {
    const o = mb.get(r.k);
    if (!o || !o.n || !r.n) continue;
    const fa = r.ms / r.n, fb = o.ms / o.n;
    console.log(`  ${r.k.padEnd(28)} ff ${fa.toFixed(4)}ms/call   cr ${fb.toFixed(4)}ms/call   = ${(fa / (fb || 1e-9)).toFixed(1)}x`);
  }
}
