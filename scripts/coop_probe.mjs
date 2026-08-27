// Probe: load the game headless, report boot state + how to reach gameplay.
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

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0,200)); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0,200)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

const state = await page.evaluate(() => {
  const has = (n) => { try { return typeof eval(n); } catch (e) { return 'undef'; } };
  return {
    authGateVisible: !!document.getElementById('lo-auth') && !document.getElementById('lo-auth').hidden,
    hasAuthUser: !!document.getElementById('auth-user'),
    globals: {
      game: has('game'), player: has('player'), net: has('net'),
      mpConnect: has('mpConnect'), spawnMonster: has('spawnMonster'),
      loadMap: has('loadMap'), LXAuth: has('LXAuth'), openClassSelect: has('openClassSelect'),
      _coopFollowingHost: has('_coopFollowingHost'),
    },
    playerCls: (typeof player !== 'undefined' && player) ? player.cls : '(no player)',
    currentMap: (typeof game !== 'undefined' && game) ? game.currentMap : '(no game)',
    monsters: (typeof game !== 'undefined' && game && game.monsters) ? game.monsters.length : -1,
    classSelectOpen: !!document.querySelector('#class-select, #class-select-modal, .class-select'),
    bodyButtons: Array.from(document.querySelectorAll('button')).slice(0,10).map(b => (b.id||b.textContent||'').slice(0,24)).filter(Boolean),
  };
});
console.log(JSON.stringify({ state, errors: errors.slice(0,15) }, null, 2));
await browser.close();
