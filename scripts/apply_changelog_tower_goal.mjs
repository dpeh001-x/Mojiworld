import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A Tower floor&rsquo;s goal counts the enemies that are actually there</span></h2>',
  '<p>From the second bug hunt. Each Tower floor&rsquo;s objective was written for its full roster &mdash; B7 said <em>&ldquo;Defeat all 40 enemies (30 Shardlings + 10 Tomb Hexers)&rdquo;</em> &mdash; but the game caps how many monsters are on screen at once, so only 36 appeared on a desktop (fewer on a phone), and the floor clears when those are gone. The objective promised enemies that never existed.</p>',
  '<p>The goal in the quest pin and the objective toast now states what is actually on the floor (B7 on a desktop: <em>&ldquo;Defeat all 36 enemies (27 Shardlings + 9 Tomb Hexers)&rdquo;</em>). Floors that spawn their whole roster read exactly as before, and boss floors are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/tower_goal_test.mjs</code> &mdash; 3 checks: B7&rsquo;s goal and pin match the enemies that spawned; B1, which spawns all 30, reads as written; no page errors. The B7 check fails on the build before this fix.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
