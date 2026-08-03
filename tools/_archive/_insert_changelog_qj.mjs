import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> 📜 Quest journal — Story / Class / Bounties, with the next beat always pinned</span></h2>
<p>The Everdawn saga spine was buried among ~80 auto-generated bestiary bounties and the per-level class lines — players couldn&rsquo;t tell what mattered. The journal now has a <strong>category layer</strong>: ✨ All · 🌅 <strong>Story</strong> (saga + advancement trials) · <strong>Class</strong> (your class line) · 🪙 <strong>Bounties</strong> (bestiary + side work), filtering whichever status tab (Active/Available/Completed) is open, with live counts per category.</p>
<p><strong>&ldquo;What do I do next?&rdquo; is now always answerable:</strong> the saga banner pins the <strong>next story beat</strong> (computed from the intended chain order — name, level gate, and whether it&rsquo;s underway / ready / locked), and the on-screen HUD quest tracker leads with a 🌅 <em>&ldquo;Next: &lt;beat&gt;&rdquo;</em> pointer row whenever the next beat isn&rsquo;t already active — refilling the void left by the removed advancement chip. Story quests also get their own <strong>dawn-ember toast tier</strong>: unlocking one fires &ldquo;🌅 STORY — &hellip;&rdquo; in a dedicated ember-and-violet style (new <code>story</code> rarity) instead of the generic purple &ldquo;New quest&rdquo;.</p>
<p>Verified live: 4 category chips render and filter correctly (Story shows exactly the 5 unlocked saga/advancement cards on the test save; Bounties 44), the pinned beat reads <code>q_inner_dim_trial</code> for a fresh-progress save, the story toast carries <code>data-rarity="story"</code>, and the tracker shows the Next pointer. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
