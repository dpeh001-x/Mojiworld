// Insert v0.26.949 changelog entry above v0.26.948.
import { readFile, writeFile, rename } from 'node:fs/promises';
const F = 'C:/Users/Xenon/Desktop/Mojiworld/CHANGELOG.html';
let s = await readFile(F, 'utf8');
const anchor = `<h2>v0.26.948 <span class="tag">`;
if (s.split(anchor).length - 1 !== 1) { console.error('anchor != 1'); process.exit(2); }

const entry = `<h2>v0.26.949 <span class="tag"><span class="pill feat">feat</span> F-portal fix, desktop touch mode, top-centre sprite bar + asset cache, Echoes portal, rainbow stairs</span></h2>
<p><strong>F no longer warps you through portals.</strong> The mobile F button picked its key by proximity and deliberately dispatched <kbd>&uarr;</kbd> when standing near a doorway &mdash; so tapping F to grab a chest or cast next to a portal teleported you instead. The portal branch is removed: portals are entered with <kbd>&#9650;</kbd> on the d-pad only, matching the desktop ArrowUp convention.</p>
<p><strong>&#x1F4F1; Touch controls anywhere.</strong> A new button below the fullscreen toggle turns the full mobile control deck (d-pad, attack arc, potion dock, menu row) on for ANY device &mdash; including desktop fullscreen. Rather than duplicating ~300 lines of layout CSS, toggling ON clones every coarse-pointer media block&rsquo;s rules into a runtime stylesheet, so future deck styling changes apply automatically; toggling OFF removes it cleanly. The viewport fitter treats forced-touch mode as a touch device so landscape positioning holds.</p>
<p><strong>Sprite loading: visible and cached.</strong> The loading indicator is now a top-centre progress BAR &mdash; &ldquo;&#x23F3; Loading sprites n/N &middot; %&rdquo; with a green fill that tracks percent &mdash; instead of a corner pill. And a new service worker (<code>sw.js</code>) caches all sprites/audio stale-while-revalidate: repeat visits serve assets from disk instantly while a background refetch keeps redrawn art fresh for next time. The game HTML itself is never cached, so code updates always land. Slow first loads remain bounded by the 12s gate; second loads should be dramatically faster.</p>
<p><strong>&#9876; Hall of Echoes at the tower base.</strong> The boss-rush portal now also stands at the bottom of the Interdimensional Ascension (x680, beside the Wayfarer&rsquo;s Lantern exit) &mdash; the original Void entry remains for early-game access.</p>
<p><strong>&#x1F308; Rainbow stairs.</strong> On Frozen Peak and the Interdimensional Ascension, every combo-boosted jump (active icy streak) now leaves a descending staircase of six glowing rainbow steps trailing behind the character, staggering in and fading over ~0.8s. Purely cosmetic &mdash; no collision.</p>
<p>Live-verified: deck toggles on/off on a 1280&times;720 mouse viewport (14.6KB CSS cloned/removed), service worker active, bar centred with fill at the right percent, Echoes portal present at (680, 14070), 6 stair fx spawn and decay at 61fps with zero console errors. <code>node --check</code> clean.</p>

`;
s = s.split(anchor).join(entry + anchor);
await writeFile(F + '.tmp', s, 'utf8');
const back = await readFile(F + '.tmp', 'utf8');
if (back.length !== s.length) { console.error('mismatch'); process.exit(3); }
await rename(F + '.tmp', F);
console.log('changelog v0.26.949 inserted');
