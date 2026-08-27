// Headless certification of the tutorial fixes:
//  1. The "Swing your weapon (Z)" step advances on a basic-attack swing even
//     with no monster in range (was gated behind a landed hit via bumpCombo).
//  2. Escape never closes the tutorial — it closes a panel opened during the
//     tour (U) and leaves the dock running + unpauses.
//  3. The tutorial closes ONLY via its own end button (Skip / Got it).
//  4. Tutorial text is standardised to Calibri.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const URL = 'http://localhost:8090/mojiworld_game.html';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
let pass = 0, fail = 0;
const ok = (n, c, d) => { (c ? pass++ : fail++); console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  ' + JSON.stringify(d) : '')); };

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
await page.click('#menu-newgame').catch(() => {});
await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
await page.fill('#auth-user', 'Tutee').catch(() => {});
await page.click('#auth-submit').catch(() => {});
await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => { try { applyClass('warrior'); } catch (e) {} });
await page.waitForTimeout(1200);
// Leave the prologue and force the interactive tutorial dock open. (Calling
// applyClass() directly doesn't run the pick-modal's own close, so hide the
// class-select modal here the way the real pick flow does.)
await page.evaluate(() => {
  try { window._prologueActive = false; window._prologuePending = false; } catch (e) {}
  try { const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {}
  try { if (typeof _showTutorialModal === 'function') _showTutorialModal(); } catch (e) {}
});
await page.waitForTimeout(400);

const dockUp = await page.evaluate(() => { const m = document.getElementById('tutorial-modal'); return !!(m && m.classList.contains('tut-dock') && m.style.display === 'block'); });
ok('interactive tutorial dock is open', dockUp);

// 1) Jump to the "attack" step, clear monsters, swing Z (castSkill basic 'd'), expect advance.
const atk = await page.evaluate(() => {
  const idx = TUTORIAL_STEPS.findIndex(s => s.detect === 'attack');
  _tutStep = idx; TUTORIAL_STEPS.forEach(s => s._done = false); _renderTutorialStep();
  try { game.monsters = []; } catch (e) {}   // nobody in range — pure swing
  const before = _tutStep, doneBefore = !!TUTORIAL_STEPS[idx]._done;
  // find the basic-attack skill id (slot 'd') for this class and cast it
  let basicId = null;
  for (const k in SKILLS) { if (SKILLS[k] && SKILLS[k].slot === 'd') { basicId = k; break; } }
  try { castSkill(basicId); } catch (e) {}
  return { idx, basicId, doneBefore, doneAfter: !!TUTORIAL_STEPS[idx]._done };
});
ok('attack step ticks on a Z swing with NO monster in range', atk.doneAfter && !atk.doneBefore, atk);

// 2) Open the U character panel (pings 'panel', pauses), then press Escape.
const escFlow = await page.evaluate(() => {
  try { openAttributes(); } catch (e) {}
  const beforePaused = game.paused, panelBefore = document.getElementById('attributes-modal').style.display;
  return { beforePaused, panelBefore };
});
await page.waitForTimeout(150);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(200);
const afterEsc = await page.evaluate(() => ({
  tutStillOpen: (() => { const m = document.getElementById('tutorial-modal'); return !!(m && m.classList.contains('tut-dock') && m.style.display === 'block'); })(),
  panelClosed: document.getElementById('attributes-modal').style.display === 'none',
  paused: game.paused,
}));
ok('Escape did NOT close the tutorial (dock still open)', afterEsc.tutStillOpen, afterEsc);
ok('Escape closed the U panel that was open', afterEsc.panelClosed, afterEsc);
ok('game unpaused after closing the panel during the tour', afterEsc.paused === false, afterEsc);

// 2b) Escape again with only the dock open — still must not end the tour.
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(150);
const afterEsc2 = await page.evaluate(() => { const m = document.getElementById('tutorial-modal'); return !!(m && m.classList.contains('tut-dock') && m.style.display === 'block'); });
ok('Escape with only the dock open still keeps the tutorial', afterEsc2);

// 3) The end button DOES close it.
const closed = await page.evaluate(() => {
  const skip = document.getElementById('tut-skip');
  if (skip) skip.click();
  const m = document.getElementById('tutorial-modal');
  return !(m && m.classList.contains('tut-dock') && m.style.display === 'block');
});
ok('clicking the end/Skip button closes the tutorial', closed);

// 4) Fonts standardised to Calibri.
await page.evaluate(() => { try { _showTutorialModal(); } catch (e) {} });
await page.waitForTimeout(200);
const fonts = await page.evaluate(() => {
  const ids = ['tut-title', 'tut-step-title', 'tut-body', 'tut-guguma-line', 'tut-next'];
  return ids.map(id => { const el = document.getElementById(id); return el ? getComputedStyle(el).fontFamily.toLowerCase() : 'missing'; });
});
ok('all tutorial text is Calibri', fonts.every(f => f.indexOf('calibri') === 0), { fonts });

ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
