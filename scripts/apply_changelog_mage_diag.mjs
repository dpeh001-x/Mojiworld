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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Diagonal Slash stops tripling the mage&rsquo;s basic</span></h2>',
  '<p>Per user: <em>&ldquo;mage + diagonal attack boon not fixed yet&rdquo;.</em></p>',
  '<p><b>It is the same report as last time, and last time it was answered rather than fixed.</b> <b>v0.29.921</b> opens by quoting it &mdash; <em>&ldquo;if u equip the diagonal attack boon on mage, ur basic attack fires 3 projectiles, please look into the bug&rdquo;</em> &mdash; then says the three bolts are <em>&ldquo;deliberate &hellip; working as designed and is untouched&rdquo;</em> and goes on to fix a real but different defect beside it (the roll driving spread and reach). The reported symptom was never touched. That is why it came back.</p>',
  '<p><b>And the three bolts broke a standing rule recorded on the very line that broke it.</b> The code read:</p>',
  '<pre><code>const shots = _diagBolt &gt; 0 ? 3 : 1;   // v0.26.x &mdash; per user: mage Z (Magic Bolt) is',
  '// UNAFFECTED by projectile-count upgrades (multishot boon + equip). Single bolt always</code></pre>',
  '<p>The comment states the rule; the expression violates it. Magic Bolt is explicitly exempt from the multishot boon, from weapon multishot and from the universal Double Shot. Diagonal Slash was the one thing left multiplying it.</p>',
  '<p><b>What the boon is supposed to do</b>, read straight off the melee branch it was modelled on: <code>range *= (1 + roll)</code> and <code>tall += player.h * (0.55 + roll)</code>. <b>One</b> swing, reaching further and opening a taller band. No extra attacks, and no damage change of any kind &mdash; <em>&ldquo;+r% reach, hits high &amp; low&rdquo;</em> is a claim about what you can hit, never about how many times you hit it.</p>',
  '<p>So the caster version is now one bolt that flies further with a taller hit band. Both halves of the tooltip survive, including the reach scaling v0.29.921 correctly added. The &times;0.55 damage penalty goes with the tripling it was paying for: it had become a flat 45% cut to a mage&rsquo;s basic in exchange for equipping an epic unique.</p>',
  '<table><thead><tr><th>Roll</th><th>Bolts</th><th>Damage / bolt</th><th>Reach</th><th>Hit band</th></tr></thead><tbody>',
  '<tr><td>none</td><td>1</td><td>1189</td><td>38</td><td>14 px</td></tr>',
  '<tr><td>45%</td><td>3 &rarr; <b>1</b></td><td>654 &rarr; <b>1189</b></td><td>55</td><td>14 &rarr; <b>28 px</b></td></tr>',
  '<tr><td>70%</td><td>3 &rarr; <b>1</b></td><td>654 &rarr; <b>1189</b></td><td>65</td><td>14 &rarr; <b>32 px</b></td></tr>',
  '<tr><td>95%</td><td>3 &rarr; <b>1</b></td><td>654 &rarr; <b>1189</b></td><td>74</td><td>14 &rarr; <b>35 px</b></td></tr>',
  '</tbody></table>',
  '<p>The hit band was checked against the art rather than just widened: the bolt&rsquo;s sprite is sized from <code>p.w</code> alone (<code>sw = max(p.w,18) &times; 3.2</code>), so the drawn orb is ~64&nbsp;px while its hitbox was 20&times;14. Even a max roll leaves the band at 35&nbsp;px &mdash; comfortably inside the orb the player can already see, so the boon never claims reach the art does not show.</p>',
  '<p><code>scripts/mage_diag_test.mjs</code> &mdash; 7 checks in a live run: one bolt at every roll, it flies level, damage identical to an unequipped mage, reach still scaling with the roll, the hit band opening and staying inside the orb, the sim asserted to have stepped first, and a control that a <em>warrior</em> basic still swings higher with the boon than without &mdash; so the caster was not fixed by breaking the class it already worked on. That control is measured, not inferred: a synthetic monster guarantees the swing loop runs, `aabb` is stubbed to capture the hitbox and return false (no damage, no side effects), and the box is compared with and without the boon — 137&times;74 becomes 267&times;206. Its first draft checked whether a live mob took damage instead, passed locally and failed on a fresh boot, and was rewritten: it was measuring which monster the zone happened to spawn and a per-mob hit cooldown, not the code under test.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 10000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
