// Verifies the loopback static server the Steam build serves the game from:
// MIME (incl. mp4 cinematics), HTTP Range (video seeking), traversal guard,
// fixed-port bind + fallback. Run: node test_static_server.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(import.meta.url);
const srv = require('./static_server.js');
const path = require('node:path');

const R = []; const ok = (n, c, x) => R.push({ n, pass: !!c, x });
const ROOT = path.join(process.cwd(), '..');

const get = (port, p, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p, headers }, (res) => {
    const chunks = [];
    res.on('data', (c) => { chunks.push(c); if (Buffer.concat(chunks).length > 1024 * 1024) res.destroy(); });
    res.on('close', () => resolve({ status: res.statusCode, headers: res.headers, size: Buffer.concat(chunks).length }));
  }).on('error', reject);
});

// parseRange unit checks
ok('range: bytes=0-99',      JSON.stringify(srv.parseRange('bytes=0-99', 1000)) === '{"start":0,"end":99}');
ok('range: bytes=500-',      JSON.stringify(srv.parseRange('bytes=500-', 1000)) === '{"start":500,"end":999}');
ok('range: bytes=-100 (suffix)', JSON.stringify(srv.parseRange('bytes=-100', 1000)) === '{"start":900,"end":999}');
ok('range: end clamped',     JSON.stringify(srv.parseRange('bytes=0-9999', 1000)) === '{"start":0,"end":999}');
ok('range: past EOF invalid', !!(srv.parseRange('bytes=1000-', 1000) || {}).invalid);
ok('range: absent -> null',  srv.parseRange(undefined, 1000) === null);
ok('mime: mp4/webm/html present', srv.MIME['.mp4'] === 'video/mp4' && srv.MIME['.webm'] === 'video/webm' && srv.MIME['.html'] === 'text/html');

const port = await srv.start(ROOT, '/mojiworld_game.html', 47899);
ok('binds requested port', port === 47899, port);

const root = await get(port, '/');
ok('/ serves the game as text/html', root.status === 200 && /text\/html/.test(root.headers['content-type']) && root.size > 1024, root.status);

const mp4 = await get(port, '/steam/higgsfield/cinematics/clip_gravitos_entry.mp4', { Range: 'bytes=0-1023' });
ok('mp4 Range -> 206 video/mp4, 1KB slice', mp4.status === 206 && mp4.headers['content-type'] === 'video/mp4' && mp4.size === 1024 && /^bytes 0-1023\//.test(mp4.headers['content-range']), { s: mp4.status, ct: mp4.headers['content-type'], cr: mp4.headers['content-range'] });

const full = await get(port, '/steam/higgsfield/cinematics/clip_gravitos_entry.mp4');
ok('mp4 full -> 200 + accept-ranges', full.status === 200 && full.headers['accept-ranges'] === 'bytes', full.status);

const trav = await get(port, '/../etc/passwd');
ok('traversal blocked', trav.status === 403 || trav.status === 404, trav.status);
// A sibling dir sharing the root's name as a PREFIX (…/Mojiworld matching
// …/Mojiworld-sib) must hit the guard (403), not fall through to stat (404).
const sib = await get(port, '/../' + path.basename(ROOT) + '-sib/secret.txt');
ok('sibling-prefix dir blocked by the guard (403)', sib.status === 403, sib.status);
const missing = await get(port, '/nope.png');
ok('missing file -> 404', missing.status === 404, missing.status);

const port2 = await srv.start(ROOT, '/mojiworld_game.html', 47899);   // taken -> ephemeral fallback
ok('taken port falls back (not crash)', typeof port2 === 'number' && port2 !== 0, port2);

let pass = 0; for (const r of R) { console.log((r.pass ? '✓ ' : '✗ ') + r.n + (r.pass ? '' : '  ' + JSON.stringify(r.x))); if (r.pass) pass++; }
console.log(`\n${pass}/${R.length} passed`);
process.exit(pass === R.length ? 0 : 1);
