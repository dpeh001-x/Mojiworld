// Insert v0.26.948 changelog entry above v0.26.947.
import { readFile, writeFile, rename } from 'node:fs/promises';
const F = 'C:/Users/Xenon/Desktop/Mojiworld/CHANGELOG.html';
let s = await readFile(F, 'utf8');
const anchor = `<h2>v0.26.947 <span class="tag">`;
if (s.split(anchor).length - 1 !== 1) { console.error('anchor != 1'); process.exit(2); }

const entry = `<h2>v0.26.948 <span class="tag"><span class="pill feat">feat</span> Mobile clarity &mdash; labeled menu, potion dock by the d-pad, universal &#x2715;, sprite pill</span></h2>
<p><strong>Root cause of &ldquo;Y / U buttons not working&rdquo; found and fixed.</strong> The buttons dispatched fine &mdash; the trap was on the way OUT: modal close buttons rendered at <strong>21&times;21px</strong> (untappable on touch), the Codex (<kbd>Y</kbd>) had no mobile button at all, and two modals (Codex, Wardrobe) are key-toggle-only with no close button whatsoever &mdash; once one opened, the deck auto-hid and a phone player was hard-stuck. Three fixes: every modal <code>.close-btn</code> now meets a 44px touch floor on mobile; a <strong>universal &#x2715; button</strong> (48px, top-right, body-level so no stacking context can bury it) appears whenever a dismissible modal is up and routes through the same <code>closeAllModals()</code> path as <kbd>Esc</kbd> (mandatory modals &mdash; class select, advancement, tutorial &mdash; correctly don&rsquo;t show it); and the Wardrobe&rsquo;s class-based open state joined the modal watcher so the deck stops eating taps over it (the &ldquo;Q is messy&rdquo; report).</p>
<p><strong>Menu row de-mystified.</strong> Every top button now carries a tiny text label under its icon &mdash; MAP&nbsp;&middot;&nbsp;QUEST&nbsp;&middot;&nbsp;BAG&nbsp;&middot;&nbsp;LV&nbsp;UP&nbsp;&middot;&nbsp;SKILL&nbsp;&middot;&nbsp;CODEX&nbsp;&middot;&nbsp;STYLE&nbsp;&middot;&nbsp;TALK &mdash; ordered most-used-first, and the Codex (<kbd>Y</kbd>) finally has a button (&#x1F4D4;).</p>
<p><strong>Potions moved to the thumb.</strong> HP/MP left the top menu row for a dedicated <code>.mc-pot-dock</code> beside the d-pad &mdash; two 52px circles labeled <strong>HP</strong> (red) and <strong>MP</strong> (blue) at resting-thumb reach, in both orientations. They inherit all deck show/hide rules.</p>
<p><strong>Sprite-loading pill.</strong> A top-left pill now shows &ldquo;&#x23F3; Loading sprites n/N&rdquo; whenever assets stream in the background mid-play (map transitions, deferred boss sets), flipping to &ldquo;&#x2713; All sprites loaded&rdquo; and auto-hiding. The login gate still hard-blocks until the <em>starting</em> map&rsquo;s full sprite set is loaded+decoded (v0.26.946) &mdash; preloading the entire game up front stays off the table (~1GB of sprites would be minutes on mobile data), so the pill makes the deferred remainder honest and visible instead.</p>
<p>Live-verified at 844&times;390: Y opens the Codex, the &#x2715; closes it and unpauses, dock potions dispatch, labels render, pill counts 121/121 on two map preloads. <code>node --check</code> clean.</p>

`;
s = s.split(anchor).join(entry + anchor);
await writeFile(F + '.tmp', s, 'utf8');
const back = await readFile(F + '.tmp', 'utf8');
if (back.length !== s.length) { console.error('mismatch'); process.exit(3); }
await rename(F + '.tmp', F);
console.log('changelog v0.26.948 inserted');
