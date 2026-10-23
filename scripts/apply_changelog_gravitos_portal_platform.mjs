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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Singularity&rsquo;s exit door keeps its platform in Gravitos&rsquo;s second and final forms</span></h2>',
  '<p>Per user: <em>&ldquo;ensure that the platform on the portal does not disappear in form 2 and 3 as players might exit midway&rdquo;</em>.</p>',
  '<ul>',
  '<li><b>What you saw.</b> The arena&rsquo;s only door, the one back to the Weight-Bearer&rsquo;s Stair, stands on the high ledge on the left. When Gravitos changed into his second form, the arena collapse knocked that ledge down with the others. For the rest of the fight the door floated high above the floor with nothing to stand on, so you could not reach it and could not leave. Since the last update, every Echo Keeper, Nightmare and Duo Trial echo also goes through all three forms, so those fights had the same problem.</li>',
  '<li><b>Now.</b> The ledge under the door never collapses. It stays in the same place in every form, with the same size, the same gentle sway and the same look, and you can still stand on it. The floor vent on the left still throws you up onto it. At the door, Up asks &ldquo;Leave the fight?&rdquo; in every form, as it does in the first, and &ldquo;Leave anyway&rdquo; takes you through.</li>',
  '<li><b>The arena still falls.</b> In the second form the high ledge on the right still cracks and drops, and in the final form the two middle ledges and their vents still go, with the same cracks, shaking, falling debris and warning. The Singularity and Collapse Rain safe zones did not use that ledge, so they work as before.</li>',
  '<li><b>Boss Rush.</b> The Hall of Echoes has no ledges and its door stands on the floor, so nothing changes there.</li>',
  '</ul>',
  '<p><b>Verified.</b> The story fight and an Echo Keeper echo, each played through all three forms. In every form the test checks that the ledge is there and solid in the same place, that the vent lands you on it and you can stand on it, and that the door asks before you leave. Before the fix, the ledge was gone in forms 2 and 3 of both fights, and so was the way out. The two older arena-collapse tests now expect the door&rsquo;s ledge to stay.</p>',
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
