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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Gravitos’s third form keeps a steady face</span></h2>',
  '<p><b>What you saw:</b> since the high-definition redraw of Gravitos’s third form, his face shimmered while he stood still. The upscaler used for that redraw drew each frame on its own, so small details such as the lines of his mouth and nose changed shape from one frame to the next.</p>',
  '<ul>',
  '<li><b>Redrawn with a steadier upscaler.</b> All 69 third-form frames (idle, walk, slam, fire beam, punch, soul drain and the supernova) were made again from the same original frames with a different AI upscaler that follows the original shapes instead of inventing new ones. Everything else is done exactly as before: the compression blocks are smoothed out, each frame is shrunk back once to its own size and lightly sharpened. Between idle frames his face now changes about a quarter to a third less than in the previous redraw, while staying about as sharp.</li>',
  '<li><b>Cleaner shadows and flame edges.</b> The new upscaler tended to turn the darkest shadows pure black and to draw a dark rim along flame edges. Each frame’s shadows are kept no darker than the original’s, and the rim just inside his outline was lightened.</li>',
  '<li><b>Same outline, same place.</b> Every frame keeps the previous version’s outline pixel for pixel and sits in exactly the same place, so his footing, size, reach and hit areas do not move.</li>',
  '</ul>',
  '<p><b>Not changed:</b> his timing, attacks, alignment and hit areas. The download for this form shrinks by about 12% (15.7 MB to 13.8 MB).</p>',
  '<p><b>Verified.</b> All 69 frames were checked file by file, and every frame’s outline matches the previous version exactly. His calibration and hit areas were compared with the live game. The existing Gravitos tests still pass, including the high-definition checks, one body across all his sets, feet on the floor, and the supernova playing all nine frames.</p>',
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
