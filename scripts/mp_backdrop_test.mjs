// The Multiplayer modal wears the internet-globe backdrop (ludo.ai art).
//
// Per user: "create a nice internet globe backdrop for this." The checks:
//   1. the backdrop FILE exists and decodes (a bad CSS url fails silently —
//      the panel would quietly fall back to the flat color)
//   2. the modal's computed background carries BOTH layers: the dark glass
//      gradient (text contrast) AND the globe image
//   3. scope: .modal is shared by every dialog — no other modal inherits it
// Run: node scripts/mp_backdrop_test.mjs [file.html] [--shot out.png]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const shotIdx = process.argv.indexOf('--shot');
const shotPath = shotIdx > 0 ? process.argv[shotIdx + 1] : null;
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof game !== 'undefined' && document.getElementById('multiplayer-modal'), { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.evaluate(() => { try { loadMap('town'); } catch (e) {} game.paused = false; });
// In gameplay first: opened from the boot menu, the title-screen mascot art
// sits ABOVE the overlay and the element screenshot captures a giant duck
// through the modal bounds. In-game is also how players actually reach it.
// 5s, not 1.5: the AREA CARD (map name + mascot art) lingers ~3s after
// loadMap and draws above every modal — the first two captures photographed
// it instead of the backdrop (a giant duck, both times).
await page.waitForTimeout(5000);

const r = await page.evaluate(async () => {
  const out = {};
  out.spriteOk = await new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 0);
    img.onerror = () => res(false);
    img.src = 'Sprites/ui/mp_globe_backdrop.webp';
  });
  // The pause/settings panel auto-opens on window blur (a Playwright window
  // is never focused) and its own art layer — panel_pause.webp, the rolling
  // chick — then overlays every modal underneath. Close it, or the screenshot
  // photographs a duck instead of the globe.
  const _set = document.getElementById('settings-modal'); if (_set) _set.style.display = 'none';
  game.paused = false;
  const ov = document.getElementById('multiplayer-modal');
  ov.style.display = 'flex';
  const panel = ov.querySelector('.modal');
  const bg = getComputedStyle(panel).backgroundImage;
  out.hasGlobe = /mp_globe_backdrop\.webp/.test(bg);
  out.hasOverlay = /linear-gradient/.test(bg);
  // scope: the help modal must NOT inherit the globe
  const help = document.querySelector('#help-modal .modal');
  out.helpClean = help ? !/mp_globe_backdrop/.test(getComputedStyle(help).backgroundImage) : null;
  return out;
});

if (shotPath) {
  await page.waitForTimeout(600);   // let the webp decode before the capture
  const ov = await page.$('#multiplayer-modal .modal');
  if (ov) await ov.screenshot({ path: path.join(ROOT, shotPath) });
  console.log(`  shot -> ${shotPath}`);
}
await browser.close();

check(r.spriteOk, 'the globe backdrop file exists and decodes', r.spriteOk);
check(r.hasGlobe, 'the Multiplayer panel carries the globe image layer', r.hasGlobe);
check(r.hasOverlay, 'and the dark glass gradient stays on top for text contrast', r.hasOverlay);
check(r.helpClean !== false, 'no other modal inherits the globe (.modal is shared)', r.helpClean);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
