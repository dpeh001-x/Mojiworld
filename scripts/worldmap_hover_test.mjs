// Pointing at a place on the World Map answers inside the map: a designed card with the name, what
// lives there and what a click will do, the routes out of it lit while the rest fall back, and a key
// to the lane weights in the corner.
//   node scripts/worldmap_hover_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11557);
const SHOT = process.argv[4] || '';
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the card and the focus helpers ship', /THE HOVER CARD/.test(html) && /const _focusLanes = /.test(html) ]);

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
await page.fill('#hero-name-input', 'Hover'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
// dismiss the tutorial for real - it sits over the map and would swallow the pointer
for (let i = 0; i < 6; i++) {
  const gone = await page.evaluate(() => { const b = document.getElementById('tut-skip'); if (b && b.offsetParent !== null) { b.click(); return false; } for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; return true; });
  if (gone) break; await page.waitForTimeout(500);
}
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of ['town', 'forest', 'mushroom', 'candyCanyon']) game.visitedMaps[id] = 1; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2600);

const before = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg') || document.querySelector('svg');
  return { nativeTitles: svg.querySelectorAll('g.wm-node title').length,
    labelled: [...svg.querySelectorAll('g.wm-node')].filter((g) => g.getAttribute('aria-label')).length,
    nodes: svg.querySelectorAll('g.wm-node').length,
    cardOn: !!svg.querySelector('.wm-card.on') };
});
checks.push(['the browser tooltip is gone, the text kept for screen readers', before.nativeTitles === 0 && before.labelled === before.nodes && before.nodes > 50, `${before.nativeTitles} titles, ${before.labelled}/${before.nodes} labelled`]);
checks.push(['the card is hidden until you point at something', !before.cardOn]);

// A real pointer move onto the node's DISC. Aim at the disc, not at the group: a node group's
// bounding rect is inflated (the atlas tile is a nested <svg> holding the whole icon sheet, clipped
// to one cell for painting but not for bbox maths), so the group's centre can land on empty space.
// Nothing in the game measures node groups - the label de-overlap pass measures the label text and
// zoom works off the viewBox - so this is a measuring trap, not a bug in the map.
const box = await page.evaluate(() => {
  const d = document.querySelector('g.wm-node[data-map-id="forest"] .wm-disc');
  const r = d.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await page.waitForTimeout(450);
const on = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg') || document.querySelector('svg');
  const card = svg.querySelector('.wm-card');
  const texts = [...card.querySelectorAll('text')].map((t) => t.textContent).filter(Boolean);
  const bg = card.querySelector('rect');
  const tr = /translate\(([-\d.]+),([-\d.]+)\)/.exec(card.getAttribute('transform') || '') || [0, 0, 0];
  const vb = svg.viewBox.baseVal;
  const lanes = [...svg.querySelectorAll('.wm-lane')];
  return { on: card.classList.contains('on'), opacity: getComputedStyle(card).opacity, texts,
    w: +bg.getAttribute('width'), h: +bg.getAttribute('height'), x: +tr[1], y: +tr[2], W: vb.width, H: vb.height,
    titleFace: card.querySelector('text').getAttribute('font-family'),
    focus: svg.classList.contains('wm-focus'), lit: lanes.filter((l) => l.classList.contains('wm-lit')).length, lanes: lanes.length,
    dimmed: lanes.filter((l) => !l.classList.contains('wm-lit') && +getComputedStyle(l).opacity < 0.12).length };
});
checks.push(['the card opens the moment you point at a place', on.on && +on.opacity > 0.9, `opacity ${on.opacity}`]);
checks.push(['it names the place in Cinzel and says what lives there',
  /Cinzel/.test(on.titleFace) && !!on.texts[0] && on.texts[0] !== '???'
  && /safe hub|boss arena|wilds/.test(on.texts[1] || '')
  && on.texts.some((t) => /^·\s+\S+\s+x\d+/.test(t) || /No monsters here/.test(t)),
  on.texts.slice(0, 3).join(' | ')]);
checks.push(['it tells you what a click will do', on.texts.some((t) => /Click to (travel|ride)|You are here|Lv \d+|Locked/i.test(t)), on.texts[on.texts.length - 1]]);
checks.push(['the card stays inside the frame', on.x >= 8 && on.y >= 8 && on.x + on.w <= on.W - 8 && on.y + on.h <= on.H - 8, `${Math.round(on.x)},${Math.round(on.y)} ${Math.round(on.w)}x${Math.round(on.h)} in ${on.W}x${on.H}`]);
checks.push(['the routes out of that place light up, the rest fall back', on.focus && on.lit > 0 && on.lit < on.lanes && on.dimmed > 10, `${on.lit} lit, ${on.dimmed} dimmed, of ${on.lanes}`]);
if (SHOT) await page.screenshot({ path: SHOT });

await page.mouse.move(8, 8);
await page.waitForTimeout(400);
const off = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg') || document.querySelector('svg');
  return { cardOn: !!svg.querySelector('.wm-card.on'), focus: svg.classList.contains('wm-focus'),
    lit: svg.querySelectorAll('.wm-lit').length };
});
checks.push(['pointing away puts everything back', !off.cardOn && !off.focus && off.lit === 0, JSON.stringify(off)]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
