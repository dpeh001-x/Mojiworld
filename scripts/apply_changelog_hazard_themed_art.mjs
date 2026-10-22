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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Falling bones, skulls and embers instead of fireballs</span></h2>',
  '<p>Per user: <i>Give them matching art</i>, then <i>change the marker at the bottom for the bones</i>, <i>change the curved ribs to a cute skull</i> and <i>reduce the 3d effects and angles</i> of the warning signs.</p>',
  '<p><b>What you saw.</b> Several maps drop something from the sky every few seconds, and every one of them fell as the same big molten fireball on the same fiery warning rune, whatever it was meant to be. Bone graveyards rained fireballs, and so did the Hollow Sepulchre&rsquo;s falling rib-bones, the Ossuary Sprawl&rsquo;s bone avalanches and the Wayfarer&rsquo;s Gate ember showers.</p>',
  '<p><b>What happens now.</b> Each one falls as its own thing:</p>',
  '<ul>',
  '<li><b>Bone Graveyard 1-3</b>: a cute little skull, wobbling as it falls.</li>',
  '<li><b>Hollow Sepulchre</b>: a long bone, rocking as it falls.</li>',
  '<li><b>Ossuary Sprawl</b>: a skull-and-crossbones chunk with loose bones tumbling round it.</li>',
  '<li><b>Wayfarer&rsquo;s Lantern (second map)</b>: a small cluster of glowing embers.</li>',
  '</ul>',
  '<p>The bones land in a puff of bone dust instead of a fire blast. On the bone maps the ground warning is now a flat bone rune with a skull and a crimson danger rim instead of the fiery one. It sits in exactly the same place, at the same width, and pulses on the same timing. The embers keep the fiery rune.</p>',
  '<p><b>Nothing else changed.</b> Each drop warns for just as long, hits the same spot for the same damage and makes the same sounds as before. Lava Cavern and the forge maps still rain molten fireballs on the fiery rune, and co-op partners see the same art as the host.</p>',
  '<p><b>Verified.</b> A browser test forces one drop on each of these maps and records what is drawn: the themed picture and the bone rune, never the fireball. It also checks that the bones land in bone dust, and that standing in the drop deals exactly the damage the plain fireball deals, with the same warning time and sounds. Lava Cavern and Magma Foundry still draw the fireball and the fiery rune. On the build before, every one of these maps drew the fireball.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
if (s.includes('@@')) { console.error('ABORT: placeholder left in'); process.exit(1); }
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
