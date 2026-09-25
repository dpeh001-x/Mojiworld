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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> The MojiMon roster cards, made cute to match</span></h2>',
  '<p>Per user: <em>&ldquo;do the same cute style for the roster cards&rdquo;</em> &mdash; the cards for each MojiMon you have bound, under How to Bind and the buddy ring.</p>',
  '<p>Each MojiMon is now a plush card like the ones above: a stitched seam, a sprinkle of star dots and a pastel glow, turning mint while it is fielded. Its sprite sits in a pastel bubble and <b>bobs while it is out</b>; its name is in Fredoka with a mint <b>FIELDED</b> pill; its stats are pills (&#128150; max HP, &#9876; attack, &#128737; damage reduction), and its HP while out is a rounded candy bar.</p>',
  '<p><b>Buttons.</b> <kbd>&#9733; H</kbd> is a gold candy pill on the MojiMon that holds the quick-summon key (a plain <kbd>&#9734; H</kbd> on the rest); <b>&#10024; Summon Jelly</b> is a full-width mint candy button, greyed with &#128164; &ldquo;after the rest&rdquo; while the cooldown runs. The bond is a pill, lit mint on the <kbd>H</kbd>-slot MojiMon &mdash; the only one paying it out &mdash; with the same tooltip.</p>',
  '<p><b>Allocate points.</b> A gold &ldquo;16 free&rdquo; chip and a &ldquo;max 15 per stat&rdquo; chip, then one row per stat: round candy &minus; / + buttons, the points, a little meter filling up to the cap, and the bonus &mdash; HP pink, ATK butter, DEF sky. &minus; is greyed at 0 (where it did nothing) and + at the cap or with no points left, as before. With nothing bound yet, a dashed bubble with a bobbing &#128035; says &ldquo;your first buddy is out there waiting&rdquo;.</p>',
  '<p>The same buttons do the same things with the same numbers. It keeps its look in the low-graphics mode, stops bobbing for <em>reduce motion</em> and fits a phone held sideways.</p>',
  '<p><b>Verified.</b> <code>scripts/mm_roster_test.mjs</code> &mdash; 14 checks: the empty bubble; the fielded card (mint, FIELDED, HP bar at its real HP, no Summon); the stat pills match the real stats; the gold &#9733; H and lit bond on the H-slot MojiMon only; Summon greyed and resting on cooldown; each stat row&rsquo;s points and meter, &minus; greyed at 0 and + greyed at the cap; the free-points chip; + and &minus; move points; &#9734; H hands over the H slot and lights that bond; a ready &#10024; Summon fields the MojiMon; nothing spills and the stat pills stay on one line on desktop and a phone; no page errors. <code>mm_cards_test</code> 16/16 and <code>u_panel_text_test</code> still pass.</p>',
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
