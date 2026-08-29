import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.290 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.290 <span class="tag"><span class="pill polish">polish</span> Soul Vortex and Necrotic Ascendance pools draw behind the monsters</span></h2>',
  '<p>Per user, with a screenshot of Scorpio all but invisible inside a green field: <em>&ldquo;soul vortex vortex and necrotic ascendance vortex should be at a layer behind the monster&rdquo;.</em></p>',
  '<p><b>The cause.</b> <code>drawHazards()</code> runs <em>after</em> the monster loop, which is right for every other hazard &mdash; they are floor effects, and painting them over the fight is the point. But these two are arena-sized fields the fight happens <em>inside</em>, so a 300&times;200 swirling pool painted straight over the boss you are trying to read.</p>',
  '<p><b>The fix.</b> <code>drawHazards</code> now takes a behind-pass flag, exactly like the <code>drawSmoothFx(true)</code> pass that already exists one line above the monster loop: the pools draw there, under the monsters; every other hazard keeps its current layer. The two passes <em>partition</em> the hazard list, which is what keeps the four particle emitters and the <code>_dieAt</code> expiry inside that function from firing twice per frame. Art, size, alpha, animation and damage are all untouched &mdash; damage lives in the hazard resolver, not the draw pass.</p>',
  '<p><code>scripts/vortex_layer_test.mjs</code> &mdash; 7 checks. A getter on each hazard&rsquo;s <code>life</code> (read inside its own draw branch, after the pass filter) is an exact &ldquo;this hazard drew&rdquo; probe: the behind pass must draw both pools and no other hazard, the main pass the reverse, and a full frame must visit every hazard exactly once. Its first control hazard read zero in <em>both</em> passes &mdash; a silent control proves nothing &mdash; so it was swapped for one whose branch actually runs on a synthetic hazard.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1000 || grew > 5000) { console.error(`ABORT: moved ${n0} -> ${s.length} (+${grew})`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.290 (+${grew} chars)`);
