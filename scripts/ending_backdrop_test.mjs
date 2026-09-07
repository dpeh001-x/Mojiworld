// v0.30.417 — ending overlay backdrop: the plate loads (HTTP 200), the layer
// order is bg < veil < stars < text, the drift/fade animations are live, and
// a full-page screenshot for the eye.
//   node scripts/ending_backdrop_test.mjs [file.html] [port] [shot.png]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11111);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const responses = [];
page.on('response', (r) => { if (/bg_ending_dawn/.test(r.url())) responses.push({ url: r.url(), status: r.status() }); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Ending');
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
await page.evaluate(() => { window._prologueActive = false; _showGameComplete(); });
await page.waitForTimeout(4500);   // past the 3.4 s fade-in
const r = await page.evaluate(() => {
  const ov = document.getElementById('game-complete-overlay');
  const bg = document.getElementById('gc-bg'), veil = document.getElementById('gc-veil'), stars = document.getElementById('gc-stars'), title = document.getElementById('gc-title');
  const cs = bg && getComputedStyle(bg);
  const order = [...ov.children].map((c) => c.id || c.tagName.toLowerCase());
  return {
    on: ov && ov.classList.contains('on'),
    bgImage: cs && cs.backgroundImage, bgOpacity: cs && +cs.opacity, anim: cs && cs.animationName,
    order, hasVeil: !!veil, titleText: title && title.textContent.trim(),
    titleVisible: title && getComputedStyle(title).opacity,
  };
});
if (SHOT) await page.screenshot({ path: SHOT });
await browser.close(); server.kill();
const checks = [
  ['overlay shown', r.on],
  ['plate requested and served 200', responses.length > 0 && responses.every((x) => x.status === 200), JSON.stringify(responses)],
  ['bg layer points at the plate', /bg_ending_dawn\.webp/.test(r.bgImage || ''), r.bgImage],
  ['bg faded in (opacity 1)', r.bgOpacity === 1, r.bgOpacity],
  ['fade + drift animations attached', /gcBgIn/.test(r.anim || '') && /gcBgDrift/.test(r.anim || ''), r.anim],
  ['layer order bg < veil < stars < title', r.order.indexOf('gc-bg') === 0 && r.order.indexOf('gc-veil') === 1 && r.order.indexOf('gc-stars') === 2 && r.order.indexOf('gc-title') === 3, r.order.join(',')],
  ['title still present', /THE WORLD DREAMS AGAIN/.test(r.titleText || ''), r.titleText],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  [' + String(extra).slice(0, 140) + ']' : '')); if (!ok) fails++; }
if (SHOT) console.log('shot -> ' + SHOT);
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
