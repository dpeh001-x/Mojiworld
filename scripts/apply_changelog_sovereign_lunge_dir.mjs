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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Sovereign lunges at you, not past you</span></h2>',
  '<p>Per user: <i>&ldquo;Tower sovereign lunges in the wrong direction&rdquo;</i>. The Sovereign of the Spire&rsquo;s lunge always covered the same long distance, however close you were. He is very wide, and he would set it off with you standing right against him. The lunge then flung him straight past you and far out the other side, so he ended up with his back to you, a long way off. Making it worse, when he walked toward you he never stopped: he walked right through you and kept going, turned round and walked back through you again. So nearly every lunge started from on top of you, and he seemed to charge off away from you.</p>',
  '<p>Now his lunge is aimed at you. He only sets it off when you are a stride clear of his body, and it carries him up to you and stops with you in front of him. It never takes him past you, and he keeps facing you when it is over. The glowing lane he draws on the floor before the lunge is exactly as long as the lunge, so you can still see where it will go and step out of it. When he walks up to you he now stops in front of you instead of walking through you. His swing, pillar strike, spire-step, shields and other moves are unchanged, and so are his sprites.</p>',
  '<p><b>Verified.</b> A browser test fights the Sovereign in his sanctum with the hero standing still 300 pixels to his left, then to his right, and by each wall. It checks that the lunge moves toward the hero and never carries him past them (before, it went 160 pixels past), that every frame from the crouch to well after the lunge faces the hero, that he stays by the hero afterwards, and that the warning lane ends where the lunge does. It also checks that a hero right up against him does not set off the lunge, and that his standing and walking poses still turn the way he faces. His existing lunge, spire-step, shield, sprite and charge-lane tests still pass.</p>',
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
