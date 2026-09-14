// The area nameplate (#map-label): dark, legible, and still able to get out of the way.
//
// Per user, with a crop of it: "make it dark black semi opaque more classy looking, more AAA style",
// then "make it look fancier".
//
// The two checks that matter beyond looks:
//   - it must stay ON SCREEN with the longest map name in the game, at phone width as well as desktop
//     (the redesign sets it in letter-spaced small caps, which is wider per character than the old
//     bold sans, so the cap and the wrap are load-bearing);
//   - .boss-veiled must still hide it. The arrival animation nearly broke that: with
//     animation-fill-mode 'both' the end keyframe sticks, and because it sets opacity and transform it
//     outranks the .boss-veiled rule forever after the first doorway.
//   node scripts/map_label_plate_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29300);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra !== undefined ? '  <- ' + extra : '')); } };
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
const clickText = (src) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  for (const b of document.querySelectorAll('button')) {
    if (getComputedStyle(b).display === 'none' || !b.offsetParent) continue;
    if (rx.test((b.textContent || '').trim())) { b.click(); return true; }
  } return false;
}, src);
const waitFor = async (l, fn, cap = 180000) => { const t0 = Date.now();
  while (Date.now() - t0 < cap) { try { if (await fn()) return true; } catch (e) {} await page.waitForTimeout(400); }
  console.log('  (timeout: ' + l + ')'); return false; };
await waitFor('form', () => page.evaluate(() => !!document.querySelector('#hero-name-input')));
await page.fill('#hero-name-input', 'Plate').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await clickText('^Next');
await waitFor('menu', async () => await clickText('New Game'));
await waitFor('reveal', async () => { await clickText('Skip prologue'); await page.keyboard.press('Enter').catch(() => {});
  return page.evaluate(() => { const o = document.getElementById('loading-overlay');
    return !o || o.classList.contains('fade') || getComputedStyle(o).display === 'none'; }); });
await page.evaluate(() => { const o = document.getElementById('story-beat-overlay');
  if (o) { o.classList.remove('on'); o.style.display = 'none'; }
  try { game.paused = false; window._lxBootGateDone = true; } catch (e) {} });
await page.evaluate(() => { try { loadMap('forest', 400); } catch (e) {} });
await page.waitForTimeout(2600);

// --------------------------------------------------------------- the look
const look = await page.evaluate(() => {
  const el = document.getElementById('map-label'); if (!el) return null;
  const c = getComputedStyle(el);
  const bg = c.backgroundImage || '';
  // the darkest colour stop the plate paints, as an r+g+b sum
  const stops = [...bg.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)]
    .map((m) => ({ sum: +m[1] + +m[2] + +m[3], a: m[4] === undefined ? 1 : +m[4] }));
  return { text: el.textContent, font: c.fontFamily, ls: c.letterSpacing, radius: c.borderRadius,
           border: c.borderTopColor, stops, hasGradient: /gradient/.test(bg),
           before: getComputedStyle(el, '::before').backgroundImage.slice(0, 40) };
});
ok(!!look && look.text === 'Emerald Thicket', 'the plate names the map it is on', look && look.text);
ok(look.hasGradient && look.stops.length >= 2, 'the plate is a gradient, not a flat fill');
ok(look.stops.length >= 2 && look.stops.every((s) => s.sum <= 60), 'every colour stop is near-black (r+g+b <= 60)',
  JSON.stringify(look.stops.map((s) => s.sum)));
ok(look.stops.length >= 2 && look.stops.every((s) => s.a > 0 && s.a < 1), 'and semi-opaque, not solid',
  JSON.stringify(look.stops.map((s) => s.a)));
ok(/Alegreya|Cinzel/.test(look.font), 'set in the house display serif, not the default sans', look.font);
ok(parseFloat(look.ls) >= 1, 'with real letter-spacing', look.ls);
ok(/gradient/.test(look.before), 'the flanking rules are drawn');
// the old lilac ring is gone: the border must be neutral, not purple
const bm = (look.border || '').match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
ok(!!bm && Math.abs(+bm[0 + 1] - +bm[3]) < 18 && Math.abs(+bm[2] - +bm[3]) < 18,
  'the border is neutral, not the old lilac', look.border);

// --------------------------------------------------------------- it still gets out of the way
const veil = await page.evaluate(async () => {
  const el = document.getElementById('map-label');
  el.classList.add('boss-veiled');
  await new Promise((r) => setTimeout(r, 420));
  const o = getComputedStyle(el).opacity;
  el.classList.remove('boss-veiled');
  return o;
});
ok(+veil < 0.05, 'boss-veiled still hides it after an arrival animation has played', 'opacity ' + veil);

// --------------------------------------------------------------- it stays on screen
const longest = await page.evaluate(() => { let b = '';
  try { for (const k in MAPS) { const n = (MAPS[k] && MAPS[k].name) || ''; if (n.length > b.length) b = n; } } catch (e) {}
  return b; });
let over = 0;
for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [430, 860], [380, 780]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(420);
  await page.evaluate((n) => { const el = document.getElementById('map-label'); if (el) el.textContent = n; }, longest);
  await page.waitForTimeout(260);
  const r = await page.evaluate(() => { const b = document.getElementById('map-label').getBoundingClientRect();
    return { l: b.left, r: b.right, vw: innerWidth }; });
  if (!(r.l >= -1 && r.r <= r.vw + 1)) { over++; console.log('    overflow at ' + w + ': ' + Math.round(r.l) + '..' + Math.round(r.r)); }
}
ok(over === 0, `the longest map name (${longest.length} chars) fits at every width`, over + ' overflowed');
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
