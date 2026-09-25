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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> DJ Vinyl&rsquo;s console: circuit lines and nodes in its background</span></h2>',
  '<p>Per user, on the new console: <em>&ldquo;improve on the background of the UI slight tech feel&rdquo;</em>, then <em>&ldquo;tech lines and nodes feel&rdquo;</em>.</p>',
  '<p>A small circuit network is now etched, faint, into the console: cyan traces with 45&deg; bends, solid nodes where they meet and ringed nodes where they end. It runs across the <b>faceplate</b> (round the edges, the top bar and the footer), a little brighter across the <b>deck</b>, behind the <b>pads</b> (it scrolls with them, like a board) and, larger and fainter, across the <b>club backdrop</b>. While a track plays, the deck&rsquo;s nodes light up in turn &mdash; cyan, with a pink, a yellow, a violet and a green one &mdash; and go quiet on STOP.</p>',
  '<p>A <b>data bus</b> now runs across the top bar from the name plate to the found counter: a trace with a node at each end and a tick scale, and a pulse of light running along it while music plays.</p>',
  '<p>It is all background images, so it keeps its look in the low-graphics mode, sits behind every control (nothing it draws takes a click) and stops moving for <em>reduce motion</em>. The pads, the wheels and what they do are unchanged.</p>',
  '<p><b>Verified.</b> <code>scripts/jb_tech_test.mjs</code> &mdash; 11 checks: the network is lines and nodes, and its tile is seamless (every trace leaving an edge comes back in on the opposite one); it is on the faceplate, deck, pad plate and backdrop, and still there in the low-graphics mode; idle, the bus is dark and the nodes rest; playing, the pulse runs and the nodes light; STOP quiets them; the controls, the screen, the pads and the backdrop still take their clicks; it fits a phone on its side; no page errors. <code>jb_console_test</code> 17/17 still passes.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
