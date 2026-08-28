// Does the loading screen ever finish on Firefox?
// ============================================================================
// #loading-overlay is still display:flex, opacity 1, pointer-events auto at
// z-index 9999 twenty-six seconds in — fully opaque and on top of everything,
// which is why every click at character select was intercepted and why nothing
// I did reached gameplay.
//
// The user's second symptom is "your sprites will not load". If the boot
// sequence takes dramatically longer on Firefox — or never completes — that IS
// the symptom, and it is a different bug from the frame-rate one.
//
// So: poll what is actually on top (elementFromPoint, which hit-tests, unlike
// the visibility checks that misled the earlier probe) and the loading
// progress text, until the overlay goes away or the clock runs out.
// Run: LX_HEADED=1 node scripts/firefox_loadtime.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10917);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const SNAP = () => {
  const ov = document.getElementById('loading-overlay');
  const cs = ov && getComputedStyle(ov);
  const top = document.elementFromPoint(640, 400);
  const bar = document.getElementById('loading-bar');
  const txt = [...document.querySelectorAll('#loading-overlay *')]
    .map((e) => (e.childElementCount === 0 ? (e.textContent || '').trim() : ''))
    .filter((t) => t && t.length < 60).slice(-4).join(' | ');
  return {
    overlay: ov ? `${cs.display}/op${cs.opacity}/pe${cs.pointerEvents}` : 'gone',
    topAtCentre: top ? (top.id ? '#' + top.id : top.tagName.toLowerCase() + '.' + String(top.className).trim().split(/\s+/)[0]) : null,
    bar: bar ? getComputedStyle(bar).width : null,
    txt,
  };
};

const drive = async (name, browser) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
  console.log(`\n### ${name}   (load event at ${Date.now() - t0}ms)`);
  let cleared = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(4000);
    const s = await page.evaluate(SNAP);
    const el = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`  ${String(el).padStart(3)}s  overlay=${String(s.overlay).padEnd(22)} top=${String(s.topAtCentre).padEnd(26)} bar=${String(s.bar).padEnd(8)} ${s.txt}`);
    const gone = s.overlay === 'gone' || s.overlay.startsWith('none') || /op0(\.0*)?\//.test(s.overlay);
    if (gone || (s.topAtCentre && !String(s.topAtCentre).startsWith('#loading') && !String(s.topAtCentre).startsWith('div.lo'))) {
      cleared = el; break;
    }
  }
  console.log(cleared ? `  => loading overlay cleared after ~${cleared}s` : '  => STILL BLOCKING after 80s');
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
