#!/usr/bin/env node
// THE ASSET CACHE KEY MUST MOVE WHEN AN ASSET IS REPLACED (v0.30.947).
//
// sw.js caches every png/webp/jpg/jpeg/gif/svg/mp3/ogg/wav/m4a/woff2 stale-while-revalidate. Adding a NEW
// filename is safe - nothing is cached under it yet. REPLACING one under its own name is not: a returning
// browser serves its cached copy instantly for the whole session and only picks the new one up the session
// after. The failure is silent, which is why it has happened at least six times (see the version notes in
// sw.js: v0.29.473, v0.29.630, v0.30.52, v0.30.73, v0.30.311, v0.30.868, v0.30.895) and once more at
// v0.30.947, where 44 recut audio files - 13 of them the music whose whole point was looping without a
// gap - were stranded behind cache v66.
//
// This asks git the question nobody remembers to ask: since the commit that last moved CACHE, has any
// asset been MODIFIED (not added)? Exits 1 and names them if so.
//
//   node scripts/sw_cache_freshness.mjs              # against origin/main (MOJI_REPO= to point elsewhere)
//   node scripts/sw_cache_freshness.mjs --ref HEAD   # against the working tree's HEAD
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.MOJI_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argRef = (() => { const i = process.argv.indexOf('--ref'); return i > 0 ? process.argv[i + 1] : null; })();
const REF = argRef || 'origin/main';
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

let fail = 0;
const say = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); if (!ok) fail++; };

// 1. the key, and the ASSET_RE that decides what it protects
let sw = '';
try { sw = git(['show', `${REF}:sw.js`]); } catch (e) { sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); }
const keyLine = (sw.match(/const CACHE = '[^']+';/) || [])[0] || '';
const key = (keyLine.match(/'([^']+)'/) || [])[1] || '';
say(!!key, 'sw.js names an asset cache generation', key);
const reSrc = (sw.match(/const ASSET_RE = \/\\\.\(([^)]+)\)/) || [])[1] || 'png|webp|jpg|jpeg|gif|svg|mp3|ogg|wav|m4a|woff2';
const ASSET_RE = new RegExp('\\.(' + reSrc + ')$', 'i');

// 2. the commit where that exact key first appeared — everything after it is at risk
let since = '';
try {
  // search the REF's own history: a checkout whose HEAD lags origin would never see the bump otherwise
  const log = git(['log', '--format=%H', '-S', key, REF, '--', 'sw.js']).split(/\r?\n/).filter(Boolean);
  since = log[log.length - 1] || '';
} catch (e) {}
say(!!since, 'the commit that introduced it is findable', since.slice(0, 8));

if (key && since) {
  // 3. assets MODIFIED since then, anywhere the game loads art or sound from
  let rows = [];
  try {
    rows = git(['diff', '--name-status', '--diff-filter=MR', since, REF, '--',
      'Sprites', 'backgrounds', 'audio', 'assets']).split(/\r?\n/).filter(Boolean);
  } catch (e) {}
  const replaced = rows.map((r) => r.split(/\t/).pop()).filter((f) => ASSET_RE.test(f));
  say(replaced.length === 0,
    'no cached asset has been replaced since the key last moved',
    replaced.length ? replaced.length + ' replaced, e.g. ' + replaced.slice(0, 4).join(', ') : '');
  if (replaced.length) {
    const byDir = {};
    for (const f of replaced) { const d = f.replace(/\/[^/]*$/, ''); byDir[d] = (byDir[d] || 0) + 1; }
    console.log('      bump CACHE in sw.js (and say why), because these are served stale for a whole session:');
    for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log('        ' + String(n).padStart(4) + '  ' + d + '/');
  }
}
console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
process.exit(fail ? 1 : 0);
