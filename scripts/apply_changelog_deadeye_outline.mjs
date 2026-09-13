import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_CHANGELOG_FILE || 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';   // a chain builds in a private copy
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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Deadeye Protocol&rsquo;s rounds carry a 2&nbsp;px black outline</span></h2>',
  '<p>Per user: <em>&ldquo;for the projectiles from the skill deadeyes protocol it needs to have a 2px black outline around it&rdquo;.</em></p>',
  '<p><b>Both rounds.</b> The Overclock round and the Execute Round now carry a black band around the body, so a pale gold round reads against the Glasswind sky and against a lit boss arena alike. Nothing else changes: the rounds fly, home and hit exactly as before, and every other projectile in the game is untouched.</p>',
  '<p><b>Two things the ring has to get right.</b> First, &ldquo;2&nbsp;px&rdquo; means 2&nbsp;px <em>as drawn</em>, not 2&nbsp;px of source art &mdash; the same lesson the gear editor&rsquo;s outline learned in v0.29.396. The Overclock round is 512&times;224 art inside an 84&nbsp;px box, so a literal 2-source-pixel ring would be about a third of a screen pixel. The radius is taken from the drawn box every time, so both rounds read the same thickness even though their art and their boxes differ. Second, this art has a soft glow edge: a quarter of its opaque pixels are semi-transparent, and tracing the raw alpha would give a fat, fuzzy ring. So the outline is built from the round&rsquo;s body at half alpha, the body is punched back out of it, and what is left &mdash; a band exactly its own width &mdash; is painted over the art. No black sits under the glow to dim it, and the body the player reads is never touched.</p>',
  '<table><thead><tr><th>Round</th><th>Art</th><th>Drawn box</th><th>Band, measured</th></tr></thead><tbody>',
  '<tr><td>Overclock round</td><td>512&times;224</td><td>84&nbsp;px</td><td>1.98&nbsp;px</td></tr>',
  '<tr><td>Execute Round</td><td>640&times;288</td><td>126&nbsp;px</td><td>1.94&nbsp;px</td></tr>',
  '</tbody></table>',
  '<p>The band is baked once per round and reused, so a round in flight costs one extra draw per frame and no new memory.</p>',
  '<p><code>scripts/deadeye_outline_test.mjs</code> &mdash; 6 checks: the band measures 2&nbsp;px at the size the game actually draws each round; the ring is a band and not a blob (the middle of it is fully transparent, so nothing black can sit under the art); live Deadeye Protocol rounds ring on real frames (48 draws over 40 frames); a siege ballista round on the same draw path does not ring at all; and a pixel-by-pixel diff of the drawn round with and without the ring shows black added outside it with the round&rsquo;s interior byte-identical. The previous build fails five of the six.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
