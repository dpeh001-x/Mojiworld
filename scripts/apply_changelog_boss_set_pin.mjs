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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A boss&rsquo;s current form stays loaded for the whole fight (Gravitos form 3 on sharp screens and iPhone)</span></h2>',
  '<p>Boss visuals must never lag a fight. The game keeps ready-to-draw copies of its art inside a memory budget, and Gravitos&rsquo;s third form is bigger than that budget on a sharp screen (and bigger than a phone&rsquo;s budget at any setting). So during the fight the game kept throwing away the poses he was not using at that moment and preparing them again the next time he used them; meanwhile he froze on his previous pose for a moment. On a computer at 2x or 3x resolution it happened about once a minute; on iPhone and iPad it happened on almost every change of move.</p>',
  '<ul>',
  '<li><b>Now</b>, while a boss is alive, every pose of the form it is in stays ready for the whole fight. When the game needs room it first lets go of the boss&rsquo;s earlier forms (a boss never goes back to them), then other art that has not been drawn for a while, as before. The rest of the art keeps at least half of the budget. On iPhone your own skill effects are prepared again a little more often than before (small, quick ones), which costs far less than the boss&rsquo;s poses did.</li>',
  '<li><b>Memory stays bounded.</b> On a computer the fight uses about what it did before. On iPhone the boss&rsquo;s form may use up to about 400 MB during the fight; a hard limit still applies. On an iPad with Sharp Display on, Gravitos&rsquo;s third form is larger than is safe to keep whole, so there it behaves exactly as before for now (keeping only part of it just moved the stutter around).</li>',
  '<li><b>Towns, hunting maps and other bosses</b> that already fit are unchanged.</li>',
  '</ul>',
  '<p><b>Measured</b> (Gravitos form 3, all seven of his move sets in turn, a level-200 berserker hitting him, about two minutes per run, several runs; old / new): on a computer at 2x, poses prepared again mid-fight 2&ndash;6 &rarr; 0 and frames drawn with a frozen pose 1&ndash;6 &rarr; 0; at 3x 7 &rarr; 0 and 7 &rarr; 0; the art memory the fight uses 240 &rarr; 249 million pixels. On an iPhone (CPU slowed 4x so the cost shows): poses prepared again 39&ndash;78 &rarr; 0, frozen-pose frames 78&ndash;163 &rarr; 0, main-thread time per frame 20&ndash;38 ms &rarr; 11&ndash;18 ms, frames over 33 ms 132 of 877 &rarr; 14 of 1593, single tasks over 50 ms 70 &rarr; 0; the art memory in the fight 40 &rarr; 80&ndash;90 million pixels.</p>',
  '<p><b>Verified.</b> A browser test fills the art memory past its limits with Gravitos alive in his third form, on a computer and on an iPhone: none of his form-3 poses are thrown away (the build before threw them away first), his second form&rsquo;s poses go first, the rest of the art keeps its room, the hard limit still holds when his form alone is bigger than it, and towns behave exactly as before. The existing boss budget test still passes.</p>',
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
