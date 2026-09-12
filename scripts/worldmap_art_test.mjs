// The World Map's art pass: lanes dissolve at both ends, the globe carries air, every pin casts a
// shadow and catches a highlight, and the labels are set in the game's own display faces.
//   node scripts/worldmap_art_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11553);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the paint box ships', /wm-lane-' \+ tier \+ '-d/.test(html) && /_mkSoft\('wm-shadow'/.test(html) && /_mkSoft\('wm-dome'/.test(html)]);

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
await page.fill('#hero-name-input', 'Art'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of ['town', 'forest', 'mushroom', 'candyCanyon']) game.visitedMaps[id] = 1; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2600);
const a = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg') || document.querySelector('svg');
  // the wide soft halo under a known lane is a second path on the same geometry - not a lane
  const lanes = [...svg.querySelectorAll('path')].filter((p) => /^M [\d.]+,[\d.]+ Q/.test(p.getAttribute('d') || '')
    && p.getAttribute('stroke') && parseFloat(p.getAttribute('stroke-width') || '0') < 4);
  const faded = lanes.filter((p) => /^url\(#wm-lane-/.test(p.getAttribute('stroke') || ''));
  const grad = (id) => { const g = svg.querySelector('#' + id); if (!g) return null;
    return [...g.querySelectorAll('stop')].map((s) => s.getAttribute('stop-opacity') || s.getAttribute('stop-color')); };
  const nodes = [...svg.querySelectorAll('g.wm-node')];
  const withShadow = nodes.filter((n) => n.querySelector('ellipse[fill="url(#wm-shadow)"]')).length;
  const withGloss = nodes.filter((n) => n.querySelector('circle[fill="url(#wm-gloss)"]')).length;
  const air = svg.querySelector('circle[fill="url(#wm-dome)"]');
  const lbl = nodes.map((n) => n.querySelector('text[font-family]')).filter(Boolean)[0];
  const sub = [...svg.querySelectorAll('text')].filter((t) => /Cormorant/.test(t.getAttribute('font-family') || ''));
  const pill = [...svg.querySelectorAll('text')].filter((t) => /Cinzel/.test(t.getAttribute('font-family') || ''));
  return { lanes: lanes.length, faded: faded.length, laneStops: grad('wm-lane-hi-d'),
    nodes: nodes.length, withShadow, withGloss,
    air: air ? { r: +air.getAttribute('r'), inSpin: !!air.closest('g.wm-spin') } : null,
    cinzel: pill.length, cormorant: sub.length,
    cinzelReady: document.fonts.check("700 12px Cinzel"), cormorantReady: document.fonts.check("italic 400 12px 'Cormorant Garamond'"),
    labelFace: lbl ? lbl.getAttribute('font-family') : '' };
});
checks.push(['every lane is painted with a fading gradient', a.faded === a.lanes && a.lanes > 50, `${a.faded}/${a.lanes}`]);
checks.push(['that gradient is transparent at both ends', JSON.stringify(a.laneStops) === JSON.stringify(['0', '1', '1', '0']), JSON.stringify(a.laneStops)]);
checks.push(['every pin casts a shadow', a.withShadow === a.nodes && a.nodes >= 80, `${a.withShadow}/${a.nodes}`]);
checks.push(['reachable pins catch a highlight, locked ones do not', a.withGloss > 0 && a.withGloss < a.nodes, `${a.withGloss}/${a.nodes} glossed`]);
checks.push(['the globe carries air, painted still under the turning rings', !!a.air && a.air.r > 200 && a.air.inSpin === false, a.air ? `r ${a.air.r}` : 'no dome']);
checks.push(['place names are set in Cinzel', /Cinzel/.test(a.labelFace) && a.cinzel >= 80, `${a.cinzel} in Cinzel`]);
checks.push(['sub-labels are set in Cormorant italic', a.cormorant >= 80, `${a.cormorant} in Cormorant`]);
checks.push(['both faces are actually loaded, not falling back', a.cinzelReady && a.cormorantReady, `Cinzel ${a.cinzelReady}, Cormorant ${a.cormorantReady}`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
