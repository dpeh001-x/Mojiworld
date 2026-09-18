import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The Pincer no longer grows antennas</span></h2>',
  '<p>Per user, with a phone video from Dune Sands: <em>&ldquo;the monster &ldquo;pincer&rdquo; is growing antennas out of nowhere, ensure he does not grow antennas&rdquo;</em>.</p>',
  '<p><b>Cause.</b> Of the Pincer&rsquo;s 27 animation frames (idle, walk and attack, nine each), exactly two had antennas: <b>idle 5 and 6</b>, the happy squint in the middle of its idle loop. Everywhere else the head is bare, so twice in every idle cycle a pair of antennas sprouted from its head and vanished again &mdash; the moment in the video.</p>',
  '<p><b>Fix.</b> The antennas are cut out of those two frames and the head redrawn under them (<code>scripts/fix_pincer_antennas.mjs</code>). The top of the silhouette across the gap is rebuilt from the outline either side of it (the body segment&rsquo;s edge on the left, the head&rsquo;s arc between and right of them); everything above goes, with an anti-aliased rim; the outline under it is repainted at the thickness measured beside it, and runs down to the head&rsquo;s own edge where the body meets the head (a circle fitted to the clean arc, within 0.7&nbsp;px); and the two dark roots each antenna pushed into the head&rsquo;s cream highlight are filled from the highlight around them. The squint, the tail, the legs and the other 25 frames are untouched, and the files are 10% smaller than before. <code>sw.js</code> moves its cache generation on one step, because the frames are replaced under their own names and a returning browser would otherwise keep serving the antennas from its cache.</p>',
  '<p><b>Verified.</b> <code>scripts/pincer_antenna_test.mjs</code> &mdash; 11 checks: none of 24 Pincer frames has anything above its head (attack 5&ndash;7 are left out of that check: the sting swings through that space there); both fixed frames keep the exact bounds <code>data/sprite_bbox.js</code> records and the empty border <code>data/sprite_edges.js</code> records, so neither table needs regenerating; outside the antennas each frame matches the original to re-encode noise (mean 1.7/255); the cache generation moved; and in the running game the loader fetches all nine idle frames and the two it draws have nothing above the head. It fails 3 of 11 on the previous build. Checked by eye in the game on Dune Sands with the idle loop pinned frame by frame.</p>',
  '');
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
