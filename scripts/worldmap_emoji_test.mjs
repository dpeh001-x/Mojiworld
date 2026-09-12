// The World Map draws its icons from the custom atlas, not the operating system's emoji font.
// SVG is the one path v0.30.634's two chokepoints cannot reach - the DOM observer skips SVG
// subtrees - so this pins the nested <svg> + <image> tiles the map uses instead.
//   node scripts/worldmap_emoji_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11517);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the SVG atlas tile helper ships', /window\._lxEmojiSvgTile = function/.test(html)]);
checks.push(['the world map asks for tiles, not SVG text', /_lxEmojiSvgTile\('⚔', 14, 15, 12\)/.test(html) && /_lxEmojiSvgTile\(_icoCh, 28, 0, 0\)/.test(html)]);
checks.push(['the gated sub-label lifts its lock into a tile', /data-lx-subtile/.test(html) && /function _wmPlaceSubTiles/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof toggleWorldMap === 'function' && typeof _lxEmojiSvgTile === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Map'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
const read = () => page.evaluate(() => {
  const TEST = /[\u{1F1E6}-\u{1F1FF}⃣\p{Extended_Pictographic}]/u;
  const KEEP = new Set(['©', '®', '™']);
  const bad = [];
  for (const t of document.querySelectorAll('svg text')) { const s = (t.textContent || '').trim(); if (TEST.test(s) && !KEEP.has(s)) bad.push(s.slice(0, 8)); }
  const imgs = [...document.querySelectorAll('svg image')].map((i) => i.getAttribute('href') || '');
  const tiles = [...document.querySelectorAll('svg svg[viewBox]')];
  const one = tiles[0];
  return { osEmoji: bad, tiles: tiles.length, atlasImages: imgs.filter((h) => /emoji_atlas/.test(h)).length,
    regionSprites: imgs.filter((h) => /world\/regions/.test(h)).length,
    sample: one ? { viewBox: one.getAttribute('viewBox'), w: one.getAttribute('width'), overflow: one.getAttribute('overflow') } : null,
    subTiles: [...document.querySelectorAll('svg svg[data-lx-subtile]')].map((t) => +t.getAttribute('x')),
    nodes: document.querySelectorAll('svg g[data-map], svg g').length };
});
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2500);
const a = await read();
checks.push(['the world map draws no operating-system emoji', a.osEmoji.length === 0, a.osEmoji.slice(0, 6).join(' ')]);
checks.push(['every node icon is an atlas tile', a.tiles >= 80 && a.atlasImages === a.tiles, `${a.tiles} tiles, ${a.atlasImages} atlas images`]);
checks.push(['the lock tiles are placed left of their centred text', a.subTiles.length > 0 && a.subTiles.every((x) => x < -6 && x > -200), `${a.subTiles.length} locks, x ${a.subTiles.slice(0, 3).join('/')}`]);
checks.push(['each tile crops one 64 px cell of the sheet', !!a.sample && /^\d+ \d+ 64 64$/.test(a.sample.viewBox) && a.sample.overflow === 'hidden', a.sample ? a.sample.viewBox : 'no tile']);
checks.push(['the painted region sprites still layer over them', a.regionSprites >= 60, String(a.regionSprites)]);
// the taxi map renders through the same function
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(600);
await page.evaluate(() => { const g = document.createElement('div'); g.id = 'lx-tp-probe'; document.body.appendChild(g); _renderWorldMapDiagram(g, {}); });
await page.waitForTimeout(1200);
const b = await page.evaluate(() => {
  const host = document.getElementById('lx-tp-probe');
  const TEST = /[\u{1F1E6}-\u{1F1FF}⃣\p{Extended_Pictographic}]/u;
  const bad = [...host.querySelectorAll('svg text')].map((t) => (t.textContent || '').trim()).filter((s) => TEST.test(s));
  const out = { bad: bad.length, tiles: host.querySelectorAll('svg svg[viewBox]').length };
  host.remove(); return out;
});
checks.push(['a second render of the same diagram is clean too', b.bad === 0 && b.tiles >= 80, `${b.bad} emoji, ${b.tiles} tiles`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
