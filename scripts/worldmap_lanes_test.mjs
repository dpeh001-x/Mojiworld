// The World Map's lanes bow like meridians, stop clear of the discs, and carry a weight that says
// how much of the route the player has actually walked - with a slow-turning globe layer behind
// them. Per user: the straight web read "too rigid and opaque ... very stiff".
//   node scripts/worldmap_lanes_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11541);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the bowed lane helper ships', /const bow = Math\.min\(len \* 0\.15, 44\)/.test(html) && /class', 'wm-spin'/.test(html)]);
checks.push(['the spin respects reduced motion', /prefers-reduced-motion: reduce\) \{ \.wm-spin \{ animation: none/.test(html)]);

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
await page.fill('#hero-name-input', 'Lanes'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
// mark a handful of maps visited so all three lane weights are on screen at once
await page.evaluate(() => { game.visitedMaps = game.visitedMaps || {}; for (const id of ['town', 'forest', 'mushroom', 'candyCanyon']) game.visitedMaps[id] = 1; });
await page.evaluate(() => toggleWorldMap());
await page.waitForTimeout(2500);
const a = await page.evaluate(() => {
  const svg = document.querySelector('#worldmap-modal svg') || document.querySelector('svg');
  const vb = svg.viewBox.baseVal, cx = vb.width / 2, cy = vb.height / 2;
  // the two arrowhead paths live in <defs> and carry no stroke - they are markers, not lanes
  const lanes = [...svg.querySelectorAll('path')].filter((p) => /^M [\d.]+,[\d.]+ [QL]/.test(p.getAttribute('d') || '') && p.getAttribute('stroke'));
  const parse = (d) => { const m = /^M ([\d.]+),([\d.]+) Q ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)$/.exec(d); return m ? m.slice(1).map(Number) : null; };
  let quad = 0, straight = 0, bowedOut = 0, bowedIn = 0, minGap = 1e9;
  const nodes = [...svg.querySelectorAll('g.wm-node')].map((g) => { const t = (g.getAttribute('transform') || '').match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/); return t ? { x: +t[1], y: +t[2] } : null; }).filter(Boolean);
  for (const p of lanes) {
    const d = p.getAttribute('d');
    const q = parse(d);
    if (!q) { straight++; continue; }
    quad++;
    const [x1, y1, bx, by, x2, y2] = q;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    (Math.hypot(bx - cx, by - cy) > Math.hypot(mx - cx, my - cy) ? bowedOut++ : bowedIn++);
    for (const n of nodes) {
      const g1 = Math.hypot(x1 - n.x, y1 - n.y), g2 = Math.hypot(x2 - n.x, y2 - n.y);
      if (g1 < minGap) minGap = g1;
      if (g2 < minGap) minGap = g2;
    }
  }
  const strokes = {};
  for (const p of lanes) { const s = p.getAttribute('stroke') || ''; strokes[s] = (strokes[s] || 0) + 1; }
  const spin = svg.querySelector('g.wm-spin');
  return { lanes: lanes.length, quad, straight, bowedOut, bowedIn, minGap: Math.round(minGap),
    weights: Object.keys(strokes).length, strokes: Object.entries(strokes).sort((x, y) => y[1] - x[1]).slice(0, 5),
    nodes: nodes.length,
    dome: !!svg.querySelector('circle[fill="url(#wm-dome)"]'),
    spin: spin ? { ellipses: spin.querySelectorAll('ellipse').length, stars: spin.querySelectorAll('circle').length,
      anim: getComputedStyle(spin).animationName, dur: getComputedStyle(spin).animationDuration, origin: spin.style.transformOrigin } : null };
});
checks.push(['every lane is a curve, none left straight', a.quad > 50 && a.straight === 0, `${a.quad} curved, ${a.straight} straight`]);
checks.push(['the whole web bows away from the centre', a.bowedOut === a.quad, `${a.bowedOut} out / ${a.bowedIn} in`]);
checks.push(['lanes stop clear of the 21 px node discs', a.minGap >= 18, `closest endpoint ${a.minGap} px from a node`]);
checks.push(['lanes carry more than one weight', a.weights >= 3, a.strokes.map(([s, n]) => n + 'x ' + s).join(', ').slice(0, 120)]);
// v0.30.653 took the star-chart globe off the board: the ground is a painted continent now, and an
// armillary sphere over a landmass reads as two maps at once. These two checks went on asking for it
// and have failed on main ever since, which is worse than useless - a suite nobody can read as green
// stops being read at all. They now assert the removal was deliberate and complete, the way
// worldmap_type_test.mjs does, and check that the atmosphere it left behind is still there.
checks.push(['the star-chart globe is off the board', !a.spin, a.spin ? 'a spin layer is still drawn' : 'none on the board']);
checks.push(['and its soft atmosphere stayed', a.dome, a.dome ? 'dome present' : 'no dome']);
checks.push(['the pins themselves did not move', a.nodes >= 80, `${a.nodes} nodes`]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
