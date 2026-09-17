import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos: the gap between one-hit-KOs is strict &mdash; hit-stop, a slow phone and a pause can no longer spend it, and form 3 rests 5 s between rain boxes</span></h2>',
  '<p>Per user: <em>&ldquo;for the 3rd form ensure strict time gap of the OHKO, it is still casting back to back&rdquo;</em>.</p>',
  '<p><b>Measured first.</b> Three live form-3 fights, 14 minutes, every warning, cast, lethal field and end logged on both clocks (<code>scripts/_grav_ohko_census.mjs</code>): separate OHKO <em>moves</em> were never closer than 25&nbsp;s after the last one ended. What casts back to back is <b>Collapse Rain</b> &mdash; four boxes, each a full-screen lethal field with its own veil, countdown and kill &mdash; and the clock between its boxes was the leaky one. v0.30.796 spaced them 4&nbsp;s apart on the <em>wall</em> clock, spawn to spawn, but a box <em>lives</em> on the world&rsquo;s clock (84 world frames), and three things stop the world while the wall clock runs:</p>',
  '<ul>',
  '<li><b>Hit-stop.</b> With a player landing hits, a 1.4&nbsp;s box measured 2.2&ndash;2.7&nbsp;s and the rest after it shrank to <b>1.4&ndash;1.8&nbsp;s</b> (42&ndash;56 world frames of a nominal 156).</li>',
  '<li><b>A slow device.</b> A phone simulating 25 frames a second stretches the same box to 3.4&nbsp;s: 0.6&nbsp;s of rest. At 20 a second the next box spawns <em>before</em> the last has resolved.</li>',
  '<li><b>A solo pause.</b> Back from a 5&nbsp;s menu, the next box landed on top of the one still counting down: <b>two lethal fields at once</b>, with different shelters, which nobody survives (measured: the second box 0.87&nbsp;s before the first resolved).</li>',
  '</ul>',
  '<p>Between moves, the window ran from the <em>cast</em>, so a long field ate it (a rain is 13&ndash;21&nbsp;s of a 25&ndash;28&nbsp;s window); a warning could open with a lethal field still on screen (an HP-tier change resets the pattern and leaves its field live); and <code>game.time</code> &mdash; the window&rsquo;s clock &mdash; runs on through a solo pause, so a 10&nbsp;s menu spent 10&nbsp;s of the gap and the next OHKO greeted the player on the way out (the same fault v0.30.633 fixed for the potion seal).</p>',
  '<p><b>Now.</b> (1) A rain box never spawns while another lethal field is live, and then only after a <b>rest counted in frames the boss AI actually ran</b> &mdash; hit-stop, lag and a pause cannot spend it: 2.6&nbsp;s in forms 1&ndash;2 (the old nominal rest, now guaranteed) and <b>5&nbsp;s in form 3</b>, so form-3 boxes come 6.5&nbsp;s apart instead of 4 (measured 6.52&nbsp;/&nbsp;6.54&nbsp;/&nbsp;6.52&nbsp;s). The 4&nbsp;s wall-clock floor stays underneath. (2) <b>Form 3: the OHKO-to-OHKO window runs from the moment the last OHKO <em>ended</em></b>, not from its cast &mdash; 28&ndash;58&nbsp;s of clear air at the last HP tier, whatever the move was. A lethal field still on screen counts as the OHKO still running, in every form. (3) In a solo pause the OHKO stamps move with the clock, as the warning window already did. Forms 1&ndash;2 keep the cast-based window they were tuned on; the warning lengths, the moves and their rotation are untouched.</p>',
  '<p><b>Verified.</b> <code>scripts/grav_ohko_gap_test.mjs</code> &mdash; 16 checks driving the real boss AI, rests counted in world frames and on the wall clock: form 1 keeps its cast-based window and its 4&nbsp;s rain rhythm; in form 3 a window 40&nbsp;s past the cast but 10&nbsp;s past the end does not warn, and 29&nbsp;s past the end does; no warning under a live field; a 10&nbsp;s menu does not spend the window; paused mid-box, no box spawns during the pause, never two fields at once, and the next box still waits out its rest; under hit-stop every rest is 300 world frames and never under 5&nbsp;s of real time. <b>The same test fails 8 of 16 on the previous build.</b> Three older tests that v0.30.796&rsquo;s clock change had silently broken are repaired (it had not run them): <code>gravitos_rain_reach_test</code> 4/6&nbsp;&rarr;&nbsp;6/6 (&ldquo;23 missing&rdquo; boxes), <code>collapse_safezone_test</code> 11/13&nbsp;&rarr;&nbsp;13/13, and <code>gravitos_ohko_warn_test</code> gets one frame of sampling slack (it read 119&nbsp;/&nbsp;209 for 120&nbsp;/&nbsp;210 on both builds). <code>grav_safezone_all_test</code> 15/15 with the new form-3 rhythm.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 14000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
