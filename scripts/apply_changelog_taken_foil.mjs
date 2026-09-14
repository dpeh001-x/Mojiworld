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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The damage you take is drawn like the damage you deal</span></h2>',
  '<p>Per user: <em>&ldquo;work on making the red damage taken design more similar to the damage dealt design&rdquo;.</em></p>',
  '<p><b>What the two looked like.</b> A hit you deal gets the full treatment: a coloured halo behind the glyph, a vertical gradient fill, a light inner foil over the black outline, and a specular band across the top. A hit you take got none of it &mdash; one flat fill inside the same 5&nbsp;px outline. Hence a flat red 14 sitting next to a gold, foiled 73,708.</p>',
  '<p><b>Now they match.</b> A damage figure spawned on you carries the same four passes, and the foil is mixed from the number&rsquo;s <em>own</em> colour rather than forced to one hue: a hit reads red, and the gold coin-loss number at the same spot stays gold. Crits keep their own gold foil, and the word pops &mdash; DODGE, PARRIED!, NEGATED &mdash; along with gains like &ldquo;+500&rdquo; are left exactly as they were, because only damage figures take the treatment.</p>',
  '<p><b>Where it is decided.</b> Not at the 103 places that spawn a number on the player &mdash; those are scattered across contact, hazards, projectiles, co-op and a dozen boss scripts, and they already disagreed with each other. Every one of them spawns at the player, so they are tagged there, and the look is chosen once in each of the two places that actually draw a number: the live path and the settled-number bitmap. Both get the same four passes, so a number does not change appearance when it settles and gets baked.</p>',
  '<table><thead><tr><th>Drawn for a 14 you took</th><th>Before</th><th>After</th></tr></thead><tbody>',
  '<tr><td>Halo behind the glyph</td><td>none</td><td>7&nbsp;px in its own colour</td></tr>',
  '<tr><td>Fill</td><td>flat</td><td>vertical gradient</td></tr>',
  '<tr><td>Inner foil</td><td>none</td><td>2&nbsp;px, mixed from its colour</td></tr>',
  '<tr><td>Specular band</td><td>none</td><td>clipped highlight pass</td></tr>',
  '<tr><td>5&nbsp;px black outline</td><td>yes</td><td>yes, unchanged</td></tr>',
  '</tbody></table>',
  '<p><code>scripts/taken_foil_test.mjs</code> &mdash; 7 checks that read the canvas calls the draw actually makes for one number, so a moving background cannot flatter them: the tagged number is filled with a gradient and wears a halo in its own colour plus a light foil; the same number untagged keeps a flat fill and no coloured marks at all; a tagged DODGE and a tagged &ldquo;+500&rdquo; get no coloured marks either; and a crit still wears its own gold.</p>',
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
