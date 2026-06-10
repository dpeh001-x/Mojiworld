import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> 🌌 World Map opener — globe spin replaced with a cinematic zoom-in</span></h2>
<p>Per user, the v0.26.872 globe rotation wasn&rsquo;t smooth: spinning the whole galaxy SVG (78 gradient planets + Gaussian-blurred nebulae) under a 3D perspective forces the browser to <em>re-rasterize the layer every frame</em> as its projection changes — visible jank on mid-range machines. Replaced with a <strong>cinematic zoom-in</strong> that is pure compositor work: the galaxy starts small, dim and slightly blurred (scale 0.62, blur 6px, drifted 14px down), <strong>flies toward you</strong> with a soft 1.2% overshoot, and settles sharp at full size — 0.9s on an ease-out-quint curve. <code>will-change: transform, opacity, filter</code> is hinted only while the class is on and releases on settle (verified back to <code>auto</code>), and the 3D <code>perspective</code> context is removed entirely.</p>
<p>Same hardened lifecycle as before: the class lives on the persistent grid (internal re-renders never re-trigger), a reflow poke restarts it on rapid close/reopen, <code>animationend</code> cleans up, and the hard fallback timer (tightened 1.8s &rarr; 1.1s for the shorter animation) guarantees the map can never stay stuck dim/blurred in throttled windows. Verified live: <code>wm-zoom</code> 0.9s active on open, no perspective, fallback armed, and post-settle the SVG reads <code>transform:none / opacity:1 / filter:none</code> with <code>will-change</code> released. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
