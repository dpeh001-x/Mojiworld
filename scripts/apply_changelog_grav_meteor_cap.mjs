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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Gravitos: one falling meteor never takes more than 30,000 HP</span></h2>',
  '<p>Per user: <em>&ldquo;work on gravitos falling meteor, apparently it dishes too much damage, cap it to 30k HP damage&rdquo;</em>.</p>',
  '<p><b>Which hit it was.</b> Gravitos has three blue meteors &mdash; the Gravity Crush column (atk&nbsp;&times;1.2), the Crush Tendril (&times;3.5) and the Decay Pillar (&times;4.2) &mdash; and each can reach the player two ways. The <b>landing</b> has always clamped its final loss into the phase band. But since v0.30.45 the landing is only the 35% residual: the <b>fall</b> &mdash; the meteor&rsquo;s body striking on the way down &mdash; carries the full payload, and that hit never passed through the band at all: raw damage through DEF, block, class DR and Aegis, then the difficulty multiplier, straight off the bar, growing with every form and every difficulty. A co-op guest&rsquo;s copy of the detonation had no bound either.</p>',
  '<p><b>The cap</b> is 30,000 on the <em>final</em> loss &mdash; after every mitigation, the difficulty multiplier and the band &mdash; at all three sites, and only for his meteors. After the band, so the band can only tighten it. The telegraph, the knockback and every other boss&rsquo;s meteors are untouched. A guest recognises the meteor by a flag on the host&rsquo;s message, and by its source label in case a relay forwards only the fields it knows.</p>',
  '<p><b>Verified.</b> <code>scripts/grav_meteor_cap_test.mjs</code> &mdash; 7 checks in a live arena with a 900,000&nbsp;HP bar to read the hit off: a 5,000,000-damage pillar, tendril and crush column each take <b>exactly 30,000</b> on the way down; the landing alone takes 17,750 (the form-3 band, under the cap); an ordinary hit under the cap is left alone; another boss&rsquo;s meteor is not capped; the guest is capped by the flag and by the label. Against the previous build the same run takes <b>the whole 900,000 bar</b> on the fall and 18,215,381 off the guest.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 1500 || grew > 8000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
