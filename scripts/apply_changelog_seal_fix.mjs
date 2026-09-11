import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';   // a chain builds in a private copy
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The heal lock no longer eats revives, and no seal runs out behind a menu</span></h2>',
  '<p>Found by the debugging sweep (per user: <em>&ldquo;do a series of debugging, look for glitches (ensure not to fall into false positive traps) look for any loopholes and inconsistencies thoroughly&rdquo;</em>). Three independent audits reproduced these, each against a control run.</p>',
  '<p><b>Revives under the heal lock.</b> Gravitos&rsquo;s comet seals healing for 10&nbsp;s by refusing any write that raises HP. Revives restore HP the same way, so a lethal hit inside the seal showed &ldquo;Second Wind!&rdquo; and spent the charge, but HP stayed at 0. The player went down with no banner and no Respawn button until the seal ended, and a respawn could arrive in the Void at 0&nbsp;HP. Miracle Evasion, Phoenix Heart, the downed state&rsquo;s 1&nbsp;HP and the co-op revive all failed the same way. Now any raise from 0 or below counts as a revive, not a heal, and goes through. Heals while you are alive are still refused.</p>',
  '<p><b>Seals ran out while paused.</b> The heal lock, the potion seal, the 3&nbsp;s potion cooldown and Gravitos&rsquo;s one-hit-KO warning all count on the game clock, which keeps ticking while the game is paused. So opening the Quest Journal or photo mode mid-fight wiped the seal (the potion seal&rsquo;s own comment promises it &ldquo;pauses with the game&rdquo;) or skipped the potion cooldown. Unpausing during the one-hit-KO warning also fired the strike on the very first frame, with no warning left. All four now hold their time while the world is frozen. Co-op is unchanged: there a pause does not stop the world, so the timers keep running.</p>',
  '<p><b>Two refusals that were not heals.</b> Status Cure Remedy (clears poison, slow, burn and freeze, restores no HP) and Warp were refused under the lock; now only HP drinks are. And in co-op, while you are paused, the game undoes any damage the running world deals you (the v0.29.674 &ldquo;ghost statue&rdquo;). Under the lock that undo was refused, so a sealed player kept the damage. It now goes through.</p>',
  '<table><thead><tr><th>Measured</th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Second Wind under the heal lock</td><td>0 HP, charge spent</td><td>146 / 292 HP</td></tr>',
  '<tr><td>Heal lock after 300 paused frames (5&nbsp;s in a menu)</td><td>600 &rarr; 300 frames left</td><td>600 &rarr; 600</td></tr>',
  '<tr><td>Potion seal after 300 paused frames</td><td>900 &rarr; 600</td><td>900 &rarr; 900</td></tr>',
  '<tr><td>Potion cooldown after 120 paused frames</td><td>180 &rarr; 60</td><td>180 &rarr; 180</td></tr>',
  '<tr><td>Gravitos one-hit-KO warning after 200 paused frames</td><td>300 &rarr; 100</td><td>300 &rarr; 300</td></tr>',
  '<tr><td>Status Cure under the heal lock</td><td>refused (poison and slow kept)</td><td>cured, one remedy used</td></tr>',
  '<tr><td>Co-op, paused: a 50-damage hit from the running world</td><td>kept (116 &rarr; 66)</td><td>undone (116 &rarr; 116)</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/seal_fix_test.mjs</code> &mdash; 11 checks: the seven rows above, plus four controls that must hold on both builds: an ordinary heal is still refused while sealed, an HP potion is still refused, the lock still counts down while you play, and in a co-op pause it keeps draining. The previous build fails six. The co-op undo check was proven separately against a build with only that part reverted, where it alone fails.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
