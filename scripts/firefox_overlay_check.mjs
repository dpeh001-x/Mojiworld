// Does the loading overlay ever go away — and what does it cost?
// ============================================================================
// The DOM dump shows #loading-overlay still present at z-index 9999 twenty-six
// seconds after load, with .lo-bg under it running `lo-kenburns 40s infinite`
// across 1,094,736px2 and .lo-embers/.cs-rays animating too.
//
// If that layer merely fades to opacity 0 and is left in the tree, the
// animations keep running and Firefox keeps compositing a full-screen layer
// every frame, forever — during gameplay, not just on the title screen. That
// would explain a complaint about PLAYING while every measurement I can take
// sits on the menu.
//
// So: report the overlay's live computed style over time, then walk character
// select to its end and report again.
// Run: LX_HEADED=1 node scripts/firefox_overlay_check.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10913);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const STATE = () => {
  const look = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return sel + ': ABSENT';
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return `${sel}: display=${cs.display} vis=${cs.visibility} opacity=${cs.opacity} pe=${cs.pointerEvents}`
         + ` z=${cs.zIndex} anim=${cs.animationName}/${cs.animationPlayState} area=${Math.round(r.width * r.height)}`;
  };
  return ['#loading-overlay', '.lo-bg', '.lo-embers', '.cs-rays', '.cs-stars', '#class-select-modal', '#game']
    .map(look);
};

const measure = () => new Promise((done) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
    else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(14000);
  console.log(`\n### ${name}`);
  console.log('  -- 14s after load --');
  for (const l of await page.evaluate(STATE)) console.log('    ' + l);
  console.log(`    fps here: ${await page.evaluate(measure)}`);

  // Walk character select to the end.
  for (let i = 0; i < 8; i++) {
    const el = await page.$('#cs-nav-next');
    if (!el) break;
    const vis = await el.isVisible().catch(() => false);
    if (!vis) break;
    try { await el.click({ timeout: 2500 }); } catch (e) { break; }
    await page.waitForTimeout(900);
  }
  for (const sel of ['#cs-confirm', '#cs-start', '#cs-begin', '.cs-start-btn', '#class-select-modal .cs-nav-btn:last-of-type']) {
    const el = await page.$(sel);
    if (el && await el.isVisible().catch(() => false)) { try { await el.click({ timeout: 2500 }); await page.waitForTimeout(1500); } catch (e) {} }
  }
  await page.waitForTimeout(3000);
  for (const sel of ['#plg-skip', '#tut-skip']) {
    const el = await page.$(sel);
    if (el && await el.isVisible().catch(() => false)) { try { await el.click({ timeout: 3000 }); await page.waitForTimeout(2000); } catch (e) {} }
  }
  await page.waitForTimeout(2500);
  console.log('  -- after walking character select / skips --');
  for (const l of await page.evaluate(STATE)) console.log('    ' + l);
  console.log(`    fps here: ${await page.evaluate(measure)}`);

  // What does killing ONLY the overlay buy, versus killing all backdrop-filter?
  const inject = async (css) => page.evaluate((c) => {
    let el = document.getElementById('__lx_ab'); if (!el) { el = document.createElement('style'); el.id = '__lx_ab'; document.head.appendChild(el); }
    el.textContent = c;
  }, css);
  await inject('#loading-overlay{display:none !important}');
  await page.waitForTimeout(600);
  console.log(`    fps with #loading-overlay display:none  -> ${await page.evaluate(measure)}`);
  await inject('#loading-overlay{display:none !important} *{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}');
  await page.waitForTimeout(600);
  console.log(`    fps + no backdrop-filter                -> ${await page.evaluate(measure)}`);
  await inject('#loading-overlay{display:none !important} *{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;animation:none !important}');
  await page.waitForTimeout(600);
  console.log(`    fps + no animations                     -> ${await page.evaluate(measure)}`);
  await page.close();
};

const list = [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: !process.env.LX_HEADED })]];
if (!process.env.LX_FFONLY) list.push(['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: !process.env.LX_HEADED })]);
for (const [nm, launch] of list) {
  let b; try { b = await launch(); } catch (e) { console.log(`${nm}: launch failed`); continue; }
  try { await drive(nm, b); } catch (e) { console.log(`${nm}: ${String(e.message).slice(0, 200)}`); }
  await b.close();
}
server.kill();
