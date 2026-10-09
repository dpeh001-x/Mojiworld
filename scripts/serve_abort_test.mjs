// A client that hangs up mid-request must not end the server. serve.js (the desktop launcher's server and every harness's)
// and steam/static_server.js (the Steam app's, in Electron's main process) both piped the file from inside the fs.stat
// callback, outside the handler's try/catch: a browser that closed in between made pipeline() throw ERR_STREAM_UNABLE_TO_PIPE
// and took the whole process down (in the Steam app, the blocking "JavaScript error in the main process" dialog). For each:
//   [1] 300 requests for the game file, every one cut off right after it is sent, some as Range requests (a video seek)
//   [2] the server is still up and still answers a normal GET with 200 and the whole file
//   node scripts/serve_abort_test.mjs        PORT override (uses PORT and PORT+1)
import http from 'node:http'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const PORT = Number(process.env.PORT || 11891);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const SIZE = fs.statSync(path.join(ROOT, 'mojiworld_game.html')).size;
const hammer = (port) => new Promise((done) => {
  let left = 300;
  for (let i = 0; i < 300; i++) {
    const headers = { Host: 'localhost' }; if (i % 3 === 0) headers.Range = 'bytes=' + (i * 1000) + '-';
    const req = http.request({ host: '127.0.0.1', port, path: '/mojiworld_game.html', headers });
    req.on('error', () => {}); req.on('close', () => { if (--left === 0) done(); });
    req.end(); setImmediate(() => req.destroy());       // hang up while the server is still in fs.stat
  }
});
const get = (port) => new Promise((done) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/mojiworld_game.html', headers: { Host: 'localhost' } }, (res) => {
    let n = 0; res.on('data', (d) => { n += d.length; }); res.on('end', () => done({ code: res.statusCode, bytes: n }));
  });
  req.on('error', (e) => done({ code: 0, err: e.code }));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// serve.js, as its own process (how the launcher and the harnesses run it)
{
  let died = null, errText = '';
  const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  srv.stderr.on('data', (d) => { errText += d; }); srv.on('exit', (c) => { died = c; });
  await wait(1200);
  for (let r = 0; r < 3; r++) await hammer(PORT);
  await wait(500);
  const g = await get(PORT);
  ok('[1] serve.js survives 900 requests cut off mid-flight', died === null, { died, err: errText.split('\n').find((l) => /Error/.test(l)) || '' });
  ok('[2] serve.js still answers a normal GET with the whole file', g.code === 200 && g.bytes === SIZE, g);
  srv.kill();
}
// steam/static_server.js, in this process (as Electron's main process runs it)
{
  let uncaught = null; const onU = (e) => { uncaught = String(e && e.code || e); }; process.on('uncaughtException', onU);
  const { requestHandler } = require(path.join(ROOT, 'steam', 'static_server.js'));
  const srv = http.createServer(requestHandler(ROOT, '/mojiworld_game.html'));
  await new Promise((r) => srv.listen(PORT + 1, '127.0.0.1', r));
  for (let r = 0; r < 3; r++) await hammer(PORT + 1);
  await wait(500);
  const g = await get(PORT + 1);
  ok('[1s] static_server.js throws nothing uncaught on 900 cut-off requests (the main-process error dialog)', uncaught === null, { uncaught });
  ok('[2s] static_server.js still answers a normal GET with the whole file', g.code === 200 && g.bytes === SIZE, g);
  srv.close(); process.off('uncaughtException', onU);
}
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
