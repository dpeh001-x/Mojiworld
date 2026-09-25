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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The MojiMon tab&rsquo;s top cards, made cute: How to Bind stepping-stones and a buddy ring</span></h2>',
  '<p>Per user, on the &ldquo;&#9939; MOJIMON&rdquo; rules card and the &ldquo;Summon cooldown&rdquo; card: <em>&ldquo;These buttons and fonts can be stylised, polished to be more artistic and appealing&rdquo;</em>, and on the first sample: <em>&ldquo;Can be further improved and made cuter&rdquo;</em>.</p>',
  '<p><b>How to Bind.</b> The paragraph of rules is now three pastel stepping-stones with paw prints walking between them, each with an icon bubble and a number badge: <b>&#127919; Master</b> (<b>10,000</b>, big and gold &mdash; kills of one species), <b>&#129668; Bind</b> (<b>Get close</b> to a wild one, then complete the binding sequence) and <b>&#129309; Team up</b>, with a pink pill <b>15&times; your max HP</b> and a gold pill <b>50% of your ATK</b> &mdash; the same numbers, read from the same constants. The header above already says MOJIMON, so the card is named after what it explains.</p>',
  '<p><b>The buddy ring.</b> The summon clock is a ring round your <kbd>H</kbd>-slot MojiMon&rsquo;s own sprite (the MojiMon logo until you have one), with a little <kbd>H</kbd> keycap on it. It is mint and pinging when <b>READY</b> (&ldquo;Slippy is ready to play!&rdquo;), and peach and filling back up while it rests (&ldquo;&#128164; resting until the next summon&rdquo;), with the countdown big beside it. The upgrade points sit on a gold star, and <b>Dismiss</b> is a pink candy button that presses in (&ldquo;&#128075; Dismiss Slippy&rdquo;).</p>',
  '<p>Plush cards: a stitched seam inside a soft border, a sprinkle of star dots, pink and sky glows and two twinkling sparkles. Fredoka for the headings and numbers, Nunito for the words (both already bundled); the icons are the game&rsquo;s own emoji set. It keeps its look in the low-graphics mode, stops twinkling for <em>reduce motion</em> and fits a phone held sideways. The roster cards below are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/mm_cards_test.mjs</code> &mdash; 16 checks: the card still states 15&times; HP and the real ATK share; the three steps with the real kill count; both pills with the real numbers; READY fills and pings the ring; the star shows the real points; with no MojiMon the ring holds the logo, and paw prints sit between the steps; Fredoka and Nunito load and are used; on cooldown the readout is peach m:ss and the ring half-drained at half the cooldown; the ring holds your H-slot MojiMon, resting; the countdown drains the ring and turns READY by itself; Dismiss shows the name and sends the mon back; nothing spills out of a step or pill on desktop or a phone; no page errors. <code>u_panel_text_test</code> still passes.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 9000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
