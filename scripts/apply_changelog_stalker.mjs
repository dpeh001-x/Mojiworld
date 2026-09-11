import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const VER = process.env.LX_VER;
if (!VER) { console.error('ABORT: LX_VER unset'); process.exit(1); }
if (s.includes('>' + VER + ' <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> The Mirror Stalker&rsquo;s lunge: slower, shorter, and announced</span></h2>',
  '<p>Per user: <em>&ldquo;mirror stalker it seems to have a very awkward fast movement / repositioning, slightly slow it down and slightly reduce the distance and have a warning sign prior to that fast movement&rdquo;.</em></p>',
  '<p><b>The move.</b> The Stalker&rsquo;s only trait is an hourglass charge: a 2.2&nbsp;s brace, then a lunge the handler hard-codes at <b>460&nbsp;px over 320&nbsp;ms</b> &mdash; about 24&nbsp;px per frame, eighteen times its walk speed. Those two numbers are shared by pathsBane, the Arbiter, the Sovereign and the Master Conductor, so a global edit would have retuned four bosses to fix one stalker. The handler, and the lane renderer that recomputes the same numbers so the lane stays an honest promise, now read optional per-trait overrides; the Stalker sets <b>380&nbsp;ms / 380&nbsp;px</b> &mdash; speed 1.44&nbsp;&rarr;&nbsp;1.00&nbsp;px/ms (&minus;30%), distance &minus;17%. Everyone else&rsquo;s lunge is byte-for-byte unchanged.</p>',
  '<p><b>The warning.</b> The lunge already has a floor-lane telegraph &mdash; but it is gated on <code>_lxZoneWorthy</code>, whose first line returns false for every non-boss, so the Stalker&rsquo;s lane <em>can never draw at any level</em>. Its only tell was a trickle of sand-grain particles at its centre, invisible among twenty of them on Echo Bridge. During the brace, any non-boss lunger now carries a pulsing <b>&ldquo;!&rdquo;</b> with a chevron pointing where the lunge will go (the direction is locked at brace start, so the sign is honest), growing as the brace runs down. Bosses keep their lane grammar and are not marked twice.</p>',
  '<p><code>scripts/stalker_lunge_test.mjs</code> &mdash; 6 checks on a real spawned Stalker held at lunge range with its cooldown forced due: the dash runs at ~16.7&nbsp;px/frame (baseline 24.0), travel clamps near 380&nbsp;px (baseline 460), the &ldquo;!&rdquo; is drawn on the live canvas while it braces and not while it dashes, plus two controls &mdash; a second Stalker with no overrides still lunges at the handler defaults (24&nbsp;px/frame, 460&nbsp;px), proving the change is an override and not a global slowdown, and a bracing boss draws no sign. On the unpatched build the three Stalker rows fail.</p>',
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
