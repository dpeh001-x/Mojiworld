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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Boss fights: less wasted work behind the scenes, and every frame looks exactly the same</span></h2>',
  '<p><b>What was happening:</b> part of the work in a boss fight had nothing to do with the boss. The browser was made to measure the screen layout again in between frames, and the combat code built small objects every frame only to throw them away. None of it showed on screen, but it all took time.</p>',
  '<ul>',
  '<li><b>Warnings and notices</b> (&ldquo;Soul Drain incoming&rdquo;, &ldquo;Skills locked&rdquo;, &ldquo;Staggered&rdquo;) still move out of the way when a menu is open. They now check where to go at the end of a frame the game is already drawing, instead of making the browser measure the screen again in between. In a boss fight that happened about three times a second.</li>',
  '<li><b>Health and mana bars</b> still drop at once when you are hit or cast a skill, and still slide back up when they refill. They no longer force the browser to measure the screen at the moment they drop.</li>',
  '<li><b>Arrow and spell trails:</b> when a big volley has already used up a frame&rsquo;s allowance of sparks, the extra trail sparks are no longer made just to be thrown away.</li>',
  '<li><b>Big volleys</b> over the projectile limit no longer make a new list every frame, and the status icons over your hero no longer make new objects every frame.</li>',
  '</ul>',
  '<p><b>Measured</b> in Gravitos, Tower Sovereign and Mira fights, with a level-200 bot using its whole kit, on a computer at 2x resolution and on a phone-speed CPU: the browser is now made to measure the screen in between frames about once a second, down from about a hundred times a second, and the time it spends on that in between frames fell by 15&ndash;78% on the computer and 11&ndash;42% at phone speed. The average time to make a frame did not change beyond measurement noise (identical runs on this machine differ by 10% or more), because the work removed is small next to drawing the fight: this removes small stalls, it is not a big speed-up. The big-volley savings did not come up in these fights (the bot never had more than 13 arrows in the air); the test below covers them with 270 shots on screen.</p>',
  '<p><b>Verified.</b> A browser test plays a Tower Sovereign fight frame by frame twice from the same start, with the same random rolls and the same clock: once with this version and once with the previous one. All 8 frames are identical pixel for pixel (the boss, your hero with eight status icons, 270 arrows and boss shots with their trails, the damage numbers), and the HUD shows the same text. The health and mana bars snap and slide exactly as before, frame by frame. The same test checks that each removed cost is really gone, and it fails on the previous version.</p>',
  '');
s = s.replace(ANCHOR, () => ENTRY);
if (s.includes('@@NUMBERS@@')) { console.error('ABORT: numbers placeholder left in'); process.exit(1); }
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
