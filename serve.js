// Minimal zero-dependency static server for the single-file game.
// Run:  node serve.js [port]      (default 8765)
// Then open  http://localhost:<port>/mojiworld_game.html
// The game MUST be served over http:// — opening the .html as a file:// path
// breaks sprite pixel-reads and asset fetches (browser security).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.argv[2] || 8765);
// MOJI_GAME_FILE — serve a CANDIDATE build in place of the working copy.
//
// 144 test suites drive the game through this server, and 107 of them request
// `/mojiworld_game.html` by name with no way to override it. Pointing one of
// those at a build under test looked like it worked — the suites take a file
// argument or an env var — but the request still fetched the working copy, so
// the run silently measured whatever happened to be checked out. That produced
// a real false report: a pad suite "failed on both builds", which read as a
// game bug, when in truth both runs had loaded the same stale working copy and
// the shipped build passed 8/8.
//
// Setting this env var redirects exactly that one request. Opt-in: unset, the
// server behaves byte-for-byte as before, so the desktop launchers are
// unaffected. The target must live inside the repo (same containment rule as
// every other path here), and it is announced at startup — a redirect this
// consequential must never be silent.
const GAME_FILE = process.env.MOJI_GAME_FILE || '';
let gameAlias = null;
if (GAME_FILE) {
  const cand = path.resolve(root, GAME_FILE);
  if (!cand.startsWith(root)) {
    console.error('MOJI_GAME_FILE must be inside the repo — ignoring: ' + GAME_FILE);
  } else if (!fs.existsSync(cand)) {
    console.error('MOJI_GAME_FILE does not exist — ignoring: ' + GAME_FILE);
  } else {
    gameAlias = cand;
  }
}
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.webm': 'video/webm', '.mp4': 'video/mp4', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/mojiworld_game.html';
  let fp = path.join(root, path.normalize(p).replace(/^(\.\.([/\\]|$))+/, ''));
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  // Only the game document is aliased; every asset still resolves normally, so
  // a candidate build loads against the same Sprites/, data/ and audio/ trees.
  if (gameAlias && fp === path.join(root, 'mojiworld_game.html')) fp = gameAlias;
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + p); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',   // always serve fresh edits (no stale sprites/HTML)
    });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => {
  console.log('LevelX serving at  http://localhost:' + port + '/mojiworld_game.html');
  if (gameAlias) console.log('  ↳ mojiworld_game.html is ALIASED to ' + path.relative(root, gameAlias));
  console.log('(Ctrl+C to stop)');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Port ' + port + ' is busy — run: node serve.js 8001');
  else console.error(e.message);
  process.exit(1);
});
