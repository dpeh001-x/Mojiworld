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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> The flying ticket was drawn 29% too short</span></h2>',
  '<p>Per user: <em>&ldquo;mticket sprite appears to be squished in game, likely a canvas error, could you unsquish it&rdquo;.</em> Not the canvas &mdash; a hardcoded aspect that never matched the art.</p>',
  `<pre style="${PRE}"><code>the draw branch     const w = p.w * 1.0, h = p.w * 0.59;   // "preserves 1.69:1"`,
  'the authored art    Sprites/projectiles/mticket.webp = 712 x 593  ->  h/w 0.833',
  'so it rendered at   0.59 / 0.833 = 71% of its correct height',
  '',
  'after: drawn 40.0 x 33.3 for a 40px projectile — h/w 0.833, 0.0% error</code></pre>',
  '<p>The 1.69:1 the comment cites was presumably placeholder art the constant was tuned against; the shipped sprite never had that ratio. The height is now derived from the sprite&rsquo;s own metadata at draw time, so it stays correct if the ticket is ever redrawn &mdash; the old constant remains only as the fallback for the frame before the image reports its size. Width is deliberately untouched: <code>p.w</code> is the box the projectile actually collides with, and an earlier pass aligned the rendered width to it on purpose. Only the height was wrong.</p>',
  '<p><b>Cleared of suspicion:</b> <code>_lxProjScaled</code>, which sits in the same call and was added days ago &mdash; it scales by one uniform factor and preserves aspect exactly.</p>',
  '<p><code>scripts/mticket_aspect_test.mjs</code> &mdash; 3 checks that capture the real <code>drawImage</code> arguments during a frame and compare the drawn ratio against the sprite&rsquo;s metadata, so it fails again if either the art or the constant drifts. Its own first version passed on the wrong call: <code>_lxProjScaled</code> blits into an offscreen cache canvas with the identical 5-argument shape and the same aspect, so the assertion now filters to the main canvas context.</p>',
  '<p><b>Noticed while sweeping the same function, not changed:</b> <code>msplinter</code> draws its 768&times;768 (square) sprite at h/w&nbsp;0.667. Unlike the ticket it carries no comment claiming to preserve an aspect, so the flattening reads as deliberate art direction for a shard &mdash; flagged here rather than &ldquo;fixed&rdquo; on a guess.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1200 || grew > 5000) { console.error(`ABORT: moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: CHANGELOG ${VER} (+${grew} chars)`);
