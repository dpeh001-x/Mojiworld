// Which full-screen CSS effect costs Firefox the frame?
// ============================================================================
// The split probe put 4726ms of a 5s Firefox window in style/paint with only
// 12ms of JS. Three candidates are live over ~950,000px2 each. This turns them
// off one at a time IN ONE PAGE SESSION — same screen, same sprites, same
// scroll state — and re-measures fps after each, so the numbers are comparable
// and the confound of "the two engines were on different screens" is gone.
//
// A candidate that does not move fps is not the cause, and gets left alone.
// Run: node scripts/firefox_ablation.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10883);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

// Each step is a <style> injected with an id, so steps stack and can be undone.
const STEPS = [
  ['baseline', ''],
  ['-#game CSS filter', '#game{filter:none !important}'],
  ['-backdrop-filter (all)', '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'],
  ['-box-shadow (all)', '*{box-shadow:none !important}'],
  ['-drop-shadow filters', '*{filter:none !important}'],
  ['-text-shadow', '*{text-shadow:none !important}'],
  ['-CSS animations', '*{animation:none !important}'],
];

const measure = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
    else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const rows = [];
  let css = '';
  for (const [label, rule] of STEPS) {
    css += rule;
    await page.evaluate((c) => {
      let el = document.getElementById('__lx_ablate');
      if (!el) { el = document.createElement('style'); el.id = '__lx_ablate'; document.head.appendChild(el); }
      el.textContent = c;
    }, css);
    await page.waitForTimeout(600);            // let style settle
    const fps = await page.evaluate(measure);
    rows.push({ label, fps });
  }
  await page.close();
  return { name, rows };
};

const out = [];
for (const [nm, launch] of [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })],
                            ...(process.env.LX_FFONLY ? [] : [['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: true })]])]) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { out.push(await drive(nm, b)); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();

for (const r of out) {
  console.log(`\n### ${r.name}   (each row = the row above PLUS this removal)`);
  let prev = null;
  for (const row of r.rows) {
    const d = prev == null ? '' : `   ${row.fps > prev ? '+' : ''}${(row.fps - prev).toFixed(1)} fps`;
    console.log(`  ${String(row.fps).padStart(7)} fps   ${row.label.padEnd(24)}${d}`);
    prev = row.fps;
  }
}
