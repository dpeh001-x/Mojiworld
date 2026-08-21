#!/usr/bin/env node
// Build a playtester zip: the runtime only, plus a README.
//   node scripts/package_playtest_build.mjs [--out DIR] [--with-node] [--dry]
//
// The repo is ~9 GB (3.5 git, 2.5 steam, 2.5 scripts) against roughly 1 GB the
// game actually loads, so this copies an allowlist rather than pruning a clone.
// Source art, backups and tooling are excluded — a tester needs the build, not
// the workshop.
import { cp, mkdir, rm, readdir, stat, writeFile, copyFile, readFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname, basename, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = arg('--out') || join(ROOT, '_playtest');

// Files the game itself needs at the root.
const ROOT_FILES = ['mojiworld_game.html', 'sw.js', 'serve.js', 'Mojiworld.cmd', 'Mojiworld.exe'];
// Asset trees it loads from. The cinematics subtree rides along because the
// game <video>-plays 21 films from it at runtime (prologue through the ending
// chain) and every cutscene FAILS OPEN on a missing clip — a package without
// them boots green and silently shows no films at all. It is ~135 MB of the
// steam/ tree; the other ~2.4 GB (Electron, store art) still stays out.
const ASSET_DIRS = ['Sprites', 'audio', 'backgrounds', 'assets', 'data',
  'steam/higgsfield/cinematics'];

// Working directories and source files that never ship.
const SKIP_DIR = (name) =>
  /^_/.test(name) ||                 // _backup_*, _raw_candidates, _sticker_backup …
  /backup/i.test(name) ||
  /^pre_\d/.test(name) ||            // pre_1656 snapshots
  name === 'Todo list' || name === 'refs' || name === 'node_modules' || name === '.git';
const SKIP_EXT = new Set(['.py', '.psd', '.md', '.tmp', '.db', '.bat~', '.ps1', '.sh']);

// Everything HEAD tracks, as forward-slash paths. The package is defined by
// the commit, so a file the working copy has but the commit does not is not
// part of the build.
// Pin to a concrete SHA up front. This script runs `git show <REF>:<path>` once
// per code file and once more for the version — roughly 20 resolutions spread
// over a ~6 minute run. With REF left as the symbolic "HEAD", a parallel
// session committing mid-run means different files come from different commits
// and the version banner describes a build that was never assembled anywhere.
// Observed live: staged bytes matched no commit in history at all.
const REF = execFileSync('git', ['rev-parse', arg('--ref') || 'HEAD'], { encoding: 'utf8' }).trim();
const TRACKED = new Set(
  execFileSync('git', ['ls-tree', '-r', '--name-only', REF], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
    .split('\n').map((x) => x.trim()).filter(Boolean));
const rel = (p) => relative(ROOT, p).split(sep).join('/');
// Text/code comes out of the commit itself; binaries are copied from disk.
const FROM_GIT = new Set(['.html', '.js', '.mjs', '.json', '.cmd', '.css']);
async function place(src, dst) {
  const r = rel(src);
  if (FROM_GIT.has(extname(src).toLowerCase()) && TRACKED.has(r)) {
    const buf = execFileSync('git', ['show', `${REF}:${r}`], { maxBuffer: 512 * 1024 * 1024 });
    if (!has('--dry')) await writeFile(dst, buf);
    return buf.length;
  }
  if (!has('--dry')) await copyFile(src, dst);
  return (await stat(src)).size;
}

let copied = 0, bytes = 0, skipped = 0, skippedBytes = 0, untracked = 0, untrackedBytes = 0, fromGit = 0;
async function walk(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR(e.name)) {
        const sz = await dirSize(s); skippedBytes += sz; skipped++;
        continue;
      }
      await walk(s, d);
    } else {
      if (SKIP_EXT.has(extname(e.name).toLowerCase())) { skippedBytes += (await stat(s)).size; skipped++; continue; }
      if (!TRACKED.has(rel(s))) { untrackedBytes += (await stat(s)).size; untracked++; continue; }
      const n = await place(s, d);
      if (FROM_GIT.has(extname(e.name).toLowerCase())) fromGit++;
      bytes += n; copied++;
    }
  }
}
async function dirSize(p) {
  let n = 0;
  for (const e of await readdir(p, { withFileTypes: true })) {
    const q = join(p, e.name);
    n += e.isDirectory() ? await dirSize(q) : (await stat(q)).size;
  }
  return n;
}

