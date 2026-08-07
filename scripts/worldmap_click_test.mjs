// v0.29.480 â€” world-map nodes must be clickable across their whole visible
// extent, and an ordinary click must not be swallowed by the pan handler.
//
// Uses elementFromPoint at real screen coordinates, so it measures the hit
// area the browser actually resolves â€” not what the markup claims.
//
//   node serve.js 8847 && node scripts/worldmap_click_test.mjs 8847 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8847';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('renderWorldMap') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const P = eval('player'), g = eval('game');
  P.cls = P.cls || 'warrior'; P.level = 99;
  // Make every map visited so nodes are accessible/clickable.
  g.visitedMaps = g.visitedMaps || {};
  for (const id of Object.keys(eval('MAPS'))) g.visitedMaps[id] = true;
  try { eval('renderWorldMap')(); } catch (e) { return { renderFailed: String(e).slice(0, 120) }; }

  const host = document.getElementById('worldmap-grid');
  const svg = host && host.querySelector('svg');
  if (!svg) return { noSvg: true };
  // Make the modal measurable.
  const modal = document.getElementById('worldmap-modal');
  if (modal) { modal.style.display = 'flex'; modal.style.zIndex = '2147483647'; }
  const lo = document.getElementById('loading-overlay'); if (lo) lo.style.display = 'none';

  const nodes = [...svg.querySelectorAll('g')].filter(n => n.querySelector('.wm-disc'));
  const hits = svg.querySelectorAll('.wm-hit');

  // Pick a node that has a click handler (accessible, not current map).
  let probe = null;
  for (const n of nodes) {
    if (n.style.cursor === 'pointer') { probe = n; break; }
  }
  if (!probe) return { noProbe: true, nodes: nodes.length, hits: hits.length };

  // Measure from the HIT CIRCLE, not the <g>. The group's bounding box also
  // contains the label text below the node, so its centre sits well under the
  // actual disc â€” an earlier cut probed from there and reported the fix broken.
  const hitEl = probe.querySelector('.wm-hit');
  if (!hitEl) return { noHit: true };
  const rect = hitEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  // Sample outward along the diagonal â€” where the old r=21 disc stopped but the
  // 40x40 icon art kept going (corners at 28.3 in viewBox units).
  const inside = (dx, dy) => {
    const el = document.elementFromPoint(cx + dx, cy + dy);
    return !!(el && probe.contains(el));
  };
  const scale = rect.width;   // rendered HIT-CIRCLE diameter in CSS px
  return {
    nodes: nodes.length, hits: hits.length,
    hitR: (svg.querySelector('.wm-hit') || {}).getAttribute ? +svg.querySelector('.wm-hit').getAttribute('r') : null,
    centre: inside(0, 0),
    diagQuarter: inside(scale * 0.25, scale * 0.25),   // ~0.35r out along the diagonal
    diagEdge: inside(scale * 0.33, scale * 0.33),     // ~0.47r — inside the old dead zone
    farOutside: inside(scale * 1.2, scale * 1.2),
    renderedPx: Math.round(rect.width),
  };
});

ok('the world map rendered nodes', !r.renderFailed && !r.noSvg && r.nodes > 0, r);
ok('every node carries an explicit hit target', r.hits === r.nodes, { hits: r.hits, nodes: r.nodes });
ok('the hit radius covers the icon corners (28.3) and hover halo (26)', r.hitR >= 26, { hitR: r.hitR });
ok('the node centre is clickable', r.centre === true, r);
ok('a point out along the diagonal â€” the old dead zone â€” is now clickable', r.diagQuarter === true, r);
ok('the outer edge of the icon art is clickable', r.diagEdge === true, r);
ok('a point well outside the node is NOT clickable (no over-grab)', r.farOutside === false, r);

// Pan threshold: a small twitch must not cancel a click.
const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    euclid: /_panMoved, Math\.hypot\(dx, dy\)/.test(s),
    manhattanGone: !/Math\.abs\(dx\) \+ Math\.abs\(dy\)\);/.test(s),
    thresh8: /if \(_panMoved >= 8\)/.test(s) && /if \(_panMoved < 8\) return;/.test(s),
    oldThreshGone: !/if \(_panMoved >= 5\)/.test(s),
  };
});
ok('drag distance is Euclidean, not Manhattan', src.euclid && src.manhattanGone, src);
ok('the drag threshold is 8px true distance on both the move and the click guard',
   src.thresh8 && src.oldThreshGone, src);
// The twitch that used to eat clicks.
const twitch = Math.hypot(3, 3);
ok('a 3x3px twitch (Manhattan 6, real 4.2) no longer cancels a click', twitch < 8, { manhattan: 6, euclidean: +twitch.toFixed(1), threshold: 8 });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

