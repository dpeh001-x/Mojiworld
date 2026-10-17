// lock-proof-resync (v0.30.x lock-proof-resync): a ship's re-sync no longer touches the shared git index, so a stale
// .git/index.lock - the Codex desktop app leaves one whenever it kills one of its `git diff` runs mid-refresh - can
// neither stop nor corrupt a ship, and a provably dead lock is moved aside (never deleted).
//   node scripts/lock_proof_resync_test.mjs   (LX_REPO=<dir> reads the pipeline scripts from a scratch copy;
//                                              MOJI_GAME_FILE / PORT are accepted and ignored - nothing in the game changes)
// A. static: what scripts/_ship_change.sh calls and in what order; no re-sync helper runs an index-writing git command.
// B. the cause, reproduced: a `git diff <commit>` killed while it refreshes the index leaves a 0-byte index.lock, and
//    the old re-sync (`git checkout TIP -- <path>`) then fails - the new one does not.
// C. the re-sync in a scratch repo holding a stale lock: checkout-identical CRLF bytes, index and lock untouched, no temp
//    files, loud failure for a path origin lacks, edits after the re-sync still caught.
// D. a blobless partial clone: one prefetch brings every missing blob, after which the re-sync needs no network.
// E. the reaper: leaves a young lock, one a running older git may own, and any doubt alone; moves a dead one aside.
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, statSync, readdirSync, utimesSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.LX_REPO || ROOT;
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const rd = (rel) => { try { return readFileSync(path.join(REPO, rel), 'utf8').replace(/\r/g, ''); } catch (e) { return ''; } };
const BASH = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((b) => existsSync(b)) || 'bash';
const fwd = (p) => p.split('\\').join('/');
const HELPER = fwd(path.join(REPO, 'scripts/_ship_resync.sh'));
const sh = (cwd, script, env) => spawnSync(BASH, ['-c', '. "' + HELPER + '"; ' + script], { cwd, encoding: 'utf8', env: { ...process.env, ...(env || {}) } });
// the real git.exe: killing Git for Windows' cmd\git.exe launcher would not stop the git doing the work
const GIT = path.join(execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim(), 'git.exe');
const gitIn = (R) => (...a) => execFileSync(GIT, a, { cwd: R, stdio: 'pipe', encoding: 'utf8' });
const scratch = (tag) => mkdtempSync(path.join(os.tmpdir(), 'lx_lock_' + tag + '_'));
const drop = (d) => { try { rmSync(d, { recursive: true, force: true }); } catch (e) {} };
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const tick = () => new Promise((r) => setImmediate(r));
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const body = (text, fn) => { const i = text.indexOf(fn + ' () {'); return i < 0 ? '' : text.slice(i, text.indexOf('\n}\n', i)); };
const code = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const INDEX_WRITERS = /\bgit\s+(-c\s+\S+\s+)*(checkout|add|reset|read-tree|update-index|status|restore|stash|commit|merge|rebase|switch)\b/;

