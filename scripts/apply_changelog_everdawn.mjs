import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Everdawn Central: one backdrop, never mirrored, and a slower, smoother sky</span></h2>',
  '<p>Per user (with a screenshot of the sakura tree meeting its own reflection): <em>&ldquo;For everdawn central I see that you are trying to extend the map by reflecting it, please do not reflect, I can generate a longer image if required. Also slow and smoothen the background video animation&rdquo;.</em></p>',
  '<p><b>Why it mirrored.</b> Every map&rsquo;s backdrop is painted stretched to the 960&times;560 screen and panned at 0.12&times; the camera. Everdawn Central is 2800 wide, so the backdrop has to slide 221&nbsp;px, and since v0.25.86 the exposed strip was covered by a horizontally flipped second copy &mdash; right edge meets right edge, so there is no visible cut, but the whole east half is the west half in a mirror. <b>Now:</b> a map flagged <code>bgNoMirror</code> paints <em>one</em> copy at its source&rsquo;s own aspect, scaled so its width covers the whole pan and anchored to the ground line, with the overscan cropped from the sky. The current plate (2912&times;1632) and clip (832&times;464) are both 1.78:1, so they take a &times;1.18 zoom and lose about 100&nbsp;px of canopy at the top. <b>An asset of 2.11:1 or wider paints at full height with no crop at all:</b> for the plate anything at least 3456&times;1632 (same height as today), for the clip at least 1184&times;560 &mdash; 1280&times;608 is a comfortable h264 size. Drop them in under the same names and the zoom goes to 1 by itself. Every other map keeps its seam copy exactly as before.</p>',
  '<p><b>The sky clip.</b> <code>everdawn.mp4</code> is 24&nbsp;fps and 5&nbsp;s, and played at 1&times; with a hard loop. It now plays at 0.55&times; (a 9&nbsp;s loop); each new frame is blended into an offscreen mix over about three screen ticks instead of stepping in, which is what keeps a slowed 24&nbsp;fps clip from showing 13&nbsp;fps stutter; and the loop no longer cuts: a second element starts from the top while the first plays its last 0.75&nbsp;s, the two cross-fade, and they swap roles. The shaping is a per-clip table; the Singularity&rsquo;s clips are not in it and play as before.</p>',
  '<p><code>scripts/everdawn_backdrop_test.mjs</code> &mdash; 7 checks: no full-width backdrop draw under a mirrored transform at the west or the east end of the town (baseline: one every frame); the copy still spans the whole screen at both ends; it slides the full 221&nbsp;px between them; the clip runs at 0.55&times;; the backdrop paints the mix canvas rather than the raw element; over a full lap the twin starts inside the last 0.75&nbsp;s and takes over, and the clip element never restarts from 0 itself; and the forest, unflagged, still paints its mirrored copy.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
