import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Singularity Collapse: the safe zone protects the column above it, and the landing is counted down</span></h2>',
  '<p>Per user: <em>&ldquo;the gravity collapse attack by sovereign and gravitos is not working properly, i get hit even if i am in the safe zone even before the animation ends&rdquo;.</em></p>',
  '<p><b>Ruled out first</b>, each in the code: a second damage path (the arena-wide hazard carries atk 99999 but no generic contact branch touches it &mdash; the resolve at life&nbsp;0 is its only damage site); a lingering hazard (the resolver splices it at once); a life/maxLife desync (330/330, 84/84, 300/300 at every push); arena geometry drift (Gravitos&rsquo;s floor is 480 and its centre platform 260, exactly the hard-coded values; B10&rsquo;s central platform is built at GY&nbsp;&minus;&nbsp;160 as assumed).</p>',
  '<p><b>What remained produces both symptoms.</b> A zone is a 70&ndash;75&nbsp;px floor-band rectangle and the resolve tests your box against it &mdash; in Gravitos&rsquo;s phase&nbsp;3, your <em>centre</em>. Jump inside the light at the wrong instant and your box leaves the rect: dead &ldquo;in the safe zone&rdquo;, and the new ring art reads as a floor pool, which makes hovering over it feel like being in it. And nothing marked the landing: the converging rings stopped at a 40&nbsp;px radius instead of closing, and the ring art breathes on an endless loop, so a correct resolve read as early.</p>',
  '<p><b>The fix.</b> A zone now protects the <em>column</em> above it: horizontal overlap as before (centre-x when strict), plus your feet within a jump&rsquo;s height (150&nbsp;px) above its floor line &mdash; bounded, so a platform zone and a ground zone (160&ndash;220&nbsp;px apart) stay distinct. Every telegraph frame stamps the last moment you counted as inside, and the resolve forgives a stamp within 10 frames (167&nbsp;ms), so hit-stop or a knockback nudge on the final frame no longer kills a player who was standing in the light. The rings now close at the resolve, the last three seconds count down <b>3&nbsp;&middot;&nbsp;2&nbsp;&middot;&nbsp;1</b> at the core, and the final half-second whites out &mdash; all derived from the same <code>life</code> counter the resolve fires on, so the cue cannot drift from the hit. Cadence, telegraph length, zone size, damage and parry are untouched.</p>',
  '<p><code>scripts/singularity_safezone_test.mjs</code> &mdash; 7 checks that push a real collapse hazard and force its resolve: standing in the zone survives (control); airborne 110&nbsp;px over it survives; knocked out 5 frames before the resolve survives; 300&nbsp;px away is hit (control &mdash; the check still kills); 220&nbsp;px above it is hit (control &mdash; the slack is bounded); phase&nbsp;3 strict, airborne with centre inside, survives; and the draw path paints a countdown digit with 120 frames left. On the unpatched build four of seven fail.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1800 || grew > 6500) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