// ---- A. static ------------------------------------------------------------------------------------------------
const SC = rd('scripts/_ship_change.sh'), H = rd('scripts/_ship_resync.sh'), REAP = rd('scripts/reap_index_lock.sh'), HOOK = rd('.claude/hooks/session-start.sh');
{
  const files = ['scripts/_ship_change.sh', 'scripts/_ship_resync.sh', 'scripts/reap_index_lock.sh', '.claude/hooks/session-start.sh'];
  const syn = files.map((f) => existsSync(path.join(REPO, f)) ? spawnSync(BASH, ['-n', fwd(path.join(REPO, f))]).status : 'missing');
  check(syn.every((s) => s === 0), 'the pipeline scripts, the reaper and the session hook exist and parse (bash -n)', syn);
  const fns = ['lx_resync_one', 'lx_resync_verify', 'lx_resync_prefetch', 'lx_reap_stale_lock', 'lx_git_starts'];
  check(fns.every((f) => body(H, f)), '_ship_resync.sh defines the re-sync, verify, prefetch and reaper helpers', fns.filter((f) => !body(H, f)));
  const dirty = ['lx_resync_one', 'lx_resync_verify', 'lx_resync_prefetch'].filter((f) => INDEX_WRITERS.test(code(body(H, f))));
  check(!dirty.length && /git cat-file --filters "\$tip:\$p"/.test(body(H, 'lx_resync_one')), 'the re-sync writes origin\'s bytes with `git cat-file --filters`; no helper runs an index-writing git command', dirty);
  check(!INDEX_WRITERS.test(code(SC)), '_ship_change.sh itself runs no index-writing git command (the whole chain is index-free)', (code(SC).match(INDEX_WRITERS) || [])[0]);
  const iS = SC.indexOf('. scripts/_ship_resync.sh ||'), iR = SC.indexOf('\nlx_reap_stale_lock'), iRound = SC.indexOf('round () {');
  check(iS > 0 && iR > iS && iR < iRound, '_ship_change.sh moves a provably stale lock aside right after loading the helpers, before any round', { iS, iR, iRound });
  const iP = SC.indexOf('lx_resync_prefetch "$TIP" $EXTRA'), i1 = SC.indexOf('lx_resync_one "$TIP" "$p" || return 1'), iV = SC.indexOf('lx_resync_verify "$TIP" $EXTRA || return 1'), iA = SC.indexOf('node "$LX_APPLY" ||');
  check(iP > 0 && iP < i1 && i1 < iV && iV < iA, 'one prefetch, then the per-path re-sync, then the hash check - all before the apply', { iP, i1, iV, iA });
  check(/^\. scripts\/_ship_resync\.sh/m.test(REAP) && /^lx_reap_stale_lock\s*$/m.test(REAP), 'scripts/reap_index_lock.sh runs the same reaper by hand', null);
  check(HOOK.includes('git --no-optional-locks status --porcelain') && !/\$\(git status --porcelain/.test(HOOK), 'the SessionStart hook\'s read-only `git status` no longer takes the index lock', null);
}

// ---- B. the cause ---------------------------------------------------------------------------------------------
{
  const R = scratch('cause'), g = gitIn(R), L = path.join(R, '.git', 'index.lock');
  try {
    g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
    const big = Buffer.alloc(256 * 1024, 'abcdefgh\n');
    for (let d = 0; d < 20; d++) {
      mkdirSync(path.join(R, 'd' + d));
      for (let i = 0; i < 100; i++) writeFileSync(path.join(R, 'd' + d, 'f' + i + '.txt'), ('row ' + d + '/' + i + '\n').repeat(30));
      for (let i = 0; i < 2; i++) writeFileSync(path.join(R, 'd' + d, 'big' + i + '.bin'), big);
    }
    g('add', '-A'); g('commit', '-qm', 'base');
    const head = g('rev-parse', 'HEAD').trim(), files = walk(R);
    let left = null, tries = 0;
    while (!left && tries < 5) {
      tries++;
      const t = new Date(Date.now() + tries * 1000 + 60000); for (const f of files) utimesSync(f, t, t);   // same bytes, new stat: a full re-hash
      const cp = spawn(GIT, ['diff', '--no-ext-diff', '--color=never', head, '--find-renames', '--numstat', '-z', '--', 'd0'], { cwd: R, stdio: 'ignore' });
      let done = false; const exited = new Promise((r) => cp.on('exit', () => { done = true; r(); }));
      const until = Date.now() + 20000;
      while (!done && Date.now() < until) { if (existsSync(L)) { cp.kill(); break; } await tick(); }   // kill it while it holds the lock
      await exited;
      if (existsSync(L)) left = statSync(L);
    }
    check(!!left && left.size === 0, 'cause: a `git diff <commit>` killed while it refreshes the index leaves a 0-byte .git/index.lock (the Codex app kills these)', { tries, size: left && left.size });
    const old = spawnSync(GIT, ['checkout', head, '--', 'd0/f0.txt'], { cwd: R, encoding: 'utf8' });
    check(old.status !== 0 && /index\.lock/.test(old.stderr), 'cause: after it, the old re-sync (`git checkout TIP -- <path>`) fails on the lock', { status: old.status, err: (old.stderr || '').slice(0, 160) });
    writeFileSync(path.join(R, 'd0', 'f0.txt'), 'stale\n');
    const r = sh(R, 'LX_RESYNC_SLEEP=0 lx_resync_one ' + head + ' d0/f0.txt && lx_resync_verify ' + head + ' d0/f0.txt');
    check(r.status === 0 && existsSync(L) && readFileSync(path.join(R, 'd0', 'f0.txt'), 'utf8').startsWith('row 0/0'), 'cause: the new re-sync restores the file with that lock in place, and leaves the lock where it is', { status: r.status, err: r.stderr.slice(0, 200) });
  } catch (e) { check(false, 'cause: scratch repo runs', String(e.message).slice(0, 200)); }
  finally { drop(R); }
}

// ---- C. the re-sync with a stale lock ---------------------------------------------------------------------------
{
  const R = scratch('resync'), g = gitIn(R), L = path.join(R, '.git', 'index.lock'), F = (rel) => path.join(R, rel);
  try {
    g('init', '-q'); g('config', 'core.autocrlf', 'true'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
    mkdirSync(F('sub/deep'), { recursive: true });
    writeFileSync(F('t.txt'), 'row a\nrow b\n'); writeFileSync(F('sub/deep/n.txt'), 'n1\n'); g('add', '-A'); g('commit', '-qm', 'one');
    writeFileSync(F('t.txt'), 'row a\nrow B (another session)\n'); writeFileSync(F('sub/deep/n.txt'), 'n2\n'); g('add', '-A'); g('commit', '-qm', 'two');
    writeFileSync(F('t.txt'), 'row a\r\nrow b\r\n');                     // the stale working copy
    rmSync(F('sub'), { recursive: true });                                 // ...missing a folder origin has
    writeFileSync(F('local_only.txt'), 'mine\r\n');                         // ...and holding a file origin lacks
    writeFileSync(L, '');                                                   // the 0-byte lock a killed git left behind
    const idx0 = sha(F('.git/index')), lk0 = statSync(L).mtimeMs;
    const r0 = sh(R, 'lx_resync_verify HEAD t.txt');
    check(r0.status !== 0 && /VERIFY FAILED: t\.txt/.test(r0.stderr), 'resync: the stale copy fails the hash check against origin', { status: r0.status });
    const r1 = sh(R, 'LX_RESYNC_SLEEP=0 lx_resync_one HEAD t.txt && LX_RESYNC_SLEEP=0 lx_resync_one HEAD sub/deep/n.txt');
    const t = readFileSync(F('t.txt'), 'utf8'), n = existsSync(F('sub/deep/n.txt')) ? readFileSync(F('sub/deep/n.txt'), 'utf8') : null;
    check(r1.status === 0 && t === 'row a\r\nrow B (another session)\r\n' && n === 'n2\r\n', 'resync: a stale index.lock no longer blocks it; CRLF bytes as a checkout writes them; a missing folder is created', { status: r1.status, err: r1.stderr.slice(0, 200), t, n });
    check(existsSync(L) && statSync(L).size === 0 && statSync(L).mtimeMs === lk0 && sha(F('.git/index')) === idx0, 'resync: the shared index and the lock are left exactly as they were', { lock: existsSync(L), idxSame: sha(F('.git/index')) === idx0 });
    const W = scratch('cowt'), ck = spawnSync(GIT, ['--work-tree=' + W, 'checkout', 'HEAD', '--', 't.txt', 'sub/deep/n.txt'], { cwd: R, encoding: 'utf8', env: { ...process.env, GIT_INDEX_FILE: F('.git/_cmp_idx') } });
    const same = ck.status === 0 && ['t.txt', 'sub/deep/n.txt'].every((p) => sha(path.join(W, p)) === sha(F(p)));
    drop(W);
    check(same, 'resync: the bytes equal what `git checkout TIP -- <path>` writes (checked out in a private index + work tree)', { status: ck.status, err: (ck.stderr || '').slice(0, 160) });
    const r3 = sh(R, 'lx_resync_verify HEAD t.txt sub/deep/n.txt brand_new.webp');
    check(r3.status === 0, 'resync: the re-synced files verify against origin; a path origin lacks is skipped', { status: r3.status, err: r3.stderr.slice(0, 200) });
    const r4 = sh(R, 'LX_RESYNC_SLEEP=0 lx_resync_one HEAD local_only.txt');
    check(r4.status !== 0 && /RE-SYNC FAILED/.test(r4.stderr) && /Nothing applied, nothing pushed/.test(r4.stderr) && readFileSync(F('local_only.txt'), 'utf8') === 'mine\r\n',
      'resync: a path origin cannot serve stops it loudly, and the file on disk is left as it was', { status: r4.status, err: r4.stderr.slice(0, 200) });
    check(!walk(R).some((f) => f.includes('.lxsync.')), 'resync: no temp file is left behind, after success or failure', walk(R).filter((f) => f.includes('.lxsync.')));
    writeFileSync(F('t.txt'), t + 'row c\r\n');                             // changed after the re-sync (another local session)
    const r5 = sh(R, 'lx_resync_verify HEAD t.txt');
    check(r5.status !== 0 && /VERIFY FAILED/.test(r5.stderr), 'resync: a file changed after the re-sync is still caught', { status: r5.status });
  } catch (e) { check(false, 'resync: scratch repo runs', String(e.message).slice(0, 200)); }
  finally { drop(R); }
}

// ---- D. a blobless partial clone --------------------------------------------------------------------------------
{
  const O = scratch('origin'), C = scratch('clone'), go = gitIn(O), gc = gitIn(C), names = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt'];
  const has = (tip, p) => spawnSync(GIT, ['cat-file', '-e', tip + ':' + p], { cwd: C, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).status === 0;
  try {
    go('init', '-q'); go('config', 'user.email', 't@t'); go('config', 'user.name', 't');
    go('config', 'uploadpack.allowFilter', 'true'); go('config', 'uploadpack.allowAnySHA1InWant', 'true');
    for (const p of names) writeFileSync(path.join(O, p), p + ' one\n'); go('add', '-A'); go('commit', '-qm', 'one');
    for (const p of names) writeFileSync(path.join(O, p), p + ' two\n'); go('add', '-A'); go('commit', '-qm', 'two');
    execFileSync(GIT, ['clone', '-q', '--filter=blob:none', '--no-checkout', pathToFileURL(O).href, C], { stdio: 'pipe' });
    const tip = gc('rev-parse', 'HEAD').trim();
    check(names.every((p) => !has(tip, p)), 'clone: the blobless clone starts without the blobs the re-sync needs', names.filter((p) => has(tip, p)));
    const r1 = sh(C, 'lx_resync_prefetch ' + tip + ' ' + names.join(' '));
    check(r1.status === 0 && /prefetched 5 missing blob/.test(r1.stdout) && names.every((p) => has(tip, p)), 'clone: one prefetch brings all five missing blobs', { status: r1.status, out: r1.stdout.slice(0, 160), err: r1.stderr.slice(0, 160) });
    const r2 = sh(C, 'lx_resync_prefetch ' + tip + ' ' + names.join(' '));
    check(r2.status === 0 && r2.stdout.trim() === '', 'clone: with nothing missing the prefetch does nothing', { out: r2.stdout });
    gc('remote', 'set-url', 'origin', pathToFileURL(path.join(O, 'gone')).href);   // the network is gone now
    const r3 = sh(C, names.map((p) => 'LX_RESYNC_SLEEP=0 lx_resync_one ' + tip + ' ' + p).join(' && ') + ' && lx_resync_verify ' + tip + ' ' + names.join(' '));
    check(r3.status === 0 && readFileSync(path.join(C, 'c.txt'), 'utf8').replace(/\r/g, '') === 'c.txt two\n', 'clone: after the prefetch the re-sync and its hash check need no fetch at all', { status: r3.status, err: r3.stderr.slice(0, 200) });
    const C2 = scratch('clone2');
    execFileSync(GIT, ['clone', '-q', '--filter=blob:none', '--no-checkout', pathToFileURL(O).href, C2], { stdio: 'pipe' });
    const r4 = sh(C2, 'LX_RESYNC_SLEEP=0 lx_resync_one ' + tip + ' e.txt && lx_resync_verify ' + tip + ' e.txt');
    drop(C2);
    check(r4.status === 0, 'clone: without a prefetch a file still fetches its own blob (lazily) and verifies', { status: r4.status, err: r4.stderr.slice(0, 200) });
  } catch (e) { check(false, 'clone: scratch repos run', String(e.message).slice(0, 200)); }
  finally { drop(O); drop(C); }
}

// ---- E. the reaper -------------------------------------------------------------------------------------------
{
  const R = scratch('reap'), g = gitIn(R), L = path.join(R, '.git', 'index.lock');
  const aged = (secs, bytes) => { writeFileSync(L, bytes || ''); const t = new Date(Date.now() - secs * 1000); utimesSync(L, t, t); return Math.floor(t.getTime() / 1000); };
  const stale = () => readdirSync(path.join(R, '.git')).filter((f) => f.startsWith('index.lock.stale-'));
  try {
    g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); writeFileSync(path.join(R, 'x.txt'), 'x\n'); g('add', 'x.txt'); g('commit', '-qm', 'x');
    aged(5);
    const e1 = sh(R, 'lx_reap_stale_lock');
    check(e1.status === 0 && existsSync(L) && /left alone \(a live git command may hold it\)/.test(e1.stdout), 'reaper: a lock younger than 2 minutes is left alone', { out: e1.stdout });
    let mt = aged(600);
    const e2 = sh(R, 'lx_git_starts () { printf "%s\n" ' + (mt + 900) + ' ' + (mt - 30) + '; }; lx_reap_stale_lock');
    check(existsSync(L) && /a git process that started before it is still running/.test(e2.stdout), 'reaper: an old lock is left alone while any git process that started before it runs', { out: e2.stdout });
    const e3 = sh(R, 'lx_git_starts () { return 1; }; lx_reap_stale_lock');
    check(existsSync(L) && /cannot list the running git processes/.test(e3.stdout), 'reaper: when the running processes cannot be listed, it does nothing', { out: e3.stdout });
    const live = spawn(GIT, ['cat-file', '--batch'], { cwd: R, stdio: ['pipe', 'ignore', 'ignore'] });
    await new Promise((r) => setTimeout(r, 2500));
    aged(0);
    const e4 = sh(R, 'lx_reap_stale_lock', { LX_REAP_MIN_AGE: '0' });
    live.stdin.end(); await new Promise((r) => live.on('exit', r));
    check(existsSync(L) && /started before it is still running/.test(e4.stdout), 'reaper: a REAL running git that started before the lock keeps it from being moved', { out: e4.stdout, err: e4.stderr.slice(0, 160) });
    mt = aged(600, 'abc');
    const e5 = sh(R, 'lx_git_starts () { printf "%s\n" ' + (mt + 60) + ' ' + (mt + 400) + '; }; lx_reap_stale_lock');
    const moved = stale();
    check(!existsSync(L) && moved.length === 1 && readFileSync(path.join(R, '.git', moved[0]), 'utf8') === 'abc' && /moved a stale/.test(e5.stdout),
      'reaper: an old lock no running git is old enough to own is moved aside to index.lock.stale-*, bytes kept (never deleted)', { out: e5.stdout, moved });
    const after = spawnSync(GIT, ['add', 'x.txt'], { cwd: R, encoding: 'utf8' });
    const e6 = sh(R, 'lx_reap_stale_lock');
    check(after.status === 0 && e6.status === 0 && e6.stdout.trim() === '', 'reaper: git works again afterwards, and with no lock the reaper is silent', { status: after.status, out: e6.stdout });
  } catch (e) { check(false, 'reaper: scratch repo runs', String(e.message).slice(0, 200)); }
  finally { drop(R); }
}
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
