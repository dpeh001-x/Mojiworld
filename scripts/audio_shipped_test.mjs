// Every audio file the COMMITTED code references must itself be COMMITTED.
//
// The playtest packager copies only tracked files, so an audio drop that was
// never `git add`ed produces a map that is silent for the tester while sounding
// fine on the author's machine — the file is right there on disk. Found live:
// bgm_bone_graveyard.mp3 and bgm_distorted_portal.mp3 were referenced by
// committed map tables but untracked.
//   node scripts/audio_shipped_test.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const g = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 536870912 });
const src = g(['show', 'HEAD:mojiworld_game.html']);
const tracked = new Set(g(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').map(s => s.trim()).filter(Boolean));

// Every 'audio/...' literal in the committed game file.
const refs = [...new Set([...src.matchAll(/'(audio\/[^']+\.(?:mp3|ogg|wav|m4a|mpeg))'/g)].map(m => m[1]))].sort();
console.log(`audio paths referenced by the committed build: ${refs.length}`);

// Some references are FORMAT CANDIDATE LISTS, not requirements: the loading
// theme declares .mp3/.m4a/.wav/.ogg and plays whichever the browser accepts,
// so only one needs to exist. Group by basename and judge the group, or this
// reports three false failures for a file that works.
const stem = (p) => p.replace(/\.[^.]+$/, '');
const byStem = new Map();
for (const p of refs) {
  const k = stem(p);
  if (!byStem.has(k)) byStem.set(k, []);
  byStem.get(k).push(p);
}
const missingOnDisk = [];
for (const [k, group] of byStem) {
  if (!group.some(p => existsSync(p))) missingOnDisk.push(k + ' (none of: ' + group.map(p => p.split('.').pop()).join('/') + ')');
}
// Tracking, by contrast, is judged per FILE that exists: a present-but-untracked
// file is silently dropped by the packager even if a sibling format is tracked.
const untracked = refs.filter(p => existsSync(p) && !tracked.has(p));

if (missingOnDisk.length) { console.log('\nNOT ON DISK:'); for (const p of missingOnDisk) console.log('  ' + p); }
if (untracked.length) { console.log('\nON DISK BUT UNTRACKED (would ship silent):'); for (const p of untracked) console.log('  ' + p); }
if (!missingOnDisk.length && !untracked.length) console.log('every referenced track is on disk and committed');

ok('every referenced audio file exists on disk', missingOnDisk.length === 0, missingOnDisk.slice(0, 8));
ok('every referenced audio file is COMMITTED (the packager only ships tracked files)',
   untracked.length === 0, untracked.slice(0, 8));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
