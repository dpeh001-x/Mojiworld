#!/usr/bin/env node
// Dead-asset audit (per user: "ensure dead files are removed").
//
// Two directions:
//   DEAD FILES — tracked art nothing references. Deleting a LIVE file is the
//   exact bug class the boot gate just fought, so the audit is conservative:
//   a file is alive if its exact path appears anywhere, OR its basename/stem
//   appears in a runtime source AND its directory is itself referenced
//   (registries store bare names and prefix a fixed dir at runtime), OR the
//   sprite frame index covers it. Anything uncertain stays.
//   DEAD REFERENCES — literal paths the code requests that do not exist on
//   disk (the class_crest_.png class: silent 404 on every boot).
//
//   node scripts/audit_dead_assets.mjs           # report only
//   flags: --json=<out.json>
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const REPO = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..');
const g = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 30, cwd: REPO });

// ---- corpus: every text the runtime (or a shipped tool) can read ----------
const SOURCES = [];
const addSrc = (p) => { try { SOURCES.push([p, readFileSync(join(REPO, p), 'utf8')]); } catch (e) {} };
addSrc('mojiworld_game.html');
addSrc('monster_animator.html');
addSrc('animator.html');
addSrc('sw.js');
addSrc('serve.js');
addSrc('steam/package.json');
for (const p of g(['ls-files', 'data/']).split('\n')) if (p.trim()) addSrc(p.trim());
for (const p of g(['ls-files', 'tools/']).split('\n'))
  if (p.trim() && !p.includes('_archive/') && /\.(html|js|mjs)$/.test(p)) addSrc(p.trim());
for (const p of g(['ls-files', 'scripts/']).split('\n'))
  if (p.trim() && /\.(mjs|js)$/.test(p)) addSrc(p.trim());
const BLOB = SOURCES.map(([, t]) => t).join('\n');
console.log(`corpus: ${SOURCES.length} files, ${(BLOB.length / 1e6).toFixed(1)}MB`);

// ---- the frame index: structured truth for <key>_<i> sets -----------------
let FIDX = { frames: {} };
try {
  const t = readFileSync(join(REPO, 'data/sprite_frame_index.js'), 'utf8');
  FIDX = JSON.parse(t.slice(t.indexOf('{')).replace(/;\s*$/, ''));
} catch (e) { console.log('WARN: frame index unreadable: ' + e); }

// ---- disk set -------------------------------------------------------------
const ART = ['Sprites', 'audio', 'backgrounds', 'assets'];
const files = g(['ls-files', ...ART]).split('\n').map(x => x.trim()).filter(Boolean);
console.log(`tracked art files: ${files.length}`);

const dirsReferenced = new Set();
for (const f of files) {
  const d = f.slice(0, f.lastIndexOf('/') + 1);
  if (!dirsReferenced.has(d) && BLOB.includes(d)) dirsReferenced.add(d);
}
// a dir also counts as referenced if code builds it without trailing slash
for (const f of files) {
  const d = f.slice(0, f.lastIndexOf('/'));
  if (d && !dirsReferenced.has(d + '/') && BLOB.includes(`'${d}/`) === false && BLOB.includes(d)) dirsReferenced.add(d + '/');
}

const alive = [];
const dead = [];
const why = {};
for (const f of files) {
  const dir = f.slice(0, f.lastIndexOf('/') + 1);
  const base = f.slice(f.lastIndexOf('/') + 1);
  const stem = base.replace(/\.[a-z0-9]+$/i, '');
  const frameM = stem.match(/^(.+)_(\d+)$/);
  let reason = null;
  if (BLOB.includes(f)) reason = 'path';
  if (!reason && frameM) {
    const key = frameM[1], idx = +frameM[2];
    const rel = dir.replace(/^Sprites\//, '').replace(/\/$/, '');
    const cnt = FIDX.frames && FIDX.frames[rel] && FIDX.frames[rel][key];
    if (cnt !== undefined && idx < cnt) reason = 'frame-index';
    // frame sets outside the index: alive if the KEY is quoted and the dir referenced
    if (!reason && dirsReferenced.has(dir)
        && (BLOB.includes(`'${key}'`) || BLOB.includes(`"${key}"`) || BLOB.includes(`'${key}.`) || BLOB.includes(`${key}_`)))
      reason = 'key+dir';
  }
  if (!reason && dirsReferenced.has(dir)
      && (BLOB.includes(base) || BLOB.includes(`'${stem}'`) || BLOB.includes(`"${stem}"`)))
    reason = 'name+dir';
  if (reason) { alive.push(f); why[f] = reason; }
  else dead.push(f);
}

// ---- reverse: referenced paths that do not exist --------------------------
const refRe = /['"`]((?:Sprites|audio|backgrounds|assets)\/[^'"`\\\n<>]+?\.(?:webp|png|jpe?g|gif|mp3|ogg|wav|woff2?))['"`]/g;
const missing = new Map();
for (const [srcName, text] of SOURCES) {
  let m;
  while ((m = refRe.exec(text))) {
    const p = m[1];
    if (!existsSync(join(REPO, p))) {
      if (!missing.has(p)) missing.set(p, []);
      if (missing.get(p).length < 3) missing.get(p).push(srcName);
    }
  }
}

// ---- report ---------------------------------------------------------------
const byDir = {};
for (const f of dead) { const d = f.slice(0, f.lastIndexOf('/') + 1); (byDir[d] = byDir[d] || []).push(f); }
console.log(`\nALIVE: ${alive.length}   DEAD CANDIDATES: ${dead.length}\n`);
for (const d of Object.keys(byDir).sort()) {
  console.log(`  ${d}  (${byDir[d].length})`);
  for (const f of byDir[d].slice(0, 6)) console.log(`     - ${f.slice(d.length)}`);
  if (byDir[d].length > 6) console.log(`     … +${byDir[d].length - 6} more`);
}
console.log(`\nDEAD REFERENCES (requested but missing on disk): ${missing.size}`);
for (const [p, srcs] of [...missing].slice(0, 30)) console.log(`  ! ${p}   <- ${srcs.join(', ')}`);

const outJson = (process.argv.find(a => a.startsWith('--json=')) || '').split('=')[1];
if (outJson) {
  writeFileSync(outJson, JSON.stringify({ alive: alive.length, why, dead, missing: [...missing] }, null, 1));
  console.log('\nwrote ' + outJson);
}
