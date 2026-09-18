// Does the world map's art finish loading BEFORE the world reveals?
//
// Per user, with a screenshot of the World Map: "ensure that the map loads before the game starts".
//
// The commence gate (v0.29.735 -> v0.30.x) holds the loading screen until every WATCHED sprite is
// complete, and it watches two things: document.images, and window._lxRegistryImages (whatever
// _warmDecodeRegistries walked). The world map's art is in neither:
//   - the 82 region emblems are SVG <image> elements that renderWorldMap CREATES on first open, so
//     at boot they do not exist in any form the gate could look at. Measured on v0.30.729: 0 of 82
//     had been REQUESTED by the time the world revealed;
//   - _wmPlate, the painted backdrop, is a bare `new Image()` at script scope - never appended, so
//     not in document.images and in no registry. It does finish in time in practice (its src is set
//     at parse, ~29 s before the reveal), but nothing HOLDS the door for it, so that is luck rather
//     than a guarantee and a slow link can lose it.
//
// A NOTE ON THE METRIC, because the first version of this test was wrong: resource timing keeps only
// 250 entries by default and this boot makes ~2,000 requests, so the region entries are evicted long
// before anything reads them and EVERY build reports zero. setResourceTimingBufferSize must be
// raised in an init script, before page script runs, or the test measures the buffer, not the game.
//   node scripts/worldmap_preload_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const PORT = Number(process.argv[2] || 29260);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra ? '  <- ' + extra : '')); } };

// The resource-timing buffer defaults to 250 entries and this boot makes ~2,000 requests, so by the
// time anything is measured the region entries have been evicted and EVERY build looks like it
// fetched nothing. Raise it before a single byte of page script runs, or the test measures the
// buffer instead of the game.
await page.addInitScript(() => { try { performance.setResourceTimingBufferSize(20000); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });

// Stamp the moment the loading overlay actually goes away - that is "the game starts". Polled from
// here rather than in-page: the overlay is re-classed several times during boot (menu-up, fade) and
// an in-page observer that misses the transition leaves nothing to compare against.
await page.evaluate(() => { window.__revealAt = null; });
const stampReveal = () => page.evaluate(() => {
  if (window.__revealAt != null) return window.__revealAt;
  const ov = document.getElementById('loading-overlay');
  const hidden = !ov || !ov.isConnected || ov.classList.contains('fade') ||
    getComputedStyle(ov).display === 'none' || +getComputedStyle(ov).opacity === 0;
  if (hidden) window.__revealAt = performance.now();
  return window.__revealAt;
});

// Walk the boot: name + class -> Next -> the MENU -> New Game. The commence gate (_finishHide) runs
// on that click, which is exactly the gate under test, so nothing here may force the overlay down.
const clickText = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  for (const b of document.querySelectorAll('button')) {
    if (getComputedStyle(b).display === 'none' || !b.offsetParent) continue;
    if (rx.test((b.textContent || '').trim())) { b.click(); return true; }
  }
  return false;
}, re.source);

// Waits on CONDITIONS, not clocks: boot timings move by tens of seconds between runs (the menu
// arrived at 12 s in one run and 20 s in the next), and a fixed sleep silently measures the wrong
// moment rather than failing.
const waitFor = async (label, fn, capMs = 180000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < capMs) {
    try { if (await fn()) return true; } catch (e) {}
    await stampReveal();
    await page.waitForTimeout(400);
  }
  console.log('  (timed out waiting for ' + label + ')');
  return false;
};

await waitFor('the name/class form', () => page.evaluate(() =>
  !!document.querySelector('#hero-name-input')));
await page.fill('#hero-name-input', 'MapPreload').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await clickText(/^Next/);
// the boot menu is what follows the form; New Game on it is what runs the commence gate
await waitFor('the boot menu', async () => await clickText(/New Game/));
// Let the gate hold for as long as it genuinely needs - that is the behaviour under test - while
// clearing the prologue, which sits IN FRONT of the reveal. Waiting for the reveal first and only
// then skipping the prologue is a deadlock: the overlay does not come down until the prologue is
// done, and the prologue does not advance while nothing is dismissing it.
await waitFor('the world reveal', async () => {
  if ((await stampReveal()) != null) return true;
  await clickText(/Skip prologue/);
  await page.keyboard.press('Enter').catch(() => {});
  return (await stampReveal()) != null;
});
await page.evaluate(() => {
  const o = document.getElementById('story-beat-overlay');
  if (o) { o.classList.remove('on'); o.style.display = 'none'; }
  try { game.paused = false; } catch (e) {}
});
await page.waitForTimeout(1200);

