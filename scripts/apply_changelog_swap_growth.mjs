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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Switching class before your job keeps what your levels earned</span></h2>',
  '<p>Found in a bug hunt. The Amnesiac&rsquo;s &ldquo;try a different path&rdquo; class swap keeps your level, as it says, but it reset your max HP, MP, ATK and DEF to the new class&rsquo;s <b>level-1</b> numbers and never gave back the growth your levels had earned. A level-19 Warrior who became a Rogue was a level-19 Rogue with <b>HP 100 / MP 50 / ATK 15 / DEF 3</b> &mdash; a Rogue who levelled to 19 has <b>496 / 266 / 51 / 21</b> &mdash; and it stayed that way for good.</p>',
  '<p>The swap now gives you every level&rsquo;s growth for your <em>new</em> class (the same numbers levelling up gives) and refills you. If an earlier swap already cost you those stats, loading your save puts them back, with a &ldquo;Restored the stats your levels earned&rdquo; note. This only touches characters who haven&rsquo;t taken a job yet, which is when the swap happens; anything you invested on top is kept.</p>',
  '<p><b>Verified.</b> <code>scripts/swap_growth_test.mjs</code> &mdash; 6 checks: a level-19 Warrior swapped to Rogue matches a native level-19 Rogue and is refilled; a save stuck on level-1 stats is restored on load; a healthy save and a save holding a job are left exactly as they were; no page errors. The swap and the restore checks fail on the build before this fix.</p>',
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
