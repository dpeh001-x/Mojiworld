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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos&rsquo;s Singularity is strictly spaced, and his lock can no longer trap you in a one-shot</span></h2>',
  '<p>Per user: <em>&ldquo;Gravitos at all forms does OHKO singularity attack way too quickly, there needs to be strict spacing, also need to strictly space with celestial lock if not players are unable to escape&rdquo;</em>, then <em>&ldquo;minimum 30s at the last form, longer for the earlier forms&rdquo;</em>.</p>',
  '<ul>',
  '<li><b>What you saw.</b> The Singularity Collapse could come back as little as 34 seconds after the last one (42 in his first form), and a new form could open with one only 7&ndash;15 seconds in. Worse, Gravitos&rsquo;s lock (the arrow-key Gravity Bind) ran on its own timer: it could catch you during the Singularity warning, inside its 5.5-second countdown, or between Collapse Rain boxes. Locked for 3.6 seconds or more, you often could not reach a safe zone at all.</li>',
  '<li><b>A strict gap between Singularities.</b> At least <b>50 seconds</b> in his first form, <b>40</b> in the second and <b>30</b> in the final form, counted in real fight time from the last one. Changing form, losing health or any other timer cannot shorten it, and no Singularity comes in the first 20 seconds of the fight or of a new form.</li>',
  '<li><b>The lock keeps clear of every one-shot.</b> It never lands during a one-shot&rsquo;s warning or while its field is up, nor just after one ends, nor shortly before one is due. A lock already flying when a one-shot starts fizzles. After a lock ends, no one-shot is announced for 4.7 seconds: time for the slowest hero to walk from the farthest spot in the arena to the nearest safe zone, with a second to react.</li>',
  '<li><b>Still a hard fight.</b> His other attacks fill the gaps as before. Damage, safe zones, warnings and the attacks themselves are unchanged. In co-op the host sets all of this timing for everyone, and a lock aimed at a partner counts the same way.</li>',
  '</ul>',
  '<p><b>Verified.</b> Real fights against his own attacks through all three forms, with the hero standing where a lock can catch them. Before the fix, locks landed inside one-shots in every form and Singularities came early after a fight or form start. Now every gap holds, every lock ends well before the next one-shot, and a safe zone is always within reach. The Supernova timing from v0.30.1827 and the other Gravitos tests still pass.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
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
