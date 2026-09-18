// Mojiworld — Electron desktop wrapper for Steam.
//
// The game is a self-contained static bundle (mojiworld_game.html + assets).
// We serve it over a loopback HTTP server (NOT file://, so the service worker,
// audio fetches and relative asset paths behave exactly as on the web). The
// relay URL is injected via preload as window.MOJI_RELAY_URL so the game's
// MP_DEFAULT_URL picks it up without the player typing a ws:// address.
//
// SAVE PERSISTENCE (critical): Chromium partitions localStorage by ORIGIN,
// including PORT. So the loopback port MUST be stable across launches — an
// ephemeral port (listen(0)) changes the origin every launch and orphans the
// player's entire character save. We bind a FIXED port + hold a single-instance
// lock so two copies never fight over it.
'use strict';
const { app, BrowserWindow, shell, powerSaveBlocker, ipcMain, dialog, Menu, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const staticServer = require('./static_server');
const winState = require('./window_state');   // v0.30.x final polish (audit U1) — see the file

const FIXED_PORT = 47821;   // stable loopback port -> stable origin -> saves persist

// v0.28.0 — Steamworks bridge (cloud saves + controller/Steam Input). Fully
// defensive: init() returns a stub with available=false if Steam isn't running
// or the native module is missing, so the app launches + plays regardless.
let steam = require('./steam_integration').STUB;
try { steam = require('./steam_integration').init(); } catch (e) { console.warn('[steam] bridge load failed:', e && e.message); }
// Enable the Steam overlay (Shift+Tab) BEFORE any window is created.
if (steam.available) { try { steam.enableOverlay(); } catch (e) {} }

// Steam Deck detection. SteamOS's gamescope session sets SteamDeck=1 in the
// environment; the Steamworks utils call is the authoritative check when the
// bridge is up. On Deck we launch fullscreen (1280×800 native) and the renderer
// pops Steam's floating gamepad keyboard when a text field takes focus.
const ON_DECK = (() => {
  try { if (steam.available && steam.utils && steam.utils.isOnDeck()) return true; } catch (e) {}
  return process.env.SteamDeck === '1' || process.env.STEAM_DECK === '1';
})();

// Friends "Join Game": Steam launches us with the `connect` rich-presence value
// appended to argv — we set it to "--moji-join=<relay>~<CODE>". Extract it so the
// renderer auto-joins that party. (Second-instance handled in the lock block.)
// Friend-INVITE accepted from a cold start instead appends "+connect_lobby <id64>";
// deliverLobbyJoin() resolves that lobby back to the party code. Parsers live in
// launch_args.js (plain Node, unit-testable).
const { extractJoin, extractConnectLobby } = require('./launch_args');
const LAUNCH_JOIN = extractJoin(process.argv);
const LAUNCH_LOBBY = extractConnectLobby(process.argv);

// Resolve a Steam lobby id -> {code, relay} from its lobby data, rebuild the
// standard connect string, and hand it to the renderer over the SAME 'moji-join'
// channel Join Game uses — the game prefills the party code and auto-joins.
async function deliverLobbyJoin(lobbyId, win) {
  if (!lobbyId || !steam.available || !steam.lobby) return;
  let info = null;
  try { info = await steam.lobby.join(lobbyId); } catch (e) {}
  if (!info || !info.code) { console.warn('[steam] +connect_lobby ' + lobbyId + ': no party_code in lobby data (host on an older build?)'); return; }
  const str = '--moji-join=' + encodeURIComponent(info.relay || '') + '~' + info.code;
  try {
    const w = win || BrowserWindow.getAllWindows()[0];
    if (!w) return;
    const send = () => { try { w.webContents.send('moji-join', str); } catch (e) {} };
    if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send); else send();
  } catch (e) {}
}

