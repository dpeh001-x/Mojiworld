// Insert v0.26.946 changelog entry above the current top (v0.26.945).
import { readFile, writeFile, rename } from 'node:fs/promises';
const F = 'C:/Users/Xenon/Desktop/Mojiworld/CHANGELOG.html';
let s = await readFile(F, 'utf8');
const anchor = `<h2>v0.26.945 <span class="tag">`;
if (s.split(anchor).length - 1 !== 1) { console.error('anchor != 1'); process.exit(2); }

const entry = `<h2>v0.26.946 <span class="tag"><span class="pill feat">feat</span> Mobile deep pass &mdash; sprite preload gate, boot 2-3&times; lighter, controls hardened, perf sweep</span></h2>
<p>A 16-agent multi-pass over the mobile experience: 4 static analysts (sprite pipeline / controls / viewport / boot), 3 live browser testers at phone viewports, and a 9-agent perf fan-out &mdash; 25 audit findings + 14 ranked perf items, of which 31 fixes shipped. Verified end-to-end at 844&times;390, 390&times;844 and 320&times;568: zero console errors, zero control overlaps, all buttons in-viewport.</p>
<p><strong>All sprites now load before the game starts.</strong> New <code>_lxPreloadMapAssets(mapId)</code> fills the same memoized registries the renderer reads (monster idle/walk/attack frames, NPC idles, map background, deck skill icons) and the login gate now waits on it for the saved/start map &mdash; with live &ldquo;Decoding world&hellip; n/N&rdquo; progress, an 8s per-image cap and a 12s hard cap so a stalled connection can never block play. Warm-decode also awaits images still in flight instead of silently skipping them, and every later map transition fire-and-forgets the same preloader (once per map). Full preload stays impossible by design (~1GB of sprites); boss/zodiac frame sets decode in the background while the login form is up instead of holding it hostage.</p>
<p><strong>Boot is dramatically lighter on phones:</strong> the 3.2MB <code>gear_erase.js</code> no longer blocks the HTML parser (<code>defer</code>); the loading screen markup moved above the 4.7MB inline script so it paints during parse instead of after a multi-second white screen; the main rAF loop skips sim+render entirely behind the opaque overlay; both ~3MB BGM tracks stopped preloading during the sprite fetch window (warmed post-login); prop bbox <code>getImageData</code> scans deferred to idle time.</p>
<p><strong>Touch controls hardened:</strong> fixed a d-pad listener leak that defeated the 1.5s stuck-pointer recovery (one window listener leaked per press); mouse/pen presses now pointer-capture so slide-off can&rsquo;t stick a key; rotation releases all held virtual keys and hard-resets the d-pad; stale 320px-era grid CSS replaced (the arc cluster scales 0.62 as one unit &mdash; F/jump no longer land on the d-pad on iPhone SE); <em>every</em> trapped <code>.modal-overlay</code> now hides the deck (was 3 ids of ~18, so shop/inventory/quest taps got eaten); portrait d-pad raised clear of the jump arc.</p>
<p><strong>Viewport:</strong> portrait scale floor 0.5&rarr;0.33 (the floor was clipping ~25% of game width on every portrait phone); fit math reads <code>visualViewport</code> (iOS URL-bar/keyboard transitions no longer push the canvas under the toolbar); fullscreen-exit refits directly; mouse-only desktops in narrow windows no longer get touch buttons (pref-respecting).</p>
<p><strong>Perf sweep (runtime smoothness):</strong> god-ray + beam-FX gradients cached (were re-allocated every frame), flash/blackout rgba strings cached at 1% quantization, FX arrays compact in place instead of O(n) splices, paused-modal watchdog caches its 26 element lookups, minion live-list refills in place, boot-gate DOM check self-disables after reveal. Three higher-risk items (skill-button cooldown loop integration, hazard compaction, radial-gradient transform caching) documented but deferred pending playtests. <code>node --check</code> clean; live-verified.</p>

`;
s = s.split(anchor).join(entry + anchor);
await writeFile(F + '.tmp', s, 'utf8');
const back = await readFile(F + '.tmp', 'utf8');
if (back.length !== s.length) { console.error('mismatch'); process.exit(3); }
await rename(F + '.tmp', F);
console.log('changelog v0.26.946 inserted');
