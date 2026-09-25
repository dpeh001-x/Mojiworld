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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Rank Points burst off the Skills tab: a comic starburst and a deep-shadowed number</span></h2>',
  '<p>Per user, on the RANK POINTS (RP) bar: <em>&ldquo;this can be better improved, the number can have more shadow, can have more pop comic feel&rdquo;</em>.</p>',
  '<p>The RP pool number is bigger, with a thick ink stroke and a <b>four-step ink extrusion</b> finished by a drop in your class&rsquo;s deep shade, so it stands off the card. Behind it the plain disc is now a <b>comic starburst</b> &mdash; twelve points in your class colour with a halftone screen and a top light &mdash; sitting on a black burst offset down and right, its outline and hard shadow, the whole sticker tilted and just breaking the panel&rsquo;s frame. &ldquo;to invest&rdquo; is an upright white caption in caps. The count still updates as you spend, and Reset RP is untouched.</p>',
  '<p><b>Verified.</b> <code>scripts/rp_pop_test.mjs</code> &mdash; 8 checks: the number is still the live count; a 30&nbsp;px numeral with a 5&nbsp;px ink stroke and a five-layer shadow; a class-colour starburst with a halftone screen on a black offset burst; the tilt; the caption in caps; Reset RP not covered and the bar fitting its column, on desktop and on a phone held sideways; no page errors. The current build fails 3 of the 8.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 800 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
