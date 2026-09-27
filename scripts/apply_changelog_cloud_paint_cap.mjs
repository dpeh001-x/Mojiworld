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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A painted hero&rsquo;s progress reaches the cloud again</span></h2>',
  '<p>While fixing the save hitch for painted heroes, we found a bigger problem. Your online account&rsquo;s cloud save only accepts saves up to 512&nbsp;KB, and a Wardrobe painting is 1 to 3&nbsp;MB. So if you had painted your hero, <b>every cloud save was refused, silently</b>: none of your progress reached the cloud, and another device could not pick it up.</p>',
  '<ul>',
  '<li><b>When your painting is too big for the cloud, the cloud save now goes without it.</b> Your progress syncs as normal, and the painting stays on this device. A message tells you once per session: &ldquo;Your wardrobe paint is too big for cloud sync &mdash; it stays on this device; progress still syncs.&rdquo;</li>',
  '<li><b>Loading that cloud save keeps your painting.</b> On a device that already has your painting, it stays. A new device gets your progress, unpainted.</li>',
  '<li>Small paintings that fit still travel with the cloud save, as before.</li>',
  '<li>If the cloud ever refuses a save as too big anyway, the game tries once more without the painting.</li>',
  '<li>Steam Cloud has no such limit and still carries your painting.</li>',
  '</ul>',
  '<p><b>Verified.</b> <code>scripts/cloud_paint_cap_test.mjs</code> &mdash; 8 checks against a stand-in cloud that refuses big saves the same way the real one does. A hero painted with about 0.9&nbsp;MB of layers saves to it without the painting and is accepted with its progress. The message shows once, and a second save does not repeat it. A stricter cloud that refuses the save gets exactly one retry without the painting, which lands. A small painting still goes along. Loading the cloud save back keeps this device&rsquo;s painting and brings the cloud&rsquo;s progress. A fresh device gets the progress with no painting. There are no page errors. 5 of the checks fail on the build before this fix, where the painted save was refused every time.</p>',
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
