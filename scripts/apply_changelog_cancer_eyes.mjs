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
  '<h2>' + VER + ' <span class="tag"><span class="pill art">art</span> Cancer gets black kawaii eyes</span></h2>',
  '<p>Per user: <em>&ldquo;for zodiac cancer the eyes are also a little weird, please do the same with black kawaii eyes&rdquo;.</em></p>',
  '<p><b>The opposite problem to Aquarius.</b> Aquarius&rsquo; base sprite was fine and a prompt spoiled one loop, so one loop was re-rolled. Cancer&rsquo;s two eyes &mdash; blank, pupil-less cream discs sitting inside amber rings, which is what reads as lifeless &mdash; were in <code>cancer.webp</code> <em>itself</em>. Every frame of all three loops inherited them, so there was no loop to fix: the base had to change first, and idle, walk and attack were regenerated from it.</p>',
  '<p><b>Now.</b> The base was edited with ludo.ai&rsquo;s image edit (<code>scripts/gen_cancer_eyes.mjs</code>), keeping the crab identical &mdash; same pose, same coral-pink shell, pearls, claws, legs, horns and outline &mdash; and replacing only the two discs with big, round, glossy black kawaii eyes, each with a white sparkle highlight. Three candidates were generated and <em>scored</em> rather than taken on trust: an image edit can quietly hand back a different crab, a different pose, or a crab on an opaque background, and any of those would have been far worse than the eyes it was sent to fix. The winner held a silhouette IoU of <b>0.988</b> against the original and left the ink coverage unchanged at 29.5%.</p>',
  '<p><b>The measure.</b> How much of the eye band is solid black. The first attempt at this scored the <em>darkest 8%</em> of the band, which read ~3 on the untouched art and ~0 on every candidate &mdash; useless, because the darkest pixels in that crop are the character&rsquo;s own outline, present either way. Coverage is the right question: the blank discs are large, so turning them black moves the number a long way while the outline contributes equally to both.</p>',
  '<table><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Base sprite</td><td>20.6%</td><td>38.5%</td></tr>',
  '<tr><td>Idle loop</td><td>~20%</td><td>38.0&ndash;39.9%</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/cancer_eyes_test.mjs</code> &mdash; 7 checks, with the per-frame bar derived from the current base at run time rather than hardcoded, so it keeps its meaning if she is ever redrawn again. It also asserts each loop still matches the base silhouette (still the same crab), that no loop is nine copies of one drawing, and that the canvas never changed. Attack frames washed out by her own charge-up glow are exempted <em>by measurement</em> and named in the output, never by frame index &mdash; so that exemption cannot silently widen if the animation changes.</p>',
  '<p><code>scripts/apply_zodiac_manifest.mjs</code> re-measures the animator manifest for all three of her states. It is the general form of the Aquarius one: deliberately surgical rather than a full rebuild, because a rebuild draws from the local Sprites tree and would ship whatever else that tree is behind on &mdash; it proves the other 158 entities are byte-identical before writing.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 9000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
