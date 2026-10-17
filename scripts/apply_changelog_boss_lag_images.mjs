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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Smoother boss fights: art is prepared in the background, and every sprite looks exactly the same</span></h2>',
  '<p>Boss fights stuttered, most of all in the first seconds and when a boss changed form. Before the game can draw a picture it has to unpack it from its file. The game did that the first time each picture was needed, in the middle of the fight, and while it did, the game froze for a moment. This happened with a boss&rsquo;s shackle seal, his rifts and rings, his sword-swing warning, your own skill effects and the boss&rsquo;s new poses at a form change. Each freeze lasted 20&ndash;100 ms on a computer and several times longer on a phone.</p>',
  '<ul>',
  '<li><b>Now that work happens in the background</b>, on a helper the browser runs beside the game, so the game never waits for it. The pictures are unpacked from the same files, at the same size, the same way, so every sprite and effect looks exactly as it did.</li>',
  '<li><b>The loading screen into a boss arena now prepares the boss&rsquo;s own art</b>, together with your skills: his attacks, his shackle seal and his telegraphs. Art that only a later form uses (Gravitos&rsquo;s second and third rifts) is prepared when he reaches that form.</li>',
  '<li><b>That art stays ready for the whole fight.</b> On a computer or an Android phone, the game used to throw away anything you had not used for a few seconds, and then had to unpack it again. It now keeps the fight&rsquo;s art and lets other art go first. Memory stays inside the same limit as before.</li>',
  '<li><b>The check that measures how tall a boss is now runs in the background too</b>, so he is still drawn at the right size. On a phone it used to freeze the screen for up to a third of a second when you entered his arena.</li>',
  '</ul>',
  '<p><b>Measured</b> with the old and new builds side by side. A level-200 bot fought six bosses in their own arenas, 35 seconds per form: Mira, Gravitos (all three forms), the Tower Sovereign, the Tower Arbiter, Aetherion (both forms), and a mage casting Arcane Burst in the Singularity. The count is of frames that took the game more than 33 ms, which you see as a stutter.</p>',
  '<ul>',
  '<li><b>Computer at 2x:</b> 81 &rarr; 27 stutters (4.2 s &rarr; 1.3 s of freezing in total). In the first five seconds of a fight or a new form, 41 &rarr; 13. Gravitos alone: 23 &rarr; 11, worst frame 80 &rarr; 57 ms. The Arcane Burst fight: 32 &rarr; 9.</li>',
  '<li><b>Computer at 1x:</b> 45 &rarr; 10 stutters. In the first five seconds, 34 &rarr; 5.</li>',
  '<li><b>Phone</b> (3x, processor slowed 4x so the cost shows): 119 &rarr; 45 stutters (7.3 s &rarr; 2.3 s). In the first five seconds, 66 &rarr; 30. Mira: 17 &rarr; 2. Aetherion: 28 &rarr; 11.</li>',
  '<li><b>iPhone memory limit</b>, Gravitos: 38 &rarr; 13 stutters at 1x and 90 &rarr; 47 at 3x.</li>',
  '<li><b>Loading into an arena</b> is often shorter than before (Aetherion&rsquo;s and Mira&rsquo;s arenas by 0.6&ndash;1.1 s on a computer). The Singularity can take up to half a second longer, so your skills are ready for the first cast.</li>',
  '</ul>',
  '<p><b>Verified.</b> A browser test enters the Singularity as a level-200 Berserker. It checks that the boss&rsquo;s art and your skill art are ready when the loading screen lifts. It draws every one of those pictures and confirms that none had to be unpacked mid-fight (the build before had to unpack 86 of them, some taking up to 68 ms). It compares the new background-prepared pictures with the old ones pixel by pixel, in both facing directions: the shackle seal, the boss&rsquo;s effects, your skills, his poses, his measured height and the background check. They are identical. It also turns the helper off and checks that the game falls back to the old way and still draws the same pixels.</p>',
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
