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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> A frozen mage can&rsquo;t warp, a stagger ends Siege Volley, and the zombie&rsquo;s poison lands at its feet</span></h2>',
  '<p>Three combat bugs found in a bug hunt.</p>',
  '<p><b>The mage&rsquo;s up-warp ignored freeze and stun.</b> Double-tapping <kbd>&uarr;</kbd> blinked a frozen or stunned mage about 160&nbsp;px upward, paying MP and cooldown, even though the keyed blink was (rightly) refused in the same state. The double-tap now respects freeze, stun and the other holds, like the dash and portals already did.</p>',
  '<p><b>Siege Volley survived a stagger.</b> Its description says it &ldquo;ends early if MP runs out or you are staggered&rdquo;, but a stagger only paused it and it kept firing afterwards. A stagger now ends it.</p>',
  '<p><b>The zombie&rsquo;s poison cloud always landed on the floor.</b> It was pinned to ground level, so a zombie up on a platform (the Tower puts most of its monsters on them) poisoned the floor far below and never the player fighting it. The cloud now lands at the zombie&rsquo;s feet; on the ground it is exactly where it always was.</p>',
  '<p><b>Verified.</b> <code>scripts/combat_fixes_test.mjs</code> &mdash; 7 checks: a frozen or stunned mage can&rsquo;t double-tap warp and a free one still can; a stagger ends Siege Volley and an uninterrupted one keeps going; the poison cloud lands at a platform zombie&rsquo;s feet and in its old place on the floor; no page errors. 3 of the 7 fail on the build before this fix.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 700 || grew > 4000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
