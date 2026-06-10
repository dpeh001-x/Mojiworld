import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> 🌌 World Map galaxy — pass 2: living cosmos</span></h2>
<p>The galaxy now <em>moves</em>. <strong>Active starlanes:</strong> every link touching your current map brightens to ice-blue and carries a <strong>travelling light pulse</strong> (SMIL animateMotion riding the lane, staggered starts) — at a glance you can see exactly where you can go from here. <strong>Orbiting moon:</strong> the you-are-here planet gains a faint dashed orbit ring and a little gold moon circling it every 7s. <strong>Living backdrop:</strong> the three nebula clouds <strong>drift</strong> on slow 22–34s cycles (CSS transforms on wrapper groups so their rotations are preserved), a <strong>galactic core</strong> with a four-point cross-flare pulses in the corner, an <strong>aurora band</strong> sweeps diagonally across the void, a second <strong>comet</strong> streaks the opposite corner on a 13s offset, and an <strong>edge vignette</strong> deepens the sense of space. <strong>Touches:</strong> safe-hub gold rings now <strong>shimmer</strong>, planets glow under the cursor (CSS hover on new node/disc classes), and the 🌌 title&rsquo;s nebula gradient <strong>flows</strong> (7s iridescent loop).</p>
<p>Still zero gameplay cost (everything lives inside the modal) and zero semantic changes — edit mode, arrows, pills, fog-of-war, taxi dimming all untouched; active-lane styling is skipped in edit mode so the red/green delta lines stay readable. Verified live from town: 3 active lanes + 3 travelling pulses, drifting nebulae &times;3, core, aurora, vignette, comet #2, orbiting moon, 18 shimmering hub rings, 78 hover-wired planets, title animating <code>wm-iris</code>. Visual confirmed via in-page SVG rasterization. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
