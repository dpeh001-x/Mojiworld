// The World Map reads as a world: the places that share a name are painted as one territory and
// named across it, and the world view names REGIONS while the close view names PLACES - never both.
//   node scripts/worldmap_territory_test.mjs [file.html] [port] [screenshot]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11657);
const SHOT = process.argv[4] || '';
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the territory layer ships', /TERRITORIES\. The map was a constellation/.test(html) && /wm-terr-name/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const read = () => page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg');
  const vis = (el) => getComputedStyle(el).opacity !== '0' && +getComputedStyle(el).opacity > 0.05;
  const regions = [...svg.querySelectorAll('.wm-terr-name')];
  const places = [...svg.querySelectorAll('text.wm-node-label')].filter((t) => (t.textContent || '').trim());
  return {
    band: svg.getAttribute('data-wm-zoom'), sparse: svg.classList.contains('wm-sparse'),
    regionNames: regions.map((t) => t.textContent), regionsVisible: regions.filter(vis).length,
    placesVisible: places.filter(vis).length,
    washes: svg.querySelectorAll('.wm-terr circle').length,
    // the territory layer must sit behind the lanes and the nodes
    layerFirst: (() => { const kids = [...svg.children]; const t = kids.findIndex((k) => k.classList && k.classList.contains('wm-terr'));
      const lane = kids.findIndex((k) => k.classList && k.classList.contains('wm-lane'));
      const node = kids.findIndex((k) => k.classList && k.classList.contains('wm-node'));
      return t >= 0 && lane > t && node > t; })(),
    overlaps: (() => { const r = regions.filter(vis).map((t) => t.getBoundingClientRect());
      let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
        if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) n++;
      return n; })(),
  };
});
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof toggleWorldMap === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Terr'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
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
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of Object.keys(MAPS)) game.visitedMaps[id] = 1; game.currentMap = 'town'; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2400);
const far = await read();
const WANT = ['BONE GRAVEYARD', 'BLOOM REACHES', 'MAGMA FOUNDRY', 'WITHERING TIDE', 'GLASSWIND STEPPE',
  'HOLLOW SEPULCHRE', "WAYFARER'S LANTERN", 'BLOCK-LAND', 'THE BASTION', 'DISTORTED PORTAL'];
checks.push(['the world names its ten regions, read out of the map names themselves',
  WANT.every((w) => far.regionNames.includes(w)) && far.regionNames.length === WANT.length, far.regionNames.join(', ').slice(0, 120)]);
checks.push(['each region is painted, not boxed', far.washes >= 25, far.washes + ' washes']);
checks.push(['the paint sits under the lanes and the pins', far.layerFirst]);
checks.push(['no region name sits on another', far.overlaps === 0, far.overlaps + ' overlapping pairs']);
checks.push(['the world view names regions, and hands the places back', far.band === 'far' && far.regionsVisible === 10 && far.placesVisible <= 2,
  `${far.regionsVisible} regions, ${far.placesVisible} places at ${far.band}`]);
if (SHOT) await page.screenshot({ path: SHOT });

const box = await page.evaluate(() => { const r = document.querySelector('#worldmap-modal svg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
for (let i = 0; i < 9; i++) { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -240); await page.waitForTimeout(110); }
await page.waitForTimeout(700);
const near = await read();
checks.push(['the close view names places, and the regions stand down', near.band === 'near' && near.regionsVisible === 0 && near.placesVisible > 10,
  `${near.regionsVisible} regions, ${near.placesVisible} places at ${near.band}`]);

// a young character: nothing to crowd yet, so the place names stay and the regions go quiet
await page.evaluate(() => { game.visitedMaps = { town: 1, forest: 1, mushroom: 1 }; toggleWorldMap(); toggleWorldMap(); });
await page.waitForTimeout(2200);
const young = await read();
checks.push(['a young map keeps its place names and quietens the regions', young.sparse === true && young.placesVisible >= 3,
  `sparse=${young.sparse}, ${young.placesVisible} places, ${young.regionsVisible} regions`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
