import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>';   // (not '</header>' + a blank line: entries now follow it directly)
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The Block (A) icon, repainted for every class in the skill icons&rsquo; style &mdash; and as big as they are</span></h2>',
  '<p>Per user: <em>&ldquo;regenerate the block A icon for all classes to better suit the icons in a similar style to the skill icons&rdquo;</em>.</p>',
  '<p><b>The art.</b> The skill icons are die-cut stickers: a white sticker edge around a thin black outline, flat vibrant colours, light cel shading. The Block icons were painted 3D objects with no sticker edge &mdash; and showed things the game never shows when you block (a crimson shield, a planet with a ring, a tornado). All five are regenerated in the skill icons&rsquo; style (ludo.ai, <code>scripts/gen_block_icons.mjs</code>), each showing what that class&rsquo;s block actually looks like in game: the <b>warrior&rsquo;s</b> golden shield of light, the <b>rogue&rsquo;s</b> violet smoke burst, the <b>mage&rsquo;s</b> light-blue rune ward, the <b>archer&rsquo;s</b> green wind gust, and a steel shield before a class is chosen. (A first run fed the skill icons&rsquo; full 1,000-character prompt and came back as glossy orbs and chibi faces; the ones shipped use the same look as a short tail after the subject.)</p>',
  '<p><b>The size.</b> Each skill icon is painted at 116% of its slot; the Block icon was a 24&nbsp;px picture under its label &mdash; about half their size, next to them. It now fills its slot the same way, with the &ldquo;Block&rdquo; chip and the A key on top like every slot&rsquo;s cost chip and key. The mobile Block and F buttons show the new art at their own size. The five files are replaced under their own names, so <code>sw.js</code> moves its cache on one step and a returning browser drops the old icons.</p>',
  '<p><b>Verified.</b> <code>scripts/block_icons_test.mjs</code> &mdash; 7 checks: all five files are the chosen art, 512&nbsp;px on transparent; the cache moved; in a running game each class&rsquo;s hotbar Block slot loads its own icon (and the steel shield before a class), fills its slot centred, and is painted at exactly the size of the skill icons beside it. It fails 4 of 7 on the previous build (the Block icon painted at 32&nbsp;px against 58.8 for the skill icons at that window size).</p>',
  '');   // a trailing EOL, so whatever followed </header> starts on its own line
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1800 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
