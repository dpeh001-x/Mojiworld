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
  '<h2>' + VER + ' <span class="tag"><span class="pill art">art</span> Cancer&rsquo;s kawaii eyes reverted</span></h2>',
  '<p>Per user, after seeing <b>v0.30.711</b> in play: <em>&ldquo;then remove the kawaii eyes it looks too artificial and weird&rdquo;.</em> Reverted in full &mdash; all 28 of her sprites are restored byte-for-byte to the art that shipped before that change. Nothing is approximated or redrawn: the files hash to the same blobs they did before.</p>',
  '<p><b>Why it did not work</b>, for the record, because neither problem is visible in a still frame. The edited eyes read as <em>pasted onto</em> the shell rather than drawn with the character. And regenerating the three loops from the edited base <em>moved</em> them: in the attack loop they drifted up the shell onto the feeler bases across frames 1&ndash;7 of nine, so she appeared to sprout eyes on her antennae &mdash; the user&rsquo;s words, <em>&ldquo;sometimes the cancer boss eyes pops up at the tip of the feelers&rdquo;</em>. Her idle and walk held position; the attack loop did not, and that is the loop a boss spends its telegraph in.</p>',
  '<p><b>What the measurement missed.</b> The check that passed the original change &mdash; eye-band black coverage going 20.6% &rarr; 38.5% across every frame &mdash; was accurate and still insufficient. It proved the eyes were <em>black</em>. It could not prove they were in the right <em>place</em>, or that they belonged to the drawing rather than sitting on top of it. A number that says &ldquo;the feature is present&rdquo; is not the same as one that says &ldquo;the art is right&rdquo;, and only looking at it in motion closed that gap.</p>',
  '<p><code>scripts/cancer_eyes_test.mjs</code> is rewritten to assert the revert rather than deleted, so nothing in the repo is left claiming something untrue &mdash; 5 checks: all 28 files byte-identical to the pre-change commit, an independent pixel read that reaches the same conclusion without consulting git, the animator manifest matching the art actually on disk, and a control that the Aquarius idle fix from earlier the same day was not caught up in the revert. <code>scripts/gen_cancer_eyes.mjs</code> is kept, headed <b>REJECTED &mdash; DO NOT RUN</b>, as the record of what was tried and why it was dropped.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 9000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
