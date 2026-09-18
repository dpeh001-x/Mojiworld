// Part 2 of scripts/settings_audit_test.mjs: the choices survive a reload (in the game AND in the panel), every button
// in the panel does its job, Done closes and resumes, and Reset Defaults puts everything back.
import { readFileSync } from 'node:fs';
export default async function part2({ page, URL, check, J, BOOT }) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openSettingsModal === 'function', null, { timeout: 120000 });
  await page.evaluate(BOOT);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const $ = (id) => document.getElementById(id);
    const on = (id) => $(id).classList.contains('on'); const vis = (el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const o = {};
    // after the reload, before the panel is opened: the game already runs on the saved choices
    o.game = { scale: parseFloat(getComputedStyle(document.querySelector('.game-wrapper')).getPropertyValue('--game-scale')), sfx: +_SFX_MASTER_VOL.toFixed(2),
      weather: LX_GFX.weather, shake: game._shakeMul, flash: game._flashMul, cb: document.body.classList.contains('cb-rarity'),
      fdesk: document.body.classList.contains('force-desktop'), ui: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim(), diff: game._diffTier };
    openSettingsModal(); await sleep(100);
    o.panel = { scale: $('set-scale').value, bgm: $('set-bgm-val').textContent, sfx: $('set-sfx-val').textContent, bgMute: on('set-bgmute'), weather: on('set-fx-weather'),
      gfx: $('set-gfx').value, fdesk: on('set-fdesk'), ui: $('set-uiscale-val').textContent, shake: $('set-shake-val').textContent, flash: $('set-flash-val').textContent,
      cb: on('set-cbrarity'), diff: $('set-difficulty').value };
    // the buttons
    const rows = [...document.querySelectorAll('#settings-modal button')].map((b) => b.textContent.trim());
    o.buttons = rows;
    $('set-tutorial-open').click(); await sleep(400);
    o.tour = { open: vis($('tutorial-modal')), settingsClosed: !$('settings-modal-bg').classList.contains('on') };
    try { closeAllModals(); } catch (e) {} await sleep(100);
    openSettingsModal(); await sleep(50);
    [...document.querySelectorAll('#set-hotkeys-row button')][0].click(); await sleep(300);
    const kb = $('keybind-modal') || $('keybind-modal-bg'); o.hotkeys = vis(kb) || !!(kb && kb.classList.contains('on'));
    try { closeAllModals(); } catch (e) {} await sleep(100);
    openSettingsModal(); await sleep(50);
    [...document.querySelectorAll('#settings-modal .hs-btn')].find((b) => /Slots/.test(b.textContent)).click(); await sleep(200);
    const bk = $('backup-modal-bg'); o.slots = !!bk && (bk.classList.contains('on') || vis(bk));
    try { closeAllModals(); } catch (e) {} await sleep(100);   // what Esc does
    o.slotsEsc = { closed: !bk.classList.contains('on'), resumed: !game.paused };
    openSettingsModal(); await sleep(50);
    let fsErr = null; try { [...document.querySelectorAll('#set-fullscreen-row button')][0].click(); } catch (e) { fsErr = e.message; } o.fsErr = fsErr;
    await sleep(200);
    return o;
  });
  check(Math.abs(r.game.scale - 1) < 0.01 && r.game.sfx === 0.3 && r.game.weather === false && r.game.shake === 0 && r.game.flash === 0 && r.game.cb && r.game.fdesk && r.game.ui === '1.3' && r.game.diff === 'hard', 'after a reload the game already runs on every saved choice', J(r.game));
  const p = r.panel;
  check(p.scale === '1' && p.bgm === '40%' && p.sfx === '30%' && !p.bgMute && !p.weather && p.gfx === 'custom' && p.fdesk && p.ui === '130%' && p.shake === '0%' && p.flash === '0%' && p.cb && p.diff === 'hard', '...and the panel shows them', J(p));
  check(r.tour.open && r.tour.settingsClosed, 'Tutorial: "Open the tour" opens it (and closes Settings)', J(r.tour));
  check(r.hotkeys, 'Hotkeys & Skills opens the key map', J(r.hotkeys));
  check(r.slots, 'Hard Save > Slots opens the backup slots', J(r.slots));
  check(r.slotsEsc.closed && r.slotsEsc.resumed, '...and Esc closes them and resumes the game', J(r.slotsEsc));
  check(!r.fsErr, 'Fullscreen: the button runs without an error', J(r.fsErr));
  // Secure Save downloads a file
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.evaluate(() => { [...document.querySelectorAll('#settings-modal .hs-btn')].find((b) => /Secure|Save/.test(b.textContent) && !/Slots|Import/.test(b.textContent)).click(); });
  const file = await dl;
  check(!!file && /\.mojisave$/.test(file.suggestedFilename()), 'Hard Save > Secure Save downloads a .mojisave', J(file && file.suggestedFilename()));
  // Import: change the live save, import the file just exported, and the file's save is what comes back
  const coins = (raw) => { const m = String(raw || '').match(/"mojicoins":(\d+)/); return m ? +m[1] : null; };
  const exported = file ? coins(JSON.parse(readFileSync(await file.path(), 'utf8')).data) : null;
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} player.mojicoins = (player.mojicoins | 0) + 777; _flushSaveStateNow(); });
  const before = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
  if (file) await page.setInputFiles('#save-import-file', await file.path());
  await page.waitForFunction(() => document.getElementById('confirm-modal').style.display === 'flex', null, { timeout: 8000 }).catch(() => {});
  const nav = page.waitForNavigation({ timeout: 15000 }).catch(() => null);
  await page.evaluate(() => document.getElementById('confirm-yes').click()); await nav;
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SAVE_KEY === 'string', null, { timeout: 120000 });
  const after = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
  check(exported != null && coins(before) === exported + 777 && coins(after) === exported, 'Hard Save > Import restores the exported save (and reloads)', J({ exported, before: coins(before), after: coins(after) }));
  await page.evaluate(BOOT);
  // Done, then Reset Defaults
  const z = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const $ = (id) => document.getElementById(id);
    try { closeAllModals(); } catch (e) {} await sleep(100);
    openSettingsModal(); await sleep(50);
    document.querySelector('#settings-modal .actions .close').click(); await sleep(150);
    const done = { closed: !$('settings-modal-bg').classList.contains('on'), resumed: !game.paused };
    openSettingsModal(); await sleep(50);
    document.querySelector('#settings-modal .actions .reset').click(); await sleep(200);
    const s = _lxGetSettings();
    const reset = { scale: s.scale, bgm: s.bgm, sfx: s.sfx, fx: s.fxWeather, ui: s.uiScale, shake: s.shakePct, flash: s.flashPct, cb: s.cbRarity, fdesk: s.fdesk, bgMute: s.bgMute, diff: s.difficulty,
      live: { weather: LX_GFX.weather, shake: game._shakeMul, cb: document.body.classList.contains('cb-rarity'), fdesk: document.body.classList.contains('force-desktop'), ui: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim() },
      panel: { scale: $('set-scale').value, weather: $('set-fx-weather').classList.contains('on'), cb: $('set-cbrarity').classList.contains('on') } };
    return { done, reset };
  });
  check(z.done.closed && z.done.resumed, 'Done closes Settings and resumes the game', J(z.done));
  const q = z.reset;
  check(q.diff === 'hard', 'Reset Defaults keeps your difficulty', J(q.diff));
  check(q.scale === 2 && q.bgm === 90 && q.sfx === 70 && q.fx === true && q.ui === 100 && q.shake === 100 && q.flash === 100 && !q.cb && !q.fdesk && q.bgMute === true, 'Reset Defaults restores the defaults', J(q));
  check(q.live.weather && q.live.shake === 1 && !q.live.cb && !q.live.fdesk && q.live.ui === '1', '...in the running game too', J(q.live));
  check(q.panel.scale === '2' && q.panel.weather && !q.panel.cb, '...and in the panel', J(q.panel));
}
