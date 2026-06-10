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
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/mojiworld_game.html';
  const fp = path.join(root, path.normalize(p).replace(/^(\.\.([/\\]|$))+/, ''));
  if (!fp.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
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
  console.log('(Ctrl+C to stop)');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Port ' + port + ' is busy — run: node serve.js 8001');
  else console.error(e.message);
  process.exit(1);
});
