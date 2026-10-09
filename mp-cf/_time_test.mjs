// mp-cf /api/time - the server's clock for the game's daily rewards in the Steam app. Run: node mp-cf/_time_test.mjs
// (src/index.js is loaded as an ES module from a temp copy; the route answers before any Durable Object is involved)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const tmp = path.join(os.tmpdir(), 'mpcf-time-' + process.pid + '.mjs');
fs.copyFileSync(path.join(HERE, 'src', 'index.js'), tmp);
try {
  const W = (await import(pathToFileURL(tmp).href)).default;
  const t0 = Date.now(); const r = await W.fetch(new Request('https://relay.test/api/time'), {}); const j = await r.json();
  ok('[1] GET /api/time answers ok with the server time', r.status === 200 && j.ok === true && Math.abs(j.now - t0) < 5000, { status: r.status, j });
  ok('[2] it can be read from the game (CORS) and is never cached', r.headers.get('access-control-allow-origin') === '*' && /no-store/.test(r.headers.get('cache-control') || ''));
  const o = await W.fetch(new Request('https://relay.test/api/time', { method: 'OPTIONS' }), {});
  ok('[3] a preflight is answered', o.status === 204);
  let routed = false; await W.fetch(new Request('https://relay.test/api/login', { method: 'POST' }), { ROOMS: { idFromName: () => 'id', get: () => ({ fetch: () => { routed = true; return new Response('{}'); } }) } });
  ok('[4] the rest of /api still goes to the Durable Object', routed);
} catch (e) { ok('the run completes', false, String(e && e.stack || e).slice(0, 300)); }
finally { try { fs.unlinkSync(tmp); } catch (e) {} }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
