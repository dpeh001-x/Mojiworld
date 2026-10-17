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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The boon wheel after a boss kill opens without a hitch, and looks exactly the same</span></h2>',
  '<p><b>What was happening:</b> after a boss fell, the game froze for a moment when the &ldquo;choose a boon&rdquo; wheel came up. It was the longest single freeze left in a boss fight: 65 to 150 ms in Tower Arbiter fights on a computer at 2x resolution, depending on how busy the fight was, and longer on slower machines.</p>',
  '<ul>',
  '<li><b>The boss&rsquo;s name at the top</b> is shrunk until it fits. The game shrank it one small step at a time, and the slanted pink banner behind the name always sticks out a little, so it never looked like a fit. Every name went through all 13 steps down to the smallest size, and each step meant setting the name in a size never used before. Now the game tries the smallest size first. The name is still too wide there, so it ends up at exactly the size it always did, after one try instead of 13.</li>',
  '<li><b>The wheel&rsquo;s lettering</b> (the boon names, the roll numbers, the tags, the emoji next to the boss&rsquo;s name) is now set up ahead of time, in quiet moments a few seconds after you enter the world and again in the second and a half between the kill and the wheel. It is laid out out of sight and cleared again straight away, so nothing ever appears on screen.</li>',
  '</ul>',
  '<p><b>Measured</b> on a real Tower Arbiter kill with hits landing, at 2x resolution: opening the wheel took 66.5 ms of the game&rsquo;s time and now takes 7 ms, inside a single frame. The set-up work runs in five small pieces of 2 to 9 ms each, in the gaps between frames.</p>',
  '<p><b>Verified.</b> A browser test kills a real Tower Arbiter and checks that the wheel opens in under 40 ms (it took 65 to 67 ms before, now about 5 ms). It also checks that the boss&rsquo;s name gets exactly the size the old step-by-step method gives, for four names at computer and phone widths, and that the hidden set-up leaves no trace: the wheel, the pause, the owed boon and the boon codex are all unchanged. Picking a card still takes the boon. Screenshots of the open wheel (same boons, computer and phone widths) match the previous version pixel for pixel. The only pixels that differed belonged to a game counter showing behind the wheel&rsquo;s corner, and that counter differs between two runs of the previous version too.</p>',
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
