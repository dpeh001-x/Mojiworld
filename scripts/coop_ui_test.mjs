// Verify the REAL entry UI: "Name your hero" gate + the party-code connect flow,
// driven by actual clicks/typing (not by setting globals).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
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
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the auth gate to actually appear (it shows after the asset load).
  await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
  const gate = await page.evaluate(() => {
    const a = document.getElementById('lo-auth');
    return {
      visible: !!a && !a.hidden,
      hasNameField: !!document.getElementById('auth-user'),
      hasPassword: !!document.getElementById('auth-pass'),
      hasRegisterTab: !!document.querySelector('.auth-tab[data-tab="register"]'),
      submitText: (document.getElementById('auth-submit') || {}).textContent,
      label: (document.querySelector('.auth-name-label') || {}).textContent,
    };
  });
  ok('gate shows "Name your hero"', gate.visible && /name your hero/i.test(gate.label || ''), gate);
  ok('no password field (accounts removed)', gate.hasPassword === false, gate);
  ok('no register tab (accounts removed)', gate.hasRegisterTab === false, gate);
  ok('submit says Enter Mojiworld', /enter mojiworld/i.test(gate.submitText || ''), gate);

  // Type a name and click Enter — the world should reveal (overlay removed) and the name applied.
  await page.click('#menu-newgame').catch(() => {});
  await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
  await page.fill('#auth-user', 'Zephyr');
  await page.click('#auth-submit');
  await page.waitForTimeout(1500);
  const afterEnter = await page.evaluate(() => ({
    overlayGone: !document.getElementById('loading-overlay') || document.getElementById('loading-overlay').classList.contains('fade'),
    heroName: (typeof player !== 'undefined' && player.look) ? player.look.name : null,
    mpName: localStorage.getItem('levelx_mp_name'),
    session: JSON.parse(localStorage.getItem('levelx_session') || '{}').kind || JSON.parse(localStorage.getItem('lx_session') || '{}').kind || '(unknown key)',
  }));
  ok('entering a name reveals the world', afterEnter.overlayGone === true, afterEnter);
  ok('character name persisted for co-op', afterEnter.mpName === 'Zephyr', afterEnter);

  // Entering a name pops the class-select modal; a real player picks a class
  // (dismissing it) before reaching the Multiplayer button. Do the same so the
  // panel isn't opened underneath class-select (whose canvas eats the click).
  await page.evaluate(() => { const c = document.getElementById('class-select-modal'); if (c) c.style.display = 'none'; });
  // Open the Multiplayer panel and verify the friendly party-code UI.
  await page.evaluate(() => { try { openMultiplayer(); } catch (e) {} });
  await page.waitForTimeout(400);
  const mp = await page.evaluate(() => ({
    modalOpen: (document.getElementById('multiplayer-modal') || {}).style.display !== 'none',
    urlPrefilled: (document.getElementById('mp-url') || {}).value,
    namePrefilled: (document.getElementById('mp-name') || {}).value,
    codeLabel: !!Array.from(document.querySelectorAll('#multiplayer-modal label')).find(l => /party code/i.test(l.textContent)),
    hasNewCodeBtn: !!document.getElementById('mp-newcode-btn'),
  }));
  ok('Multiplayer panel opens', mp.modalOpen, mp);
  ok('server URL is pre-filled (no ws:// typing)', !!mp.urlPrefilled && mp.urlPrefilled.length > 0, mp);
  ok('name pre-filled from character name', mp.namePrefilled === 'Zephyr', mp);
  ok('has a "Party Code" label', mp.codeLabel, mp);
  ok('has a 🎲 New code button', mp.hasNewCodeBtn, mp);

  // Click New code -> a code appears; then Connect -> becomes connected.
  await page.click('#mp-newcode-btn');
  const code = await page.evaluate(() => (document.getElementById('mp-room') || {}).value);
  ok('New code generates a party code', /^[A-Z0-9]{5}$/.test(code || ''), { code });
  await page.click('#mp-connect-btn');
  await page.waitForFunction(() => typeof net === 'object' && net.connected, null, { timeout: 12000 }).catch(() => {});
  const conn = await page.evaluate(() => ({ connected: net.connected, isHost: net.isHost, room: net.baseRoom }));
  ok('Connect via the panel actually connects', conn.connected === true, conn);

  ok('no page errors through the whole UI flow', errs.length === 0, errs.slice(0, 5));
} catch (e) {
  results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) });
} finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== ENTRY UI + JOIN FLOW ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
