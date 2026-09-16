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
  '<h2>' + VER + ' <span class="tag"><span class="pill balance">balance</span> Ground Slam: every line of damage &minus;25%</span></h2>',
  '<p>Per user: <em>&ldquo;Reduce ground slam per line of damage by 25%&rdquo;</em>.</p>',
  '<p>Ground Slam deals its damage in three kinds of line, all through <code>performAround</code> (ATK &times; multiplier on every foe in the radius). Each is cut by exactly a quarter:</p>',
  '<table><tr><th>Line</th><th>Count</th><th>Was</th><th>Now</th></tr>',
  '<tr><td>Somersault ticks (120 px)</td><td>4</td><td>0.55&times; ATK</td><td>0.4125&times;</td></tr>',
  '<tr><td>Landing (190 px)</td><td>1</td><td>2.7&times;</td><td>2.025&times;</td></tr>',
  '<tr><td>Shockwave rings (110&ndash;230 px)</td><td>3 (4 with the rank bonus)</td><td>1.2&times;</td><td>0.9&times;</td></tr>',
  '<tr><td><b>A full cast on one foe</b></td><td></td><td><b>8.5&times;</b></td><td><b>6.375&times;</b></td></tr></table>',
  '<p>Nothing else moves: radii, knockback, timing, cooldown and the visuals are untouched, and <code>performAround</code>&rsquo;s small +0&ndash;8 flat roll is shared by every skill that uses it, so it is left alone.</p>',
  '<p><code>scripts/gs_nerf_test.mjs</code> measures the multipliers off a <b>real cast</b> rather than reading them from the source: ATK pinned high so the flat roll is under 0.1% of a line, crits off, <code>hitMonster</code> replaced by a recorder, and a stand-in foe riding the warrior through the leap so every line reaches it. Run against the previous build it reads 0.55 / 2.7 / 1.2 and a total of 8.5&times; &mdash; so the test tells the two apart &mdash; and against this one 0.4125 / 2.025 / 0.9 and 6.375&times;, exactly &times;0.75. The first version recorded no hits at all: the harness boots into the Void, which counts as a town, and the sanctuary sweep deleted the stand-in foe every frame.</p>',
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
