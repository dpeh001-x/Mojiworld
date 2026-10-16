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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Arbiter lunges facing you, not the wall</span></h2>',
  '<p>Per user: <i>&ldquo;arbiter lunge facing wrong direction&rdquo;</i>. The Arbiter&rsquo;s lunge (he crouches behind the falling sand, then charges a long way forward with his sword out) could turn him round halfway through. His court is narrow, so when you stood near either wall and he charged at you, he hit the wall and spun to face away from you: the rest of the charge, the recovery and the standing pose after it all showed his back to you, sword pointing at the open floor, while he was still pushing toward you. He then stayed turned away, because you were standing too close in front of him for him to turn round again. Separately, when a charge carried him past you, he snapped round on the very first frame of his recovery, so the end of a forward charge looked like a backward slide.</p>',
  '<p>Now he faces the way he charges from the moment he crouches until he has recovered, on both sides, whether he stops at a wall or in the open. After the recovery he turns to face you as usual. His sprites, his size and his other moves (standing, walking, his big swing, the pillar strike and the verdict) are unchanged, and so are the charge&rsquo;s distance, speed and timing.</p>',
  '<p><b>Verified.</b> A browser test fights the Arbiter in his court and sets off his charge with the hero standing to his right by the right wall, to his left by the left wall, and in open floor on each side. For every frame from the crouch to well after the recovery it checks which way his drawn sword points against the way he is moving and where the hero stands. Before this fix both wall cases turned him round partway through the charge (and the charge that carried him past you turned on its first recovery frame); now every frame faces the right way. It also checks that he still turns back to face you after charging past, and that his standing, walking and swing poses still turn with him both ways. His earlier charge and shield tests still pass.</p>',
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
