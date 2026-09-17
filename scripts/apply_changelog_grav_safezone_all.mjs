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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos: a safe zone you can always find, in every form</span></h2>',
  '<p>Per user, with a video of a form-3 death: <em>&ldquo;work on gravitos safe zones, as you can see for form 3 there are no safe zones, ensure that there are safe zones in all forms to avoid OHKO&rdquo;</em>.</p>',
  '<p><b>What the video shows.</b> Form 3 at 49%: <em>COLLAPSE RAIN INCOMING</em>, the rain starts, and the player is COLLAPSED by the second box ~3.5&nbsp;s later without a rift ever appearing. Forced in a harness (<code>scripts/_grav_rain_probe.mjs</code>), the form-3 rain <em>does</em> spawn its box 106&nbsp;px from the player, on screen, and draws it. So the zones exist in every form &mdash; this player could not see the one they got. Four ways a zone could be invisible or unreachable, all closed:</p>',
  '<ol>',
  '<li><b>A box under the HUD.</b> Probed with <code>elementFromPoint</code> at the tester&rsquo;s 1630&times;944: the minimap panel sits over screen x&nbsp;736&ndash;944 of 960 along the floor, the hotkey hint over 821&ndash;944 of the floor band&rsquo;s top. The rain rolled its box anywhere across the visible floor, so one box in five landed behind the minimap &mdash; drawn, and hidden. <b>The box is now rolled only where the floor is actually visible</b>: the panel-covered spans of the band are read off the live DOM at spawn (whole element stack, three heights, cached 3&nbsp;s) and cut from the roll. And when no visible floor is within reach &mdash; the player standing under the minimap &mdash; the box lands at their feet and <b>the panels over it fade to 12% while the zone lives</b>, restored the frame after it resolves.</li>',
  '<li><b>Form 3 ran the rain at 2.1&times;.</b> The 4&nbsp;s gap between boxes was measured in <code>patternTimer</code>, which forms 2/3 scale (1.56&times; / 2.12&times;, measured), so form 3&rsquo;s boxes came <b>1.9&nbsp;s apart while each lived 1.4&nbsp;s of real time</b>: no beat to read the next one. The gap is wall-clock now, 4&nbsp;s in every form, and the pattern ends when the last box has resolved rather than on the scaled timer.</li>',
  '<li><b>Nothing pointed at the box.</b> A 102&times;60 rift on a 960&nbsp;px floor, under the collapse veil, behind lasers and bursts, for 1.4&nbsp;s. Every live safe zone now carries a <b>beacon</b>, drawn in a late pass after the art post-FX so nothing in the scene washes it out: a pillar of light rising from the rect (exactly the column the zone protects, so every lit pixel is a safe pixel), a ring that expands from it on spawn, a timer ring that closes on it as the resolve nears (white in the last second), and a chevron at the screen edge with the distance for a zone that is off screen. The ground marker itself is unchanged and still paints nothing past the rect.</li>',
  '<li><b>No art, no zone.</b> If the rift art had not decoded, the fallback was a pale wash at 0.30 alpha under a 0.22&ndash;0.68 veil. The rift and shield art now warm with the rest of the boss&rsquo;s art at spawn, and the fallback is a gold fill and rim that reads on its own &mdash; still inside the rect.</li>',
  '</ol>',
  '<p><b>Verified.</b> <code>scripts/grav_safezone_all_test.mjs</code> &mdash; 15 checks in a live game at 1630&times;944: 39 boxes rolled with the player at every screen position, none with a visible panel over any corner or its centre, all on screen; the pillar stands over the rect, rect-wide and 150 tall, and spills nothing beside it; an off-screen zone gets its edge chevron and label; with the art gone the zone still paints its gold fill and rim inside the rect; the minimap fades to 0.12 while a zone lives and returns after; and a real form-3 rain drops its four boxes <b>4.0&nbsp;s apart on the wall clock</b> (previous build: 1.9&nbsp;s) and ends 1.5&nbsp;s after the last resolves. The existing <code>singularity_safezone_test.mjs</code> (7 resolve cases) still passes; <code>gravitos_safezone_draw_test.mjs</code> reports the same two pre-existing &ldquo;a fill covers the rect&rdquo; misses on the previous build (the rift is a blit now, not a fill).</p>',
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
