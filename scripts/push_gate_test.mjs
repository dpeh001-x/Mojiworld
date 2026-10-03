// THE PUSH-CLOBBER GATE, shapes half (bughunt 2026-10-02 cisec-1 / cisec-9) + marker half (the sw.js cache-bump half is sw_bump_gate_test.mjs).
//   node scripts/push_gate_test.mjs [--shapes-only] [hook.js]      (default .claude/hooks/push-clobber-gate.js)
// SHAPES: which push COMMANDS the hook gates. A throwaway repo whose manifest names one marker the pushed game.html lacks: a command the hook
//   reads as pushing a commit to main exits 2 naming that marker, anything else exits 0 - about 60 command shapes (flags, HEAD:main, <sha>:main,
//   +main, git -C, git.exe, bash -c, PowerShell, comments, continuations, bare pushes with main or another branch checked out ...), plus
//   woff2 counting as art for the sw.js cache-bump rule. No origin, no network, nothing outside a temp dir; --shapes-only stops after it.
// Feeds the hook a push of throwaway commits built on origin/main with a PRIVATE index (the working copy and its
// index are never touched, nothing is pushed):
//   - the unchanged tip is allowed (exit 0), and answers in under a minute - one dry run took 10m17s on 2026-09-27
//     when the hook read the 10 MB game blob once per marker, so every typed push lost the race to main;
//   - deleting one landed marker from mojiworld_game.html, from sw.js, and from a data/ table each blocks (exit 2),
//     naming that marker and only markers of that same file - every marker is counted in its OWN file.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHAPES_ONLY = process.argv.includes('--shapes-only');
const HOOK = path.resolve(ROOT, process.argv.slice(2).find((a) => !a.startsWith('--')) || '.claude/hooks/push-clobber-gate.js');
const git = (args, env) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, env: env || process.env, stdio: ['pipe', 'pipe', 'pipe'] });
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info).slice(0, 400)}`); if (!ok) bad++; };

// ======================================== SHAPES ========================================
{
  const T = mkdtempSync(path.join(tmpdir(), 'lxshape-'));
  const sh = (cwd, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const MARK = 'LANDED_FIX_MARKER_BH';
  const manifest = JSON.stringify({ markers: [{ file: 'game.html', marker: MARK, min: 1, fix: 'shapes test', landed: 't' }] });
  const mkRepo = (name, files) => {
    const d = path.join(T, name); mkdirSync(d, { recursive: true });
    sh(d, ['init', '-q', '-b', 'main']);
    for (const [f, c] of Object.entries(files)) { mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); writeFileSync(path.join(d, f), c); }
    sh(d, ['add', '-A']); sh(d, ['commit', '-q', '-m', 'base']);
    return d;
  };
  const BAD = mkRepo('bad repo (1)', { 'scripts/landed_fixes.json': manifest, 'game.html': 'a game without the marker' });   // spaces + parens in the path: git -C "..."
  const PLAIN = mkRepo('plain', { 'game.html': 'no manifest here' });
  const GOOD = mkRepo('good', { 'scripts/landed_fixes.json': manifest, 'game.html': 'a game WITH ' + MARK });
  sh(BAD, ['branch', 'feature']);
  const SHA = sh(BAD, ['rev-parse', 'HEAD']);
  const ART = mkRepo('art', { 'scripts/landed_fixes.json': manifest, 'game.html': 'a game WITH ' + MARK, 'sw.js': "const CACHE = 'mojiworld-assets-v1';\n", 'assets/fonts/a.woff2': 'font v1', 'Sprites/a.png': 'png v1' });
  sh(ART, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);   // the gate diffs against origin/main
  const artBranch = (name, edit) => { sh(ART, ['checkout', '-q', '-b', name, 'main']); edit(); sh(ART, ['add', '-A']); sh(ART, ['commit', '-q', '-m', name]); const s = sh(ART, ['rev-parse', 'HEAD']); sh(ART, ['checkout', '-q', 'main']); return s; };
  const W = (f, c) => writeFileSync(path.join(ART, f), c);
  const A_FONT = artBranch('art-font', () => W('assets/fonts/a.woff2', 'font v2'));
  const A_FONT_BUMP = artBranch('art-font-bump', () => { W('assets/fonts/a.woff2', 'font v2'); W('sw.js', "const CACHE = 'mojiworld-assets-v2';\n"); });
  const A_NEWFONT = artBranch('art-new', () => W('assets/fonts/b.woff2', 'a brand new font'));
  const A_PNG = artBranch('art-png', () => W('Sprites/a.png', 'png v2'));

  const hook = (cmd, project, tool) => {
    const r = spawnSync(process.execPath, [HOOK], { cwd: ROOT, input: JSON.stringify({ tool_name: tool || 'Bash', tool_input: { command: cmd } }), encoding: 'utf8', timeout: 60000, env: { ...process.env, CLAUDE_PROJECT_DIR: project } });
    return { code: r.status, err: r.stderr || '' };
  };
  const fill = (s) => s.split('{SHA}').join(SHA).split('{REPO}').join(BAD.replace(/\\/g, '/')).split('{PLAIN}').join(PLAIN.replace(/\\/g, '/'));
  const GATED = [   // exit 2, naming the marker
    'git push origin main', 'git push -u origin main', 'git push --force-with-lease origin main', 'git push --force-with-lease=main:abc123 origin main', 'git push --force origin main',
    'git push -f origin main', 'git push --atomic origin main', 'git push --no-verify -q origin main', 'git push origin HEAD:main', 'git push origin {SHA}:main',
    'git push origin {SHA}:refs/heads/main', 'git push origin +main', 'git push origin +{SHA}:refs/heads/main', 'git push -q origin "{SHA}:refs/heads/main"', "git push origin '{SHA}:refs/heads/main'",
    'git push origin feature:main', 'git push origin refs/heads/main', 'git push origin refs/heads/feature:refs/heads/main', 'git push origin HEAD',
    'git push origin "$(git rev-parse HEAD):refs/heads/main"', 'git push', 'git push origin', 'git push --all origin', 'git push --mirror origin', 'git push origin "refs/heads/*:refs/heads/*"',
    'git -c core.editor=true push origin main', 'git --no-pager push origin main', 'git.exe push origin main', '"C:/Program Files/Git/cmd/git.exe" push origin main', '/usr/bin/git push origin main',
    'cd somewhere && git push origin main', 'echo start; git push origin main', 'git status && git push origin main || echo failed', 'git push origin main 2>&1 | tail -3',
    'git push origin main # ship it', 'git push \\\n  origin main', 'git push \\\r\n  origin main', '(git push origin main)', 'bash -c "git push origin main"', "sh -c 'git push origin main'",
    'env GIT_TRACE=1 git push origin main', 'GIT_SSH_COMMAND=ssh git push origin main', 'time git push origin main', 'git push -o ci.skip origin main', 'git push --push-option=x origin main',
    'git push origin main --tags', 'git commit -qm wip\ngit push origin main', 'git push origin main 2> push.log',
    'git -C "{REPO}" push origin main',
    // commit messages written through a heredoc (apostrophes in the body must not swallow the push that follows), and text the parser cannot close
    'git commit -m "$(cat <<\'EOF\'\nit\'s a fix, don\'t panic\nEOF\n)" && git push origin main',
    'git add -A && git commit -m "$(cat <<\'EOF\'\nmsg: it\'s done\nEOF\n)"\ngit push origin main',
    'cat > notes.txt <<EOF\nsome \'quoted text\nEOF\ngit push origin main',
    'git push origin main "unterminated', "git commit -m 'it'\"'\"'s fine' && git push origin main",
  ];
  const GATED_PS = [
    "git commit -m @'\nIt's a fix\n'@; git push origin main",'& git push origin main', "& 'C:\\Program Files\\Git\\cmd\\git.exe' push origin main", 'git push origin main; if ($?) { echo ok }', '{ git push origin main }', 'git push origin main | Out-Null'];
  const FREE_PS = ["git commit -m @'\nIt's about git push origin main\n'@", "git commit -m @'\nIt's done\n'@; git push origin feature"];
  const FREE = [   // exit 0: not a push of anything to main (or not ours to judge)
    'git push origin feature', 'git push origin main-old', 'git push origin feature:feature', 'git push --tags origin', 'git push origin --delete main', 'git push origin :main', 'git push -d origin main',
    'git commit -m "docs: about git push origin main"', "git commit -m 'x' # git push origin main", 'echo git push origin main', 'echo "git push origin main"', 'git status', 'git log --oneline -3 -- push',
    'git commit -m "$(cat <<\'EOF\'\nfix the gate: it\'s now seen when you run git push origin main\nEOF\n)"', 'cat <<EOF\ngit push origin main\nEOF', 'git commit -m "x"  # then git push origin main',
    'git pull --rebase origin main', 'git fetch origin main', 'npm run push main', 'git push origin "$UNSET:refs/heads/main"', 'git push origin "${UNSET}:refs/heads/main"', 'git -C "{PLAIN}" push origin main',
  ];
  const FREE_ON_FEATURE = ['git push', 'git push origin', 'git push origin HEAD', 'git push -u origin HEAD', 'git push origin feature'];   // HEAD = feature
  const GATED_ON_FEATURE = ['git push origin main', 'git push origin feature:main'];                                                       // still main
  console.log(`shapes: hook ${path.relative(ROOT, HOOK) || HOOK}, throwaway repos under ${T}`);
  try {
    for (const c of GATED) { const cmd = fill(c); const r = hook(cmd, c.includes('{REPO}') ? PLAIN : BAD); check(r.code === 2 && r.err.includes(MARK), 'gated: ' + JSON.stringify(c), { code: r.code, err: r.code === 2 ? undefined : r.err.slice(0, 120) }); }
    for (const c of GATED_PS) { const r = hook(c, BAD, 'PowerShell'); check(r.code === 2 && r.err.includes(MARK), 'gated (PowerShell): ' + JSON.stringify(c), { code: r.code }); }
    for (const c of FREE_PS) { const r = hook(c, BAD, 'PowerShell'); check(r.code === 0, 'not gated (PowerShell): ' + JSON.stringify(c), { code: r.code }); }
    for (const c of FREE) { const r = hook(fill(c), BAD); check(r.code === 0, 'not gated: ' + JSON.stringify(c), { code: r.code, err: r.err.slice(0, 120) }); }
    sh(BAD, ['symbolic-ref', 'HEAD', 'refs/heads/feature']);   // another branch is checked out
    for (const c of FREE_ON_FEATURE) { const r = hook(c, BAD); check(r.code === 0, 'on branch feature, not gated: ' + JSON.stringify(c), { code: r.code }); }
    for (const c of GATED_ON_FEATURE) { const r = hook(c, BAD); check(r.code === 2 && r.err.includes(MARK), 'on branch feature, still gated: ' + JSON.stringify(c), { code: r.code }); }
    sh(BAD, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    check(hook('git push origin main', GOOD).code === 0, 'a push whose blobs carry every marker is allowed (git push origin main)');
    check(hook('git push origin main', T).code === 0, 'a project dir that is not a repo fails open');
    check(hook('git push origin main', BAD, 'Read').code === 0, 'a non-shell tool is ignored');
    check(hook('git push origin main', BAD, 'PowerShell').code === 2, 'the PowerShell tool is gated like Bash');
    // cisec-9: woff2 is art (sw.js caches it), so replacing one under its own name needs the CACHE bump like a png does
    const art = (sha, w) => hook('git push origin ' + sha + ':refs/heads/main', ART, w);
    const rF = art(A_FONT), rP = art(A_PNG), rB = art(A_FONT_BUMP), rN = art(A_NEWFONT);
    check(rF.code === 2 && /sw\.js cache bump/.test(rF.err) && /a\.woff2/.test(rF.err), 'woff2: a replaced font without a sw.js CACHE bump blocks the push', { code: rF.code, err: rF.err.slice(0, 160) });
    check(rP.code === 2 && /a\.png/.test(rP.err), 'png: (unchanged rule) a replaced sprite without a bump blocks', { code: rP.code });
    check(rB.code === 0, 'woff2: the same font replacement WITH a CACHE bump is allowed', { code: rB.code, err: rB.err.slice(0, 160) });
    check(rN.code === 0, 'woff2: a brand-new font file needs no bump', { code: rN.code, err: rN.err.slice(0, 160) });
  } finally { rmSync(T, { recursive: true, force: true }); }
  if (SHAPES_ONLY) { console.log(`\n${total - bad}/${total} passed`); process.exit(bad ? 1 : 0); }
}

git(['fetch', 'origin', '--quiet']);
const BASE = git(['rev-parse', 'origin/main']).trim();
const entries = JSON.parse(git(['cat-file', '-p', BASE + ':scripts/landed_fixes.json'])).markers || [];
const tmp = mkdtempSync(path.join(tmpdir(), 'lxgate-'));
const blobCache = new Map();
const blobOf = (file) => { if (!blobCache.has(file)) blobCache.set(file, git(['cat-file', '-p', BASE + ':' + file])); return blobCache.get(file); };
const count = (s, m) => s.split(m).length - 1;

// A commit on BASE whose `file` has the first occurrence of `marker` cut out (a stale rebuild dropping one fix).
let n = 0;
const withoutMarker = (file, marker) => {
  const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'idx' + (++n)) };
  git(['read-tree', BASE], env);
  const src = blobOf(file), at = src.indexOf(marker);
  const p = path.join(tmp, 'blob' + n); writeFileSync(p, src.slice(0, at) + src.slice(at + marker.length), 'utf8');
  const h = git(['hash-object', '-w', '--no-filters', '--', p]).trim();
  git(['update-index', '--cacheinfo', '100644,' + h + ',' + file], env);
  const tree = git(['write-tree'], env).trim();
  return git(['commit-tree', tree, '-p', BASE, '-m', 'push-gate test throwaway: drop one ' + file + ' marker'], env).trim();
};
// One entry of `file` whose marker occurs exactly as often as it must, so a single cut takes it under its minimum.
const pick = (file) => entries.find((e) => e.file === file && e.marker && !/[\r\n]/.test(e.marker) && count(blobOf(file), e.marker) === ((e.min | 0) || 1));
const runHook = (sha) => {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: ['git', 'push', 'origin', sha + ':refs/heads/main'].join(' ') } });
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [HOOK], { cwd: ROOT, input, encoding: 'utf8', timeout: 180000, env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } });
  const named = [...(r.stderr || '').matchAll(/^ {2}(\S+): marker "(.*)" found \d+x, needs >= \d+x$/gm)].map((m) => ({ file: m[1], marker: m[2] }));
  return { code: r.status, ms: Date.now() - t0, named, err: (r.stderr || '').slice(0, 300) };
};

try {
  console.log(`hook ${path.relative(ROOT, HOOK) || HOOK}, base ${BASE.slice(0, 8)}, ${entries.length} manifest entries`);
  const tip = runHook(BASE);
  check(tip.code === 0, 'the unchanged origin/main tip is allowed (exit 0)', { code: tip.code, named: tip.named.slice(0, 3), err: tip.err });
  check(tip.code !== null && tip.ms < 60000, `...and the gate answers in under a minute (${(tip.ms / 1000).toFixed(1)} s)`);
  // the hook matches markers as UTF-8 bytes, so one cut is a marker with non-ASCII text (an em dash, a glyph)
  const wide = entries.find((e) => e.file === 'mojiworld_game.html' && /[^\x00-\x7f]/.test(e.marker) && !/[\r\n]/.test(e.marker)
    && count(blobOf(e.file), e.marker) === ((e.min | 0) || 1));
  for (const [file, pre] of [['mojiworld_game.html'], ['mojiworld_game.html', wide], ['sw.js'], ['data/anim_calib.js']]) {
    const e = pre || pick(file);
    if (!e) { check(false, `${file}: an entry to cut exists`); continue; }
    const r = runHook(withoutMarker(file, e.marker));
    const hit = r.named.some((v) => v.file === file && v.marker === e.marker);
    const own = r.named.length > 0 && r.named.every((v) => v.file === file);
    check(r.code === 2 && hit && own, `${file}: cutting one ${pre ? 'non-ASCII ' : ''}marker blocks the push (exit 2), naming it and only ${file} markers (${(r.ms / 1000).toFixed(1)} s)`,
      { code: r.code, marker: e.marker.slice(0, 60), named: r.named.map((v) => v.file + ': ' + v.marker.slice(0, 40)).slice(0, 4), err: r.code === 2 ? undefined : r.err });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
