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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> First-hour feedback: hero names, &ldquo;Creating hero&hellip;&rdquo;, one Esc after the tour, readable hints</span></h2>',
  '<p>A pre-launch playthrough as a brand-new player found a few places where the game left you guessing.</p>',
  '<ul>',
  '<li><b>Hero names were changed without telling you.</b> Typing <code>&lt;b&gt;x&lt;/b&gt;</code> gave a hero called &ldquo;bxb&rdquo;, because the filter dropped the brackets but kept the letters inside them. Tag-like pieces are now removed whole. The name fields on the title screen (New Game and Co-op) have a small live hint listing the allowed characters: letters, numbers, spaces, - and _. When something you type will be dropped, the hint shows the name that will actually be saved. In character creation the same note pops up under the name field whenever that happens.</li>',
  '<li><b>&ldquo;Enter Mojiworld&rdquo;</b> greyed out for 2&ndash;5 seconds and nothing else happened. The button now reads <b>Creating hero&hellip;</b> until character creation opens.</li>',
  '<li><b>After the tour&rsquo;s last step</b> (<kbd>U</kbd> &rarr; Skills), the tour&rsquo;s closing story card started on top of the open panel. Your first <kbd>Esc</kbd> skipped that card, and a second press was needed to close the panel. The card now waits until the panel is closed, so one <kbd>Esc</kbd> closes it and the closing words play over the world.</li>',
  '<li>The story cards&rsquo; <b>&ldquo;click / tap / press Enter to continue&rdquo;</b> line and the <b>loading-screen tip</b> were dark on dark and hard to read. Both are brighter now, and the tip sits on a dark plate like the notifications.</li>',
  '<li><b>Deaths</b> were checked too, and nothing needed adding. Watched frame by frame, the death card with its coin and EXP toll is on screen for its whole beat, and &ldquo;Defeated! Lost N Mojicoins&rdquo; appears over the Void arrival with the exact amount taken.</li>',
  '</ul>',
  '<p><b>Verified.</b> A new browser test goes through the real title screen: it types a tag-like name, checks the hint, the busy button, the saved name and the creation name field. In game it finishes the tour behind the <kbd>U</kbd> panel and presses <kbd>Esc</kbd> once. It also measures how readable the hint and tip are, and samples a death every frame. Eight of its ten checks fail on the build before this change (the death check passes on both, which is how we know the death messages already existed), and all ten pass on the new build, three runs in a row.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
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
