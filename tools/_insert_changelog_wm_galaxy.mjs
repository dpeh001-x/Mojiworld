import { readFile, writeFile, unlink } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> 🌌 World Map (W) — full galaxy-themed visual overhaul</span></h2>
<p>The W-key World Map is now a galaxy. <strong>Backdrop:</strong> deep-space canvas (layered violet/cyan/magenta radial gradients with an inner cosmic glow border), three blurred <strong>nebula clouds</strong> (SVG radial gradients through a Gaussian filter), a tilted <strong>milky-way band</strong>, a <strong>70-star field</strong> (58 static in white/ice-blue/gold + 12 CSS-twinkling), and one lazy <strong>shooting star</strong> streaking the top corner every 9s. <strong>Edges:</strong> every portal connection is now a glowing <em>star-lane</em> — a soft cyan halo under a brighter violet core (156 paths for 78 links). <strong>Nodes:</strong> flat discs replaced with <strong>planet-sphere gradients</strong> (off-centre highlight reads as a lit globe) in three variants — violet worlds, gold hub-planets, darkened locked worlds — and the &ldquo;you are here&rdquo; halo now <strong>breathes</strong> (SMIL pulse on radius + opacity). <strong>Chrome:</strong> nebula gradients layered over the painted modal backdrop, a CSS star-shimmer layer, a glowing 🌌 nebula-gradient title, and a cosmic here-chip.</p>
<p>All map semantics untouched: gold safe-hub rings, crimson boss rings + ⚔, tier-coloured strokes, level pills, fog-of-war &ldquo;???&rdquo;, directional arrows, taxi dimming, and the key-1 connection editor all render exactly as before. Animations live only inside the modal (nothing runs while it&rsquo;s closed). Verified live: 4 nebulae, 58+12 stars, shooting star, 78 glow + 78 core lanes, 78 planet discs, all 3 gradients, shimmer layer, glowing title, and the pulsing halo (confirmed from town — the original check ran from the off-map Void). Visual confirmed via an in-page SVG rasterization. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
try { await unlink(new URL('./_wm_galaxy_preview.jpg', import.meta.url)); } catch (_) {}
console.log('Inserted ' + next);
