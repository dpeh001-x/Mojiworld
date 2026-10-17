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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Gravitos’s third form in high definition</span></h2>',
  '<p><b>What you saw:</b> Gravitos’s third form looked soft and blocky next to his first two forms. His third-form animations were made from video frames, enlarged and saved with visible square compression blocks, and the game shows that form at close to full size, so nothing hid it.</p>',
  '<ul>',
  '<li><b>Sharper art.</b> All 69 third-form frames (idle, walk, slam, fire beam, punch, soul drain and the supernova) were redrawn: the compression blocks were smoothed out, each frame was upscaled to 4K by an AI upscaler, shrunk back once to its own size and lightly sharpened. His face, armour lines and ember veins are now crisp instead of smeared. The upscaler draws each frame on its own, so a little detail on his face can change slightly from frame to frame.</li>',
  '<li><b>One body, on the floor.</b> His third form is also realigned: the slam, fire beam, punch and soul drain start exactly where his idle stands and at its size, his feet stand a little deeper so both heels meet the floor, and the supernova is now drawn at his normal size instead of 25% larger. Its hit area was scaled with it, so it covers exactly the same space as before.</li>',
  '<li><b>Same outline.</b> Every frame keeps the outline of that alignment pixel for pixel, so his footing, size and reach stay exactly where they were tuned; only the inside of each frame is sharper.</li>',
  '</ul>',
  '<p><b>Not changed:</b> his timing, attacks and hit areas (checked on every frame, facing both ways: the same to within a pixel). The download grows by about 14% for this form (13.7 MB to 15.7 MB).</p>',
  '<p><b>Verified.</b> The frames, outlines and calibration are checked file by file; in the game his hit areas were compared frame by frame against the previous version; the existing Gravitos tests pass (one body across his sets, feet on the floor, the supernova playing all nine frames and handing back to idle), with the floor and supernova expectations moved to the approved stance.</p>',
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
