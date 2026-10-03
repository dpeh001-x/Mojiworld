// bughunt servers - the local static server (serve.js): L1 / cisec-2 / cisec-3 / bootdata-5 / bootdata-6 / cisec-8 (/__root).
//   [SERVE_ROOT=<tree whose serve.js is tested>] [PORT_SERVE=14005] node scripts/bughunt_servers/serve.mjs
// Node only. serve.js is copied into a throwaway fixture tree (so a hostile request can never reach the repo, and the sibling-prefix
// escape has a real sibling to reach) and run as a child process on PORT_SERVE.. ; every child is killed by recorded pid.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.env.SERVE_ROOT || path.join(HERE, '..', '..'));
const P0 = +(process.env.PORT_SERVE || 14005);
const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d === undefined ? '' : '   ' + JSON.stringify(d).slice(0, 300))); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lxsrv-'));
const ROOT = path.join(TMP, 'root'), SIB = path.join(TMP, 'root-sib');
const w = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
w(path.join(ROOT, 'mojiworld_game.html'), '<html>GAME</html>');
w(path.join(ROOT, 'candidate.html'), '<html>CANDIDATE</html>');
w(path.join(ROOT, 'data', 'x.js'), 'var x = 1;');
w(path.join(ROOT, '.git', 'HEAD'), 'ref: refs/heads/main');
w(path.join(ROOT, '.mcp.json'), '{"key":"SECRETKEY"}');
w(path.join(ROOT, '_steamcmd', 'config', 'token'), 'SECRETTOKEN');
w(path.join(SIB, 'secret.txt'), 'SIBLINGSECRET');
const BIG = Buffer.alloc(8 * 1024 * 1024); for (let i = 0; i < BIG.length; i++) BIG[i] = i & 255;
fs.writeFileSync(path.join(ROOT, 'big.mp4'), BIG);
fs.copyFileSync(path.join(SRC, 'serve.js'), path.join(ROOT, 'serve.js'));

const kids = [];
const start = async (port, env) => {
  const c = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  c.logs = ''; c.stdout.on('data', (d) => { c.logs += d; }); c.stderr.on('data', (d) => { c.logs += d; });
  kids.push(c);
  for (let i = 0; i < 40 && c.exitCode === null; i++) { if (await req(port, '/data/x.js', { Host: 'localhost' }).then((r) => r.status === 200 || r.status === 421)) break; await sleep(100); }
  return c;
};
const req = (port, p, headers, o) => new Promise((resolve) => {
  const r = http.request({ host: '127.0.0.1', port, path: p, method: (o && o.method) || 'GET', headers: headers || {}, agent: false, timeout: 5000 }, (res) => {
    const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    res.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), err: e.code || e.message }));
  });
  r.on('error', (e) => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), err: e.code || e.message }));
  r.on('timeout', () => { r.destroy(); resolve({ status: 0, headers: {}, body: Buffer.alloc(0), err: 'timeout' }); });
  r.end();
});
const text = (r) => (r.body ? r.body.toString('utf8') : '');

