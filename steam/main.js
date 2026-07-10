// Mojiworld — Electron desktop wrapper for Steam.
//
// The game is a self-contained static bundle (mojiworld_game.html + assets).
// We serve the repo root over a loopback HTTP server (NOT file://, so the
// service worker, audio fetches and relative asset paths all behave exactly
// as they do on the web) and load it in a BrowserWindow. The multiplayer
// relay URL is injected via preload as window.MOJI_RELAY_URL so the game's
// MP_DEFAULT_URL picks it up without the player ever typing a ws:// address.
'use strict';
const { app, BrowserWindow, shell, powerSaveBlocker } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Reduce Chromium's throttling of an unfocused/occluded window so a co-op HOST
// keeps simulating smoothly when the player alt-tabs (the common case). A fully
// MINIMIZED host can still have rAF throttled — the game degrades gracefully
// there: followers detect the host went quiet (~5s) and fall back to local
// simulation, and host re-election kicks in, so nobody freezes.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Dev: serve the repo root (../). Packaged: electron-builder copies the game
// into resources/app (see extraResources in package.json).
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'app') : path.join(__dirname, '..');
const ENTRY = '/mojiworld_game.html';
// Relay URL: env var wins. We do NOT ship a bogus placeholder default — a packaged
// build with no relay is a hard error (co-op would silently fail). In dev we pass
// '' so the game's own ws://localhost default engages.
const RELAY_URL = process.env.MOJI_RELAY_URL || '';
if (app.isPackaged && !RELAY_URL) {
  throw new Error('MOJI_RELAY_URL must be set for packaged Steam builds (see STEAM.md).');
}

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
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));  // ephemeral loopback port
  });
}

async function createWindow() {
  const port = await startServer();
  // Prevent the OS from suspending the app (co-op host authority + audio).
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
      backgroundThrottling: false,   // keep the game loop running when unfocused (co-op host must keep simulating)
    },
  });
  // Open external links (Discord, docs) in the OS browser, not inside the game.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.loadURL('http://127.0.0.1:' + port + ENTRY);
  return win;
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
