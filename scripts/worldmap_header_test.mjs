// The World Map's header strip: set in the game's faces, the discovery count carrying a bar, and
// exactly one close button in that corner.
//   node scripts/worldmap_header_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11599);
const SHOT = process.argv[4] || '';
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the header stylesheet and the de-duplication rule ship',
  /#worldmap-header \.wm-hd-title/.test(html) && /modal-has-own-close #mc-modal-close \{ display: none/.test(html)]);
checks.push(['the universal close is still the fallback for a modal with no close of its own',
  /@media \(pointer: fine\)/.test(html) && /body\.forced-modal-closable #mc-modal-close \{ display: flex !important; \}/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof toggleWorldMap === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Header'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
for (let i = 0; i < 6; i++) {
  const gone = await page.evaluate(() => { const b = document.getElementById('tut-skip'); if (b && b.offsetParent !== null) { b.click(); return false; } for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; return true; });
  if (gone) break; await page.waitForTimeout(500);
}
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; const ids = Object.keys(MAPS).slice(0, 40); for (const id of ids) game.visitedMaps[id] = 1; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2200);
const a = await page.evaluate(() => {
  const h = document.getElementById('worldmap-header');
  const f = (sel) => { const el = h.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el);
    return { face: cs.fontFamily.split(',')[0].replace(/"/g, ''), size: parseFloat(cs.fontSize), style: cs.fontStyle, track: cs.letterSpacing, text: (el.textContent || '').trim().slice(0, 24) }; };
  const bar = document.getElementById('worldmap-progress');
  const counts = (document.getElementById('worldmap-counts').textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
  const closes = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '✕' && b.offsetParent !== null)
    .map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }; });
  const hr = h.getBoundingClientRect();
  let overlap = null;
  if (closes.length === 1) {
    const c = closes[0];
    for (const el of h.querySelectorAll('span, div, kbd')) {
      const t = (el.textContent || '').trim(); if (!t || el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.right > c.x && r.left < c.x + c.w && r.bottom > c.y && r.top < c.y + 40) overlap = t.slice(0, 20);
    }
  }
  return { title: f('.wm-hd-title'), chipKey: f('.wm-hd-chip b'), chipName: f('#worldmap-here-name'),
    counts: f('#worldmap-counts'), key: f('.wm-hd-key'),
    barPct: bar ? parseFloat(bar.style.width) : -1, visited: counts ? +counts[1] : -1, total: counts ? +counts[2] : -1,
    closes, overlap, headerH: Math.round(hr.height) };
});
checks.push(['exactly one close button is on screen, not two', a.closes.length === 1, JSON.stringify(a.closes)]);
checks.push(['the title is set in Cinzel, tracked and in caps', !!a.title && /Cinzel/.test(a.title.face) && parseFloat(a.title.track) >= 2, a.title ? `${a.title.face} ${a.title.size}px, tracking ${a.title.track}` : 'no title']);
checks.push(['the chip pairs a Cormorant label with a Cinzel place name',
  !!a.chipKey && /Cormorant/.test(a.chipKey.face) && a.chipKey.style === 'italic' && !!a.chipName && /Cinzel/.test(a.chipName.face),
  a.chipKey && a.chipName ? `"${a.chipKey.text}" ${a.chipKey.face} + "${a.chipName.text}" ${a.chipName.face}` : 'missing']);
checks.push(['the count and the key hint are set in Cormorant', !!a.counts && /Cormorant/.test(a.counts.face) && !!a.key && /Cormorant/.test(a.key.face), a.counts ? a.counts.face + ' ' + a.counts.size + 'px' : '']);
checks.push(['the discovery bar matches the count it sits beside', a.total > 0 && Math.abs(a.barPct - (a.visited / a.total) * 100) < 0.6, `${a.visited}/${a.total} = ${((a.visited / a.total) * 100).toFixed(1)}%, bar ${a.barPct}%`]);
checks.push(['nothing in the header runs under the close button', a.overlap === null, a.overlap || 'clear']);
checks.push(['the strip stays a single line', a.headerH <= 56, a.headerH + ' px tall']);
if (SHOT) await page.screenshot({ path: SHOT, clip: { x: 20, y: 40, width: 1240, height: 120 } });
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
