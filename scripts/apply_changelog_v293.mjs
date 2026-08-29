import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/CHANGELOG.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
if (s.includes('>v0.30.293 <')) { console.log('already applied'); process.exit(0); }
const ANCHOR = '</header>' + EOL + EOL;
if ((s.split(ANCHOR).length - 1) !== 1) { console.error('ABORT: header anchor not unique'); process.exit(1); }
const PRE = 'background:#0d0b14;border:1px solid #2a2438;border-radius:6px;padding:10px;overflow-x:auto';
const ENTRY = J(
  '</header>',
  '',
  '<h2>v0.30.293 <span class="tag"><span class="pill bug">bug</span> Virga&rsquo;s wings stop fading into the frame edge</span></h2>',
  '<p>Per user: <em>&ldquo;virga&rsquo;s boss animation wings appears to be feathered and cutoff could you fix or regenerate the sprites&rdquo;.</em></p>',
  '<p><b>Diagnosed before touching art.</b> The engine feathers any sprite edge its probe finds art on: each frame is drawn into a 48&times;48 canvas and the border rows are sampled at alpha&nbsp;&gt;&nbsp;24 (<code>data/sprite_edges.js</code>). One border sample therefore covers <b>1332&nbsp;/&nbsp;48 = 27.75</b> source pixels &mdash; anything within ~28&nbsp;px of the edge bleeds into it. Virga&rsquo;s shipped table said exactly what the user was seeing:</p>',
  `<pre style="${PRE}"><code>fly      9/9 frames clean            <- 66px of margin. The intended composition.`,
  'idle     8/9 flagged left/right    <- the wings',
  'attack   4/9 flagged',
  'walk     3/9 flagged   (frames 2 and 5 genuinely CUT: 0px, wing runs off canvas)</code></pre>',
  '<p><b>Recomposed, not regenerated.</b> The artwork is good &mdash; it is simply laid out too large for its canvas in three of the four states, and <code>fly</code> proves the intended framing. Regenerating 27 frames through ludo.ai would have risked style drift against the 9 fly frames that were already correct. Instead every idle/walk/attack frame is uniformly scaled to <b>k&nbsp;=&nbsp;0.913</b> inside the <em>same</em> 1332&times;1332 canvas, centred horizontally, with the content&rsquo;s bottom pinned exactly where it was so the feet never move. Margins went from <b>0&ndash;3&nbsp;px to 59&ndash;124&nbsp;px</b>, and all 27 frames now read as uncut.</p>',
  '<p><b>She is the same size on screen.</b> One shared <code>k</code> for the three states (they differed by under 0.3%, and a shared value keeps idle&harr;walk&harr;attack transitions from popping), cancelled by a per-state calib <code>s&nbsp;=&nbsp;1/k&nbsp;=&nbsp;1.095</code> under the exact keys the renderer looks up &mdash; <code>zodiac/idle</code>, <code>zodiac/walk</code>, <code>zodiac/attack</code>, verified against <code>_loadBossFrames</code>. Both the recompose and the calib scale are anchored at the feet, so they cancel precisely. <code>fly</code> is untouched and stays at s&nbsp;=&nbsp;1.</p>',
  '<p>The two genuinely truncated walk frames stay truncated &mdash; those pixels never existed &mdash; but they now end as a clean interior edge instead of a fading one. <code>scripts/virga_wings_test.mjs</code> &mdash; 7 checks: the margin on all 27 frames, the canvas size (the renderer derives draw size from the source long edge, so a changed canvas would silently resize the boss), the shipped edge table, the calib compensation, and two controls &mdash; fly untouched, and the probe still flagging genuinely cut sprites elsewhere.</p>',
  '<p><b>Note on the edge table:</b> regenerating it swept all 6,209 sprites and picked up <code>zodiac/pounce/leo_*</code> changes from another session&rsquo;s <em>uncommitted</em> art. Only the Virga keys were taken; every other entry was left exactly as origin had it.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 6000) { console.error(`ABORT: moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG v0.30.293 (+${grew} chars)`);
