// bughunt servers (2026-10-02) - runs every part of the servers cluster's tests, one after the other, and sums them up.
//   [SERVE_ROOT=<tree to test>] node scripts/bughunt_servers_test.mjs [part ...]        parts: serve launcher mp mpcf server hooks steam
// Node only (no browser, no semaphore). Own ports: 14005-14008 (static servers + launcher), 19200-19231 (relays). A part whose file is not in this
// tree (a service the lead held back) is reported as SKIP, not as a failure. Each part prints its own PASS / FAIL lines; this prints one verdict per part.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = [
  ['serve', 'serve.js + the Steam static server (400s, Host list, Range, containment, fd release)', 'scripts/bughunt_servers/serve.mjs'],
  ['launcher', 'Mojiworld.cmd replaces a server that serves another folder (Windows)', 'scripts/bughunt_servers/launcher.mjs'],
  ['steam', 'steam/test_static_server.mjs (extended)', 'steam/test_static_server.mjs', 'steam'],
  ['mp', 'mp/server.mjs (Render relay)', 'scripts/bughunt_servers/mp.mjs'],
  ['mpcf', 'mp-cf Durable Object relay (in-memory runtime stand-in; workerd not run)', 'scripts/bughunt_servers/mpcf.mjs'],
  ['server', 'server/ relay + accounts', 'scripts/bughunt_servers/server.mjs'],
  ['hooks', 'push gate shapes, hooks, session-start, sw.js, Steam App ID guard, workflows', 'scripts/bughunt_servers/hooks.mjs'],
];
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let failed = 0, ran = 0, pass = 0, fail = 0;
for (const [id, label, rel, cwd] of PARTS) {
  if (want.length && !want.includes(id)) continue;
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.log(`SKIP  ${id}: ${rel} is not in this tree`); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [file], { cwd: path.join(ROOT, cwd || '.'), encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26, env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  for (const l of out.split('\n')) if (/^(FAIL|✗)/.test(l)) console.log('      ' + l.slice(0, 230));
  const m = /(\d+) passed, (\d+) failed/.exec(out) || /^(\d+)\/(\d+) passed/m.exec(out);
  const p = m ? +m[1] : 0, f = m ? (m[2] !== undefined && /failed/.test(m[0]) ? +m[2] : +m[2] - +m[1]) : 1;
  ran++; pass += p; fail += f;
  if (r.status !== 0) failed++;
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${id}: ${label} - ${p} passed, ${f} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
console.log(`\n${ran - failed}/${ran} parts passed (${pass} checks passed, ${fail} failed)`);
process.exit(failed ? 1 : 0);
