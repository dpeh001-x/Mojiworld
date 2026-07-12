import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')); };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
  await page.evaluate(() => { const s = { v: 1, t: Date.now(), player: { cls: 'mage', level: 20, look: { name: 'Dev' } }, game: { currentMap: 'town' } }; localStorage.setItem('levelx_save_v1', JSON.stringify(s)); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
  await page.click('#menu-continue');
  await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(800);

  // --- before unlock ---
  ok('LX_DEV not set initially', await page.evaluate(() => localStorage.getItem('LX_DEV') === null));
  ok('🛠 dev button hidden on desktop', !(await page.isVisible('#mobile-dev-btn')));

  // --- type the passphrase ---
  await page.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (e) {} });
  await page.keyboard.type('pehsenglee', { delay: 40 });
  await page.waitForTimeout(300);

  ok('LX_DEV set after passphrase', await page.evaluate(() => localStorage.getItem('LX_DEV') === '1'));
  ok('🛠 dev button now visible (unhidden)', await page.isVisible('#mobile-dev-btn'));

  // --- the unhidden 🛠 dev button now opens the dev console (openDevConsole is
  // hard-gated on LX_DEV, which the passphrase set). Clear any panel the
  // passphrase's gameplay keys opened (e.g. 'p' = Postal Wisp) first.
  await page.evaluate(() => { try { if (typeof closeAllModals === 'function') closeAllModals(); if (typeof game !== 'undefined') game.paused = false; } catch (e) {} });
  await page.click('#mobile-dev-btn');
  await page.waitForTimeout(300);
  ok('dev console (#dev-modal) opens via the 🛠 button after unlock', await page.evaluate(() => {
    const m = document.getElementById('dev-modal');
    return !!m && getComputedStyle(m).display !== 'none';
  }));

  // --- persistence: reload keeps it unlocked + button shown ---
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#menu-continue', { state: 'visible', timeout: 90000 });
  await page.waitForTimeout(300);
  ok('button revealed on reload when already unlocked', await page.isVisible('#mobile-dev-btn'));

  // --- negative: typing in a text field must NOT unlock ---
  const page2 = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page2.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
  await page2.evaluate(() => {
    const i = document.createElement('input'); i.id = '_t'; document.body.appendChild(i); i.focus();
  });
  await page2.keyboard.type('pehsenglee', { delay: 20 });
  await page2.waitForTimeout(200);
  ok('typing in a text field does NOT unlock', await page2.evaluate(() => localStorage.getItem('LX_DEV') === null));

  ok('no page errors', page._errors.length === 0, page._errors.join(' | '));
} finally { await browser.close(); }
const fails = results.filter(r => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