try {
  let srv = await start(P0), crashes = 0;
  const up = async () => { if (srv.exitCode !== null) { crashes++; srv = await start(P0); } };   // a crash is counted once, then the next case gets a fresh server
  const H = { Host: 'localhost:' + P0 };
  console.log(`serve.js under test: ${path.join(SRC, 'serve.js')}  fixture ${ROOT}  port ${P0}`);

  // ---- baseline ---------------------------------------------------------------------------------------------------
  let r = await req(P0, '/', H);
  check(r.status === 200 && text(r) === '<html>GAME</html>', '/ serves the game document', { s: r.status, e: r.err });
  r = await req(P0, '/data/x.js', H);
  check(r.status === 200 && /javascript/.test(r.headers['content-type']) && text(r) === 'var x = 1;', 'an asset is served with its MIME type');
  r = await req(P0, '/nope.png', H);
  check(r.status === 404, 'a missing file is 404');

  // ---- L1 / cisec-2 / bootdata-5: a malformed escape or a NUL must not kill the server ------------------------------
  for (const p of ['/%', '/%E0%A4%A', '/a%00b', '/%00']) {
    await up(); r = await req(P0, p, H);
    await sleep(60); const alive = await req(P0, '/', H);
    check(r.status === 400 && alive.status === 200, `GET ${p} answers 400 and the server stays up`, { s: r.status, e: r.err, aliveStatus: alive.status, exit: srv.exitCode });
  }

  // ---- cisec-3: separator-safe containment (a sibling that shares the root's name as a PREFIX) -------------------------
  for (const p of ['//../root-sib/secret.txt', '/../root-sib/secret.txt', '/%2e%2e/root-sib/secret.txt', '/..%2froot-sib%2fsecret.txt', '/../../' + path.basename(TMP) + '/root-sib/secret.txt']) {
    await up(); r = await req(P0, p, H);
    check((r.status === 403 || r.status === 404) && !/SIBLINGSECRET/.test(text(r)), `sibling-prefix escape ${p} is refused`, { s: r.status, leaked: /SIBLINGSECRET/.test(text(r)) });
  }

  // ---- cisec-3: Host allow-list (DNS rebinding) ---------------------------------------------------------------------
  for (const h of ['evil.com', 'evil.com:' + P0, '127.0.0.1.evil.com', 'localhost.evil.com:' + P0, 'attacker.example.com', 'x.test.evil.com', '192.168.1.5:' + P0]) {
    await up(); r = await req(P0, '/', { Host: h });
    check(r.status === 421 || r.status === 403, `Host "${h}" is refused`, { s: r.status });
  }
  for (const h of ['localhost', 'localhost:' + P0, '127.0.0.1:' + P0, '[::1]:' + P0, 'play.mojiworld.test:' + P0, 'a.b.localhost:' + P0, 'tester.mojiworld.example:' + P0, 'LOCALHOST:' + P0]) {
    await up(); r = await req(P0, '/', { Host: h });
    check(r.status === 200, `Host "${h}" is served`, { s: r.status });
  }

  // ---- cisec-3: secrets in the checkout root are not served ---------------------------------------------------------
  for (const p of ['/.git/HEAD', '/.mcp.json', '/_steamcmd/config/token', '/%2egit/HEAD', '/data/../.git/HEAD']) {
    await up(); r = await req(P0, p, H);
    check((r.status === 404 || r.status === 403) && !/SECRET|refs\/heads/.test(text(r)), `${p} is not served`, { s: r.status });
  }

  // ---- bootdata-6: HTTP Range (video seeking) -----------------------------------------------------------------------
  await up(); r = await req(P0, '/big.mp4', { ...H, Range: 'bytes=0-1023' });
  check(r.status === 206 && r.body.length === 1024 && r.headers['content-range'] === 'bytes 0-1023/' + BIG.length && r.body.equals(BIG.subarray(0, 1024)), 'Range bytes=0-1023 -> 206, the first KB', { s: r.status, cr: r.headers['content-range'], n: r.body && r.body.length });
  r = await req(P0, '/big.mp4', { ...H, Range: 'bytes=4000000-' });
  check(r.status === 206 && r.body.length === BIG.length - 4000000 && r.body.equals(BIG.subarray(4000000)), 'Range bytes=4000000- -> 206, the tail', { s: r.status, n: r.body && r.body.length });
  r = await req(P0, '/big.mp4', { ...H, Range: 'bytes=-100' });
  check(r.status === 206 && r.body.equals(BIG.subarray(BIG.length - 100)), 'suffix Range bytes=-100 -> the last 100 bytes', { s: r.status });
  r = await req(P0, '/big.mp4', { ...H, Range: 'bytes=99999999-' });
  check(r.status === 416 && r.headers['content-range'] === 'bytes */' + BIG.length, 'a Range past the end -> 416 + content-range bytes */size', { s: r.status });
  r = await req(P0, '/big.mp4', H);
  check(r.status === 200 && r.headers['accept-ranges'] === 'bytes' && r.body.equals(BIG) && /video\/mp4/.test(r.headers['content-type']) && +r.headers['content-length'] === BIG.length, 'a whole-file read is 200 + accept-ranges + content-length + exact bytes', { s: r.status, ar: r.headers['accept-ranges'] });
  r = await req(P0, '/', { ...H, Range: 'bytes=0-4' });
  check(r.status === 206 && text(r) === '<html', 'Range works on the document too');
  check(/no-cache/i.test((await req(P0, '/', H)).headers['cache-control'] || ''), 'Cache-Control no-cache is kept (fresh edits)');

  // ---- cisec-8: /__root names the folder this server serves ----------------------------------------------------------
  r = await req(P0, '/__root', H);
  check(r.status === 200 && path.resolve(text(r).trim()).toLowerCase() === path.resolve(ROOT).toLowerCase(), '/__root answers the served folder (the launcher compares it with its own)', { s: r.status, body: text(r).slice(0, 120) });

  // ---- MOJI_GAME_FILE alias (144 suites depend on it) -----------------------------------------------------------------
  const alias = await start(P0 + 1, { MOJI_GAME_FILE: 'candidate.html' });
  r = await req(P0 + 1, '/', { Host: 'localhost' });
  const r2 = await req(P0 + 1, '/mojiworld_game.html', { Host: 'localhost' });
  check(text(r) === '<html>CANDIDATE</html>' && text(r2) === '<html>CANDIDATE</html>', 'MOJI_GAME_FILE still aliases the game document', { a: text(r), b: text(r2) });
  r = await req(P0 + 1, '/data/x.js', { Host: 'localhost' });
  check(text(r) === 'var x = 1;', 'and every other path resolves normally under the alias');
  alias.kill();

  // ---- the open file is released when the client goes away (fd leak) --------------------------------------------------
  // In-process: serve.js is required here with fs.createReadStream wrapped, so every stream it opens can be inspected.
  {
    const realCreate = fs.createReadStream, streams = [];
    fs.createReadStream = function (...a) { const s = realCreate.apply(this, a); streams.push(s); return s; };
    const savedArgv = process.argv.slice(), P = P0 + 2;
    process.argv[2] = String(P); process.argv[3] = '';
    const savedExit = process.exit; process.exit = () => {};
    const savedLog = console.log; console.log = () => {};
    try { require(path.join(ROOT, 'serve.js')); } finally { console.log = savedLog; process.exit = savedExit; process.argv = savedArgv; }
    await sleep(500);
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => {
        const rq = http.request({ host: '127.0.0.1', port: P, path: '/big.mp4', headers: { Host: 'localhost', ...(i % 2 ? { Range: 'bytes=1000-' } : {}) } }, (res) => {
          res.pause(); setTimeout(() => { res.destroy(); resolve(); }, 150);
        });
        rq.on('error', () => resolve()); rq.end();
      });
    }
    await sleep(600);
    fs.createReadStream = realCreate;
    check(streams.length === 0 || streams.every((s) => s.destroyed), 'every file stream is destroyed once its client aborts (no fd leak)', { opened: streams.length, leaked: streams.filter((s) => !s.destroyed).length });
    const again = await req(P, '/', { Host: 'localhost' });
    check(again.status === 200, 'and the in-process server still answers', { s: again.status });
  }

  // ---- last: the first server survived everything above --------------------------------------------------------------
  check(crashes === 0 && srv.exitCode === null, 'the server process never exited during the run', { crashes, exit: srv.exitCode, logs: srv.logs.slice(0, 200) });
} finally {
  for (const k of kids) { try { k.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a leaked handle on Windows: the OS temp sweep gets it */ }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
