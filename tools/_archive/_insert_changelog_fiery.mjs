import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);   // insert at the FIRST h2 (top of the entry list)

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> New town map — The Fiery Hideout (beside Sauro Slope) with 2 service NPCs</span></h2>
<p><strong>The Fiery Hideout</strong> — a safe-zone rest stop carved into the basalt beside Sauro Slope. Mid-slope doorway portal (x:1200, between the Lava Cavern and Koopa Throne exits) with a return portal home; <code>isTown</code> (no spawns/chests), Lv 40 band, taxi-listable, on the W-map beside the slope&rsquo;s pin, ember-den sky over the slope&rsquo;s basalt backdrop, and the slope&rsquo;s lava ambience. Layout: brew loft, central ember shelf, forge canopy, chimney overlook.</p>
<p><strong>Two new service NPCs</strong> (ludo.ai-generated full-body chibi sprites, registered in <code>NPC_SPRITE_FILES</code>):</p>
<p>&bull; <strong>Ashka, Ember Alchemist</strong> 🧪 — sells potions (same shop as the town apothecary) with her own drake-fire-brewing voice and a judgmental kettle. <code>Sprites/npc/ashka.png</code>.<br>
&bull; <strong>Furnax, Forgemaster</strong> ⚒ — full forging service suite mirroring Brok&rsquo;s: Buy Gear, Sell Items, Enhance Gear, Craft Set Piece, Reforge Bench, Heirloom Transfer. <code>Sprites/npc/furnax.png</code>.</p>
<p>Both got dedicated dialogue roles (<code>emberAlchemist</code> / <code>forgeMaster</code>) with dialog-subtitle pips, so their voices are their own rather than reusing Joyce/Brok&rsquo;s lines. Verified live: map loads as a 0-monster safe zone, both NPCs spawn and talk, the potion shop opens from Ashka, all 6 Furnax service buttons render, both 512px sprites decode, and the slope portal warps in. <code>node --check</code> clean. (Mid-task note: survived a brief collaborator-session file-truncation incident — all prior work re-verified intact, and one clobbered batch was cleanly re-applied.)</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