// ---------------------------------------------------------------- the measurement
const before = await page.evaluate(() => {
  const rev = window.__revealAt;
  const ids = (typeof WM_REGION_ICON_IDS !== 'undefined') ? [...WM_REGION_ICON_IDS] : [];
  const ents = performance.getEntriesByType('resource')
    .filter((e) => e.name.includes('Sprites/world/regions/'));
  const done = rev == null ? 0 : ents.filter((e) => e.responseEnd <= rev).length;
  let plateDone = false, plateSrc = '';
  try { plateDone = !!(_wmPlate && _wmPlate._lxReady && _wmPlate.naturalWidth > 0); plateSrc = _wmPlate.src || ''; } catch (e) {}
  const plateEnt = performance.getEntriesByType('resource').find((e) => plateSrc && e.name === plateSrc);
  return {
    revealAt: rev, total: ids.length,
    requested: ents.length, finishedBeforeReveal: done,
    plateDone, plateBeforeReveal: !!(plateEnt && rev != null && plateEnt.responseEnd <= rev),
    // Structural, not circumstantial: is the map's art actually WATCHED by the commence gate?
    // "it finished in time" can be luck on a fast link; "the gate holds the door for it" cannot.
    gatedRegions: (window._lxRegistryImages || []).filter((i) => (i.src || '').includes('Sprites/world/regions/')).length,
    gatedPlate: (window._lxRegistryImages || []).some((i) => plateSrc && i.src === plateSrc),
    mapOpen: !!document.querySelector('#worldmap-modal.show, #worldmap-modal[style*="flex"]'),
  };
});
console.log(`\n  reveal at ${before.revealAt == null ? '(never)' : Math.round(before.revealAt) + 'ms'}`);
console.log(`  region emblems: ${before.total} in the set, ${before.requested} requested by reveal, ` +
            `${before.finishedBeforeReveal} FINISHED before reveal`);
console.log(`  backdrop plate: loaded=${before.plateDone}  finishedBeforeReveal=${before.plateBeforeReveal}`);
console.log(`  watched by the gate: ${before.gatedRegions}/${before.total} emblems, plate=${before.gatedPlate}\n`);

ok(before.revealAt != null, 'the world revealed (loading overlay went away)');
ok(before.finishedBeforeReveal === before.total,
  `all ${before.total} region emblems finished loading before the world revealed`,
  `only ${before.finishedBeforeReveal}/${before.total} had finished`);
ok(before.gatedRegions === before.total,
  `all ${before.total} region emblems are watched by the commence gate`,
  `only ${before.gatedRegions}/${before.total} are in _lxRegistryImages`);
ok(before.gatedPlate, 'the world-map backdrop plate is watched by the commence gate',
  before.plateBeforeReveal ? 'it finished in time, but nothing held the door for it' : 'not watched at all');

// ---------------------------------------------------------------- first paint of the map
await page.evaluate(() => { try { window._lxBootGateDone = true; } catch (e) {} });
const _wT0 = Date.now();
await page.keyboard.press('w');
// FIRST paint, not eventual paint: read the emblems the moment the map's first render lands. A fixed 120 ms wait
// raced that render - the same build read 77 nodes on one run and 0 on the next, and 0 read as "never rendered".
await page.waitForFunction(() => [...document.querySelectorAll('#worldmap-grid image')].some((im) => (im.getAttribute('href') || '').includes('Sprites/world/regions/')),
  null, { timeout: 5000, polling: 16 }).catch(() => {});
const _wOpenMs = Date.now() - _wT0;
const firstPaint = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('#worldmap-grid image')]
    .filter((im) => (im.getAttribute('href') || '').includes('Sprites/world/regions/'));
  let pending = 0;
  for (const im of imgs) {
    const href = im.getAttribute('href');
    const e = performance.getEntriesByType('resource').find((r) => r.name.endsWith(href));
    if (!e) pending++;
  }
  return { nodes: imgs.length, pending };
});
console.log(`\n  first paint: ${firstPaint.nodes} emblem nodes, ${firstPaint.pending} with no completed fetch, ${_wOpenMs} ms after W\n`);
ok(firstPaint.nodes > 0, 'the map rendered emblem nodes');
ok(firstPaint.pending === 0, 'no emblem was still un-fetched at the map\'s first paint',
  firstPaint.pending + ' of ' + firstPaint.nodes + ' were still loading');

await browser.close().catch(() => {});
server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
