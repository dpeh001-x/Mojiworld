// Insert v0.26.943 changelog entry above the current top entry (v0.26.942).
import { readFile, writeFile, rename } from 'node:fs/promises';
const F = 'C:/Users/Xenon/Desktop/Mojiworld/CHANGELOG.html';
let s = await readFile(F, 'utf8');

const anchor = `<h2>v0.26.942 <span class="tag">`;
if (s.split(anchor).length - 1 !== 1) { console.error('anchor count != 1'); process.exit(2); }

const entry = `<h2>v0.26.943 <span class="tag"><span class="pill feat">feat</span> Mobile rescue &mdash; touch deck un-hidden, MapleStory-style arc, fullscreen prompt</span></h2>
<p><strong>Touch controls were invisible for every fresh mobile player</strong> &mdash; the shipped markup carried a stale <code>hide-mobile-ctrl</code> class baked into <code>&lt;body&gt;</code> by an old DOM-snapshot recovery, and boot only ever <em>added</em> that class (saved pref / <code>?nomobile=1</code>), never removed it. Fixed twice over: the class is de-baked from the markup, and <code>_initMobileControls</code> is now authoritative &mdash; no saved pref + no URL opt-out &rArr; controls force-shown. <kbd>Esc</kbd>-free toggle still works and still persists.</p>
<p><strong>MapleStory-M-style face cluster.</strong> The right-hand 3&times;3 button grid is gone; in its place the genre-standard corner layout: an 86&nbsp;px crimson basic-attack thumb circle anchored bottom-right, primaries <kbd>X</kbd>/<kbd>S</kbd>/<kbd>C</kbd>/<kbd>D</kbd> fanned on an inner arc (r=95) at thumb reach, utility + ults <kbd>F</kbd>/<kbd>V</kbd>/<kbd>G</kbd> on an outer arc (r=150), jump inset left at the thumb&rsquo;s resting spot. D-pad unchanged on the left (drag-friendly smart pad). Portrait scales the whole cluster to 0.78 as one unit instead of re-gridding it.</p>
<p><strong>Fullscreen at start.</strong> The rotate-to-landscape nag now leads with a green <em>&#x26F6; Fullscreen landscape</em> button &mdash; tap requests browser fullscreen + a landscape orientation lock via a new <code>_lxMobileFullscreen()</code> (deliberately <em>not</em> <code>toggleFullscreenDesktop()</code>, which flips force-desktop and would hide the touch deck). Landscape starters get the same treatment on their first login tap: Continue-as-Guest / Sign-in on a coarse-pointer device doubles as the fullscreen gesture.</p>
<p><strong>Sprite-load audit (mobile &ldquo;unfinished character&rdquo; report):</strong> all 806 asset paths referenced by the game cross-checked case-sensitively against the git index (GitHub Pages is case-sensitive; Windows isn&rsquo;t) &mdash; <strong>zero mismatches</strong>, and the character compositor verified rendering fully (hair + face + outfit) in a phone-sized viewport. Note: saves are per-device (localStorage), so a phone shows a fresh default character, not your desktop one. Verified live at 844&times;390 and 390&times;700: deck visible on fresh boot, arc laid out, nag buttons present; <code>node --check</code> clean.</p>

`;
s = s.split(anchor).join(entry + anchor);
await writeFile(F + '.tmp', s, 'utf8');
const back = await readFile(F + '.tmp', 'utf8');
if (back.length !== s.length) { console.error('write mismatch'); process.exit(3); }
await rename(F + '.tmp', F);
console.log('changelog v0.26.943 inserted');
