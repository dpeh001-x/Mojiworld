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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The title menu goes pop punk: a POP sunset, a hand-cut ink card, sticker buttons and icons, a lemon MOJIWORLD</span></h2>',
  '<p>Per user: <em>&ldquo;the ornate gold frame can be changed to more pop punk style&rdquo;</em>, <em>&ldquo;the background image can be swapped out with a more POP render&rdquo;</em> and <em>&ldquo;perhaps we can do something to the rectangular modal and icons&rdquo;</em> &mdash; then the class badge, the social logos, the tag and the wordmark&rsquo;s colour in turn.</p>',
  '<p><b>Backdrop.</b> A new pop-art key art: a neon sunset whose speed-line rays fan out from behind the menu, the party and Guguma small at the lower left, a crystal tower town on the right, with a checkerboard strip along the bottom. <b>The card.</b> The gold filigree frame is gone; the menu sits on a hand-cut ink poster &mdash; an ink edge, a white keyline, a deep violet dotted ground, a hard hot-pink offset, a torn bottom edge and a slight tilt &mdash; with hazard tape and pink tape over its top corners and a star and a bolt sticker hanging off its sides. It slams in when the menu appears.</p>',
  '<p><b>Buttons and icons.</b> Every menu button is an ink sticker with a white keyline and a hard offset, alternately tilted; the top one (Continue, or New Game on a first visit) is acid yellow, and hover lifts a button with a yellow keyline and a pink offset. New pop sticker icons (a rainbow quill, a high five, a gear, a lightning chest) hang off the buttons&rsquo; left edges, and the Continue card wears a pop sticker for your class &mdash; crossed swords, a wizard hat, a skull-charm dagger or a bow &mdash; instead of the gold crest (the class-select screen keeps its crests). Ko-fi, Discord, Instagram and Website are redrawn as flat pop badges with their cute faces kept; the links are unchanged.</p>',
  '<p><b>Type.</b> <b>MOJIWORLD</b> is recoloured lemon (the painted bevel kept) with a hard ink drop instead of the soft glow that made a box behind it; the loading screen keeps the gold one. <b>Once upon a time</b> is lemon capitals on a black torn tag with a pink offset, under two straight pink and yellow rules; the version is a yellow price tag. Only the title menu changes &mdash; the loading screen, the name and co-op panels and everything in game are as before.</p>',
  '<p><b>Verified.</b> <code>scripts/title_pop_test.mjs</code> &mdash; 13 checks: the POP backdrop loads; the gold frame is gone for the ink card and its pink offset; the lemon wordmark with no glow box; the lemon tag and straight rules; the four sticker icons; a saved Mage&rsquo;s Continue card wears the mage sticker; button faces, the yellow primary and the pink hover offset; every button still takes its own click (the tape and stickers never cover one); the four badge redraws with their links; the card fits with the copyright under it; a phone on its side, where New Game takes its tap; no page errors; and <code>start_menu_test</code> (its crest check now follows the Continue badge to the class sticker) still passing.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