if (!has('--dry')) { await rm(OUT, { recursive: true, force: true }); await mkdir(OUT, { recursive: true }); }
for (const f of ROOT_FILES) {
  const s = join(ROOT, f);
  if (!existsSync(s)) { console.log(`  (absent, skipped) ${f}`); continue; }
  if (!TRACKED.has(f)) { console.log(`  (untracked, skipped) ${f}`); untracked++; continue; }
  const n = await place(s, join(OUT, f));
  if (FROM_GIT.has(extname(f).toLowerCase())) fromGit++;
  bytes += n; copied++;
}
for (const d of ASSET_DIRS) {
  const s = join(ROOT, d);
  if (!existsSync(s)) { console.log(`  (absent) ${d}`); continue; }
  await walk(s, join(OUT, d));
}

// Optional: bundle the signed node.exe so the tester installs nothing. The
// launcher already prefers .\node\node.exe over a PATH node.
if (has('--with-node')) {
  const sys = process.execPath;
  if (existsSync(sys)) {
    if (!has('--dry')) { await mkdir(join(OUT, 'node'), { recursive: true }); await copyFile(sys, join(OUT, 'node', 'node.exe')); }
    const sz = (await stat(sys)).size; bytes += sz; copied++;
    console.log(`  bundled node.exe (${(sz / 1024 / 1024).toFixed(0)} MB) — tester needs nothing installed`);
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const VER = (() => { try { return (execFileSync('git', ['show', `${REF}:mojiworld_game.html`], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })
  .match(/GAME_VERSION = '(v[\d.]+)'/) || [])[1]; } catch (e) { return '?'; } })();

// The tester README. It lives in docs/guides/ because this script wipes OUT on
// every run — a README authored straight into _playtest/ survives exactly one
// packaging and then silently vanishes, and verify_playtest_build.mjs asserts
// it ships. Tracked file in, generated file out.
const README_SRC = join(ROOT, 'docs', 'guides', 'playtest_README.txt');
if (!existsSync(README_SRC)) { console.error(`ABORT: README template missing: ${rel(README_SRC)}`); process.exit(1); }
{
  const tpl = await readFile(README_SRC, 'utf8');
  const out = tpl.replace(/\{\{VERSION\}\}/g, VER);
  if (out.includes('{{')) { console.error('ABORT: unresolved {{token}} left in the README'); process.exit(1); }
  // BOM + CRLF: this is a .txt a Windows tester opens in Notepad. Without the
  // BOM the em-dashes render as "â€”" — the first thing they read, mojibaked.
  if (!has('--dry')) await writeFile(join(OUT, 'README.txt'), '\uFEFF' + out.replace(/\r?\n/g, '\r\n'), 'utf8');
  copied++; bytes += Buffer.byteLength(out);
}

console.log(`\nbuild: ${VER} from ${REF} (${execFileSync('git', ['rev-parse', '--short', REF], { encoding: 'utf8' }).trim()})`);
console.log(`staged ${copied} files, ${mb(bytes)}  — ${fromGit} code files taken from the commit, not the working copy`);
console.log(`excluded ${skipped} dirs/files, ${mb(skippedBytes)} (backups, source art, tooling)`);
if (untracked) console.log(`skipped ${untracked} untracked file(s), ${mb(untrackedBytes)} — not part of the committed build`);
console.log(has('--dry') ? '(dry run — nothing written)' : `-> ${OUT}`);

// --- optional: the shippable zip --------------------------------------------
// The name comes from VER, i.e. the version of the build actually staged. An
// earlier zip was named off HEAD, which had moved between packaging and
// zipping, so the filename advertised a build the zip did not contain.
// Staged under a real folder name so the README's "unzip this folder" is true
// and a dragged-out extraction cannot scatter 7k files loose.
if (has('--zip') && !has('--dry')) {
  const zipName = `Mojiworld-playtest-${VER}.zip`;
  const zipPath = join(ROOT, zipName);
  const staged = join(dirname(OUT), `Mojiworld-playtest-${VER}`);
  await rm(zipPath, { force: true });
  await rm(staged, { recursive: true, force: true });
  await rename(OUT, staged);
  try {
    const sevenZa = join(ROOT, 'steam', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
    if (existsSync(sevenZa)) {
      execFileSync(sevenZa, ['a', '-tzip', '-mx=5', '-bso0', '-bsp0', zipPath, staged], { stdio: 'inherit' });
    } else {
      execFileSync('powershell', ['-NoProfile', '-Command',
        `Compress-Archive -LiteralPath '${staged}' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`], { stdio: 'inherit' });
    }
  } finally {
    await rename(staged, OUT);   // put _playtest back so the verifier can boot it
  }
  if (!existsSync(zipPath)) { console.error('ABORT: the zip was not produced'); process.exit(1); }
  console.log(`zip: ${zipName} (${mb((await stat(zipPath)).size)}) -> ${zipPath}`);
}
