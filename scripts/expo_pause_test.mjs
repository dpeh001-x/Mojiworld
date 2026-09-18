// EXPEDITION EXIT, PAUSE CARD, SPLIT TWINS (v0.30.891 launch audit). After a run ends the player stands on the tower floor
// for ~2.5 s: nothing there may be picked up or paid. The pause card's exits warn during a run; the daily parcel waits for
// the run to end; a boss wheel or a timed story beat waits for the pause card; an Esc that closes the confirm dialog stops
// there; the tour's close keeps an open panel paused; and a split Gemini's takedown plays on the pair's LAST kill.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/expo_pause_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11199';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _startExpedition === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    document.querySelectorAll('#lo-stack, #tutorial-modal').forEach((e) => e.remove());
    player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player._expLootAck = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 300); game.paused = false;
  });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    const toasts = []; const _st = window.showToast; window.showToast = (t, k) => { toasts.push(String(t)); try { _st(t, k); } catch (e) {} };
    const asks = []; const _uc = window.uiConfirm; window.uiConfirm = (o) => { asks.push(o); return Promise.resolve(false); };
    // 1. the exit window
    _startExpedition(); await wait(2500);
    out.inRun = !!(game.expedition && game.expedition.active);
    // 2. the pause card's exits, during the run
    _lxPauseOpen(); _lxPauseAct('title'); await wait(100); _lxPauseOpen(); _lxPauseAct('quit'); await wait(100);
    out.asks = asks.map((o) => o.title + ' | ' + o.body);
    try { closeAllModals(); } catch (e) {} game.paused = false;
    // 3. the daily parcel, during the run
    try { checkDaily(); } catch (e) {} const d = player.dailyState || game.dailyState || {}; const before = !!d.parcelClaimed;
    try { _claimDailyParcel(); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false;
    out.parcel = { before, after: !!((player.dailyState || game.dailyState || {}).parcelClaimed) };
    const coins0 = player.mojicoins, inv0 = player.inventory.length, map0 = game.currentMap;
    _endExpedition('abandon'); await wait(150);
    const coins1 = player.mojicoins, inv1 = player.inventory.length;
    const blade = { name: 'Floor Probe Blade', icon: '🗡', type: 'weapon', atk: 1, rarity: 'common', tier: 1 };
    game.drops.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'item', item: blade, life: 9000 });
    game.drops.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'mojicoin', value: 500, life: 9000 });
    await wait(700);
    out.window = { map: game.currentMap === map0, coinsKept: player.mojicoins - coins1, bladeKept: player.inventory.some((x) => x && x.name === 'Floor Probe Blade') };
    await wait(2600);
    out.back = { town: game.currentMap === 'town', lockClear: !game._expExitMap };
    const clearScene = async () => { for (let i = 0; i < 20; i++) { const o = document.getElementById('story-beat-overlay'); if (!o || !o.classList.contains('on')) break; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(250); } try { closeDialog(); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false; await wait(200); };
    await wait(1200); await clearScene();   // the Amnesiac reflects on the run (a story beat that pauses)
    game.drops.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, vy: 0, type: 'mojicoin', value: 50, life: 9000 });
    const c2 = player.mojicoins; await wait(600); out.back.townPays = player.mojicoins > c2;
    window.uiConfirm = _uc;
    // 4. nothing opens under the pause card
    await clearScene();
    _lxPauseOpen(); showPowerupChoice({ name: 'Probe', icon: '👑' }); _playStoryBeat({ stanzas: [{ text: 'probe beat' }] });
    await wait(700);
    const pm = document.getElementById('powerup-modal'), sb = document.getElementById('story-beat-overlay');
    out.underCard = { wheel: !!(pm && getComputedStyle(pm).display !== 'none'), beat: !!(sb && sb.classList.contains('on')) };
    _lxPauseClose(); await wait(1400);
    out.afterCard = { beat: !!(sb && sb.classList.contains('on')) };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
    try { closeAllModals(); } catch (e) {} game.paused = false; await wait(300);
    // 5. an Esc that closes the confirm dialog stops there
    await clearScene();
    uiConfirm({ title: 'Probe?', body: 'probe' }); await wait(200);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(300);
    out.escConfirm = { pauseOpened: !!document.getElementById('lx-pause') };
    try { _lxPauseClose(); closeAllModals(); } catch (e) {} game.paused = false;
    // 6. the tour's close keeps an open panel paused
    game._uTab = 'items'; toggleSharedModal('attributes-modal', 'lp', openLevelUpPanel); await wait(300);
    const p0 = !!game.paused; try { _closeTutorial(false); } catch (e) {} out.tour = { before: p0, after: !!game.paused };
    try { closeAllModals(); } catch (e) {} game.paused = false;
    // 7. a split Gemini: the original dies first
    loadMap('zod_gemini', 400); await wait(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
    for (const q of game.monsters.slice()) q.currentHp = 0; game.monsters.length = 0;
    spawnMonster(700, 300, 'zodiac_gemini', true, false); const a = game.monsters[game.monsters.length - 1];
    spawnMonster(900, 300, 'zodiac_gemini', true, false); const b = game.monsters[game.monsters.length - 1];
    b._isTwin = true; b._twinParent = a; b.exp = 0; b.mojicoins = 0; a._twin = b; a._split = true;
    let stings = 0; const _vs = window._lxVictorySting; window._lxVictorySting = (m) => { stings++; };
    toasts.length = 0; a.currentHp = 0; killMonster(a); await wait(1800);
    const w1 = document.getElementById('powerup-modal');
    out.first = { stings, toasts: toasts.filter((t) => /defeated|twin falls/i.test(t)), wheel: !!(w1 && getComputedStyle(w1).display !== 'none') };
    toasts.length = 0; b.currentHp = 0; killMonster(b); await wait(1800);
    out.last = { stings, toasts: toasts.filter((t) => /defeated|twin falls/i.test(t)), wheel: !!(w1 && getComputedStyle(w1).display !== 'none') };
    window._lxVictorySting = _vs; try { closeAllModals(); } catch (e) {}
    return out;
  });
  check(r.inRun, 'an Expedition run started');
  check(r.asks.length === 2 && r.asks.every((x) => /REMOVED/.test(x)), 'the pause card\u2019s Return to title and Quit warn that the run\u2019s loot is removed', J(r.asks));
  check(!r.parcel.after, 'the daily parcel cannot be claimed inside the tower (it paid into the blocked wallet and was lost)', J(r.parcel));
  check(r.window.map && r.window.coinsKept === 0 && !r.window.bladeKept, 'after the run ends, loot and coins on the tower floor are not collected', J(r.window));
  check(r.back.town && r.back.lockClear && r.back.townPays, 'back in town the lock is gone and pickups pay again', J(r.back));
  check(!r.underCard.wheel && !r.underCard.beat && r.afterCard.beat, 'a boss wheel or story beat waits for the pause card to close', J({ under: r.underCard, after: r.afterCard }));
  check(!r.escConfirm.pauseOpened, 'Esc on the confirm dialog closes it without opening the pause card', J(r.escConfirm));
  check(r.tour.before && r.tour.after, 'closing the tour keeps an open panel paused', J(r.tour));
  check(r.first.stings === 0 && !r.first.wheel && r.first.toasts.some((t) => /twin falls/i.test(t)) && !r.first.toasts.some((t) => /defeated/i.test(t)), 'Gemini: the original falling first is "One twin falls!" - no sting, no wheel', J(r.first));
  check(r.last.stings === 1 && r.last.wheel && r.last.toasts.some((t) => /defeated! Choose a powerup/.test(t)), 'Gemini: the pair\u2019s last kill plays the takedown and opens the wheel', J(r.last));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
