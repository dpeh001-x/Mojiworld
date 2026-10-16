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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Gravitos moves more smoothly: each pose now melts into the next, in all three forms</span></h2>',
  '<p>Per user: <i>add ghost frames effect to all form of gravitos to make the animation flow better</i>, and <i>ensure it does not lag the fights</i>.</p>',
  '<ul>',
  '<li><b>What you saw.</b> Each of Gravitos&rsquo;s moves is a short run of drawings, and he jumped from one drawing to the next. The steps showed most in his walk and his punches.</li>',
  '<li><b>What happens now.</b> When he changes to his next drawing, the one he just left stays on screen for a moment as a see-through ghost and fades out, starting at half strength and gone well before the next change. The jump becomes a quick dissolve, so his walk, punches, laser, Soul Drain, Supernova and idle all flow. This works in every form, including after he comes back as form 2 and form 3.</li>',
  '<li><b>Lined up exactly.</b> Each ghost is drawn exactly where and how its own drawing was shown: the same size, facing and footing. When he switches from one move to another, the last pose of the old move fades into the first pose of the new one.</li>',
  '<li><b>Kept out of the way.</b> No ghosts while he flashes from a hit or is frozen, during a hit-stop or a cutscene, or as he dies. A drawing that hasn&rsquo;t finished loading is never used.</li>',
  '<li><b>No lag.</b> A ghost is one extra see-through copy of a picture the game already has ready, with no new image work. If your frame rate drops (under about 45 fps), the ghosts switch themselves off and come back once it recovers (above about 55 fps).</li>',
  '</ul>',
  '<p><b>Verified.</b> A test watched Gravitos in all three forms, facing both ways. It checked that every ghost fades on schedule, sits exactly where its own drawing was shown, and fades correctly when he switches moves. It checked that there are no ghosts while he dies, while he is frozen or in hit-stop, or when a drawing hasn&rsquo;t loaded, and never more than one extra picture at a time. It also checked that the frame-rate switch turns them off and back on. These checks fail on the build before this change and pass on this one. In full fights against all three forms, with his attacks and effects on screen and hits landing, the game&rsquo;s work per frame stayed the same with the ghosts on as with them off, within measuring noise. Measured on its own, one ghost costs the game about 0.03 ms per frame (about 0.16 ms on a slowed-down phone setup). No page errors.</p>',
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
