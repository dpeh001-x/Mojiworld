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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> Marksman&rsquo;s B/G column: no total, gold rows, one size up</span></h2>',
  '<p>Per user: <em>&ldquo;For marksman B/G damage number, remove the total damage line, keep the rows make the colour gold and size slightly bigger&rdquo;</em>.</p>',
  '<p><b>Marksman was the one class the v0.30.730 pass never reached.</b> That release took the running total off B/G columns &mdash; but marksman&rsquo;s G and B are <code>marksman_oneshot</code> and <code>marksman_ult</code>, and both sit in <code>_LX_DE_LINE_SKILLS</code>, which <code>_lxGbStack</code> returns on: <em>Deadeye&rsquo;s own paths column themselves, and keep their tallies</em>. So they never took the volcano branch and kept the original Deadeye treatment &mdash; rows shrunk to 11&ndash;14 to leave headroom for a total that carried the read.</p>',
  '<p><b>And they were not gold.</b> A column row keeps whatever colour the number arrived wearing, which is the damage <em>tier</em> colour. Every Deadeye line is a guaranteed crit, so the lookup uses the crit palette &mdash; and that palette is <code>#ffffff</code> at tier 4. A marksman hitting hard enough had a column of small <b>white</b> numbers with a gold total sitting on top of it. That is exactly the report, and the test reproduces it rather than assuming it.</p>',
  '<p><b>Now:</b> the total is gone, the rows take the same gold the other classes&rsquo; B/G rows use, and they go from 11&ndash;14 up to 19 &mdash; past a crit&rsquo;s 18 and a normal hit&rsquo;s 14, nowhere near the 46px B/G sticker. The row pitch goes 20 &rarr; 26, because the taller glyph measures a 22px box and would otherwise touch its neighbour; the held spacing is asserted against that measurement, not eyeballed.</p>',
  '<p>Nothing builds a column total any more, so the branch that chose between having one and not having one went with it, along with the <code>sum</code> / <code>total</code> / <code>noSum</code> bookkeeping, the line in <code>_lxDeColumnsHold</code> that positioned it, and the now-dead <code>LX_COL_ROW_MAX</code>. The freshness test loses its <q>is the total still alive?</q> clause and is down to the column&rsquo;s own age.</p>',
  '<p><b>Deliberately left alone:</b> the window-close banners, <code>FOCUS FIRE 12.4K</code> and <code>OVERCLOCK 31K</code>. Those are named end-of-window readouts, not the total that sat on the column, and removing them was not what was asked for &mdash; a test pins them so they cannot go quietly.</p>',
  '<p><code>scripts/de_gold_test.mjs</code> &mdash; 10 checks in a live game. The one that matters most is not about colour at all: the freshness test was rewritten, and getting that wrong means every hit starts a fresh column and the stack silently stops stacking, so five hits are asserted to be one column of five live rows. Plus controls that the other classes&rsquo; volcano rows are untouched and that the size ladder still climbs normal &rarr; crit &rarr; marksman row &rarr; sticker.</p>',
  '<p>That last control was first written as an equality against two hard-coded pixel pairs, which measures the harness&rsquo;s device pixel ratio rather than this change; it asserts the ordering instead.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 12000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
