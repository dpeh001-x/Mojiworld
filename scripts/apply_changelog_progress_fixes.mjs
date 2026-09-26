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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A resumed Spire quest keeps its chests, and Dragoon&rsquo;s +2 Jump is safe from the Jump lane and Reset Stats</span></h2>',
  '<p>Two progression bugs found in a bug hunt.</p>',
  '<p><b>&ldquo;Progress restored&rdquo;, then thrown away.</b> Abandoning and re-accepting the Spire quest said &ldquo;Progress restored &mdash; 2 already counted&rdquo; and showed 2/4, but the next chest set it to 1/4, and three chests later it sat at 3/4, not done. The chest count now carries on from what was restored (this covers any multi-step visit quest).</p>',
  '<p><b>Dragoon&rsquo;s +2 Jump.</b> The Jump lane in the Level Up panel assumed you start at your class&rsquo;s jump, so a Dragoon could buy 18 ranks where only 14 add anything &mdash; 8&nbsp;SP for nothing &mdash; and <b>Reset Stats</b> then took the Dragoon&rsquo;s +2 away for good. The lane now stops where ranks stop adding, and Reset Stats keeps a job or master&rsquo;s jump bonus. Other classes&rsquo; lanes are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/progress_fixes_test.mjs</code> &mdash; 6 checks: a re-accepted Spire quest goes 2/4 &rarr; 3/4 and finishes on the fourth chest; a plain Warrior&rsquo;s Jump cap is unchanged; a Dragoon buys only the ranks that add jump; Reset Stats keeps the +2; no page errors. 4 of the 6 fail on the build before this fix.</p>',
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
