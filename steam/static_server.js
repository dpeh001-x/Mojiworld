// Mojiworld — loopback static file server (no Electron imports, so it is
// testable in plain Node). Serves the game bundle with correct MIME types and
// HTTP Range support (Chromium issues Range requests for <video> seeking; the
// story-beat cinematics are 4–22 MB mp4s).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// Parse a "bytes=start-end" header against a file of `size` bytes.
// Returns { start, end } or null when absent/invalid (→ serve whole file).
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

// requestHandler(root, entry) -> (req, res) — serves files under `root`,
// mapping '/' to `entry`, with a path-traversal guard and Range support.
// v0.30.1670 srv-abort - THE CLIENT MAY ALREADY BE GONE. The file is piped from inside the fs.stat callback, which runs after the
// request handler's try/catch has returned. If the browser hung up in between (a page closed mid-load, a video seek aborting
// its Range request), pipeline() throws ERR_STREAM_UNABLE_TO_PIPE synchronously and nothing catches it: serve.js died (every
// later request refused), and in the Steam app's main process it is the blocking "JavaScript error" dialog.
const sendFile = (res, fp, opts) => {
  if (res.destroyed || res.writableEnded) return;
  const rs = fs.createReadStream(fp, opts);
  try { pipeline(rs, res, () => {}); } catch (e) { rs.destroy(); try { res.destroy(); } catch (e2) { /* gone */ } }
};
function requestHandler(root, entry) {
  // bughunt 2026-10-02 (L1 / cisec-2 / bootdata-5): this runs in the Electron MAIN process, where an uncaught throw is the blocking
  // 'JavaScript error in the main process' dialog. A malformed escape (GET /%) or a NUL byte is a 400, a throw anywhere is a 500, and
  // the file stream is piped with stream.pipeline so its descriptor is released when the client aborts (video seeks abort every
  // Range request; .pipe never destroyed the source) and a stream error (file locked / removed after the stat) is not uncaught.
  const handle = (req, res) => {
    let p;
    try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); res.end('bad request'); return; }
    if (p.indexOf(String.fromCharCode(0)) >= 0) { res.writeHead(400); res.end('bad request'); return; }
    if (p === '/') p = entry;
    const abs = path.normalize(path.join(root, p));
    // Prefix guard with a separator: bare startsWith(root) would also admit
    // SIBLING directories that share the prefix (root "…\Mojiworld" matching
    // "…\Mojiworld2\secret") via a crafted ../ path.
    if (abs !== root && !abs.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.stat(abs, (err, st) => { try {
      if (res.destroyed) return;   // v0.30.1670 srv-abort - nobody left to answer
      if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
      const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
      const range = parseRange(req.headers.range, st.size);
      if (range && range.invalid) {
        res.writeHead(416, { 'content-range': 'bytes */' + st.size });
        res.end(); return;
      }
      if (range) {
        res.writeHead(206, {
          'content-type': type,
          'content-length': range.end - range.start + 1,
          'content-range': 'bytes ' + range.start + '-' + range.end + '/' + st.size,
          'accept-ranges': 'bytes',
        });
        sendFile(res, abs, { start: range.start, end: range.end });
      } else {
        res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes' });
        sendFile(res, abs);
      }
    } catch (e) { try { res.destroy(); } catch (e2) { /* gone */ } } });   // v0.30.1670 srv-abort - a throw here would be the main-process error dialog
  };
  return (req, res) => {
    try { handle(req, res); }
    catch (e) { try { if (!res.headersSent) { res.writeHead(500); res.end('error'); } else res.destroy(); } catch (e2) { /* the socket is gone */ } }
  };
}

// start(root, entry, fixedPort) -> Promise<port>. Binds the fixed loopback port
// (stable origin → saves persist); falls back to an ephemeral port rather than
// crashing if it is taken (launching beats crashing — see main.js notes).
function start(root, entry, fixedPort) {
  return new Promise((resolve) => {
    const handler = requestHandler(root, entry);
    const server = http.createServer(handler);
    server.on('error', () => {
      const fb = http.createServer(handler);
      fb.on('error', () => resolve(fixedPort));
      fb.listen(0, '127.0.0.1', () => resolve(fb.address().port));
    });
    server.listen(fixedPort, '127.0.0.1', () => resolve(fixedPort));
  });
}

module.exports = { MIME, parseRange, requestHandler, start };
