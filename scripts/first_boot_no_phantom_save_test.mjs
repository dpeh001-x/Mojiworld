// A brand-new player's first boot: nothing is saved before they create a hero, and New Game does not reload.
//
// Per user: "make sure the sprites BGM and map load before the game starts". Measuring the first boot found
// the autosave heartbeat writing a DEFAULT Lv.1 warrior ~31 s into a new player's loading screen, while
// character creation was still open behind it. The menu then offered "Continue · Hero · Lv.1 Warrior",
// New Game treated that stranger as an adventure to back up, wipe and RELOAD (the whole boot a second time),
// and the start-map prediction prepared 'town' for a player about to create their hero in The Void.
// Asserts, on a fresh profile booted the way a player boots it (no ?dev=1):
//   1. well past the autosave heartbeat, with creation still open, no save exists;
//   2. the menu shows no Continue card, and the boot predicts The Void as the start map;
//   3. New Game -> name -> Enter reaches character creation WITHOUT a page reload;
//   4. picking a class is what lifts the guard (_lxAwaitingCreation clears);
//   5. no page errors.
//   node scripts/first_boot_no_phantom_save_test.mjs        (MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 11741), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0;
const ok = (name, cond, info) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 200) : '')); cond ? pass++ : fail++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
let loads = 0; page.on('load', () => loads++);
const t0 = Date.now();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { const la = document.getElementById('lo-auth'); return la && !la.hidden && la.getBoundingClientRect().width > 2; }, null, { timeout: 150000, polling: 250 });
const menuS = (Date.now() - t0) / 1000;
// stay on the menu until well past the heartbeat that used to write the phantom save
const waitMs = Math.max(0, 40000 - (Date.now() - t0));
await page.waitForTimeout(waitMs);
const atMenu = await page.evaluate(() => ({
  build: GAME_VERSION, hasSave: hasSave(), flag: window._lxAwaitingCreation,
  continueShown: (() => { const c = document.getElementById('menu-continue'); return !!(c && getComputedStyle(c).display !== 'none'); })(),
  predicted: (typeof _lxPredictStartMap === 'function') ? _lxPredictStartMap() : null,
  creationOpen: document.getElementById('class-select-modal').style.display, cls: player.cls,
}));
console.log(`  build ${atMenu.build} · menu at ${menuS.toFixed(1)} s · checked at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
ok('40 s into a first boot, with creation still open, nothing has been saved', atMenu.hasSave === false && atMenu.creationOpen === 'flex', atMenu);
ok('the default hero is still unclaimed (the guard is armed)', atMenu.flag === true, atMenu);
ok('the menu offers no Continue to a player who has never played', atMenu.continueShown === false, atMenu);
ok('the boot prepares The Void, where a new player creates their hero', atMenu.predicted === 'void', atMenu);

const loadsBefore = loads;
await page.evaluate(() => { window.__sameDocument = true; });
await page.click('#menu-newgame');
await page.waitForTimeout(800);
await page.fill('#auth-user', 'Tester');
await page.click('#auth-submit');
const reached = await page.waitForFunction(() => {
  const ov = document.getElementById('loading-overlay');
  const lifted = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('fade');
  return lifted && document.getElementById('class-select-modal').style.display === 'flex';
}, null, { timeout: 120000, polling: 250 }).then(() => true, () => false);
const after = await page.evaluate(() => ({ same: window.__sameDocument === true, hasSave: hasSave(), flag: window._lxAwaitingCreation }));
ok('New Game reaches character creation without reloading the page', reached && after.same === true && loads === loadsBefore, { reached, ...after, reloads: loads - loadsBefore });

// pick a class: go to the class page and click the first card
await page.evaluate(() => { try { _renderCsPage('class'); } catch (e) {} });
await page.waitForTimeout(500);
const picked = await page.evaluate(() => { const c = document.querySelector('#class-select-modal .class-card'); if (!c) return false; c.click(); return true; });
await page.waitForTimeout(1500);
const created = await page.evaluate(() => ({ flag: window._lxAwaitingCreation, cls: player.cls }));
ok('picking a class lifts the guard', picked === true && created.flag === false, { picked, ...created });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
