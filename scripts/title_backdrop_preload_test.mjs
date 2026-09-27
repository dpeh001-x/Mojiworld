// The title menu's POP backdrop must be fetched during the boot, not when the menu is already showing (final polish,
// title-bg). It lived only in a `#loading-overlay.menu-up` rule, so the request started at menu-up - the same instant the
// web image hold releases its queued sprites - and the menu sat on a bare purple ground while the art crawled in.
// Boots with the web hold forced on (?lxhold=1) on a throttled line and times the backdrop against menu-up.
//   node scripts/title_backdrop_preload_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9939);
const ART = 'backgrounds/title_keyart_pop.webp';
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${JSON.stringify(x)}`); };
const html = fs.readFileSync(path.resolve(ROOT, PAGE), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
ok('static: the <head> preloads the title backdrop', new RegExp(`<link rel="preload" as="image" href="${ART.replace('.', '\\.')}"`).test(head), null);
ok('static: the menu rule still names the same file', html.includes(`#loading-overlay.menu-up .lo-bg { background-image: url('${ART}')`), null);
if (!fs.existsSync(path.join(ROOT, ART))) { console.log(`SKIP  live timing - ${ART} is not in this checkout`); }
else {
  const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // a modest home line: 40 ms, ~24 Mbit/s down
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 3e6, uploadThroughput: 1e6 });
  await page.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
    const mark = () => { const o = document.getElementById('loading-overlay'); if (o && o.classList.contains('menu-up') && !window.__menuUpAt) window.__menuUpAt = performance.now(); };
    new MutationObserver(mark).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await page.goto(`http://localhost:${PORT}/${PAGE}?lxhold=1`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => !!window.__menuUpAt, null, { timeout: 240000, polling: 100 });
  await page.waitForFunction((a) => performance.getEntriesByType('resource').some((e) => e.name.endsWith(a) && e.responseEnd > 0), ART, { timeout: 120000, polling: 100 });
  const t = await page.evaluate((a) => { const e = performance.getEntriesByType('resource').find((x) => x.name.endsWith(a));
    return { menuUp: Math.round(window.__menuUpAt), start: Math.round(e.startTime), end: Math.round(e.responseEnd), by: e.initiatorType,
      fetches: performance.getEntriesByType('resource').filter((x) => x.name.endsWith(a)).length }; }, ART);
  await page.waitForTimeout(1500);
  const lateFetches = await page.evaluate((a) => performance.getEntriesByType('resource').filter((x) => x.name.endsWith(a)).length, ART);
  console.log(JSON.stringify(t));
  ok('the backdrop is asked for before the menu shows', t.start < t.menuUp, t);
  ok('the backdrop has arrived by the time the menu shows (250 ms grace)', t.end <= t.menuUp + 250, { lateBy: t.end - t.menuUp });
  ok('the menu paints the preloaded copy - one download, not two', lateFetches === 1, { fetches: lateFetches });
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
  await browser.close(); server.kill();
}
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
