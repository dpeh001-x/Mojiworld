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
  '<h2>' + VER + ' <span class="tag"><span class="pill feat">feat</span> Knight Guardian: a winged aegis, animated, twice the size &mdash; and never cut off</span></h2>',
  '<p>Per user: <em>&ldquo;For knight&rsquo;s skill guarding skill sprite and animation need to be larger and grander, more grandiose looking, ensure no cutoffs of canvas edges&rdquo;</em> (using ludo.ai).</p>',
  '<p><b>What it was.</b> One <em>static</em> sprite &mdash; a gold cross in a glowing ring &mdash; at size 180 for 50 frames, grown 0.5&times; &rarr; 1.1&times; and drawn <em>over</em> the knight. The <code>spawnFx(&#39;warrior&#39;,&#39;shieldBash&#39;)</code> beside it draws nothing (<code>FX_CATALOG</code> is empty), so that sprite was the whole effect.</p>',
  '<p><b>The art.</b> New from ludo.ai via <code>scripts/gen_knight_guardian_fx.mjs</code>: a gold heraldic tower shield with a cross crest, two vast wings of light and a spiked rune halo &mdash; deliberately unlike Holy Shield&rsquo;s blue crystal kite shield. Three candidates were drawn and the most symmetrical one animated into a <b>9-frame loop</b>: the wings beat, the halo pulses, a holy flash peaks mid-loop and sparkles rise. The base was seated in the middle half of its canvas before animating so the wingbeat had room to grow, and all nine frames share one crop so the loop cannot jitter. Every frame, and the static fallback (the loop&rsquo;s own frame 0), measured <b>zero ink on a 2px border</b>; the union of all nine sits 143px clear of every edge.</p>',
  '<p><b>In game.</b> Size 180 &rarr; <b>400</b> on a stately 0.78 &rarr; 1.06 swell &mdash; <b>417px</b> tall at full swell against the old 198 &mdash; held 84 frames instead of 50, looping every 5. It draws <b>behind</b> the knight and <b>follows</b> them: at this size an emblem on top buries the knight and every foe beside it, and one left at the cast point by a moving knight reads as a dropped decal.</p>',
  '<p><b>The other cutoff.</b> The first in-game sample, centred on the chest like the old sprite, had the <b>bottom third cut off by the bottom of the screen</b> &mdash; a knight standing on low ground is only ~100px above it. So the emblem is now seated with the knight at its foot (<code>pivotY 0.86</code>) and rises up behind them, and a new opt-in burst flag, <code>clampView</code>, nudges the whole box back inside the view rather than letting a screen edge slice it. Every other burst is untouched.</p>',
  '<p>Registration, all three of which fail silently if missed: <code>_FX_ANIM_KEYS</code> (an unlisted key never asks for frames), the frame index (<code>&quot;knight_guardian&quot;: 9</code> &mdash; an indexed folder answers 0 for an absent key), and <code>_LX_SKILL_FX</code> so a knight&rsquo;s loop is warmed before the first cast.</p>',
  '<p><code>scripts/knight_guardian_fx_test.mjs</code> &mdash; 9 checks in a live game. The on-screen check reads the box off the real <code>drawImage</code> call with the knight low on the ground, high near the top and at the left edge; a control spawns the same burst <em>without</em> the flag and confirms it still crosses the bottom edge, so the clamp is proven opt-in rather than assumed.</p>',
  '<p><b>Three harness problems found on the way, none in the game.</b> The game&rsquo;s service worker served requests that Playwright&rsquo;s interception never saw, so staged art 404&rsquo;d &mdash; and the <em>first sample sent for review partly showed the loop&rsquo;s static first frame</em> rather than the animation; it was re-captured with service workers blocked and re-sent. The draw probe matched original images, but the game swaps a set&rsquo;s entries for shrunk canvases after decode, so it saw nothing drawn; it now checks at call time. And a burst pinned at 2 frames of life genuinely expired when the sim ran two steps inside one heavy frame; it is pinned with a margin.</p>',
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
