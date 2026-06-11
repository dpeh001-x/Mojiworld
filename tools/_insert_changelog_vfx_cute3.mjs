import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> Cute pass on 3 hazard VFX — lava drop, quake ring, lightning pillar</span></h2>
<p>Per user, <code>lava_drop</code>, <code>quake_ring</code> and <code>lightning_pillar</code> rerolled once more with two explicit requirements baked into the master generator&rsquo;s prompts: a <strong>uniform ~3px solid black contour outline</strong> around every shape (die-cut cartoon sticker weight) and <strong>a little cute</strong> — plump rounded kawaii forms, chubby pebbles/blobs/zig-zags, glossy bubbly highlights and tiny star sparkles, while still reading as danger zones (deliberately no faces). The quake ring&rsquo;s chunky outlined cobble-pebbles set the reference weight; the first lava-drop roll came back with only a thin rim and was rerolled with hardened &ldquo;fully enclosed by a pure-black contour, exactly like the quake-ring pebbles&rdquo; language until it matched. Prompts live in <code>scripts/generate_mob_vfx.mjs</code> so future regens keep the style. All three verified decoding at 768px in-game.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
