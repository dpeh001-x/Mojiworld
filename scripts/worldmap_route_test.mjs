// Names take a free seat around their node instead of stacking into the art, they hold their size on
// screen as the map zooms, and pointing at a place traces the way there from where you stand.
//   node scripts/worldmap_route_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11631);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the placer, the zoom scalar and the route ship',
  /LABEL PLACEMENT/.test(html) && /const _routeTo = /.test(html) && /--wm-k/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const clash = () => page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg');
  const box = svg.getBoundingClientRect();
  const on = (r) => r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;
  const labels = [...svg.querySelectorAll('text.wm-node-label')]
    .filter((t) => (t.textContent || '').trim() && getComputedStyle(t).opacity !== '0')
    .map((t) => ({ s: t.textContent.trim(), r: t.getBoundingClientRect() })).filter((x) => on(x.r));
  const discs = [...svg.querySelectorAll('g.wm-node .wm-disc')].map((c) => c.getBoundingClientRect());
  const ov = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  let onNode = 0, pairs = 0;
  for (const L of labels) { for (const d of discs) if (ov(L.r, d)) { onNode++; break; } }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (ov(labels[i].r, labels[j].r)) pairs++;
  const seats = {};
  for (const t of svg.querySelectorAll('text.wm-node-label')) { const a = t.getAttribute('text-anchor') || 'middle'; seats[a] = (seats[a] || 0) + 1; }
  return { labels: labels.length, onNode, pairs, seats };
});
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof toggleWorldMap === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Route'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
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
// the hardest case the map has: every place discovered, so every name wants a seat
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of Object.keys(MAPS)) game.visitedMaps[id] = 1; game.currentMap = 'town'; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2600);
const far = await clash();
checks.push(['on a fully discovered map, almost no name sits on a node', far.onNode <= 6 && far.labels >= 20, `${far.onNode} of ${far.labels} names touch a disc`]);
checks.push(['and almost none sits on another name', far.pairs <= 3, `${far.pairs} overlapping pairs`]);
checks.push(['names use the seats around their node, not just the one under it', (far.seats.start || 0) + (far.seats.end || 0) >= 4, JSON.stringify(far.seats)]);

// Measure what the player sees: the rendered box in screen pixels. The computed font-size is in SVG
// user units, which SHOULD halve as you zoom 2x - that is the whole mechanism.
const sizeAt = () => page.evaluate(() => {
  const t = [...document.querySelectorAll('text.wm-node-label')].find((x) => (x.textContent || '').trim() && getComputedStyle(x).opacity !== '0' && x.getBoundingClientRect().height);
  return t ? Math.round(t.getBoundingClientRect().height * 10) / 10 : -1;
});
const sizeFar = await sizeAt();
const ctr = await page.evaluate(() => { const r = document.querySelector('#worldmap-modal svg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
for (let i = 0; i < 5; i++) { await page.mouse.move(ctr.x, ctr.y); await page.mouse.wheel(0, -240); await page.waitForTimeout(120); }
await page.waitForTimeout(900);
const sizeNear = await sizeAt();
const zoomed = await clash();
checks.push(['a name holds its size on screen as the map zooms', sizeFar > 0 && Math.abs(sizeNear - sizeFar) / sizeFar < 0.25, `${sizeFar} px out, ${sizeNear} px in`]);
checks.push(['zoomed in, the names are still off the nodes', zoomed.onNode <= 12 && zoomed.labels >= 20, `${zoomed.onNode} of ${zoomed.labels} touch a disc`]);

// the route: point at the furthest place on screen and read the line back
const far2 = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg'), box = svg.getBoundingClientRect();
  const cur = svg.querySelector('g.wm-node[data-map-id="' + game.currentMap + '"] .wm-disc');
  if (!cur) return null;
  const c = cur.getBoundingClientRect();
  let best = null, bd = 0;
  for (const g of svg.querySelectorAll('g.wm-node')) {
    const d = g.querySelector('.wm-disc').getBoundingClientRect();
    if (d.left < box.left + 60 || d.right > box.right - 60 || d.top < box.top + 60 || d.bottom > box.bottom - 60) continue;
    const dist = Math.hypot(d.left - c.left, d.top - c.top);
    if (dist > bd) { bd = dist; best = { id: g.getAttribute('data-map-id'), x: d.left + d.width / 2, y: d.top + d.height / 2 }; }
  }
  return best;
});
if (!far2) throw new Error('no node to point at');
await page.mouse.move(far2.x, far2.y);
await page.waitForTimeout(650);
const route = await page.evaluate(() => {
  const p = document.querySelector('.wm-route');
  const d = (p && p.getAttribute('d')) || '';
  const texts = [...document.querySelectorAll('.wm-card text')].map((t) => t.textContent).filter(Boolean);
  return { segs: (d.match(/M /g) || []).length, dash: p ? getComputedStyle(p).strokeDasharray : '', meta: texts[1] || '' };
});
checks.push(['pointing at a place traces the way there from where you stand', route.segs >= 1, `${route.segs} portal hops drawn`]);
checks.push(['the traced line runs, rather than sitting still', /\d/.test(route.dash), `dash ${route.dash}`]);
checks.push(['the card says how far it is', /\d+ jumps? away/.test(route.meta), route.meta]);
await page.mouse.move(8, 8);
await page.waitForTimeout(350);
const cleared = await page.evaluate(() => !document.querySelector('.wm-route').getAttribute('d'));
checks.push(['pointing away clears the route', cleared]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
