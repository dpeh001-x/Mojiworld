import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span><span class="pill polish">polish</span> Follow-ups: prism pips · Verge/Sprawl mid-bosses · talent respec</span></h2>
<p><strong>💠 Prism charges are finally visible.</strong> The priest&rsquo;s <code>_prismCharges</code> mechanic (Holy Light builds up to 5 charges; Celestial Aurora consumes them) has existed with <em>no display whatsoever</em>. It now renders as prism pips one row above the Arcane Ember flames (same pip pattern, priest-only), updating on both the build and the consume.</p>
<p><strong>Rare mid-bosses for the new L60-70 grounds</strong> (pathsBane idiom — <code>miniElite</code> + one revive): 🥀 <em>Blight Elder</em> (Lv 64, Gloomspore Verge — towering smash-telegraph treant that gets back up once) and 🦴 <em>Ossuary Tyrant</em> (Lv 69, Ossuary Sprawl — bone-crowned heavy with a column-strike borrowed from the tomb-hexer&rsquo;s pillar fx, plus a revive). Both spawn as rare elites (<code>spawnChance 0.5</code>, 1 per map), reuse elderbark/boneGolem art via aliases, and carry full table wiring (natural levels 64/69, bestiary bounties, SFX families).</p>
<p><strong>↻ Talent respec.</strong> Talents are no longer locked forever: a chosen talent&rsquo;s U-panel card now shows a <strong>Respec (300◈ setshards)</strong> button — confirm dialog, shard deduction, choice cleared, and the one-of-three pick modal reopens immediately. Sits between the Craft (200◈) and Heirloom (500◈) tiers of the shard economy.</p>
<p>Verified live: prism pips render at 3 charges and hide at 0 (priest-gated); both mid-boss types resolve with sprites loading via alias, bounties generated, and spawn entries live; respec deducts exactly 300◈ (500&rarr;200), clears the choice, and reopens the pick. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
