#!/usr/bin/env node
// Run every *_test.mjs / *_audit*.mjs / verify_*.mjs in scripts/ and report.
//
//   node scripts/run_all_tests.mjs                 # everything except network suites
//   node scripts/run_all_tests.mjs --net           # include coop/relay/live suites
//   node scripts/run_all_tests.mjs --only steam    # substring filter
//   node scripts/run_all_tests.mjs --timeout 180   # per-test seconds (default 120)
//
// There was no aggregate runner: 108 suites existed and each had to be invoked
// by hand, so a regression in any one of them was invisible until someone
// happened to run that file. Exit code is the number of FAILED suites, so this
// drops straight into CI.
//
// Network suites (coop_*, relay, *_live_*, loadtest) need a running relay and
// fail for environmental reasons rather than real defects, so they are held
// behind --net and reported in their own bucket either way.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const argv = process.argv.slice(2);
const WITH_NET = argv.includes('--net');
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1] : null; })();
const TIMEOUT_S = (() => { const i = argv.indexOf('--timeout'); return i >= 0 ? +argv[i + 1] : 120; })();

const NET = /^(coop_|_mp_|_relay_)|_live_|loadtest/;
// run_all_tests itself matches the `_test` selector — without this it spawns a
// nested full run (and a second set of servers on the same ports), which both
// times out and corrupts the outer run's results through contention.
const SELF = path.basename(fileURLToPath(import.meta.url));
const SKIP = /^(_tmp_|_check_scripts|_seed_push)/;

// --- environment the playwright suites need -------------------------------
// They were written against a Linux CI container: a hardcoded chromium path
// under /opt/pw-browsers and a static server on :8080. Neither exists on a dev
// machine, so 63 of 86 suites failed for environmental reasons and the whole
// regression net read as broken. Resolve a real browser and stand the server
// up here so the same suites run unmodified in both places.
const CANDIDATE_EXES = [
  process.env.PW_EXE,
  (() => { try { return require('playwright-core').chromium.executablePath(); } catch (e) { return null; } })(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].filter(Boolean);
const EXE = CANDIDATE_EXES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
if (!EXE) console.warn('WARNING: no chromium found — browser suites will fail. Set PW_EXE.');
else console.log(`browser: ${EXE}`);

// Three port conventions coexist in the suite: 72 files hardcode :8080, 8
// hardcode :8765, one :8090, and the rest read their port out of argv. Serve the
// hardcoded ports here and hand the rest what they ask for.
//
// TWO argv conventions, and they are incompatible. Most suites read
// `process.argv[2]` as the PORT; 107 read it as the PAGE and take the port from
// argv[3]. This runner passed the port in argv[2] to everyone, so those 107 were
// handed "8080" as a filename: some opened http://localhost:<own-port>/8080 (a
// 404 page, so every DOM check failed) and some tried to READ a file called 8080
// and died with ENOENT in 0.3 s. worldmap_zoom_test is the clean example — 12/12
// when run by hand, ENOENT under the runner. They have read as failing for as
// long as they have existed, which is how a regression net stops being read.
// argvFor() picks the order per file off the file's own source.
const GAME_PORT = +(process.env.GAME_PORT || 8080);
const EXTRA_PORTS = [8765, 8090];
const servers = [];
const startOne = (port) => new Promise((res) => {
  const s = spawn(process.execPath, ['serve.js', String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  servers.push(s);
  let done = false;
  const ready = () => { if (!done) { done = true; res(); } };
  s.stdout.on('data', (d) => { if (/serving at/i.test(String(d))) ready(); });
  s.on('error', ready);
  setTimeout(ready, 2500);   // serve.js can be silent; never hang the run
});
const startServer = () => Promise.all([GAME_PORT, ...EXTRA_PORTS].map(startOne));

const files = fs.readdirSync(SCRIPTS)
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => /(_test|_audit|^verify_)/.test(f.replace(/\.mjs$/, '')))
  .filter((f) => !SKIP.test(f) && f !== SELF)
  .filter((f) => (ONLY ? f.includes(ONLY) : true))
  .filter((f) => (WITH_NET ? true : !NET.test(f)))
  .sort();

// Which convention does this suite follow? The page-first ones declare their
// default inline (`process.argv[2] || 'mojiworld_game.html'`), so the file says
// so itself. Every page-first suite that reads argv[3] reads it as a port
// (checked across all 107), so handing it the port there is always right.
const _ARGV = new Map();
const argvFor = (file) => {
  if (_ARGV.has(file)) return _ARGV.get(file);
  let src = '';
  try { src = fs.readFileSync(path.join(SCRIPTS, file), 'utf8'); } catch (e) {}
  const pageFirst = /process\.argv\[2\]\s*\|\|\s*['"`][^'"`]*\.html['"`]/.test(src);
  const a = pageFirst ? ['mojiworld_game.html', String(GAME_PORT)] : [String(GAME_PORT)];
  _ARGV.set(file, a);
  return a;
};

const run = (file) => new Promise((res) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [path.join('scripts', file), ...argvFor(file)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    // PW_EXE and MOJI_PW_EXE are both in use across the suite; set both so a
    // test picks up the resolved browser whichever convention it follows.
    env: {
      ...process.env, CI: '1', NO_COLOR: '1',
      ...(EXE ? { PW_EXE: EXE, MOJI_PW_EXE: EXE } : {}),
      PORT: String(GAME_PORT),
      MOJI_GAME_URL: `http://localhost:${GAME_PORT}/mojiworld_game.html`,
    },
  });
  let out = '', err = '', killed = false;
  p.stdout.on('data', (d) => { out += d; if (out.length > 200000) out = out.slice(-200000); });
  p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-200000); });
  const timer = setTimeout(() => { killed = true; p.kill('SIGKILL'); }, TIMEOUT_S * 1000);
  p.on('close', (code) => {
    clearTimeout(timer);
    res({ file, code: killed ? 'TIMEOUT' : code, ms: Date.now() - t0, out, err, net: NET.test(file) });
  });
  p.on('error', (e) => { clearTimeout(timer); res({ file, code: 'SPAWN_ERR', ms: 0, out, err: String(e), net: NET.test(file) }); });
});

