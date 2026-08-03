import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> Mid-bosses go fully bespoke — anims, unique projectiles, pillar specials, SFX</span></h2>
<p>The user-authored <strong>Blight Elder</strong> and <strong>Ossuary Tyrant</strong> sprites are now fully wired (art aliases dropped) and both mini-bosses received the complete asset pipeline via ludo.ai:</p>
<p>&bull; <strong>Animations</strong> — 9-frame idle / walk / attack sets for both (54 frames), with bespoke motion prompts: the Elder lumbers on root-feet and root-fist-smashes with spore bursts; the Tyrant high-stomps with opposing club-arm swing and two-hand femur-club slams (body-locked, no zoom). Animator-tool manifest regenerated (127 entities).<br>
&bull; <strong>Unique projectiles</strong> — 🥀 <em>Grave-Seed</em> (tendril-wrapped blight pod, tumbling spin) for the Elder, who is now a <strong>ranged caster</strong> (shoot every 2.4s) on top of his smash; 🦴 <em>Soul-Bone Spear</em> (teal soul-fire femur, velocity-oriented) replacing the Tyrant&rsquo;s borrowed mbonechip.<br>
&bull; <strong>Special attacks + VFX</strong> — both now cast <strong>columnStrike pillars with their OWN ludo-generated column sprites</strong> (256&times;1024, per the established fx_col spec): a blighted-nature spore pillar for the Elder (new special: dmg&times;1.7, 8s cd) and an erupting-bone pillar for the Tyrant (replacing the borrowed tomb-hexer sprite). The Elder also gained a <strong>spore death-burst</strong> (explodesOnDeath, r170 &times;0.85) — punishing melee at both ends of his revive.<br>
&bull; <strong>Unique SFX</strong> — four clips into the zero-code per-monster override slots (<code>audio/monster/mob_&lt;type&gt;_hit/die.mp3</code>): wet timber crack + collapsing-tree death groan for the Elder; deep bone-plate knock + clattering bone-cascade death for the Tyrant.</p>
<p>Verified live: aliases gone with both types loading their own .png art, both projectiles registered (spin/orient blit modes) and decoded, both column sprites decoded, full kits on the types (Elder: shoot + pillar + death-burst + revive; Tyrant: spear + own pillar), all anim frames and SFX files fetchable. One generation hiccup: the Tyrant&rsquo;s first anim pass raced the user&rsquo;s file re-save and skipped — re-run cleanly. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
