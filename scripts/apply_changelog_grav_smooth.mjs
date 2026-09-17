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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">perf</span> Boss fights, smoother: the recurring stalls of a Gravitos fight, and the draw that dominated it</span></h2>',
  '<p>Per user: <em>&ldquo;work on reducing the lags for boss fights even more such as gravitos, it needs to run ultrasmooth&rdquo;</em>.</p>',
  '<p><b>Measured first</b> (<code>scripts/_grav_phases.mjs</code>, <code>scripts/_grav_lever.mjs</code>): a full three-form fight with the boss kept on screen, every draw function timed, every slow canvas call attributed to the image it drew, and each suspect turned off in turn to see what the frame gave back. Six findings, in order of cost:</p>',
  '<ol>',
  '<li><b>Damage numbers were the biggest render cost of the fight.</b> With ~10 alive, turning them off took the frame from 12.5&nbsp;ms to 4.4&nbsp;ms. Not the settled ones &mdash; those blit a bitmap &mdash; but the <em>live</em> ones: a number renders 5&ndash;8 passes of thick text for its 12-frame pop, and did so <em>again</em> for its whole 6&ndash;14 frame fade, because the bitmap gate refused any scale outside the idle bob&rsquo;s band and the fade shrinks to 0.7. Nearly half of every number&rsquo;s life was the expensive path. <b>The fade now blits the bitmap it already holds</b>, under the same shrink and alpha &mdash; the same picture, one draw. The pop stays live (the crisp overshoot is the point of it), and a B/G sticker&rsquo;s outward dissolve stays live too (a bitmap that far up would soften).</li>',
  '<li><b>A boss frame drawn raw.</b> At a form change, and at the first cast of each new set (laser, punch, soul), the stand-in held the first <em>raw</em> 1656&nbsp;px frame until its off-thread bake landed &mdash; and that raw draw was pinned (a 1656&times;1214 canvas mint), plain-baked and feathered on the spot: <b>96&ndash;180&nbsp;ms in one frame, four times a form</b>. The stand-in now holds the boss&rsquo;s <b>last drawn canvas</b> until a baked frame exists, a frame waiting for its bake is never pinned, and the next form&rsquo;s sets start baking at the flip itself rather than at their first draw.</li>',
  '<li><b>The first cast of each pattern</b> decoded and pinned its 768&nbsp;px ring art on the frame it was cast (laser 22&nbsp;ms, soul 36&nbsp;ms, slam 22&nbsp;ms). Gravitos&rsquo;s five rings now decode off-thread and pin at spawn through the prewarm drain, the way a mob&rsquo;s swing art already does &mdash; and the drain&rsquo;s pin job decodes <em>before</em> it pins for every image, since a pin is a drawImage and on an undecoded webp that is the synchronous decode the queue exists to keep off the frame.</li>',
  '<li><b>The session&rsquo;s first damage number</b> paid 18&ndash;50&nbsp;ms of font instantiation inside its fillText, mid-fight. The combat fonts are touched once, offscreen, on the first simulated frame.</li>',
  '<li><b>A burst of particles in new colours</b> (a form change spawns 40) minted 40 glow stamps in one frame, 29&nbsp;ms. Stamp mints now spend the frame&rsquo;s existing mint budget; an over-budget particle draws its cheap square for a frame and gets its stamp on the next.</li>',
  '<li><b>The boss title&rsquo;s stats-card clearance</b> forced a DOM layout from inside the draw every 500&nbsp;ms. Every 3&nbsp;s now; a resize resets it.</li>',
  '</ol>',
  '<p><b>Two things that looked like stalls and were not.</b> Six 50&ndash;90&nbsp;ms foot-anchor probes on the punch frames turned out to be the <em>harness</em> serving a stale <code>data/sprite_bbox.js</code> from the working copy; the deployed table is current and the game never probes. And the 16&ndash;43&nbsp;ms video draws are the arena&rsquo;s backdrop clip delivering new frames; drawing it through a cached canvas instead measured 21% <em>slower</em>, so it stays as it is.</p>',
  '<p><b>Verified.</b> <code>scripts/grav_smooth_test.mjs</code> &mdash; 9 checks in a live game: a fading number draws one bitmap and no text (a popping one still draws live text); the stand-in returns the last canvas and, without one, the old raw hold; a frame flagged as baking is not pinned; all five rings queue, decode and pin; the fonts are warm; 30 fresh particles over budget mint nothing and still draw, under budget they mint; three clearance calls in a second read the DOM once; and end to end across forms 1&nbsp;&rarr;&nbsp;3 with the boss on screen, <b>no full-size boss frame is pinned or plain-baked on the main thread</b>. Against the previous build the same run fails seven of the nine, and records a 1656&times;1214 pin and a 1656&times;1445 plain bake at the form changes.</p>',
  '<p>Absolute frame rates are not quoted: another session was running its own headless browser on this machine during the measurements, and the throughput numbers moved by 3&times; between runs. The stall attributions above are per-call and unaffected; the fps levers were read only where the gain was far beyond that noise.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 12000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