console.log(`running ${files.length} suites (timeout ${TIMEOUT_S}s${WITH_NET ? ', incl. network' : ', network excluded'})`);
await startServer();
console.log(`static servers on :${[GAME_PORT, ...EXTRA_PORTS].join(' :')}\n`);
const stopServer = () => { for (const s of servers) { try { if (!s.killed) s.kill('SIGKILL'); } catch (e) {} } };
process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(130); });

const results = [];
for (const f of files) {
  const r = await run(f);
  results.push(r);
  const ok = r.code === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.padEnd(42)} ${String(r.code).padStart(9)}  ${(r.ms / 1000).toFixed(1)}s`);
}

const failed = results.filter((r) => r.code !== 0);
const failNet = failed.filter((r) => r.net);
const failCore = failed.filter((r) => !r.net);

console.log(`\n${'='.repeat(72)}`);
console.log(`PASSED ${results.length - failed.length}/${results.length}   FAILED ${failed.length} (core ${failCore.length}, network ${failNet.length})`);

for (const r of failCore) {
  console.log(`\n${'-'.repeat(72)}\nFAIL ${r.file}  (exit ${r.code})`);
  const body = ((r.err || '') + '\n' + (r.out || '')).split('\n').filter((l) => l.trim());
  console.log(body.slice(-24).join('\n'));
}
if (failNet.length) console.log(`\nnetwork suites failing (expected without a relay): ${failNet.map((r) => r.file).join(', ')}`);

fs.writeFileSync(path.join(ROOT, 'scripts', '_tmp_test_report.json'),
  JSON.stringify(results.map(({ file, code, ms, net }) => ({ file, code, ms, net })), null, 1));
console.log('\nfull matrix -> scripts/_tmp_test_report.json');
process.exit(failCore.length);
