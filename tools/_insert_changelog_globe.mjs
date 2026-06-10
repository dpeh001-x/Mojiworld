import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> 🌌 World Map — globe spin-in on open</span></h2>
<p>Opening the W map now plays a <strong>one-round globe rotation</strong>: the whole galaxy diagram spins in with a 3D <code>rotateY</code> from 360&deg; to 0&deg; under a 1400px perspective, scaling up from 55% and fading in, decelerating into place over 1.6s (<code>cubic-bezier(0.22,1,0.36,1)</code>) — one full coin-spin round, then it settles and every interaction (hover glow, clicks, edit mode) runs untransformed. The class lives on the persistent grid container so internal re-renders never re-trigger it; a reflow poke restarts it cleanly on rapid close/reopen; and only the player W-key path spins — the dev key-1 editor opens instantly.</p>
<p><strong>Hardened against a real edge case caught during verification:</strong> occluded/throttled windows freeze CSS animations at the 0% keyframe and never fire <code>animationend</code> — which would have left the map invisible (opacity 0, scale 0.55). A 1.8s hard-fallback timer now guarantees the spin class drops no matter what; <code>animationend</code> still clears it (and the timer) earlier in the normal case. Verified live: class applied on open with <code>wm-globe</code> 1.6s animation + 1400px perspective, fallback armed, and after the window the class drops with <code>transform: none</code> / opacity 1 — fully visible even with animations frozen. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