// Renderer <-> Steam IPC. Cloud/achievement/presence/overlay/stats are async
// (invoke/handle); the input snapshot is a fast synchronous read polled per frame.
ipcMain.handle('steam:cloud-read',   (_e, name) => { try { return steam.cloud.read(name); } catch (e) { return null; } });
ipcMain.handle('steam:cloud-write',  (_e, name, content) => { try { return steam.cloud.write(name, content); } catch (e) { return false; } });
ipcMain.handle('steam:ach-unlock',   (_e, name) => { try { return steam.achievement.unlock(name); } catch (e) { return false; } });
ipcMain.handle('steam:presence-set', (_e, p) => { try { return steam.presence.set(p); } catch (e) { return false; } });
ipcMain.handle('steam:overlay-open', (_e, dialog) => { try { return steam.overlay.open(dialog); } catch (e) { return false; } });
ipcMain.handle('steam:stats-set',    (_e, obj) => { try { return steam.stats.set(obj); } catch (e) { return false; } });
ipcMain.on('steam:input-snapshot',   (e) => { try { e.returnValue = steam.input.snapshot(); } catch (err) { e.returnValue = null; } });
// SYNCHRONOUS cloud write — the beforeunload final mirror only. The async
// invoke path can be torn down with the renderer mid-flight; sendSync blocks
// until the native write returns, so the freshest save always lands.
ipcMain.on('steam:cloud-write-sync', (e, name, content) => { try { e.returnValue = steam.cloud.write(name, content); } catch (err) { e.returnValue = false; } });
// Deck battery: keep the machine awake ONLY while this player HOSTS a co-op
// party (the host's sim is the party's world). Solo players can let the Deck
// sleep normally — localStorage saves are synchronous, resume just works.
let _psbId = null;
ipcMain.on('moji-host-state', (_e, hosting) => {
  try {
    if (hosting && _psbId == null) _psbId = powerSaveBlocker.start('prevent-app-suspension');
    else if (!hosting && _psbId != null) { powerSaveBlocker.stop(_psbId); _psbId = null; }
  } catch (e) {}
});
// Steam Deck / Big Picture: pop the floating gamepad keyboard over the game so
// text fields (hero name, party code, chat) are typeable without a keyboard.
ipcMain.handle('steam:show-text-input', (_e, opts) => { try { return steam.utils.showTextInput(opts || {}); } catch (e) { return false; } });
// Steam lobby (friend invites). host: mirror the current party code into a
// FriendsOnly lobby; invite: open Steam's invite dialog on it; leave: drop it.
ipcMain.handle('steam:lobby-host',   (_e, data) => { try { return steam.lobby.host(data || {}); } catch (e) { return ''; } });
ipcMain.handle('steam:lobby-leave',  () => { try { return steam.lobby.leave(); } catch (e) { return false; } });
ipcMain.handle('steam:lobby-invite', () => { try { return steam.lobby.invite(); } catch (e) { return false; } });
// Invite accepted while we're already running: resolve the lobby -> party code.
if (steam.available) {
  try { steam.onLobbyJoinRequested((id) => deliverLobbyJoin(id)); } catch (e) {}
  // Rich-presence "Join Game" while running fires a callback with our own
  // connect string (no second instance) — forward it over the same channel.
  try {
    steam.onRichPresenceJoinRequested((s) => {
      try { const w = BrowserWindow.getAllWindows()[0]; if (w) w.webContents.send('moji-join', String(s || '')); } catch (e) {}
    });
  } catch (e) {}
  // Overlay open/close -> the game pauses a SOLO session under the overlay.
  try {
    steam.onOverlayActivated((active) => {
      try { const w = BrowserWindow.getAllWindows()[0]; if (w) w.webContents.send('moji-overlay', !!active); } catch (e) {}
    });
  } catch (e) {}
}
// Pump Steamworks callbacks periodically (cloud/input/presence housekeeping).
if (steam.available) { try { setInterval(() => { try { steam.runCallbacks(); } catch (e) {} }, 200); } catch (e) {} }

