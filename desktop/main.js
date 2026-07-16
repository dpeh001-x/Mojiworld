// Mojiworld desktop shell.
// Serves the game folder over a loopback HTTP server (fixed port, so the
// origin — and therefore localStorage saves — stays stable across launches),
// then opens it in a fullscreen-capable BrowserWindow. No game-code changes.
const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 17893; // fixed: origin stability keeps saves; see pickPort()
// Packaged: resources/game/. Dev (`npm start` from desktop/): the repo root.
const GAME_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2',
};

function serve(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (p === '/') p = '/mojiworld_game.html';
  const file = path.normalize(path.join(GAME_ROOT, p));
  // stay inside the game folder
  if (!file.startsWith(path.normalize(GAME_ROOT + path.sep))) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end(); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      // Range support so <video> seeking/streaming works.
      let start = range[1] ? parseInt(range[1], 10) : st.size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
      res.writeHead(206, {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
      fs.createReadStream(file).pipe(res);
    }
  });
}

// Try the fixed port; fall back upward only if it's genuinely taken by
// something else (saves live on the port-17893 origin, so we warn via title).
function pickPort(server, port, tries, cb) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) pickPort(server, port + 1, tries - 1, cb);
    else throw e;
  });
  server.listen(port, '127.0.0.1', () => cb(port));
}

let win = null;
function createWindow(port) {
  win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 960, minHeight: 560,
    backgroundColor: '#07070c', show: false, autoHideMenuBar: true,
    title: 'Mojiworld',
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null); // F11 fullscreen still works below
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen()); e.preventDefault();
    }
  });
  // external links -> system browser, never in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${port}/mojiworld_game.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    const server = http.createServer(serve);
    pickPort(server, PORT, 10, (port) => createWindow(port));
  });
  app.on('window-all-closed', () => app.quit());
}
