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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Arbiter&rsquo;s big swing comes off his sword, and hits only where it is drawn</span></h2>',
  '<p>Per user: <i>&ldquo;for this swing on the left, it should be positioned closer to the arbiter instead of being so far out&rdquo;</i>, then, shown the fix: shorten his reach to match. When the Arbiter wound up his heavy overhead swing, its purple crescent (the faint warning, the white starburst and the strike itself) appeared high up and well out in front of him, with a clear gap between it and his body and blade. It looked like a separate attack rather than his own sword stroke. This happened on both sides, whichever way he faced.</p>',
  '<p>Now the crescent starts right at his armour and sweeps down and out from there, so the starburst flashes beside his raised sword and the stroke lands on the floor in front of him. Facing left and facing right look like mirror images of each other. The crescent is the same size and shape as before.</p>',
  '<p><b>His reach is shorter, to match his swing art</b> (per user). His swing used to hit well past the end of the crescent, so you could be struck while standing clear of anything drawn. Now it reaches exactly as far as the crescent lands, about 30% shorter than before: stand past its tip and the swing misses you. It hits just as hard, sets off at the same distance, keeps the same windup and can still deliver its verdict. The warning drawn during the windup has shrunk to the new reach. No other boss&rsquo;s swing has moved.</p>',
  '<p><b>Verified.</b> A browser test fights the Arbiter in his arena and makes him swing facing each way. At the moment of the strike it measures the space between the front of his drawn armour and the nearest edge of the crescent: it was 60 to 125 pixels before, depending on his pose, and now there is none: the crescent begins against his sword arm and shoulder. The faint windup warning lines up with him too. It also checks that his hit area now ends within a few pixels of the crescent&rsquo;s tip, that a hero standing inside the crescent is still hit while one standing just past its tip is not, and that three other bosses (the Sundered Smith, Barnaby and Capricorn) draw their swings exactly where they did before.</p>',
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
