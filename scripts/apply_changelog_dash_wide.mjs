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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Flurry, Dimensional Warp, Rush and Smoke Dash now reach wide bosses</span></h2>',
  '<p>A follow-up to the fix that let these four skills hit tall enemies. They still missed <em>wide</em> ones: each skill checked whether the <b>middle</b> of the enemy was within reach. A boss is several times wider than you, so his middle can be far out of reach while his body is right in front of you:</p>',
  '<ul>',
  '<li><b>Dimensional Warp</b> (mage) passed through King Krook standing about 140&nbsp;px ahead, even though the warp&rsquo;s strike zone covered half his body. Warping <b>up</b> hit a boss only if you stood at his exact middle.</li>',
  '<li><b>Flurry</b> (rogue) missed a boss near the far end of the blink.</li>',
  '<li><b>Rush</b> (warrior) landed its body hit on a boss you ran into, but most of its five flame bursts missed.</li>',
  '<li><b>Smoke Dash</b> (rogue) missed a boss standing across the dash path, and its cloud missed a boss beside the landing spot.</li>',
  '</ul>',
  '<p><b>Now</b> each skill hits an enemy as soon as any part of his body is inside its strike zone. The reach of every skill is unchanged. Enemies about your size are hit exactly as before, and a small monster just outside the reach is still missed.</p>',
  '<p><b>Verified.</b> <code>scripts/dash_wide_test.mjs</code> &mdash; each skill cast at King Krook, King Gloopaloo and Leo at two distances inside its reach, plus a Shroom just outside the reach and one inside it, and no page errors. On the build before this fix all 15 boss checks fail (Flurry, Warp and Smoke Dash landed nothing, Rush only its body hit). With the fix all 26 checks pass. The earlier tall-enemy test (<code>scripts/dash_hitbox_test.mjs</code>, 21 checks) still passes.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 300 || grew > 6000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
