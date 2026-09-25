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
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> DJ Vinyl&rsquo;s jukebox is a DJ console: one backlit pad per track, each with its own icon</span></h2>',
  '<p>Per user: <em>&ldquo;make the jukebox design WAY more hip popular and stylish with drift phonk vibes, make sure that each BGM also has a unique icon, make it like DJ console concept where each button on the DJ console plays a specific music&rdquo;</em>, then, with a photo of a pad controller: <em>&ldquo;Sort of this kind of interface: make it simple and cute, well mapped and organised&rdquo;</em>.</p>',
  '<p><b>The console.</b> The list of rows is now a little black controller like the photo. Across the top: a pink drifting-car badge, the name plate in chrome-pink italics, a <b>ドリフト・フォンク</b> sticker and a <b>found</b> counter (&ldquo;37 / 46 FOUND&rdquo;). The <b>left jog wheel</b> is the record: a rainbow LED ring round a grooved platter that spins while a track plays, with that track&rsquo;s icon on its label. The middle is a <b>rainbow fan meter</b> that dances while music plays, a screen with the track&rsquo;s full name and its running time, and <b>STOP</b> and <b>SHUFFLE</b> (a random track you have found, never the one already on). The <b>right jog wheel</b> is the music volume &mdash; the Settings music slider, turned by hand: drag it, scroll it, use the arrow keys or its &minus; / + keys, and it saves like the slider does.</p>',
  '<p><b>The pads.</b> One per track, all 46, in four colour zones like the photo&rsquo;s: <b>A &middot; towns</b> (cyan), <b>B &middot; wilds</b> (green), <b>C &middot; cosmic</b> (violet), <b>D &middot; bosses</b> (pink), numbered A1&ndash;A8, B1&ndash;B26, C1&ndash;C7, D1&ndash;D5. Each carries its own icon (ludo.ai, <code>scripts/gen_jukebox_icons.mjs</code>, in the HUD icons&rsquo; style): a volcano for Lava Cavern, a snowflake for Frozen Peak, a lollipop for Candy Canyon, a singularity for Gravitos, and so on. The playing pad lights up in its zone&rsquo;s colour and its icon bounces; an undiscovered track keeps its pad and number with a padlock and &ldquo;???&rdquo;, so you can see where the gaps are without the name being given away.</p>',
  '<p><b>It looks like real hardware.</b> After the first sample (<em>&ldquo;the background of the UI and the buttons can be improved to have more DJ console feel&rdquo;</em>): the body is a matte black faceplate with a fine brushed grain, a gunmetal bezel and four hex screws, with an RGB underglow strip along its bottom edge, under two club beams (pink, cyan) sweeping down through the haze. The deck and the pads sit in recessed plates; small printed labels (<b>DECK A</b>, <b>STOP</b>, <b>SHUFFLE</b>, <b>MASTER</b>, <b>PERFORMANCE PADS</b>, the model line <b>VNL-46</b>) are silkscreened on the plate. The record has a chrome rim and grooves; the volume knob is knurled aluminium in an LED arc that fills with the volume; the screen is a dark LCD with a pixel grid; STOP and SHUFFLE are round rubber buttons in LED rings (STOP&rsquo;s ring lights up while a track plays); &#10005;, &minus;, + and Done are rubber keys that press down. Each pad is a rubber pad backlit in its zone&rsquo;s colour; an undiscovered one stays unlit grey. All of this is drawn with borders, outlines and gradients, not shadows, so it keeps its look in the low-graphics mode, which turns every shadow off.</p>',
  '<p>What each pad plays, how discovery unlocks it and how Stop hands the map&rsquo;s own music back are exactly as before. The window no longer wears its Persona plate &mdash; the console has its own body &mdash; so <code>ui_panel_plates_test</code> drops it from its list. On a phone on its side the console fits the screen, drops the footer (the &#10005; closes it) and scrolls the pads.</p>',
  '<p><b>Verified.</b> <code>scripts/jb_console_test.mjs</code> &mdash; 17 checks: every track has its own 256&nbsp;px icon file and no two share one; 46 pads in zones A&ndash;D numbered like a pad bank; every found pad loads its own icon; undiscovered pads keep a padlock and do not leak the name, and pressing one plays nothing; pressing a pad lights it, spins the record with its icon and names it on the screen; STOP clears all of that; 25 shuffles never repeat or play a locked track; the volume wheel moves the music volume (50&nbsp;&rarr;&nbsp;60 by keys, back down by scroll and &minus;); at 1280&times;800 it fits and no pads overlap; on a phone on its side it fits and scrolls with tappable pads. <code>jukebox_all_bgm_test</code> 8/8, <code>panel_vh_audit_test</code> 17/17 and <code>polish_pass_test</code> 9/9 still pass; <code>panel_escape_test</code> gives the same 3/6 as the previous build.</p>',
  '');
s = s.replace(ANCHOR, ENTRY);
const grew = s.length - n0;
if (grew < 2500 || grew > 12000) { console.error('ABORT: moved ' + grew); process.exit(1); }
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
