// THE PUSH-CLOBBER GATE, marker half (the sw.js cache-bump half is sw_bump_gate_test.mjs).
//   node scripts/push_gate_test.mjs [hook.js]      (default .claude/hooks/push-clobber-gate.js)
// Feeds the hook a push of throwaway commits built on origin/main with a PRIVATE index (the working copy and its
// index are never touched, nothing is pushed):
//   - the unchanged tip is allowed (exit 0), and answers in under a minute - one dry run took 10m17s on 2026-09-27
//     when the hook read the 10 MB game blob once per marker, so every typed push lost the race to main;
//   - deleting one landed marker from mojiworld_game.html, from sw.js, and from a data/ table each blocks (exit 2),
//     naming that marker and only markers of that same file - every marker is counted in its OWN file.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.resolve(ROOT, process.argv[2] || '.claude/hooks/push-clobber-gate.js');
const git = (args, env) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 30, env: env || process.env, stdio: ['pipe', 'pipe', 'pipe'] });
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info).slice(0, 400)}`); if (!ok) bad++; };

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
