// Live test: STEAM INTEGRATION — (A) controller: a synthetic Gamepad drives the
// player through the real input pipeline (Steam presents a Steam Controller as a
// virtual gamepad, so this is the path that actually runs on Steam); (B) Steam
// Cloud: a mocked window.SteamAPI.cloud mirrors the save + adopts a newer cloud
// save on boot; (C) native Steam Input snapshot ORs into the pad poll; (D) with
// no SteamAPI (the web build) everything is a clean no-op.
import { chromium } from 'playwright-core';
// Overridable so the suite runs anywhere (Windows: MOJI_PW_EXE to local Chrome).
const EXE = process.env.MOJI_PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.MOJI_GAME_URL || 'http://localhost:8080/mojiworld_game.html';
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
    // flip the _lxPadPresent perf gate exactly like a real first button press
    window.dispatchEvent(new Event('gamepadconnected'));
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

  // (A4) X button (2 -> attack 'z') triggers an attack. Capture at the keydown
  // instant (a melee swing decays within a couple of sim frames), from a clean
  // grounded/idle state so no prior test bleeds in.
  const atk = await page.evaluate(async () => {
    // reset to a clean, attackable state
    Object.keys(game.keys).forEach(k => game.keys[k] = false);
    player.onGround = true; player.vx = 0; player.vy = 0; player.hitStun = 0; player.attacking = false;
    player.attackTimer = 0; player.attackCooldown = 0; player._atkCd = 0; player.dodging = 0;
    const spawnBefore = (game.projectiles || []).length;
    window.__press(2, true); _lxPadPoll();   // keydown -> the handler starts the attack synchronously
    const immediate = !!player.attacking || (player.attackTimer || 0) > 0 || player.state === 'attack' || game.keys['z'] === true;
    updatePlayer(16);
    const oneFrame = immediate || !!player.attacking || (player.attackTimer || 0) > 0 || (game.projectiles || []).length > spawnBefore;
    window.__press(2, false); _lxPadPoll();
    return { immediate, oneFrame, zKey: game.keys['z'] };
  });
  ok('X button triggers an attack (z key routed through the pipeline)', atk.oneFrame || atk.zKey === true, atk);

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

  // (E) RICH PRESENCE + JOIN GAME + INVITE + STATS (mock the bridge surface).
  const feat = await page.evaluate(async () => {
    const rec = { presence: [], overlay: [], stats: [], connected: [] };
    window.SteamAPI = Object.assign(window.SteamAPI || {}, {
      available: true,
      presence: { set: (p) => { rec.presence.push(p); return Promise.resolve(true); } },
      overlay: { open: (d) => { rec.overlay.push(d); return Promise.resolve(true); } },
      stats: { set: (o) => { rec.stats.push(o); return Promise.resolve(true); } },
      cloud: { read: () => Promise.resolve(null), write: () => Promise.resolve(true) },
    });
    // (E1) presence while NOT connected -> status + empty group + empty connect
    if (net) net.connected = false;
    player.level = 12; player.cls = 'warrior';
    _lxSteamPresence(true);
    const solo = rec.presence[rec.presence.length - 1];
    // (E2) presence while connected -> group = party code + a connect string
    if (net) { net.connected = true; net.baseRoom = 'wxyz9'; net._lastUrl = 'wss://relay.example'; net.peers = { 2: {} }; }
    _lxSteamPresence(true);
    const coop = rec.presence[rec.presence.length - 1];
    // (E3) invite button opens the overlay to friends
    const invited = _lxSteamInviteFriends();
    // (E4) stats push carries lifetime counters
    game.kills = 137; player.mojicoins = 5400; game.bossDefeated = { a: 1, b: 1 };
    _lxSteamPushStats();
    const stat = rec.stats[rec.stats.length - 1];
    return { solo, coop, invited, invOverlay: rec.overlay[0], stat };
  });
  ok('rich presence: solo status, no party group', /Playing/.test(feat.solo.status) && feat.solo.group === '' && feat.solo.connect === '', feat.solo);
  ok('rich presence: co-op status + party GROUP + connect string', /co-op/.test(feat.coop.status) && feat.coop.group === 'WXYZ9' && /--moji-join=.*~WXYZ9/.test(feat.coop.connect), feat.coop);
  ok('Invite Friends opens the Steam overlay', feat.invited === true && feat.invOverlay === 'friends', feat);
  ok('Steam Stats push carries lifetime counters', feat.stat && feat.stat.lifetime_kills === 137 && feat.stat.highest_level === 12 && feat.stat.bosses_defeated === 2, feat.stat);

  // (F) JOIN GAME — a connect string auto-joins the party (mock mpConnect).
  const join = await page.evaluate(async () => {
    const calls = [];
    const orig = window.mpConnect;
    window.mpConnect = (url, name, room) => { calls.push({ url, room }); };   // capture, don't actually connect
    if (net) net.connected = false;
    _lxSteamTryAutoJoin('--moji-join=' + encodeURIComponent('wss://relay.example') + '~ABC42');
    window.mpConnect = orig;
    return { calls };
  });
  ok('Join Game connect string auto-joins the correct party', join.calls.length === 1 && join.calls[0].url === 'wss://relay.example' && join.calls[0].room === 'ABC42', join);

  // (J) STEAM LOBBY — friend invites end to end: the party mirrors into a
  // lobby (code carrier), Invite uses the lobby dialog, and a resolved
  // +connect_lobby prefills the party-code UI everywhere before auto-joining.
  const lobby = await page.evaluate(async () => {
    const rec = { host: [], leave: 0, invite: 0, overlay: [] };
    window.SteamAPI = Object.assign(window.SteamAPI || {}, {
      available: true,
      lobby: { host: (d) => { rec.host.push(d); return Promise.resolve('109775240000000001'); },
               leave: () => { rec.leave++; return Promise.resolve(true); },
               invite: () => { rec.invite++; return Promise.resolve(true); } },
      overlay: { open: (d) => { rec.overlay.push(d); return Promise.resolve(true); } },
    });
    if (net) { net.connected = true; net.baseRoom = 'wxyz9'; net._lastUrl = 'wss://relay.example'; net.peers = { 2: {} }; }
    _lxSteamLobbyCode = '';
    _lxSteamPresence(true); await new Promise(r => setTimeout(r, 20));
    const hosted = rec.host.length === 1 ? rec.host[0] : null;
    _lxSteamPresence(true); await new Promise(r => setTimeout(r, 20));   // same code -> no re-host
    const hostCallsAfterRepeat = rec.host.length;
    const invited = _lxSteamInviteFriends(); await new Promise(r => setTimeout(r, 30));
    const inviteUsedLobby = rec.invite >= 1 && rec.overlay.length === 0;
    net.connected = false;
    _lxSteamPresence(true); await new Promise(r => setTimeout(r, 20));   // party over -> drop lobby
    const left = rec.leave >= 1;
    // invite right after (re)connecting, BEFORE any heartbeat -> hosts on demand
    net.connected = true; net.baseRoom = 'newp2';
    const invited2 = _lxSteamInviteFriends(); await new Promise(r => setTimeout(r, 30));
    const onDemand = rec.host.length === 2 && rec.host[1].code === 'NEWP2' && rec.invite >= 2;
    net.connected = false; _lxSteamLobbySync();   // cleanup
    // friend side: main resolved +connect_lobby -> moji-join -> PREFILL + join
    localStorage.removeItem(MP_ROOM_KEY);
    const joins = []; const mpOrig = window.mpConnect;
    window.mpConnect = (url, name, room) => { joins.push({ url, room }); };
    _lxSteamTryAutoJoin('--moji-join=' + encodeURIComponent('wss://relay.example') + '~QQ7PL');
    window.mpConnect = mpOrig;
    const prefRoom = (document.getElementById('mp-room') || {}).value;
    const prefMenu = (document.getElementById('menu-coop-code') || {}).value;
    const prefSaved = localStorage.getItem(MP_ROOM_KEY);
    return { hosted, hostCallsAfterRepeat, invited, inviteUsedLobby, left, invited2, onDemand, joins, prefRoom, prefMenu, prefSaved };
  });
  ok('co-op heartbeat hosts the invite lobby with the party code', !!lobby.hosted && lobby.hosted.code === 'WXYZ9' && /relay\.example/.test(lobby.hosted.relay), lobby.hosted);
  ok('heartbeat re-run does NOT re-host the same lobby', lobby.hostCallsAfterRepeat === 1, lobby.hostCallsAfterRepeat);
  ok('Invite Friends prefers the lobby INVITE DIALOG over the overlay', lobby.invited === true && lobby.inviteUsedLobby === true, lobby);
  ok('party end drops the lobby', lobby.left === true, lobby.left);
  ok('invite before the heartbeat hosts the lobby on demand', lobby.invited2 === true && lobby.onDemand === true, lobby);
  ok('accepted invite prefills the party code everywhere + auto-joins', lobby.joins.length === 1 && lobby.joins[0].room === 'QQ7PL' && lobby.prefRoom === 'QQ7PL' && lobby.prefMenu === 'QQ7PL' && lobby.prefSaved === 'QQ7PL', { joins: lobby.joins, room: lobby.prefRoom, menu: lobby.prefMenu, saved: lobby.prefSaved });

  // (L) FRESH-SAVE INVITE — no class picked yet (class select still up): the
  // join must NOT connect; it prefills, saves and tells the player instead.
  const fresh = await page.evaluate(async () => {
    const calls = []; const orig = window.mpConnect;
    window.mpConnect = (u, n, r) => calls.push(r);
    const savedCls = player.cls; player.cls = null;
    window.__toasts.length = 0;
    localStorage.removeItem(MP_ROOM_KEY);
    _lxSteamTryAutoJoin('--moji-join=' + encodeURIComponent('wss://relay.example') + '~FRSH1');
    player.cls = savedCls; window.mpConnect = orig;
    return { calls, saved: localStorage.getItem(MP_ROOM_KEY), toast: (window.__toasts || []).some(t => /FRSH1 saved/.test(t)) };
  });
  ok('fresh save: invite does NOT auto-connect under class select', fresh.calls.length === 0, fresh.calls);
  ok('fresh save: code saved + player told what to do', fresh.saved === 'FRSH1' && fresh.toast === true, fresh);

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

  // (G) CONTROLLER MENU NAV — with a panel open the pad navigates the MENU
  // (focus ring, D-pad moves, B closes) and stops driving the character.
  const nav = await page.evaluate(async () => {
    window.__pad.buttons.forEach((_, i) => window.__press(i, false)); window.__axis(0, 0); window.__axis(1, 0); _lxPadPoll();
    openSettingsModal(); await new Promise(r => setTimeout(r, 50));
    const openBefore = !!_lxPadModalRoot();
    window.__press(13, true); _lxPadPoll(); window.__press(13, false); _lxPadPoll();
    const f1 = document.querySelector('.pad-focus');
    window.__press(13, true); _lxPadPoll(); window.__press(13, false); _lxPadPoll();
    const f2 = document.querySelector('.pad-focus');
    const movedFocus = !!(f1 && f2 && f1 !== f2);
    const leaked = !!(game.keys['arrowdown'] || game.keys['arrowup']);
    window.__press(1, true); _lxPadPoll(); window.__press(1, false); _lxPadPoll();
    await new Promise(r => setTimeout(r, 60));
    const closed = !_lxPadModalRoot();
    return { openBefore, first: f1 ? (f1.id || f1.className || f1.tagName) : null, movedFocus, leaked, closed };
  });
  ok('pad enters menu mode with a focus ring on a control', nav.openBefore && !!nav.first, nav);
  ok('D-pad moves focus between menu controls', nav.movedFocus === true, nav);
  ok('menu mode: movement does not leak to the character', nav.leaked === false, nav);
  ok('B closes the open panel from the pad', nav.closed === true, nav);

  // (H) RUMBLE — haptics ride the audio.play switchboard: fire even when the
  // game is MUTED, and never when the pad has sat untouched 8s+ (idle gate).
  const rumble = await page.evaluate(async () => {
    window.__rumbles = [];
    window.__pad.vibrationActuator = { playEffect: (type, p) => { window.__rumbles.push(Object.assign({ type }, p)); return Promise.resolve('complete'); } };
    window.__press(14, true); _lxPadPoll(); window.__press(14, false); _lxPadPoll();   // pad "in use" now
    const wasMuted = audio.muted; audio.muted = true;
    _lxRumbleLast = 0; audio.play('hit');
    await new Promise(r => setTimeout(r, 90));
    audio.play('death');
    const got = window.__rumbles.slice();
    _lxPadLastInput = performance.now() - 9000;   // pad idle 9s -> gate closes
    _lxRumbleLast = 0;
    const before = window.__rumbles.length;
    audio.play('crit');
    const gated = window.__rumbles.length === before;
    audio.muted = wasMuted;
    return { got, gated };
  });
  ok('rumble fires through audio.play while MUTED (hit tick)', rumble.got.some(r => r.type === 'dual-rumble' && r.duration === 55), rumble.got);
  ok('death lands the heavy rumble', rumble.got.some(r => r.duration === 450 && r.strongMagnitude > 0.9), rumble.got);
  ok('idle-pad gate: no rumble when the pad is untouched 8s+', rumble.gated === true, rumble.gated);

  // (I) QUIT — the Deck exit path: wrapper-only row unhidden, REACHED WITH THE
  // PAD from the open Settings panel, flushes the save, then window.close().
  const quit = await page.evaluate(async () => {
    window.__closed = 0;
    const origClose = window.close; window.close = () => { window.__closed++; };
    openSettingsModal(); await new Promise(r => setTimeout(r, 30));   // SteamAPI mock present -> wrapper build
    const rowShown = document.getElementById('set-quit-row').style.display !== 'none';
    const quitBtn = document.querySelector('#set-quit-row button');
    window.__pad.buttons.forEach((_, i) => window.__press(i, false)); _lxPadPoll();
    let steps = 0, focused = null;
    while (steps++ < 120) {
      window.__press(13, true); _lxPadPoll(); window.__press(13, false); _lxPadPoll();
      focused = document.querySelector('.pad-focus');
      if (focused === quitBtn) break;
    }
    const reached = focused === quitBtn;
    localStorage.removeItem(SAVE_KEY);
    window.__press(0, true); _lxPadPoll(); window.__press(0, false); _lxPadPoll();   // A on the quit button
    await new Promise(r => setTimeout(r, 30));
    const saved = !!localStorage.getItem(SAVE_KEY);
    const closed = window.__closed > 0;
    window.close = origClose;
    try { closeSettingsModal(); } catch (e) {}
    return { rowShown, reached, steps, saved, closed };
  });
  ok('wrapper build unhides the Quit row in Settings', quit.rowShown === true, quit);
  ok('quit row is REACHABLE with the pad (D-pad walk)', quit.reached === true, { steps: quit.steps });
  ok('A on Quit flushes the save before closing', quit.saved === true, quit);
  ok('A on Quit calls window.close()', quit.closed === true, quit);

  // (K) TEXT-FIELD ESCAPE HATCH — a focused typeable field parks the pad
  // (no game leaks), and B blurs it so navigation resumes (Deck keyboard's
  // Enter doesn't blur; without this the pad bricked in the MP modal).
  const hatch = await page.evaluate(async () => {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.id = '__hatch'; document.body.appendChild(inp);
    inp.focus();
    const focusedBefore = document.activeElement === inp;
    Object.keys(game.keys).forEach(k => game.keys[k] = false);
    window.__press(0, true); _lxPadPoll();
    const anyKey = Object.keys(game.keys).some(k => game.keys[k]);
    window.__press(0, false); _lxPadPoll();
    window.__press(1, true); _lxPadPoll();
    const blurred = document.activeElement !== inp;
    window.__press(1, false); _lxPadPoll();
    inp.remove();
    return { focusedBefore, anyKey, blurred };
  });
  ok('typing focus parks the pad (no game key leaks)', hatch.focusedBefore && hatch.anyKey === false, hatch);
  ok('B blurs a focused text field (pad never bricks)', hatch.blurred === true, hatch);

  // (M) SMOOTH-TRANSITION TRIO — host-conditional power block, overlay
  // auto-pause (solo only, latched), synchronous final cloud mirror.
  const trio = await page.evaluate(async () => {
    const rec = { host: [], sync: [] };
    window.SteamAPI = Object.assign(window.SteamAPI || {}, { available: true,
      hostState: (v) => rec.host.push(v),
      cloud: { read: () => Promise.resolve(null), write: () => Promise.resolve(true),
               writeSync: (n, c) => { rec.sync.push([n, (c || '').length]); return true; } } });
    // hosting -> true; follower -> false; disconnected -> false
    if (net) { net.connected = true; net.baseRoom = 'pwr01'; net.isHost = true; }
    _lxSteamPresence(true); const h1 = rec.host[rec.host.length - 1];
    net.isHost = false; _lxSteamPresence(true); const h2 = rec.host[rec.host.length - 1];
    net.connected = false; _lxSteamPresence(true); const h3 = rec.host[rec.host.length - 1];
    // overlay pause: solo + unpaused -> pause on open, resume on close
    window._prologueActive = false; window._prologuePending = false;
    game.paused = false; _lxSteamOverlayPausedByUs = false;
    _lxSteamOverlayPause(true);  const pausedOnOpen = game.paused === true;
    _lxSteamOverlayPause(false); const resumedOnClose = game.paused === false;
    // latch: someone ELSE's pause is never force-released
    game.paused = true; _lxSteamOverlayPause(true); _lxSteamOverlayPause(false);
    const foreignPauseKept = game.paused === true;
    game.paused = false;
    // co-op: overlay never freezes the party
    net.connected = true; _lxSteamOverlayPause(true);
    const coopUntouched = game.paused === false;
    net.connected = false;
    // final mirror: beforeunload runs the SYNC cloud write with the saved blob
    localStorage.setItem(SAVE_KEY, '{"v":1,"t":1,"player":{}}');
    game._resetting = false;
    window.dispatchEvent(new Event('beforeunload'));
    const synced = rec.sync.length > 0 && rec.sync[rec.sync.length - 1][0] === SAVE_KEY && rec.sync[rec.sync.length - 1][1] > 0;
    return { h1, h2, h3, pausedOnOpen, resumedOnClose, foreignPauseKept, coopUntouched, synced };
  });
  ok('power block follows HOST state (true/false/false)', trio.h1 === true && trio.h2 === false && trio.h3 === false, trio);
  ok('overlay pauses a solo game and resumes on close', trio.pausedOnOpen && trio.resumedOnClose, trio);
  ok('overlay never force-releases a foreign pause', trio.foreignPauseKept === true, trio);
  ok('overlay never freezes a co-op session', trio.coopUntouched === true, trio);
  ok('beforeunload lands the final cloud mirror SYNCHRONOUSLY', trio.synced === true, trio);

  // (D) WEB BUILD (no SteamAPI): every Steam path is a clean no-op.
  const web = await page.evaluate(async () => {
    delete window.SteamAPI;
    const avail = _steamAvailable();
    let threw = false;
    try { _lxSteamCloudPush('{"x":1}', true); const r = await _lxSteamCloudSync(); void r; _lxSteamLobbySync(); _lxSteamInviteFriends(); } catch (e) { threw = true; }
    // quit row must STAY hidden on the web (no SteamAPI / MOJI_RELAY_URL)
    document.getElementById('set-quit-row').style.display = 'none';
    openSettingsModal(); await new Promise(r => setTimeout(r, 30));
    const quitHidden = document.getElementById('set-quit-row').style.display === 'none';
    try { closeSettingsModal(); } catch (e) {}
    return { avail, threw, quitHidden };
  });
  ok('web build: Steam unavailable + cloud/lobby/invite calls are safe no-ops', web.avail === false && web.threw === false, web);
  ok('web build: quit row stays hidden', web.quitHidden === true, web.quitHidden);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== STEAM INTEGRATION (mapping → menus → rumble → quit · cloud · lobby invites) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
