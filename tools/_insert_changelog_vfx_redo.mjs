import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill polish">polish</span> All 9 hazard VFX redone to match the house art style</span></h2>
<p>Per user, the <code>Sprites/vfx/</code> set (gravity well, frost beam, poison cloud, shock ring, lightning pillar, quake ring, dash streak, lava drop, lava pool — the monster special-skill hazard sprites) didn&rsquo;t fit the game&rsquo;s art: results had drifted across styles, from thick-outline western-cartoon (lava pool) to outline-less flat watercolor (poison cloud). <strong>All 9 regenerated via ludo.ai</strong> with the generator&rsquo;s style prefix rewritten to enforce the house look explicitly — <em>soft painterly cel-shaded anime, bold clean dark outline, glossy highlights, vibrant saturated</em>, with hard negatives against pixel-art / chunky-cartoon / watercolor / photoreal. The lava pair was also folded into <code>generate_mob_vfx.mjs</code> so one script now owns the whole directory, and the originals are preserved at <code>Sprites/vfx/_backup_redo/</code>.</p>
<p>Quality pass on every output caught two generation defects and rerolled them with hardened prompts: the dash streak had pulled a whole anime character into frame (now pure abstract violet speed energy), and the gravity well carried a residual square background plate + a stray disc artifact (now a clean circular vortex on full transparency). Verified live: all 9 <code>LX_VFX</code> images decode at 768px; the hazard renderers blit them with their existing procedural fallbacks untouched.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
