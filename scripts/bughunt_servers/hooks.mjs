// bughunt servers - tooling / CI: the push-clobber gate's command shapes (cisec-1, cisec-9), hook invocation (cisec-7), session-start (cisec-10),
// the sw.js cache write (cisec-12 = bootdata-7), the Steam App ID guards (cisec-4), workflow paths + permissions (bootdata-8, cisec-15).
//   [SERVE_ROOT=<tree under test>] [JS_YAML_DIR=<js-yaml package dir>] node scripts/bughunt_servers/hooks.mjs
// Node only; the workflows are parsed with js-yaml when it can be found (else only text checks run), session-start.sh runs under `bash`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SRC = path.resolve(process.env.SERVE_ROOT || REPO);
let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d === undefined ? '' : '   ' + JSON.stringify(d).slice(0, 320))); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lxhk-'));

try {
  console.log(`tooling under test: ${SRC}`);

  // ---- cisec-1 / cisec-9: the gate's command shapes (scripts/push_gate_test.mjs --shapes-only, run from THIS tree's copy) ------------------
  {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'push_gate_test.mjs'), '--shapes-only', path.join(SRC, '.claude', 'hooks', 'push-clobber-gate.js')], { cwd: REPO, encoding: 'utf8', timeout: 280000 });
    const m = /(\d+)\/(\d+) passed/.exec(r.stdout || '');
    const bad = (r.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).length;
    check(r.status === 0 && m && m[1] === m[2], 'push gate: every command shape is gated / not gated as it should be (' + (m ? m[0] : 'no summary') + ')', { code: r.status, fails: bad, err: (r.stderr || '').slice(0, 200) });
    const gate = read('.claude/hooks/push-clobber-gate.js');
    check(!gate.includes(String.fromCharCode(0)), 'push gate: the source has no literal NUL byte (git treats it as binary)');
    // the tokeniser runs on every Bash / PowerShell command that mentions "push", inside a hook with no timeout: it must neither throw nor loop on
    // hostile or half-typed text. Deterministic fuzz over the characters and fragments that drive its state machine.
    {
      const fns = vm.runInNewContext(gate.split("let buf = '';")[0] + '\n({ splitCommands, pushesIn })', { require: createRequire(import.meta.url), process, console });
      const pieces = ['git', ' push', ' origin', ' main', ' -C', ' x', '"', "'", '$(', ')', '(', '`', '\\', '\n', '\r\n', ';', '&&', '||', '|', '&', '>', '2>&1', '<<', "<<'EOF'", '<<-X', 'EOF', 'X', '#', '${', '}', '{', ' ', '\t', '@\'', '\'@', '@"', '"@', 'bash -c ', 'git.exe ', '+', ':', 'refs/heads/main', ' -- ', '$', 'x'];
      let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
      let thrown = 0, slowest = 0; const t0 = Date.now();
      for (let i = 0; i < 4000; i++) {
        let s = ''; for (let k = 1 + rnd(40); k > 0; k--) s += pieces[rnd(pieces.length)];
        const t1 = Date.now();
        try { fns.pushesIn(s, 0); } catch (e) { thrown++; }
        slowest = Math.max(slowest, Date.now() - t1);
      }
      const big = 'git push origin main ' + "'a ".repeat(50000), t2 = Date.now(); let bigOk = true; try { fns.pushesIn(big, 0); } catch (e) { bigOk = false; }
      check(thrown === 0 && slowest < 200 && Date.now() - t0 < 20000 && bigOk && Date.now() - t2 < 5000, 'push gate: 4000 random command strings (unbalanced quotes, $( ), heredocs, here-strings ...) neither throw nor stall the tokeniser', { thrown, slowestMs: slowest, totalMs: Date.now() - t0, bigMs: Date.now() - t2 });
    }
    check(gate.includes('const blobAt = (file) => {'), 'push gate: the landed-fix marker for the one-read-per-file scan is still present');
    const mf = JSON.parse(read('scripts/landed_fixes.json'));
    check(Array.isArray(mf.markers) && mf.markers.length > 100 && !/push-clobber-gate\.py/.test(mf._readme.join('\n')) && /push-clobber-gate\.js/.test(mf._readme.join('\n')), 'manifest: _readme names the real hook (.js), markers untouched', { markers: mf.markers.length });
  }

  // ---- cisec-7: every hook runs through an explicit interpreter, with the project dir quoted -------------------------------------------------
  {
    const st = JSON.parse(read('.claude/settings.json'));
    const cmds = []; for (const ev of Object.values(st.hooks || {})) for (const g of ev) for (const h of g.hooks || []) cmds.push(h.command);
    check(cmds.length === 4 && cmds.every((c) => /^(bash|node|python3) "\$CLAUDE_PROJECT_DIR\/\.claude\/hooks\/[\w.-]+"$/.test(c)), 'settings.json: all hook commands name their interpreter and quote $CLAUDE_PROJECT_DIR', cmds);
    check(cmds.some((c) => /mobile-pre-push\.py/.test(c)) && cmds.some((c) => /mobile-zone-check\.py/.test(c)), 'settings.json: the mobile hooks are kept (only their invocation changed)');
    check(fs.existsSync(path.join(SRC, '.claude/hooks/session-start.sh')) && cmds.some((c) => /^bash .*session-start\.sh"$/.test(c)), 'settings.json: session-start.sh is run through bash');
  }

  // ---- cisec-10: untracked files no longer stop the session-start sync ---------------------------------------------------------------------------
  {
    const bashProbe = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
    if (bashProbe.status !== 0) check(true, 'session-start: SKIPPED (no bash on PATH)');
    else {
      const sh = (cwd, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      const origin = path.join(TMP, 'origin.git'), a = path.join(TMP, 'a'), b = path.join(TMP, 'b'), c = path.join(TMP, 'c');
      fs.mkdirSync(origin); sh(origin, ['init', '-q', '--bare', '-b', 'main']);
      sh(TMP, ['clone', '-q', origin, a]); fs.writeFileSync(path.join(a, 'f.txt'), '1'); sh(a, ['add', '-A']); sh(a, ['commit', '-q', '-m', 'one']); sh(a, ['branch', '-M', 'main']); sh(a, ['push', '-q', 'origin', 'main']);
      sh(TMP, ['clone', '-q', origin, b]); sh(TMP, ['clone', '-q', origin, c]);
      fs.writeFileSync(path.join(a, 'f.txt'), '2'); sh(a, ['commit', '-qam', 'two']); sh(a, ['push', '-q', 'origin', 'main']);
      const want = sh(a, ['rev-parse', 'HEAD']);
      fs.writeFileSync(path.join(b, 'scratch_notes.txt'), 'untracked noise'); fs.mkdirSync(path.join(b, 'marketing')); fs.writeFileSync(path.join(b, 'marketing', 'x.png'), 'x');   // the real checkout carries ~300 of these
      fs.writeFileSync(path.join(c, 'f.txt'), 'locally edited');                                                                                                          // a TRACKED edit
      const run = (dir) => spawnSync('bash', [path.join(SRC, '.claude/hooks/session-start.sh')], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, timeout: 60000 });
      const rb = run(b), rc = run(c);
      check(sh(b, ['rev-parse', 'HEAD']) === want && rb.status === 0, 'session-start: a checkout with only untracked files is fast-forwarded to origin/main', { out: (rb.stdout || '').slice(-200) });
      check(sh(c, ['rev-parse', 'HEAD']) !== want && rc.status === 0 && fs.readFileSync(path.join(c, 'f.txt'), 'utf8') === 'locally edited', 'session-start: a tracked local edit still stops the sync, and is left alone', { status: rc.status, out: (rc.stdout || '').slice(-160), err: (rc.stderr || '').slice(-160), head: sh(c, ['rev-parse', 'HEAD']).slice(0, 8), want: want.slice(0, 8) });
    }
  }

  // ---- cisec-12 / bootdata-7: the service worker's cache write is inside waitUntil, and its failure is not an unhandled rejection --------------------
  {
    const code = read('sw.js');
    const unhandled = []; const onUnhandled = (e) => unhandled.push(String(e && e.message)); process.on('unhandledRejection', onUnhandled);
    const mkSw = (putImpl) => {
      const listeners = {}; const puts = [];
      const cache = { match: async () => undefined, put: (req, res) => { puts.push(req); return putImpl(); } };
      const ctx = { self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://game.test' }, skipWaiting() {}, clients: { claim() {} } },
        caches: { open: async () => cache, keys: async () => [], delete: async () => true }, fetch: async () => ({ ok: true, clone() { return this; } }), Response: class { constructor(b, i) { Object.assign(this, i); } }, URL, console };
      vm.runInNewContext(code, ctx);
      return { listeners, puts };
    };
    const fire = async (sw) => {
      const e = { waits: [], request: { method: 'GET', url: 'https://game.test/Sprites/a.webp', headers: { get: () => null } }, respondWith(p) { this.resp = Promise.resolve(p); }, waitUntil(p) { this.waits.push(p); } };
      sw.listeners.fetch(e);
      const res = await e.resp;
      return { e, res };
    };
    let release; const gate = new Promise((r) => { release = r; });
    const slow = mkSw(() => gate);
    const { e, res } = await fire(slow);
    let settled = false; Promise.all(e.waits).then(() => { settled = true; });
    await sleep(40);
    check(res && res.ok && slow.puts.length === 1, 'sw.js: the network response is returned at once and its copy is cache.put', { ok: !!(res && res.ok), puts: slow.puts.length });
    check(settled === false, 'sw.js: waitUntil is still pending while cache.put is in flight (the worker may not be killed before the write lands)', { settled });
    release(); await sleep(40);
    check(settled === true, 'sw.js: waitUntil settles once the write is done');
    const failing = mkSw(() => Promise.reject(new Error('QuotaExceededError')));
    const f2 = await fire(failing); await sleep(60);
    const waitsOk = await Promise.all(f2.e.waits).then(() => true, () => false);
    check(f2.res && f2.res.ok && waitsOk && unhandled.length === 0, 'sw.js: a failing cache.put (quota) neither fails the response nor surfaces as an unhandled rejection', { unhandled, waitsOk });
    process.off('unhandledRejection', onUnhandled);
  }

  // ---- cisec-4: verify_depot_matches_repo.mjs fails on Spacewar / a different App ID -------------------------------------------------------------
  {
    const makeAsar = (files) => {
      const entries = {}; let off = 0; const bufs = [];
      for (const [n, c] of Object.entries(files)) { const b = Buffer.from(c); entries[n] = { size: b.length, offset: String(off) }; off += b.length; bufs.push(b); }
      const json = Buffer.from(JSON.stringify({ files: entries })), pad = (4 - (json.length % 4)) % 4, padded = Buffer.concat([json, Buffer.alloc(pad)]);
      const hdr = Buffer.alloc(16); hdr.writeUInt32LE(4, 0); hdr.writeUInt32LE(8 + padded.length, 4); hdr.writeUInt32LE(4 + padded.length, 8); hdr.writeUInt32LE(json.length, 12);
      return Buffer.concat([hdr, padded, ...bufs]);
    };
    const verify = (appid) => {
      const d = fs.mkdtempSync(path.join(TMP, 'depot-'));
      const w = (rel, c) => { fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true }); fs.writeFileSync(path.join(d, rel), c); };
      w('steam/release/win-unpacked/resources/app.asar', makeAsar({ 'preload.js': '// preload', ...(appid === null ? {} : { 'steam_appid.txt': appid }) }));
      w('steam/release/win-unpacked/resources/app/mojiworld_game.html', "const GAME_VERSION = 'v0.0.1';");
      w('mojiworld_game.html', "const GAME_VERSION = 'v0.0.1';"); w('steam/preload.js', '// preload'); w('steam/steam_appid.txt', '4842650\n');
      const r = spawnSync(process.execPath, [path.join(SRC, 'scripts', 'verify_depot_matches_repo.mjs')], { cwd: d, encoding: 'utf8' });
      return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
    };
    const good = verify('4842650\n'), spacewar = verify('480\n'), other = verify('1234567'), none = verify(null);
    check(good.code === 0 && !/WRONG STEAM APP ID/.test(good.out), 'verify_depot: a depot carrying the committed App ID passes', { code: good.code, out: good.out.slice(-160) });
    check(spacewar.code === 1 && /WRONG STEAM APP ID/.test(spacewar.out) && /Spacewar/.test(spacewar.out), 'verify_depot: a depot baked with 480 (Spacewar) exits 1', { code: spacewar.code });
    check(other.code === 1 && /WRONG STEAM APP ID/.test(other.out), 'verify_depot: a depot whose App ID differs from steam/steam_appid.txt exits 1', { code: other.code });
    check(none.code === 1 && /none found/.test(none.out), 'verify_depot: a depot with no steam_appid.txt in its asar exits 1', { code: none.code });
  }

  // ---- cisec-4 / bootdata-8 / cisec-15: the workflows -------------------------------------------------------------------------------------------
  {
    const sb = read('.github/workflows/steam-build.yml'), dw = read('.github/workflows/deploy-worker.yml');
    check(!/\|\|\s*480/.test(sb) && (sb.match(/SID: \$\{\{ vars\.STEAM_APP_ID \}\}/g) || []).length === 2 && (sb.match(/if \[ -n "\$SID" \]; then echo "\$SID" > steam_appid\.txt; fi/g) || []).length === 2,
      'steam-build.yml: both jobs overwrite steam_appid.txt only when the STEAM_APP_ID variable is set (no || 480), via env not inline ${{ }}');
    check(sb.split('\n').filter((l) => /\$\{\{\s*vars\./.test(l) && !/^\s*#/.test(l)).every((l) => /^\s+\w+: \$\{\{ vars\.\w+ \}\}\s*$/.test(l)), 'steam-build.yml: every repository variable reaches a step as env, none is pasted into shell text');
    let yaml = null;
    for (const c of [process.env.JS_YAML_DIR, path.join(SRC, 'steam/node_modules/js-yaml'), path.join(REPO, 'steam/node_modules/js-yaml')]) { if (c && fs.existsSync(path.join(c, 'package.json'))) { try { yaml = createRequire(import.meta.url)(c); break; } catch (e) { /* next */ } } }
    if (yaml) {
      const doc = yaml.load(sb), paths = doc.on.push.paths;
      check(paths.includes('assets/**') && paths.includes('manifest.webmanifest'), 'steam-build.yml: paths: includes assets/** and manifest.webmanifest (what steam/package.json extraResources ships)', paths);
      check(doc.permissions && doc.permissions.contents === 'read', 'steam-build.yml: least-privilege permissions (contents: read)');
      const dwDoc = yaml.load(dw);
      check(dwDoc.permissions && dwDoc.permissions.contents === 'read' && dwDoc.on.push.paths[0] === 'mp-cf/**', 'deploy-worker.yml: least-privilege permissions (contents: read), trigger paths unchanged');
      for (const f of fs.readdirSync(path.join(SRC, '.github/workflows'))) { let ok = true; try { yaml.load(read('.github/workflows/' + f)); } catch (e) { ok = false; } if (!ok) check(false, f + ' parses as YAML'); }
      check(true, 'every workflow parses as YAML');
    } else {
      check(/- 'assets\/\*\*'/.test(sb) && /- 'manifest\.webmanifest'/.test(sb), 'steam-build.yml: paths: includes assets/** and manifest.webmanifest (text check; js-yaml not found)');
      check(/^permissions:\n  contents: read$/m.test(sb) && /^permissions:\n  contents: read$/m.test(dw), 'steam-build.yml and deploy-worker.yml: least-privilege permissions (text check; js-yaml not found)');
    }
  }
} finally {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a lingering handle */ }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
