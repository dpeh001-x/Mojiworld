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
  '<h2>' + VER + ' <span class="tag"><span class="pill bug">bug</span> Class Advancement cards no longer clipped &mdash; the choice prompt is back on screen</span></h2>',
  '<p>Per user, with a screenshot of the Berserker / Knight cards cut at the modal frame: <em>&ldquo;cut off for this job advancement UI please fix&rdquo;.</em></p>',
  '<p><b>Measured on the live modal</b> at the game&rsquo;s 960&times;560 canvas (screen px at the 1.333 wrapper scale):</p>',
  '<pre style="' + PRE + '"><code>row viewport   314      header stack ~150 (title 56+16, subtitle 28+14, divider 35), padding 72',
  'job tier       513  ->  199px hidden     card 684: icon 117, name 47, flavor 165, signature 93, basic skills 71, stats 33',
  'job, armed     571  ->  257px hidden     the "click again to become the ..." prompt sat entirely below the fold',
  'master tier    482  ->  168px hidden</code></pre>',
  '<p>The row <em>did</em> scroll, but with a thin near-invisible scrollbar on a dark ground, so to a player it was simply cut off &mdash; and the one line that makes the choice work was the part hidden. Two faults at once: cards too tall for the canvas the game is designed at, and nothing saying &ldquo;there is more&rdquo;.</p>',
  '<p><b>The fix</b> is CSS plus a twelve-line toggler. Every block compacted (modal padding 40/32&rarr;18/16, the 38&nbsp;px title to 26, subtitle and divider margins halved, card padding 26/22&rarr;14/16, flavor 13.5/1.62&rarr;12.5/1.45, signature and perk trimmed, the description&rsquo;s 56&nbsp;px of guaranteed air removed); the icon now sits <em>beside</em> the name instead of stacked above it &mdash; that block alone was 117&ndash;135&nbsp;px, and the two were already siblings, so no DOM change; the modal gives the row 97% instead of 92%. Result: <b>overflow 0 / 0 / 0</b>, cards 684&rarr;443&ndash;467&nbsp;px.</p>',
  '<p><b>And for the long tail</b> &mdash; three-card masters, longer flavor text, the armed confirm block &mdash; overflow is now <em>visible</em>: a gold scrollbar replaces the invisible thin default, and a &ldquo;scroll for more&rdquo; hint lives only while the row actually overflows, hiding once scrolled to the end. Toggled after each open and after a card is armed. The talent picker, which shares this modal, is untouched (it uses <code>tp-*</code> classes) and still fits its three cards.</p>',
  '<p><code>scripts/adv_modal_fit_test.mjs</code> &mdash; 6 checks that open all four screens for real: job resting, job armed (with the confirm prompt&rsquo;s box asserted <em>inside</em> the row&rsquo;s visible box), master, talent picker, a control that the hint is hidden when nothing overflows, and a <b>positive control</b> that forces 889&nbsp;px of overflow and requires the hint to appear and then vanish at the end &mdash; without which a &ldquo;fits&rdquo; pass could hide a dead affordance. On the unpatched build rows 1&ndash;3 fail at 199 / 257 / 168 and the toggler is absent.</p>',
  '<p><b>Process note:</b> the pre-push race check showed 75 deletions against origin where these edits account for ~35 &mdash; origin had moved under the working copy &mdash; so the file was re-synced and the anchor-guarded, idempotent apply script re-run before the push. Nothing of the parallel session&rsquo;s work was overwritten.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error('ABORT: moved ' + grew); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log('applied: CHANGELOG ' + VER + ' (+' + grew + ' chars)');
