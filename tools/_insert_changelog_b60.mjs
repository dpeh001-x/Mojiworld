import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> L60-70 bestiary fill — Gloomspore Verge + Ossuary Sprawl (6 new monsters)</span></h2>
<p>The L60-70 band — the game&rsquo;s most dangerous stretch under the punish curve, and previously its emptiest (~5 mob types vs 15-20 in the L20-40 bands) — gets <strong>two new hunting grounds</strong> before the Wayfarer wall and Aetherion/Gravitos:</p>
<p>&bull; <strong>🥀 Gloomspore Verge (Lv 62)</strong> — east of Thornspire Thicket; the bloom gone graveyard. New mobs: <em>Gravebloom</em> (Lv 62 seed-caster), <em>Wiltfang</em> (Lv 63 pack hound), <em>Sporewraith</em> (Lv 64 flying spore ghost) + redeployed thornmaw/pinechad/elderbark (32 spawns).<br>
&bull; <strong>🦴 Ossuary Sprawl (Lv 67)</strong> — east of Hollow Sepulchre; the bone fields. New mobs: <em>Marrowgeist</em> (Lv 66, phases out), <em>Cryptbinder</em> (Lv 67 bone-caster with ground spikes), <em>Ossuary Sentinel</em> (Lv 69 heavy with telegraphed greatswing) + redeployed lichkin/shardlich/sepulchreHound (32 spawns).</p>
<p>All six types reuse existing painted art via <code>MONSTER_SPRITE_ALIASES</code> (the vigil_vermillion mechanism — zero new assets, stats fully re-tuned on the band curve), and every required table is wired: <code>MOB_NATURAL_LEVEL</code> (mandatory for the gap scaler), bestiary bounties (Oakhart/Petunia/Old Rye, 6 new <code>b_*</code> quests), damage-SFX families, FLOATING set, taxi + W-map pins + portals both ways + bloom/sepulchre BGM &amp; ambience. <strong>Data audit:</strong> verified the new mobs scale identically to established same-level mobs (Marrowgeist and Mournshade, both Lv 66, scale at exactly the same 4.78&times; ratio for the same player), and confirmed <code>MOB_NATURAL_LEVEL</code> has no remaining gaps — bosses/tower mobs intentionally carry explicit <code>level:</code> fields instead. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