// Reduce Chromium's throttling of an unfocused/occluded window so a co-op HOST
// keeps simulating when the player alt-tabs. A fully MINIMIZED host degrades
// gracefully (followers detect the quiet host ~5s and fall back to local sim).
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Dev: serve the repo root (../). Packaged: electron-builder copies the game
// into resources/app (see extraResources in package.json).
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
const ENTRY = '/mojiworld_game.html';

// Relay URL resolution — NEVER throws (a throw here crashes the whole app on
// launch, killing solo play too). Order: env var (dev/QA override) -> bundled
// relay.config.json (baked at build time) -> '' (game falls back to its own
// MP_DEFAULT_URL; co-op simply won't connect but the game runs). A build script
// or CI writes steam/relay.config.json {"relay":"wss://..."} for the shipped app.
function resolveRelayUrl() {
  if (process.env.MOJI_RELAY_URL) return process.env.MOJI_RELAY_URL;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'relay.config.json'), 'utf8'));
    if (cfg && typeof cfg.relay === 'string' && cfg.relay) return cfg.relay;
  } catch (e) { /* no config file — fine */ }
  console.warn('[mojiworld] No relay configured (MOJI_RELAY_URL / relay.config.json). Multiplayer disabled; solo play unaffected.');
  return '';
}
const RELAY_URL = resolveRelayUrl();

// Static file serving (MIME incl. mp4 cinematics, Range support for <video>
// seeking, traversal guard, fixed-port-with-fallback) lives in static_server.js
// so it stays testable in plain Node — see that file for the details.

