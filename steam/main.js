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
const { app, BrowserWindow, shell, powerSaveBlocker } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FIXED_PORT = 47821;   // stable loopback port -> stable origin -> saves persist

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

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = ENTRY;
      const abs = path.normalize(path.join(ROOT, p));
      if (!abs.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }  // path-traversal guard
      fs.readFile(abs, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.on('error', () => {
      // FIXED_PORT is in use (rare — an unrelated app). Fall back to an ephemeral
      // port so the game still LAUNCHES; saves for that session use a different
      // origin, but launching beats crashing.
      const fb = http.createServer(server.listeners('request')[0]);
      fb.listen(0, '127.0.0.1', () => resolve(fb.address().port));
    });
    server.listen(FIXED_PORT, '127.0.0.1', () => resolve(FIXED_PORT));
  });
}

async function createWindow() {
  const port = await startServer();
  try { powerSaveBlocker.start('prevent-app-suspension'); } catch (e) {}
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 960, minHeight: 560,
    backgroundColor: '#0b0713',
    title: 'Mojiworld',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: ['--moji-relay=' + RELAY_URL],
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.loadURL('http://127.0.0.1:' + port + ENTRY);
  return win;
}

// One instance only — a second copy would bind a different port (new origin =
// orphaned save) and split the localStorage. Focus the existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
