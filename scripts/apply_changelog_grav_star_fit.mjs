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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos&rsquo;s Supernova now plays all the way through in forms 2 and 3</span></h2>',
  '<ul>',
  '<li><b>What you saw.</b> When the Singularity Collapse went off, Gravitos dropped back to standing before his Supernova animation had finished. In form 2 his chest blast only flickered, and the fading lightning and the calm pose after it never showed. In form 3 he went straight from the growing pink sphere to standing: the sphere bursting, the shards flying out and the calm pose after them never showed.</li>',
  '<li><b>What happens now.</b> The animation is timed to end exactly as the collapse goes off. The blast and everything after it play at their normal speed in the last moments before the collapse (about a third of a second in form 2, about two thirds of a second in form 3). The earlier frames fill the rest of the warning, as before. He reaches his calm last pose just as the collapse hits, then goes back to standing, with no jump in his position.</li>',
  '<li><b>Nothing else changes.</b> The collapse itself is untouched: same 5.5-second warning, same safe zones, same damage, same timing and cooldown, and the same reach for his body. The fix only changes which drawing is shown.</li>',
  '</ul>',
  '<p><b>Verified.</b> In real fights against his own attack patterns, the Supernova was cast in form 2 and form 3, facing both ways, at full, half and low health. All nine drawings now show, in order. He goes back to standing from his last drawing, his feet stay on the same floor line and his body stays put. The collapse lasts exactly as long as before, with the same safe zones and cooldown. The ghost-frame blend and the footing fix from the last two updates still work. Before this fix, form 2 stopped at drawing 7 of 9 and form 3 at drawing 4 of 9. No page errors.</p>',
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
