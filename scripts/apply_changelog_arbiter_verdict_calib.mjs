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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The Tower Arbiter keeps his footing when he raises his burning verdict</span></h2>',
  '<p>When the Tower Arbiter went from standing guard into his burning-verdict pose &mdash; greatsword held point-down at his feet, fire running down the blade &mdash; his whole body jumped about a boot-length backwards, and slid forward again the moment he stood back up. His walk had the same problem on a smaller scale: his first step started a little ahead of where he had been standing.</p>',
  '<p>Now his boots stay exactly where they are. The verdict pose and his walk stand in the same footprints as his idle stance (within about a pixel), whichever way he is facing, so he no longer slides or hops when he changes pose. His size, his height, the timing of every pose and the areas his attacks hit are unchanged. His swing, his pillar strike and the brace before his lunge already stood in those footprints and are untouched.</p>',
  '<p><b>Verified.</b> His boot soles were measured on screen in the game, facing left and facing right, on every frame of every pose; a browser test now checks that every verdict frame and his walk land on the idle&rsquo;s footprints (within 3 pixels) on the same floor line, that his other poses still do, that nothing else in his calibration changed, and that all of the Arbiter&rsquo;s existing tests still pass.</p>',
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
