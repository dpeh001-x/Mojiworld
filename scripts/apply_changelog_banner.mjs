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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> A new Warlord standard &mdash; drawn at its own shape, with no glow</span></h2>',
  '<p>Per user, with a screenshot of the planted rally banner: <em>&ldquo;regenerate the sprite for this banner it should be much nicer and aesthetic and fit the game better, remove the weird glow around it&rdquo;</em> and <em>&ldquo;it should not looked squished as well&rdquo;.</em></p>',
  '<p><b>The squish was severe, and it was the renderer.</b> The old asset is a 182&times;697 cutout (aspect 0.26) that the hazard branch force-drew into its 92&times;150 box (aspect 0.61) &mdash; the standard was compressed to <b>43% of its proportional height</b>, which is why a slender pole-and-pennant read as a stubby wide flag. The draw now takes its width from the image&rsquo;s natural aspect at the box height, so no banner art can be squished again.</p>',
  '<p><b>The &ldquo;glow&rdquo; had two sources, and neither was what it looked like.</b> Checked and cleared first: the feather system (FX images are plain <code>Image</code>s drawn with raw <code>drawImage</code>, no feather path) and a leaked canvas shadow (the hazard renderer sets none). The real ones: a deliberate warm orange pool painted at the pole base, and a <em>fringe</em> &mdash; a hard-alpha cutout shrunk 4.6&times; in a single bilinear step every frame smears its red edge into a translucent band around the whole silhouette. The pool is removed outright (a small dark contact shadow grounds the pole instead, the way every other planted object is grounded); the fringe is removed by routing the source through the projectile pre-scaler, a cached, uniform, high-quality downscale to about twice the draw size, so the per-frame shrink is gentle.</p>',
  '<p><b>The art.</b> Three candidates were generated through ludo.ai with the repo&rsquo;s object-first prompt recipe and explicit <em>no glow, no aura</em> negations, trimmed to silhouette with the pole base flush to the bottom edge (the renderer anchors that edge to the floor line). All three were clean; the pick is the one with the widest cloth, a centred pole and the richest gold trim &mdash; a broad crimson pennant on a crossbar, brass finial, ground spike. Promoted at 263&times;768 (36&nbsp;KB), and its edge-table entry refreshed: it went from all four sides flagged as cut to a two-sample touch at the finial and the spike.</p>',
  '<p><code>scripts/warlord_banner_test.mjs</code> &mdash; 5 checks that spy on the live canvas while a real banner hazard renders: the drawn aspect equals the image&rsquo;s natural aspect within 2%; the source is the cached pre-scaled canvas rather than the raw image; no radial gradient with the pool&rsquo;s exact signature is issued; a control that the banner really is being drawn every frame; and the asset&rsquo;s pole base is flush with its bottom edge. On the unpatched build the three renderer rows fail (it draws 0.613 whatever the art, from the raw image, with one pool gradient per frame).</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1800 || grew > 6500) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
// The atomic rename can hit a transient EPERM on this OneDrive working copy
// (another session or the sync client holding a handle for a moment). Retry
// with backoff rather than abort a whole ship chain on a 2-second lock.
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) { console.error('ABORT: rename kept failing: ' + lastErr.code); process.exit(1); }
}
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
