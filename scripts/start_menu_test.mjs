// Live test: STEAM-STYLE START PAGE (v0.27.8) — the boot gate opens on a main
// menu: Continue card (save meta), New Game (auto-backup + wipe), Play Co-op
// (party code), Settings (hoisted above the gate), Save Backups (slot modal).
// Run serve.js (localhost:8765) first, then: node scripts/start_menu_test.mjs
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.MOJI_URL || 'http://localhost:8765/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')); };
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));

  // ---- RUN 1: fresh profile (no save) ----
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
  ok('menu visible after boot', true);
  ok('Continue hidden on fresh run', !(await page.isVisible('#menu-continue')));
  ok('New Game primary on fresh run', await page.evaluate(() => document.getElementById('menu-newgame').classList.contains('primary')));

  // v0.27.9 — title-screen ambience + entrance + music wiring
  await page.waitForTimeout(1600);   // let the ember fade-in (1.4s transition) land
  ok('menu-up entrance class stamped', await page.evaluate(() => document.getElementById('loading-overlay').classList.contains('menu-up')));
  ok('key art applied to backdrop', await page.evaluate(() => getComputedStyle(document.querySelector('#loading-overlay .lo-bg')).backgroundImage.includes('title_keyart')));
  ok('embers layer active', await page.evaluate(() => Number(getComputedStyle(document.querySelector('#loading-overlay .lo-embers')).opacity) > 0.5));
  ok('menu items cascade in (animation set)', await page.evaluate(() => getComputedStyle(document.querySelector('#lo-menu .menu-item')).animationName.includes('lo-menu-in')));
  ok('version tag filled', /v0\.\d+/.test(await page.textContent('#lo-version')));
  ok('logo image loaded (not fallback text)', await page.evaluate(() => {
    const el = document.getElementById('lo-logo');
    return !!el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0 && el.src.includes('mojiworld_logo');
  }));
  ok('menu bgm element wired to Moji is loading', await page.evaluate(() => typeof _menuBgm !== 'undefined' && _menuBgm._srcs[0].includes('Moji is loading')));
  ok('menu bgm survives missing file (fallback chain)', await page.evaluate(() => typeof _menuBgm !== 'undefined' && (_menuBgm._dead === true || _menuBgm._i < _menuBgm._srcs.length)));

  await page.click('#menu-settings');
  await page.waitForSelector('#settings-modal', { state: 'visible', timeout: 5000 });
  const z = await page.evaluate(() => getComputedStyle(document.getElementById('settings-modal-bg')).zIndex);
  ok('settings opens above gate', Number(z) > 9999, 'z=' + z);
  await page.click('#settings-modal .close');
  ok('settings z restored on close', await page.evaluate(() => getComputedStyle(document.getElementById('settings-modal-bg')).zIndex === '200'));

  await page.click('#menu-backups');
  await page.waitForSelector('#backup-modal', { state: 'visible', timeout: 5000 });
  ok('backup modal opens pre-game', true);
  ok('backup empty state', (await page.textContent('#backup-slots')).includes('No backups yet'));
  ok('backup-now hidden with no save', !(await page.isVisible('#backup-now-btn')));
  await page.click('#backup-modal .bk-close');

  await page.click('#menu-newgame');
  await page.waitForSelector('#menu-name-panel', { state: 'visible', timeout: 5000 });
  ok('no wipe warning on fresh run', !(await page.isVisible('#menu-newgame-warn')));
  await page.click('#menu-name-back');
  ok('back returns to menu', await page.isVisible('#lo-menu'));

  await page.click('#menu-coop');
  await page.waitForSelector('#menu-coop-panel', { state: 'visible', timeout: 5000 });
  await page.click('#menu-coop-newcode');
  ok('party-code generator fills code', !!(await page.inputValue('#menu-coop-code')));
  await page.click('#menu-coop-back');

  await page.click('#menu-newgame');
  await page.fill('#auth-user', 'TestHero');
  await page.click('#auth-submit');
  await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 15000 });
  ok('fresh New Game enters world', true);

  // ---- RUN 2: with a save (Continue card, backups, wipe warning) ----
  await page.evaluate(() => {
    const s = { v: (typeof SAVE_VERSION !== 'undefined' ? SAVE_VERSION : 1), t: Date.now(),
      player: { cls: 'mage', level: 42, look: { name: 'Aurora' } }, game: { currentMap: 'town' } };
    localStorage.setItem('levelx_save_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#lo-menu', { state: 'visible', timeout: 90000 });
  ok('Continue card visible with save', await page.isVisible('#menu-continue'));
  const sub = await page.textContent('#menu-continue-sub');
  ok('Continue card shows name/level/class/map', sub.includes('Aurora') && sub.includes('Lv.42') && sub.includes('Mage'), sub.trim());
  ok('Continue card shows class crest', await page.evaluate(() => {
    const i = document.getElementById('menu-continue-icon');
    return i && i.style.display !== 'none' && i.complete && i.naturalWidth > 0 && i.src.includes('class_crest_mage');
  }));

  await page.click('#menu-backups');
  await page.waitForSelector('#backup-now-btn', { state: 'visible', timeout: 5000 });
  await page.click('#backup-now-btn');
  await page.waitForTimeout(300);
  ok('backup slot created', (await page.textContent('#backup-slots')).includes('Lv.42'));
  ok('menu backup count updated', (await page.textContent('#menu-backups-sub')).includes('1 snapshot'));
  await page.click('#backup-modal .bk-del');
  ok('destructive action arms first', (await page.textContent('#backup-modal .bk-del')) === 'Sure?');
  await page.click('#backup-modal .bk-del');
  await page.waitForTimeout(200);
  ok('delete lands on second click', (await page.textContent('#backup-slots')).includes('No backups yet'));
  await page.click('#backup-modal .bk-close');

  await page.click('#menu-newgame');
  ok('wipe warning shown with save', await page.isVisible('#menu-newgame-warn'));
  await page.click('#menu-name-back');

  await page.click('#menu-continue');
  await page.waitForSelector('#loading-overlay', { state: 'detached', timeout: 15000 });
  ok('Continue enters world with saved name', await page.evaluate(() => (window.LX_PENDING_SESSION || {}).name === 'Aurora'));
  ok('no page errors', page._errors.length === 0, page._errors.join(' | '));
} finally {
  await browser.close();
}
const fails = results.filter(r => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
