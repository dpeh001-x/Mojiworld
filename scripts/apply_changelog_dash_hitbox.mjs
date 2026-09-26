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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Flurry, Dimensional Warp, Rush and Smoke Dash now hit bosses and tall monsters</span></h2>',
  '<p>The pre-launch combat audit found four dash skills that passed straight through big enemies standing right next to you:</p>',
  '<ul>',
  '<li><b>Flurry</b> (rogue) and <b>Dimensional Warp</b> (mage) did <em>no damage at all</em> to King Gloopaloo, Mooma or King Krook, however close you were.</li>',
  '<li><b>Rush</b> (warrior) landed only its first body hit on them; all five flame bursts missed.</li>',
  '<li>The <b>Smoke Dash</b> cloud (rogue) never ticked on them.</li>',
  '</ul>',
  '<p>The same happened to ordinary monsters that are much taller than you &mdash; nearly half of all monster types for Dimensional Warp. Each skill checked whether one point of the enemy (its middle or the top of its head) was near the same point on you, which only works for enemies about your size.</p>',
  '<p><b>Now</b> each skill checks whether any part of the enemy&rsquo;s body is inside its strike zone. Tall monsters and bosses on your floor are hit like everything else. Enemies about your size are hit exactly as before, and a monster on a platform above or below you is still out of reach.</p>',
  '<p><b>Verified.</b> <code>scripts/dash_hitbox_test.mjs</code> &mdash; each skill cast at rank 10 at all three bosses and at a Shroom, at two distances, plus a Shroom on a platform above you. On the build before this fix the 12 boss checks fail: Flurry and Warp 0 hits, Rush 1 of 6, the cloud 0 of 3. With the fix each boss takes as many hits as the Shroom (Flurry 2, Warp 1, Rush 6, Smoke Dash 1 + 3 cloud ticks), and the Shroom above you is never hit.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
