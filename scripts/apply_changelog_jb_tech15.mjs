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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> DJ Vinyl&rsquo;s console: the circuit lines and nodes at 15% opacity</span></h2>',
  '<p>Per user: <em>&ldquo;Make the opacity of the nodes and circuitry 15%&rdquo;</em>.</p>',
  '<p>Every circuit line and node on the console is now drawn at exactly <b>15%</b>: on the faceplate, the deck, the pad plate and the club backdrop (they ranged from 7% to 28%), and the top-bar data bus&rsquo;s line, ticks and end nodes (24&ndash;60%). The deck&rsquo;s glowing nodes are dark at rest and pulse up to 15% while a track plays (they rested at 14% and peaked at 70%). The small pulse of light running along the top-bar line is not circuitry and is unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/jb_tech15_test.mjs</code> &mdash; 6 checks, read back from the live page: every line and node in the faceplate, deck, pad-plate and backdrop tiles is at 15%; the data bus is at 15%; the lit nodes are dark at rest and, sampled through two seconds of playback, pulse up to 15% and never past it; the bus pulse still runs; no page errors. <code>jb_tech_test</code> 11/11 and <code>jb_console_test</code> 17/17 still pass.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 800 || grew > 5000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
