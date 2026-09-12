// The World Map's restyle: the fog draws no text, the names that remain are big enough to read and
// haloed, the map names fewer places the further out you are, and nothing idles under the pointer.
//   node scripts/worldmap_type_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11591);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the bands and the promotion rule ship', /SEMANTIC ZOOM/.test(html) && /const _lblPromote = /.test(html) && /wm-lbl-far/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
const visible = () => page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg');
  let n = 0;
  for (const t of svg.querySelectorAll('text')) {
    if (t.closest('.wm-card')) continue;
    if (!(t.textContent || '').trim()) continue;
    if (getComputedStyle(t).opacity === '0') continue;
    n++;
  }
  return { n, band: svg.getAttribute('data-wm-zoom') };
});
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof toggleWorldMap === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Type'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
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
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of ['town', 'forest', 'mushroom', 'candyCanyon', 'sunsetBeach', 'duneSands']) game.visitedMaps[id] = 1; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2600);

const a = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg');
  const texts = [...svg.querySelectorAll('text')].filter((t) => !t.closest('.wm-card'));
  const strings = texts.map((t) => (t.textContent || '').trim());
  const lbl = [...svg.querySelectorAll('text.wm-node-label')].filter((t) => (t.textContent || '').trim());
  const one = lbl[0];
  const cs = one ? getComputedStyle(one) : null;
  const nodes = [...svg.querySelectorAll('g.wm-node')];
  const fog = nodes.filter((g) => +(g.getAttribute('opacity') || 1) < 0.5);
  const fogDisc = fog.length ? +fog[0].querySelector('.wm-disc').getAttribute('r') : -1;
  return {
    fogStrings: strings.filter((s) => s === '???' || s === 'unexplored').length,
    labels: lbl.length, total: strings.filter(Boolean).length,
    size: one ? parseFloat(one.getAttribute('font-size')) : -1,
    paintOrder: cs ? (cs.paintOrder || '') : '', stroke: one ? one.getAttribute('stroke') : '',
    strokeIsBlack: one ? /rgba\(0, ?0, ?0/.test(one.getAttribute('stroke') || '') : true,
    fogNodes: fog.length, fogDisc,
    hubShimmer: svg.querySelectorAll('circle animate').length,
    spinPlay: (() => { const s = svg.querySelector('.wm-spin'); return s ? getComputedStyle(s).animationPlayState : 'none'; })(),
  };
});
checks.push(['the fog draws no text at all', a.fogStrings === 0, `${a.fogStrings} "???"/"unexplored" strings`]);
checks.push(['the map is quiet: far fewer labels than the 161 it drew', a.total <= 30, `${a.total} labels on screen`]);
checks.push(['a place name is big enough to read', a.size >= 18, a.size + ' user units (~' + (a.size * 0.68).toFixed(1) + ' px on screen)']);
checks.push(['the name wears a halo, painted under the glyph, and it is not pure black', /stroke/.test(a.paintOrder) && !a.strokeIsBlack, `paint-order "${a.paintOrder}", stroke ${a.stroke}`]);
checks.push(['unvisited places are dimmed and sit smaller', a.fogNodes > 40 && a.fogDisc > 0 && a.fogDisc < 21, `${a.fogNodes} fogged, disc r ${a.fogDisc}`]);
checks.push(['no node idles on its own any more', a.hubShimmer === 0, a.hubShimmer + ' per-node animations']);

// The bands only have work to do once the map is crowded: while you know 24 places or fewer they
// are all promoted to the far band on purpose, so zooming in would have nothing left to reveal.
// Open a fully explored map and check the bands there.
await page.evaluate(() => { for (const id of Object.keys(MAPS)) game.visitedMaps[id] = 1; toggleWorldMap(); toggleWorldMap(); });
await page.waitForTimeout(2400);
const far = await visible();
const box = await page.evaluate(() => { const r = document.querySelector('#worldmap-modal svg').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
for (let i = 0; i < 9; i++) { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -240); await page.waitForTimeout(110); }
await page.waitForTimeout(600);
const near = await visible();
checks.push(['on a crowded map, zooming in names more places', far.band === 'far' && near.band === 'near' && near.n > far.n * 1.5, `${far.n} at ${far.band} -> ${near.n} at ${near.band}`]);
checks.push(['and zoomed out it still names only the landmarks', far.n < 45, `${far.n} of 109 named at the far zoom`]);

// the de-overlap pass must be safe to run again - it used to only ever push labels down
const drift = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg');
  const ys = () => [...svg.querySelectorAll('text.wm-node-label')].map((t) => +t.getAttribute('y'));
  _wmDeoverlapLabels(svg);                       // settle first: the visible set just changed with the zoom
  const before = ys();
  _wmDeoverlapLabels(svg);                       // now the same set twice - this is the idempotency test
  const after = ys();
  let worst = 0; for (let i = 0; i < before.length; i++) worst = Math.max(worst, Math.abs(after[i] - before[i]));
  return { worst: Math.round(worst * 10) / 10, n: before.length };
});
checks.push(['running the label spacer again does not walk labels down the map', drift.worst < 1.5, `worst drift ${drift.worst} units over ${drift.n} labels`]);

// And the globe holds still while a node is being read. The perf watchdog may have dropped the run
// into the lowest FX tier by now, which skips the globe layer entirely by design - force it back on
// and re-render so there is a globe to test.
await page.evaluate(() => { try { LX_PERF.veryLowFx = false; } catch (e) {} toggleWorldMap(); toggleWorldMap(); });
await page.waitForTimeout(2200);
const spin = await page.evaluate(() => {
  const s = document.querySelector('.wm-spin');
  if (!s) return { present: false };
  const idle = getComputedStyle(s).animationPlayState;
  const g = document.querySelector('g.wm-node');
  if (g) g.dispatchEvent(new MouseEvent('mouseenter'));
  return { present: true, idle, hovered: getComputedStyle(document.querySelector('.wm-spin')).animationPlayState };
});
checks.push(['the globe stops turning while you read a node', spin.present && spin.idle === 'running' && spin.hovered === 'paused', JSON.stringify(spin)]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
