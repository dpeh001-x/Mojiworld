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
  '<h2>' + VER + ' <span class="tag"><span class="pill polish">perf</span> Boss fights, smoother (round two): a popping damage number blits glyphs instead of rasterising text</span></h2>',
  '<p>Per user: <em>&ldquo;work on decreasing boss battle lags even more&rdquo;</em>.</p>',
  '<p><b>Measured first, with hits landing.</b> The earlier rounds profiled a fight nobody was hitting in. <code>scripts/_hud_cost.mjs</code> freezes Gravitos in idle, lands a hit 7 times a second, and reads the main thread&rsquo;s CPU time per frame off the <em>thread clock</em> of a Chrome trace, split by pipeline stage &mdash; a number other processes on the machine cannot distort, which mattered: frame rates on this machine swung 5&times; between identical windows during the work. With hits landing, <b>damage numbers were ~90% of the canvas flush, and of that the ten-frame pop was ~80%</b>: numbers forced to spawn already settled took the flush from 3.1 to 0.7&nbsp;ms/frame in one session, against 0.18 with numbers off.</p>',
  '<p><b>Why the pop is expensive</b> (<code>scripts/_dn_bench.mjs</code>). A settled number is one bitmap. A popping one is 3&ndash;6 passes of thick stroked text at a size that changes every frame, and numbers of several base sizes pop at once, so the glyph cache never has the size warm and every glyph of every pass is re-generated: eight mixed-size numbers popping cost <b>5.7&ndash;8.4&nbsp;ms</b> of flush per frame, the same text at one constant size <b>0.05</b>. Carrying the pop in the font size instead of the transform does not help; neither does a coarse size ladder; rotation is worse still. Only not rasterising text does. And a scaled bitmap is not allowed to be the answer: the 5&nbsp;px outline has to be the same width in every phase (v0.29.408, v0.30.460 &mdash; reported as varying twice), and a bitmap carries its outline with it.</p>',
  '<p><b>So the pop draws from a glyph atlas.</b> For each (base size, pop size, style, colour) the twelve glyphs a damage figure is made of are rendered <em>once</em> &mdash; at that exact font size, with a literal 5&nbsp;px outline &mdash; into a small canvas, <b>one row per pass of the live path</b> (shadow, halo, outline, rim, fill + highlight), so that drawn row by row across the whole number the layers stack exactly as they did when each pass was one call: a digit&rsquo;s halo can never tint its neighbour&rsquo;s outline. A popping number is then a handful of blits from one texture, placed on whole device pixels at exactly their own size (the same no-resample guarantee the settled bitmap carries). Pop sizes sit on a 4% ladder hung on the base size, so a pop needs six or seven atlases, not ten; one atlas is built per frame at most, and a number whose atlas is not ready draws live for that frame exactly as before. The cache is bounded (~48&nbsp;MB, oldest out first). The pop uses it in boss and heavy scenes &mdash; the frames that need it; B/G stickers and word pops keep the live path.</p>',
  '<p><b>The fade tail, and a guarantee I broke in v0.30.790.</b> That release made a fading number blit its settled bitmap under the shrink. Cheap &mdash; but a bitmap carries its outline, so a fading number&rsquo;s outline shrank with it (5 &rarr; 3.5&nbsp;px) beside neighbours holding a flat 5: <code>scripts/damage_number_outline_test.mjs</code> has failed 3 of 6 since, and I did not run it then. A fading figure now draws from the atlas at the shrunken size, in every scene: a literal 5&nbsp;px outline again, still no text. That test is back to 6 of 6, with <b>0&nbsp;px of spread across every draw path</b>.</p>',
  '<p><b>The font bug, found twice.</b> The comparison sheet for this change rendered four of every five live numbers in 10&nbsp;px sans-serif: the font cache sat inside the per-number <code>save()</code>/<code>restore()</code> pair. A parallel session found and fixed exactly that as v0.30.807 while this was being measured, the same way (font set before the save), so this change carries no font edit of its own &mdash; only a check that three same-size numbers popping live in one frame all draw in the damage font.</p>',
  '<p><b>Result</b>, atlas on/off alternated three times inside one warm session: canvas flush <b>1.80 &rarr; 0.40&nbsp;ms/frame (&minus;78%)</b>, main-thread CPU per frame <b>4.60 &rarr; 3.32&nbsp;ms (&minus;28%)</b> at 7 hits a second; a multi-hit skill lands several times that.</p>',
  '<p><b>Verified.</b> <code>scripts/dn_atlas_pop_test.mjs</code> &mdash; 11 checks in a live Gravitos arena: a popping figure rasterises no text; every glyph blit is on whole device pixels at its own size; the atlas picture covers the same pixels as the live text (IoU &ge; 0.90 at four ages for plain, crit and big, same size to within the ladder, same measured outline); every atlas is stroked with a literal 5&nbsp;px under the plain render scale whatever the pop size; a word, a B/G sticker and a calm scene all still draw live; three same-size numbers popping live in one frame all draw in the damage font; one build per frame; the cache holds its budget. <code>dmgnum_outline_test.mjs</code> 6/6, <code>damage_number_outline_test.mjs</code> 6/6 (was 3/6), <code>grav_smooth_test.mjs</code> 9/9 &mdash; three tests taught that a figure may blit glyph cells (<code>scripts/apply_dn_atlas_tests.mjs</code>). <code>dn_bitmap_dpr_test.mjs</code> fails 0/3 on the previous build and on this one with identical numbers; it is not touched here.</p>',
  '<p><b>Measured and not done yet.</b> The HUD is the next cost: CSS animations and transitions in the DOM (toasts, the combo pop, the combo and buff timers&rsquo; width transitions, the EXP sheen) force a style recalc on nearly every frame of a fight, and with them switched off the main thread&rsquo;s frame cost halves. That is a separate change, because the cheap versions of those have to look the same.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 3000 || grew > 14000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
