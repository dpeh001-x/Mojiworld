// The World Map's zoom slider (which opens on the whole world), the way back to the last three
// places you came from at the Taxi Uncle's fare, and the map's display face.
//   node scripts/worldmap_zoom_test.mjs [file.html] [port] [screenshot]
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11633);
const SHOT = process.argv[4] || '';
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
const fontFile = path.join(ROOT, 'assets/fonts/marcellus-sc-400-latin.woff2');
checks.push(['the display face ships beside the other two',
  existsSync(fontFile) && statSync(fontFile).size > 8000 && /@font-face \{ font-family: 'Marcellus SC'/.test(html),
  existsSync(fontFile) ? statSync(fontFile).size + ' bytes' : 'missing']);
checks.push(['the slider and the recent strip ship', /id="worldmap-zoom"/.test(html) && /function _wmRenderRecent/.test(html)]);

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
await page.fill('#hero-name-input', 'Zoom'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
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
// somewhere to come back from, a boss arena in the list to prove it is refused, and coins for the fare
await page.evaluate(() => {
  game.visitedMaps = game.visitedMaps || {};
  for (const id of ['town', 'forest', 'mushroom', 'candyCanyon', 'slimeCave']) game.visitedMaps[id] = 1;
  game.currentMap = 'town';
  game.mapHistory = ['gravitosArena', 'forest', 'mushroom', 'candyCanyon', 'slimeCave'];
  player.mojicoins = 99999;
});
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2400);

const z0 = await page.evaluate(() => {
  const el = document.getElementById('worldmap-zoom');
  const svg = document.querySelector('#worldmap-modal svg');
  const vb = svg.viewBox.baseVal;
  const r = el.getBoundingClientRect(), m = document.querySelector('#worldmap-modal .modal').getBoundingClientRect();
  return { value: Number(el.value), vbw: Math.round(vb.width), onScreen: r.width > 0 && r.bottom < m.bottom && r.left > m.left };
});
checks.push(['the map opens on the whole world, with the slider at that end', z0.value === 0 && z0.vbw >= 1500 && z0.onScreen, `slider ${z0.value}, viewBox width ${z0.vbw}`]);

// drag the slider to the far end
const zin = await page.evaluate(() => {
  const el = document.getElementById('worldmap-zoom');
  el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true }));
  const vb = document.querySelector('#worldmap-modal svg').viewBox.baseVal;
  return { vbw: Math.round(vb.width), band: document.querySelector('#worldmap-modal svg').getAttribute('data-wm-zoom') };
});
checks.push(['dragging it in really zooms the map', zin.vbw < z0.vbw * 0.45 && zin.band === 'near', `viewBox width ${z0.vbw} -> ${zin.vbw}, band ${zin.band}`]);

// and the wheel writes the slider back
const sync = await page.evaluate(() => {
  const el = document.getElementById('worldmap-zoom');
  el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true }));
  return Number(el.value);
});
const box = await page.evaluate(() => { const r = document.querySelector('#worldmap-modal svg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
for (let i = 0; i < 4; i++) { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -240); await page.waitForTimeout(110); }
await page.waitForTimeout(400);
const afterWheel = await page.evaluate(() => Number(document.getElementById('worldmap-zoom').value));
checks.push(['scrolling moves the slider too, so the two never disagree', sync === 0 && afterWheel > 20, `slider ${sync} -> ${afterWheel} after four notches`]);

const rec = await page.evaluate(() => {
  const host = document.getElementById('worldmap-recent');
  const btns = [...host.querySelectorAll('button')];
  return { caption: (host.querySelector('.wm-rc-cap') || {}).textContent || '',
    ids: btns.map((b) => b.getAttribute('data-map-id')),
    labels: btns.map((b) => b.textContent.trim().slice(0, 30)),
    face: btns[0] ? getComputedStyle(btns[0]).fontFamily.split(',')[0].replace(/"/g, '') : '',
    fee: btns[0] ? (btns[0].querySelector('.wm-rc-fee') || {}).textContent : '' };
});
checks.push(['the last three places you came from are offered back', rec.ids.length === 3, rec.labels.join(' | ')]);
checks.push(['the boss arena you came from is NOT offered', rec.ids.indexOf('gravitosArena') < 0, rec.ids.join(', ')]);
checks.push(['each one names the Taxi Uncle\'s fare', /\d/.test(rec.fee), rec.fee]);
if (SHOT) await page.screenshot({ path: SHOT });

// press one: it charges the fare and puts you there
const ride = await page.evaluate(async () => {
  const before = player.mojicoins, target = document.querySelector('#worldmap-recent button');
  const id = target.getAttribute('data-map-id');
  target.click();
  await new Promise((r) => setTimeout(r, 1500));
  return { id, paid: before - player.mojicoins, arrived: game.currentMap, fare: (typeof _taxiFare === 'function') ? _taxiFare() : -1 };
});
checks.push(['pressing one rides there', ride.arrived === ride.id, `asked for ${ride.id}, landed in ${ride.arrived}`]);
checks.push(['and it costs exactly the Taxi Uncle\'s fare', ride.paid === ride.fare && ride.fare > 0, `paid ${ride.paid}, fare ${ride.fare}`]);

// the map's face
const face = await page.evaluate(async () => {
  try { await document.fonts.ready; } catch (e) {}
  return { loaded: document.fonts.check("400 16px 'Marcellus SC'") };
});
checks.push(['the map is set in the new face, and it really loaded', face.loaded]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