async function createWindow() {
  const port = await staticServer.start(ROOT, ENTRY, FIXED_PORT);
  // powerSaveBlocker is NOT started here anymore — it's host-conditional (see
  // the 'moji-host-state' IPC above) so a solo Deck player can let it sleep.
  // v0.30.x final polish (audit U1) — reopen the way the player left it: size, position (while that display is still
  // connected), maximized, fullscreen. Not on Deck, where gamescope owns the window.
  const _stFile = path.join(app.getPath('userData'), 'window-state.json');
  const _st = ON_DECK ? null : winState.loadState(_stFile);
  let _pos = {};
  try { if (_st && winState.onScreen(_st, screen.getAllDisplays().map((d) => d.workArea))) _pos = { x: _st.x, y: _st.y }; } catch (e) {}
  const win = new BrowserWindow({
    width: _st ? _st.width : 1280, height: _st ? _st.height : 800, minWidth: 960, minHeight: 560,   // 1280×800 = Steam Deck native
    ..._pos,
    fullscreen: ON_DECK || !!(_st && _st.fullscreen),   // gamescope expects fullscreen on Deck
    backgroundColor: '#0b0713',
    title: 'Mojiworld',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: ['--moji-relay=' + RELAY_URL, '--moji-steam=' + (steam.available ? '1' : '0'), '--moji-deck=' + (ON_DECK ? '1' : '0'), '--moji-launch-join=' + LAUNCH_JOIN, '--moji-packaged=' + (app.isPackaged ? '1' : '0')],   // v0.30.797 - the page hides dev tools in the packaged app
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      devTools: !app.isPackaged,   // v0.30.791 - F12 / Ctrl+Shift+I opened devtools in the shipped build
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'deny' };   // v0.30.898 launch audit: was 'allow' - a blob:/data:/about: URL opened a second window with the preload
  });
  // v0.30.898 launch audit: the window only ever shows the game. A dropped file or a stray link navigated it away with no way
  // back; http(s) goes to the system browser instead, anything else is refused.
  win.webContents.on('will-navigate', (e, url) => {
    if (String(url).startsWith('http://127.0.0.1:' + port + '/')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) { try { shell.openExternal(url); } catch (_) {} }
  });
  win.loadURL('http://127.0.0.1:' + port + ENTRY);
  if (_st && _st.maximized && !_st.fullscreen) win.maximize();
  // v0.30.x final polish (audit U1) — Alt+Enter and F11 toggle fullscreen (the page binds neither); the window's
  // state is saved as it closes.
  win.webContents.on('before-input-event', (e, input) => {
    if (!ON_DECK && winState.isFullscreenKey(input)) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
  });
  if (!ON_DECK) win.on('close', () => { try { winState.saveState(_stFile, winState.snapshot(win)); } catch (e) {} });
  // v0.30.791 - LAUNCH POLISH: a renderer crash or hang used to leave a blank or frozen window with no way back
  // but the task manager. Crash: reload (the game autosaves every 30 s and on hide). Hang: ask, never guess.
  // v0.30.898 launch audit: a renderer that keeps crashing (e.g. out of memory) was reloaded every 500 ms forever. Three
  // crashes inside two minutes stop the loop and say so.
  const _crashes = [];
  win.webContents.on('render-process-gone', async (_e, d) => {
    console.error('[mojiworld] renderer gone: ' + (d && d.reason));
    const now = Date.now(); _crashes.push(now); while (_crashes.length && now - _crashes[0] > 120000) _crashes.shift();
    if (_crashes.length >= 3) {
      try { await dialog.showMessageBox(win, { type: 'error', buttons: ['Quit'], title: 'Mojiworld', message: 'Mojiworld keeps crashing.', detail: 'Your progress up to the last save is kept. Please restart the game; if this repeats, lower Graphics Quality in Settings.' }); } catch (e) {}
      try { app.quit(); } catch (e) {}
      return;
    }
    setTimeout(() => { try { if (!win.isDestroyed()) win.webContents.reload(); } catch (e) {} }, 500);
  });
  win.webContents.on('did-fail-load', (_e, code, desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;   // -3 = aborted by a newer navigation
    console.error('[mojiworld] load failed: ' + code + ' ' + desc);
    setTimeout(() => { try { if (!win.isDestroyed()) win.loadURL('http://127.0.0.1:' + port + ENTRY); } catch (e) {} }, 1000);
  });
  win.on('unresponsive', async () => {
    try {
      const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Wait', 'Reload'], defaultId: 0, cancelId: 0, title: 'Mojiworld', message: 'The game is not responding.', detail: 'Wait a little longer, or reload. Progress is saved every 30 seconds.' });
      if (r.response === 1 && !win.isDestroyed()) { win.webContents.forcefullyCrashRenderer(); }
    } catch (e) {}
  });
  return win;
}

// One instance only — a second copy would bind a different port (new origin =
// orphaned save) and split the localStorage. Focus the existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore(); w.focus();
      // A friend clicked "Join Game" while we were already running: forward the
      // new party's connect string to the renderer, which switches parties.
      const join = extractJoin(argv);
      if (join) { try { w.webContents.send('moji-join', join); } catch (e) {} }
      // Invite-accept relaunch attempt: Steam handed +connect_lobby to the NEW
      // instance (which exits on the lock) — argv reaches us here instead.
      const lob = extractConnectLobby(argv);
      if (lob) deliverLobbyJoin(lob, w);
    }
  });
  app.whenReady().then(async () => {
    // v0.30.x final polish (audit U1) — the shipped game has no application menu. Electron's default one was live:
    // Alt showed File / Edit / View, Ctrl+R reloaded the game and Ctrl+W closed it. A dev run keeps it.
    if (app.isPackaged) { try { Menu.setApplicationMenu(null); } catch (e) {} }
    const w = await createWindow();
    // Cold-start friend invite: resolve the lobby once the window exists (the
    // 'moji-join' send inside waits for did-finish-load, so nothing is lost).
    if (LAUNCH_LOBBY) deliverLobbyJoin(LAUNCH_LOBBY, w);
  });
  app.on('will-quit', () => { try { steam.shutdown(); } catch (e) {} });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
