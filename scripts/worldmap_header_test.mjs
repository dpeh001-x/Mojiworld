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
    // v0.30.669 — the quietest text in the strip, against the card behind it. "Press W to close"
    // used to be #7d7396 on a near-black card: 4.2:1, under the 4.5 that small text needs to be read
    // rather than merely noticed. A ratio survives a palette change; a hex literal does not.
    faintest: (() => {
      const el = document.querySelector('#worldmap-header .wm-hd-key'), card = document.querySelector('#worldmap-header .wm-hd-r');
      if (!el || !card) return -1;
      // Split on anything that is not a digit or a dot. Written without a backslash class on
      // purpose: one does not survive being generated through a template literal, and the failure is
      // silent — the class matches the letters "d" and "." and every reading comes back NaN.
      const nums = (v) => String(v).split(/[^0-9.]+/).filter(Boolean).map(Number);
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const fg = nums(getComputedStyle(el).color).slice(0, 3);
      const cn = nums(getComputedStyle(card).backgroundColor);
      const a = cn.length > 3 ? cn[3] : 1;
      const under = [10, 8, 16];                       // the near-black the card is laid over
      const bg = cn.slice(0, 3).map((c, i) => c * a + under[i] * (1 - a));
      const x = L(fg), y = L(bg);
      return Math.round(100 * (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) / 100;
    })(),
    hdRows: (() => {
      const l = document.querySelector('#worldmap-header .wm-hd-l'), r = document.querySelector('#worldmap-header .wm-hd-r');
      if (!l || !r) return -1;
      return Math.abs(l.getBoundingClientRect().top - r.getBoundingClientRect().top) < 10 ? 1 : 2;
    })(),
    hdFloats: (() => { const h = document.getElementById('worldmap-header'); return !!h && getComputedStyle(h).position === 'absolute'; })(),
    mapPct: (() => {
      const m = document.querySelector('#worldmap-modal .modal'), svg = document.querySelector('#worldmap-modal svg');
      if (!m || !svg) return -1;
      const mr = m.getBoundingClientRect(), host = svg.parentElement.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const sc = Math.min(host.width / vb.width, host.height / vb.height);
      return Math.round(100 * (vb.width * sc) * (vb.height * sc) / (mr.width * mr.height));
    })(),
    closes, overlap, headerH: Math.round(hr.height) };
});
checks.push(['exactly one close button is on screen, not two', a.closes.length === 1, JSON.stringify(a.closes)]);
// v0.30.650 moved the map's display face from Cinzel to Marcellus SC; either is the map's face
checks.push(['the title is set in the map display face, tracked and in caps', !!a.title && /Alegreya|Marcellus|Cinzel/.test(a.title.face) && parseFloat(a.title.track) >= 2, a.title ? `${a.title.face} ${a.title.size}px, tracking ${a.title.track}` : 'no title']);
checks.push(['the chip pairs a Cormorant label with a display-face place name',
  !!a.chipKey && /Cormorant/.test(a.chipKey.face) && a.chipKey.style === 'italic' && !!a.chipName && /Alegreya|Marcellus|Cinzel/.test(a.chipName.face),
  a.chipKey && a.chipName ? `"${a.chipKey.text}" ${a.chipKey.face} + "${a.chipName.text}" ${a.chipName.face}` : 'missing']);
checks.push(['the count and the key hint are set in Cormorant', !!a.counts && /Cormorant/.test(a.counts.face) && !!a.key && /Cormorant/.test(a.key.face), a.counts ? a.counts.face + ' ' + a.counts.size + 'px' : '']);
checks.push(['the discovery bar matches the count it sits beside', a.total > 0 && Math.abs(a.barPct - (a.visited / a.total) * 100) < 0.6, `${a.visited}/${a.total} = ${((a.visited / a.total) * 100).toFixed(1)}%, bar ${a.barPct}%`]);
checks.push(['nothing in the header runs under the close button', a.overlap === null, a.overlap || 'clear']);
// v0.30.660 — the header no longer takes a slice of the modal: it floats over the map, so its own
// height costs the world nothing and a ceiling on it measures nothing. What it was really protecting
// is that the two halves sit on ONE line rather than stacking, which is still worth pinning - and
// the thing it was paying for, map area, is now asserted directly.
checks.push(['the two halves of the header sit on one line', a.hdRows === 1, a.hdRows + ' row(s)']);
checks.push(['the header floats: it takes no height from the map', a.hdFloats, a.hdFloats ? 'out of flow' : 'still in the column']);
checks.push(['the map has the whole modal', a.mapPct >= 90, a.mapPct + '% of the modal is map (was 60% before v0.30.660)']);
checks.push(['the faintest text in the strip is readable, not just present', a.faintest >= 4.5, a.faintest + ':1 against its card (4.5 is the floor for small text)']);
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
