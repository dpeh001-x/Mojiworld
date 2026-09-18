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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Falling fireballs: twice the size, hit by the fireball you see, and a blast only a little wider than it</span></h2>',
  '<p>Per user, on a screenshot of two falling meteors: <em>&ldquo;the fireballs should be bigger by about 100% in all instances and hitbox should match it, this applies for monsters and skills, ensure it does not look pixelated&rdquo;</em>; then, on a crop of the fireball&rsquo;s glowing teardrop, <em>&ldquo;this part of the sprite should be the hitbox&rdquo;</em> and <em>&ldquo;the blast radius is just slightly expanded width from that when it hits the ground&rdquo;</em>.</p>',
  '<p><b>Which fireball.</b> The falling meteor &mdash; a lava rock in a flame bulb with a fiery trail &mdash; that the Archmage&rsquo;s <b>Meteor</b> drops, and that every monster with a falling-meteor attack drops too: Aries, Skirra, Aetherion&rsquo;s columns, Barnaby and the Sundered Smith&rsquo;s fire pillars, and the map ceiling hazards. They share one hazard and one drawing, so they all change. Gravitos&rsquo;s blue meteors are not fireballs and are exactly as they were; the Sage and Elementalist pyres rise from the ground and drop nothing.</p>',
  '<p><b>Size.</b> Drawn at 100&nbsp;&rarr;&nbsp;170&nbsp;px as it fell; now <b>200&nbsp;&rarr;&nbsp;340&nbsp;px</b>, with its six trail copies spaced to match. It lands with its bottom where the old one&rsquo;s landed, on the ground rune.</p>',
  '<p><b>Hitbox on the way down.</b> The glowing teardrop you see: the rock and flame bulb plus the first two trail copies stacked on it, from the rock of the second copy down to the bottom of the flame, as wide as the fireball. It was a 20&nbsp;&rarr;&nbsp;35&nbsp;px band centred on the middle of the picture &mdash; about 40&nbsp;px <em>above</em> the rock &mdash; stretched across the whole lane, so you could be hit well to the side of the fireball, and were hit a beat after it visibly reached you. Now a fireball hits what it overlaps, the frame it reaches it: a monster&rsquo;s on you, your Meteor on monsters.</p>',
  '<p><b>Blast on landing.</b> The fireball&rsquo;s hitbox at the moment it lands, 25% wider (with the same margin above and below): <b>136&nbsp;px wide</b>, on the ground. It was the whole lane (180&ndash;360&nbsp;px) for the full height of the screen, so a player on a platform high above the landing point was hit by the ground blast. The ground rune now shows the blast&rsquo;s width, the explosion is sized to it, and a co-op guest takes the same blast (the host now sends its height too). <b>Your Meteor is narrower for it:</b> it used to strike every monster in a 360&nbsp;px lane; it now strikes what the fireball falls through and a 136&nbsp;px blast where it lands, and its description says so.</p>',
  '<p><b>Not pixelated, and no dearer.</b> At the largest size and the desktop render cap (2&times;) the fireball needs 680 device pixels &mdash; exactly its source art; the animation&rsquo;s bake size rises 320&nbsp;&rarr;&nbsp;360 so the bake is never smaller than the draw. Twice the size is four times the area, drawn seven times with the trail, so it now draws only the column of the picture that has ink (every frame keeps all its pixels inside the middle 35% &times; 92%): the same picture for a third of the fill. Six fireballs at once measured 0.50&nbsp;ms against 0.65&ndash;0.90&nbsp;ms for the old small ones.</p>',
  '<p><b>Verified.</b> <code>scripts/fireball2x_test.mjs</code> &mdash; 22 checks in a running game at render scale 2: the size through the fall and the trail spacing; the cropped draw; blue meteors untouched; the hitbox matches the teardrop as drawn (measured on the real art at the real blits, within 3&ndash;4%); the landing point; the blast is the landing hitbox 25% wider and the rune shows it; on the real hazard ticker a monster&rsquo;s fireball hits a standing player on the frame it reaches them and its blast hits them, hits a player high in its path sooner but its blast does not reach them, misses a player 85&nbsp;px off-centre (inside the old lane) and one far away, and hits a player it overlaps even outside a narrow lane; your Meteor hits a monster the frame it reaches it and no longer hits one 130&nbsp;px off-centre; the co-op message carries the blast&rsquo;s height; the Meteor&rsquo;s text; the full 680&nbsp;px frame. It fails 18 of 22 on the previous build. <code>meteor_pillar_hitbox_test</code>, <code>grav_meteor_cap_test</code> and <code>meteor_sigil_splash_test</code> give the same results as on the previous build.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 12000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
