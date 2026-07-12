// Live test: STEAM INTEGRATION — (A) controller: a synthetic Gamepad drives the
// player through the real input pipeline (Steam presents a Steam Controller as a
// virtual gamepad, so this is the path that actually runs on Steam); (B) Steam
// Cloud: a mocked window.SteamAPI.cloud mirrors the save + adopts a newer cloud
// save on boot; (C) native Steam Input snapshot ORs into the pad poll; (D) with
// no SteamAPI (the web build) everything is a clean no-op.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof _lxPadPoll === 'function' && typeof loadMap === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { player.cls = 'warrior'; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; loadMap('glasswindSteppe'); } catch (e) {} });
  await sleep(800);

  // Install a controllable synthetic gamepad.
  await page.evaluate(() => {
    window.__pad = { connected: true, id: 'Test Controller (STANDARD GAMEPAD)', mapping: 'standard',
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0, touched: false })),
      axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [window.__pad, null, null, null];
    window.__press = (i, on) => { window.__pad.buttons[i] = { pressed: !!on, value: on ? 1 : 0, touched: !!on }; };
    window.__axis = (i, v) => { window.__pad.axes[i] = v; };
    // spy showToast so the connect toast is captured regardless of fade timing
    window.__toasts = [];
    const _orig = window.showToast;
    window.showToast = function (t, r) { try { window.__toasts.push(String(t)); } catch (e) {} return _orig ? _orig.apply(this, arguments) : undefined; };
  });

  // (A1) D-pad LEFT (button 14 -> moveLeft -> arrowleft) moves the player left.
  const left = await page.evaluate(async () => {
    player.x = 800; player.vx = 0; window.__press(14, true); _lxPadPoll();
    const keySet = !!game.keys['arrowleft'];
    for (let i = 0; i < 8; i++) updatePlayer(16);
    const vx = player.vx;
    window.__press(14, false); _lxPadPoll();
    return { keySet, vx, released: !game.keys['arrowleft'] };
  });
  ok('D-pad left sets the move key + moves the player left', left.keySet && left.vx < 0, left);
  ok('releasing the button clears the held key', left.released === true, left);

  // (A2) Left STICK left (axis 0 negative) also moves left.
  const stick = await page.evaluate(async () => {
    player.x = 800; player.vx = 0; window.__axis(0, -0.9); _lxPadPoll();
    for (let i = 0; i < 8; i++) updatePlayer(16);
    const vx = player.vx; window.__axis(0, 0); _lxPadPoll();
    return { vx };
  });
  ok('left stick moves the player (analog axis path)', stick.vx < 0, stick);

  // (A3) A button (0 -> jump -> Space) makes the grounded player jump.
  const jump = await page.evaluate(async () => {
    player.onGround = true; player.vy = 0; player.y = 300;
    window.__press(0, true); _lxPadPoll();
    for (let i = 0; i < 3; i++) updatePlayer(16);
    const jumped = player.vy < 0 || player.onGround === false;
    window.__press(0, false); _lxPadPoll();
    return { vy: player.vy, jumped };
  });
  ok('A button jumps (grounded player leaves the floor)', jump.jumped, jump);

  // (A4) X button (2 -> attack 'z') triggers an attack.
  const atk = await page.evaluate(async () => {
    player._atkFlag = false; const before = player.attacking || player.attackTimer || 0;
    window.__press(2, true); _lxPadPoll();
    for (let i = 0; i < 2; i++) updatePlayer(16);
    const attacking = !!player.attacking || (player.attackTimer || 0) > 0 || (game.projectiles || []).length > 0 || player.state === 'attack';
    window.__press(2, false); _lxPadPoll();
    return { attacking };
  });
  ok('X button triggers an attack', atk.attacking, atk);

  ok('controller-connected toast fired', await page.evaluate(() => (window.__toasts || []).some(t => /Controller connected/i.test(t))));

  // (B) STEAM CLOUD — mock the bridge and verify mirror + newest-wins adopt.
  const cloud = await page.evaluate(async () => {
    const store = {};
    window.SteamAPI = { available: true,
      cloud: { read: (n) => Promise.resolve(store[n] || null), write: (n, c) => { store[n] = c; return Promise.resolve(true); } },
      input: { snapshot: () => window.__steamBtns || null } };
    // mirror: pushing a save writes to cloud
    const j = JSON.stringify({ v: 1, t: 5000, player: { level: 9 } });
    _lxSteamCloudPush(j, true);
    await new Promise(r => setTimeout(r, 50));
    const mirrored = store[SAVE_KEY] === j;
    // newest-wins ADOPT: local old, cloud newer+higher -> sync writes cloud to local + returns 'reloading'
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: 1000, player: { level: 3 } }));
    store[SAVE_KEY] = JSON.stringify({ v: 1, t: 9000, player: { level: 20 } });
    const r1 = await _lxSteamCloudSync();
    const adopted = JSON.parse(localStorage.getItem(SAVE_KEY)).player.level === 20;
    // local AHEAD -> keep local, push up, no reload
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: 12000, player: { level: 40 } }));
    store[SAVE_KEY] = JSON.stringify({ v: 1, t: 9000, player: { level: 20 } });
    const r2 = await _lxSteamCloudSync();
    const keptLocal = JSON.parse(localStorage.getItem(SAVE_KEY)).player.level === 40 && JSON.parse(store[SAVE_KEY]).player.level === 40;
    return { available: _steamAvailable(), mirrored, r1, adopted, r2, keptLocal };
  });
  ok('Steam bridge detected available', cloud.available === true, cloud);
  ok('save mirrors to Steam Cloud on push', cloud.mirrored === true, cloud);
  ok('boot sync ADOPTS a newer cloud save (returns reloading)', cloud.r1 === 'reloading' && cloud.adopted, cloud);
  ok('boot sync KEEPS + pushes a more-advanced local save', cloud.r2 !== 'reloading' && cloud.keptLocal, cloud);

  // (B2) STEAM ACHIEVEMENTS — the game's own unlocks mirror to Steam.
  const ach = await page.evaluate(async () => {
    const calls = [];
    window.SteamAPI.achievement = { unlock: (n) => { calls.push(n); return Promise.resolve(true); } };
    _lxSteamAchDone.clear();
    // trigger a fresh unlock through the REAL checkAchievements path
    game.achievements = {}; game.kills = 1;
    checkAchievements();
    const firstBlood = calls.includes('firstBlood');
    // dedup: a second check does NOT re-fire the same achievement
    const n1 = calls.length; checkAchievements(); const noDup = calls.length === n1;
    // load-sync pushes already-earned achievements up
    calls.length = 0; _lxSteamAchDone.clear();
    game.achievements = { firstBlood: 1, slayer100: 1 };
    _lxSteamSyncAchievements();
    const synced = calls.includes('firstBlood') && calls.includes('slayer100');
    return { firstBlood, noDup, synced, count: (typeof ACHIEVEMENTS !== 'undefined') ? ACHIEVEMENTS.length : 0 };
  });
  ok('game achievement unlock mirrors to Steam', ach.firstBlood === true, ach);
  ok('achievement unlock de-dupes (no repeat IPC)', ach.noDup === true, ach);
  ok('load syncs already-earned achievements to Steam', ach.synced === true, ach);
  ok('achievement catalog present (' + ach.count + ' achievements)', ach.count >= 20, ach);

  // (C) Native Steam Input snapshot ORs into the poll (no physical pad button).
  const nativeInput = await page.evaluate(async () => {
    window.__pad.buttons.forEach((_, i) => window.__press(i, false)); window.__axis(0, 0);
    player.onGround = true; player.vy = 0;
    window.__steamBtns = { jump: true };   // native ISteamInput reports 'jump' pressed
    _lxPadPoll();
    for (let i = 0; i < 3; i++) updatePlayer(16);
    const jumped = player.vy < 0 || player.onGround === false;
    window.__steamBtns = null; _lxPadPoll();
    return { jumped };
  });
  ok('native Steam Input snapshot drives the game (jump action)', nativeInput.jumped, nativeInput);

  // (D) WEB BUILD (no SteamAPI): every Steam path is a clean no-op.
  const web = await page.evaluate(async () => {
    delete window.SteamAPI;
    const avail = _steamAvailable();
    let threw = false;
    try { _lxSteamCloudPush('{"x":1}', true); const r = await _lxSteamCloudSync(); void r; } catch (e) { threw = true; }
    return { avail, threw };
  });
  ok('web build: Steam unavailable + cloud calls are safe no-ops', web.avail === false && web.threw === false, web);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== STEAM INTEGRATION (controller + cloud saves) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
