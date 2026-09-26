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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Ticket Rush: Stage 3 points at the Carriage, Milo won&rsquo;t warp you into a stage he didn&rsquo;t start, and resumed or restarted runs keep their numbers straight</span></h2>',
  '<p>Four Ticket Rush (party quest) bugs from the second bug hunt.</p>',
  '<p><b>Stage 3 pointed at the wrong map.</b> The quest tracker and navigator sent you to the Stage 1 lobby (it has Ticket Mechs too) and even said &ldquo;Target nearby&rdquo; there, where Stage 3 kills don&rsquo;t count. They now name the <b>Carriage of Ascension</b> until you are aboard.</p>',
  '<p><b>Milo warped you into stages he hadn&rsquo;t started.</b> Below a stage&rsquo;s level (after an ascension, say), &ldquo;Begin Stage 2/3/4&rdquo; quietly failed to start the stage but still loaded you into it &mdash; a run that counted nothing, and for Stage 4 a Conductor fight that paid nothing. Milo now tells you the level you need and keeps you where you are.</p>',
  '<p><b>A resumed Spire lost its pieces.</b> Re-accepting the Spire restored &ldquo;2 already counted&rdquo; but wiped the pieces you had found, so the pin read 0/4 and the summit exit could stay shut. A resumed Spire now keeps its pieces; a fresh one still starts clean.</p>',
  '<p><b>&ldquo;Reset my papers&rdquo; kept last run&rsquo;s progress.</b> A restarted Rush reopened Stage 3 at &ldquo;10 already counted&rdquo;. Restarting now clears it.</p>',
  '<p><b>Verified.</b> <code>scripts/pq_fixes_test.mjs</code> &mdash; 7 checks: Stage 3 guidance names the Carriage from town and from the lobby; Milo&rsquo;s under-level Begin Stage 2 starts nothing and warps nowhere; a fresh Spire starts with no pieces and a resumed one keeps them; a restart clears the banked progress; no page errors. 5 of the 7 fail on the build before this fix.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
