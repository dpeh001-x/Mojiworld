// Minimal zero-dependency static server for the single-file game.
// Run:  node serve.js [port]      (default 8765)
// Then open  http://localhost:<port>/mojiworld_game.html
// The game MUST be served over http:// — opening the .html as a file:// path
// breaks sprite pixel-reads and asset fetches (browser security).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');

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
  if (cand !== root && !cand.startsWith(root + path.sep)) {   // separator-safe: a sibling folder that shares the prefix is not "inside"
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

// bughunt 2026-10-02 (L1 / cisec-2 / cisec-3 / bootdata-5 / bootdata-6 / cisec-8):
//  - a malformed percent escape ("GET /%") or a NUL used to throw inside the request listener and end the whole
//    process (any web page can fire one at 127.0.0.1:8765): both are a 400 now, and a throw anywhere is a 500;
//  - containment is separator-safe (the old bare startsWith(root) let "//../<root>-live/x" out to a sibling folder);
//  - the Host header must name a loopback name, so a DNS-rebinding page cannot read the checkout through this port
//    (localhost, 127.0.0.1, [::1], *.localhost, and the reserved *.test / *.example / *.invalid, which no public DNS can
//    ever answer; MOJI_ALLOW_HOST=a.b,c.d adds names, e.g. a tunnel for a tester); dotfile folders (.git, .claude,
//    .mcp.json) and _steamcmd/ (the Steam builder login) are never served;
//  - HTTP Range (the 4-22 MB story-beat mp4s seek and restart), streamed instead of read whole into memory, and the
//    stream is destroyed when the client goes away (stream.pipeline; .pipe leaked the file descriptor);
//  - GET /__root names the folder this server serves, so Mojiworld.cmd can tell a stale server from another folder.
const HOST_OK = /^(localhost|127\.0\.0\.1|\[::1\]|([a-z0-9-]+\.)+(localhost|test|example|invalid))(:\d{1,5})?$/i;
const EXTRA_HOSTS = new Set(String(process.env.MOJI_ALLOW_HOST || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
const hostOk = (h) => !h || HOST_OK.test(h) || EXTRA_HOSTS.has(String(h).toLowerCase().replace(/:\d+$/, ''));
const NUL = String.fromCharCode(0);
const HIDDEN = /(^|[/\\])\.[^/\\.]|^[/\\]+_steamcmd([/\\]|$)/i;   // .git / .claude / .mcp.json / _steamcmd (the ".." segments are resolved below)

// "bytes=start-end" against a file of `size` bytes -> { start, end }, null (serve the whole file) or { invalid: true } (416).
// (Same parser as steam/static_server.js; serve.js ships alone in the portable zip, so it is copied, not required.)
function parseRange(header, size) {
  if (!header || !/^bytes=\d*-\d*$/.test(header)) return null;
  const [s, e] = header.slice(6).split('-');
  let start = s === '' ? null : parseInt(s, 10);
  let end = e === '' ? null : parseInt(e, 10);
  if (start === null) {           // suffix form: bytes=-N (last N bytes)
    if (end === null || end === 0) return null;
    start = Math.max(0, size - end); end = size - 1;
  } else if (end === null || end >= size) {
    end = size - 1;
  }
  if (start >= size || start > end) return { invalid: true, size };
  return { start, end };
}
const plain = (res, code, msg) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.end(msg); };

function handle(req, res) {
  if (!hostOk(req.headers.host)) return plain(res, 421, 'misdirected');
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { return plain(res, 400, 'bad request'); }
  if (p.indexOf(NUL) >= 0) return plain(res, 400, 'bad request');
  if (p === '/__root') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(root); }
  if (p === '/') p = '/mojiworld_game.html';
  if (HIDDEN.test(p)) return plain(res, 404, 'not found');
  let fp = path.join(root, path.normalize(p).replace(/^(\.\.([/\\]|$))+/, ''));
  if (fp !== root && !fp.startsWith(root + path.sep)) return plain(res, 403, 'forbidden');
  // Only the game document is aliased; every asset still resolves normally, so
  // a candidate build loads against the same Sprites/, data/ and audio/ trees.
  if (gameAlias && fp === path.join(root, 'mojiworld_game.html')) fp = gameAlias;
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) return plain(res, 404, 'not found: ' + p);
    const rg = parseRange(req.headers.range, st.size);
    if (rg && rg.invalid) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
    const h = {
      'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',   // always serve fresh edits (no stale sprites/HTML)
      'Accept-Ranges': 'bytes',
    };
    if (rg) { h['Content-Range'] = 'bytes ' + rg.start + '-' + rg.end + '/' + st.size; h['Content-Length'] = rg.end - rg.start + 1; res.writeHead(206, h); }
    else { h['Content-Length'] = st.size; res.writeHead(200, h); }
    if (req.method === 'HEAD') return res.end();
    pipeline(fs.createReadStream(fp, rg ? { start: rg.start, end: rg.end } : undefined), res, () => {});   // the callback swallows ECONNRESET / EBUSY; pipeline destroys both ends
  });
}

http.createServer((req, res) => {
  try { handle(req, res); }
  catch (e) { try { if (!res.headersSent) plain(res, 500, 'error'); else res.destroy(); } catch (e2) { /* the socket is gone */ } }   // nothing a request carries may end the process
}).listen(port, '127.0.0.1', () => {
  console.log('LevelX serving at  http://localhost:' + port + '/mojiworld_game.html');
  if (gameAlias) console.log('  ↳ mojiworld_game.html is ALIASED to ' + path.relative(root, gameAlias));
  console.log('(Ctrl+C to stop)');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error('Port ' + port + ' is busy — run: node serve.js 8001');
  else console.error(e.message);
  process.exit(1);
});
