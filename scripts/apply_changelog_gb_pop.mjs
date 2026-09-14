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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> B and G hits land like stickers &mdash; and white numbers were secretly blue</span></h2>',
  '<p>Per user, across several passes: <em>&ldquo;still actually appears smaller than crit &hellip; can have it overlapped and have some staggered delay &hellip; make it enlarge and pop before fading away&rdquo;</em>, then <em>&ldquo;can overlap much more, be bigger more stunning looking and more wow factor&rdquo;</em>, with a reference image, then <em>&ldquo;for this grey coloured damage make it have more white at the top of the gradient&rdquo;</em>.</p>',
  '<p><b>&ldquo;Smaller than crit&rdquo; was never the size.</b> Baked and measured at the shipped settings, a B/G glyph was already half again a crit&rsquo;s. What differed was the <em>entrance</em>: a crit spawns at age&nbsp;0 and plays its whole pop-in, ballooning to ~1.4&times;, while a column row was spawned at <code>life 24 / maxLife 30</code> &mdash; age&nbsp;6 of a 10-frame pop &mdash; so it skipped nearly all the overshoot and simply appeared. The crit was the one that <em>moved</em>, and movement reads as size.</p>',
  '<table><thead><tr><th>Number</th><th>Size</th><th>Actual ink</th></tr></thead><tbody>',
  '<tr><td>Normal hit</td><td>14</td><td>67 &times; 29</td></tr>',
  '<tr><td>Crit</td><td>18</td><td>86 &times; 39</td></tr>',
  '<tr><td><b>B / G</b></td><td><b>38</b></td><td><b>175 &times; 84</b></td></tr>',
  '</tbody></table>',
  '<p><b>The sticker outline.</b> Per the reference image: a heavy black edge with a thick <em>white</em> border outside it. Canvas strokes centre on the path, so the trick is painting the wide white first and the black over it &mdash; what is left is a clean white ring outside the black. The bright inner rim added in v0.30.730 goes back to crits only; an inner rim <em>and</em> an outer border reads as mush at this weight.</p>',
  '<p><b>They cascade, and they fan.</b> Rows landing inside a 3-frame window are held back five frames each so they walk on one at a time. A held row is <em>genuinely</em> paused &mdash; skipped by the draw <b>and</b> the tick &mdash; because otherwise it would burn its pop-in frames invisibly and walk on part-way through its own entrance, the exact defect being fixed. Each row also steps 64&nbsp;px sideways, wrapping every four.</p>',
  '<p>That step is not decoration, it is what makes the overlap work. At a 26&nbsp;px pitch each row is <b>69% buried</b> under the next; stacked vertically that was an unreadable pile, and three separate attempts (26, 34, 40&nbsp;px straight down) all failed. Rendering pitch/step pairs side by side showed that only a step near half the number&rsquo;s own width turns a buried stack into a fanned deck you can read every row of.</p>',
  '<p><b>And the wow.</b> The pop-in overshoot goes to 4.4 where a crit is 2.6, so it slams rather than arrives; the blast is 24 radial particles with its shockwave flash; a white-hot overpaint fades across the first four frames so it lands like something struck; and the tail inverts &mdash; a B/G number scales <em>up</em> as it fades (1.64&times;) where every other number shrinks (0.74&times;).</p>',
  '<p><b>The grey number, and a bug hiding under it.</b> A plain hit had no gradient at all &mdash; a flat fill measuring <code>rgb(255,255,255)</code> at the crown and <code>rgb(163,163,163)</code> at the foot, where the black anchor bleeds up. It now gets a cached ramp, pure white into silver. Building it exposed a real defect in <code>_mixHex</code>, the shared colour-blend helper: it reads colours with <code>parseInt(hex.slice(1), 16)</code>, which cannot handle <b>3-digit hex</b>. The plain damage number is <code>\'#fff\'</code>, and <code>parseInt(\'fff\', 16)</code> is <code>0x000FFF</code> &mdash; <b>blue</b>. The first render came out periwinkle, <code>rgb(167,171,236)</code>, which is what caught it. Harmless until now only because every previous caller happened to pass six digits; fixed in the helper, and the base now measures a neutral <code>rgb(233,233,236)</code>.</p>',
  '<p><code>scripts/gb_pop_test.mjs</code> &mdash; 10 checks, measured off real bakes and a live sim. Two are there because earlier versions of this work shipped or nearly shipped without them: the plain-crown check asserts white <em>and neutral</em> (the <code>_mixHex</code> guard), and the ramp is measured with the low-FX flag <em>forced</em> in both states &mdash; an earlier draft inherited whatever the environment chose, passed locally, and failed in the ship chain because its headless run had low-FX on. It was measuring the perf tier, not the feature.</p>',
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
