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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Sharp Display: a Graphics switch for crisp text and edges on phones and high-resolution screens</span></h2>',
  '<p><b>What you saw.</b> On a phone the game screen looked soft: names, damage numbers and every edge drawn on it were a little blurry. That was on purpose, to save the phone&rsquo;s graphics chip and battery: the game drew its picture at a fixed small size and the phone stretched it about twice over to fill the screen. High-resolution desktop screens were stretched a little too.</p>',
  '<p><b>What happens now.</b> <b>Settings &rsaquo; Graphics &rsaquo; Sharp Display (uses more battery)</b> draws the game at your screen&rsquo;s own sharpness, up to twice the detail of before on a phone. It is <b>off by default</b>, so nothing changes for anyone who leaves it alone: phones keep their battery-friendly picture and desktops keep what they had. Turn it on if you want the crisp look and your device keeps up; turn it off again if the game stutters or the phone runs warm. It is remembered like your other graphics settings, and Reset Defaults turns it off.</p>',
  '<p>Nothing else moves: the camera, where monsters stand, where you tap or click to talk to someone, the touch buttons and the on-screen panels line up exactly as before, and a photo-mode screenshot is saved at the sharper size.</p>',
  '<p><b>Verified</b> on a landscape phone screen and on a 1280&times;720 high-resolution window, through the real switch: off, the picture is drawn at exactly the size it was before; on, it has at least one and a half times the detail per screen point (twice, in both tests); a monster in a frozen frame sits on the same spot on screen at both settings; tapping or clicking a townsperson opens them, and the phone&rsquo;s Jump button jumps; the photo-mode picture is the full sharp frame; the setting survives a reload; and switching it off again restores the old picture exactly. The old build has no switch, so the sharpness and reload checks fail there.</p>',
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
