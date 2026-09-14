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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">polish</span> B and G damage, tuned over six rounds of samples</span></h2>',
  '<p>A single pass built from a long back-and-forth, every step rendered and reviewed before shipping. Per user, in order: <em>&ldquo;the core should be more bigger than the white outline&rdquo;</em>, <em>&ldquo;chunkier and wider&rdquo;</em>, <em>&ldquo;the burst overlap can be vertically just above each other&rdquo;</em>, <em>&ldquo;I dont like this font, use the previous font but make it wider, bolder&rdquo;</em>, <em>&ldquo;a strong dropshadow also to attenuate the effect&rdquo;</em>, <em>&ldquo;do not horizontally stretch it, put a soft glow around the sticker&rdquo;</em>, <em>&ldquo;the white and black outlines can be thinner&rdquo;</em>, <em>&ldquo;the black outline in the inside can be slightly slightly thicker&rdquo;</em>, <em>&ldquo;make it enlarge and pop out dramatically&rdquo;</em>, <em>&ldquo;like a mini wobble shake&rdquo;</em>, <em>&ldquo;rotation maximum 10 degrees, remove the shockwave ring&rdquo;</em> then <em>&ldquo;wobble 12 degrees max&rdquo;</em>, <em>&ldquo;make the glow temporary larger then smaller as a replacement to the shockwave ring&rdquo;</em>, and <em>&ldquo;the outer glow is to thick and opaque &hellip; soften it, decrease the radius and size&rdquo;</em>.</p>',
  '<table><thead><tr><th></th><th>v0.30.736</th><th>Now</th></tr></thead><tbody>',
  '<tr><td>Core</td><td>38</td><td><b>46</b>, untransformed Impact</td></tr>',
  '<tr><td>White border</td><td>24</td><td><b>15</b></td></tr>',
  '<tr><td>Black edge</td><td>12</td><td><b>11</b></td></tr>',
  '<tr><td>Burst</td><td>fanned, 64&nbsp;px diagonal</td><td><b>vertical</b>, pitch 58</td></tr>',
  '<tr><td>Entrance</td><td>0.12 &rarr; 1.63&times;</td><td><b>0.06 &rarr; 2.08&times;</b></td></tr>',
  '<tr><td>Wobble</td><td>&plusmn;10&deg;</td><td><b>&plusmn;12.0&deg;</b> + a 6&nbsp;px judder</td></tr>',
  '<tr><td>Glow</td><td>11&nbsp;px, buried under the border</td><td><b>30/22/16 outside it</b>, swelling 1.6&times; on arrival</td></tr>',
  '<tr><td>Drop shadow</td><td>2/3&nbsp;px @ 0.55</td><td><b>7/9&nbsp;px @ 0.8</b>, full silhouette</td></tr>',
  '</tbody></table>',
  '<p><b>Four things that were not what they looked like</b>, and are the reason this took the rounds it did.</p>',
  '<p><b>The glow had been invisible.</b> A coloured halo was painted at 11&nbsp;px and the white border over it is wider &mdash; it had been covered completely since the border landed. A glow under a wider opaque ring is not a glow.</p>',
  '<p><b>The circular bloom on arrival was not a size problem.</b> The glow width was divided by the pop scale to pin it to a constant <em>device</em> width. Correct for a settled number; at frame&nbsp;0 the glyph is at 0.06&times; while the glow stayed full-size, so it painted a soft disc around a speck. It now divides by <code>max(1, scale)</code>, so the glow shrinks with the glyph and only becomes constant at full size &mdash; frame&nbsp;0 renders 2.9 device px instead of 30.</p>',
  '<p><b>&ldquo;Chunkier and wider&rdquo; is a family, not a size.</b> Impact is condensed; scaling it only ever made these taller. A pass in Arial Black was rejected, and so was a horizontal stretch &mdash; so the face is left exactly as it draws, and the only weight added is a 2&nbsp;px dilation (the glyph stroked again in its own fill). An earlier 5&nbsp;px dilation closed the counters of a condensed face and the digits merged into a blob.</p>',
  '<p><b>The wobble constant is not the angle.</b> The curve is <code>sin(age &times; 0.9) &times; W &times; (1 &minus; age/12)</code>, whose peak lands at about 0.81 of <code>W</code>. &ldquo;12 degrees max&rdquo; was solved as <code>W = 0.2094 / 0.81</code> and then checked frame by frame across the window: the peak is 12.0&deg; at frame&nbsp;2 and no frame exceeds it.</p>',
  '<p>Also folded in: the six literal copies of the border widths became two constants, because the dropped silhouette is stroked at the border width and six hand-typed copies is exactly how a shadow silently stops matching the thing it is a shadow of. And the burst pitch was chosen by rendering 50 / 58 / 66 side by side &mdash; at 50 each row&rsquo;s drop shadow ate the digits below it, at 66 the rows stopped overlapping at all.</p>',
  '<p><code>scripts/gb_core_test.mjs</code> &mdash; 9 checks measured off real bakes and the shipped formulas rather than read back from the constants: the entrance curve, the wobble peak across the whole window, the glow rendering 2.9 device px at frame 0 against 30 settled, Impact present at both font sites with no stretch anywhere, the shockwave ring gone, the silhouette reading the border width in both draw paths, and a control that a normal hit and a crit keep their own sizes and their own pop.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2000 || grew > 14000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
