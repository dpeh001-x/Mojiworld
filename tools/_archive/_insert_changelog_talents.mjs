import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const idx = src.indexOf(m[0]);

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span> ✦ Job Talents (pick 1 of 3, permanent) + 🔥 Arcane Embers mage rotation</span></h2>
<p><strong>Build identity between advancements.</strong> Every job now has a <strong>Talent</strong> — a permanent perk chosen <strong>one-of-three</strong> the moment you advance (the pick modal chains right after the job lands, reusing the advancement card UI; existing characters past advancement choose theirs from a new card in the U panel&rsquo;s Level Up tab). 27 perks across 9 jobs — e.g. Berserker: <em>Bloodrush</em> (basics heal 5%) / <em>Rampage</em> (+10% ATK) / <em>Warbreaker</em> (+15% skill damage); Priest: <em>Benediction</em> (potions +35%) / <em>Sanctuary</em> / <em>Zeal</em>; Archmage: <em>Overflow</em> (crits refund MP) / <em>Archon</em> / <em>Mindspring</em> (+20% max MP)&hellip; Effects hook LIVE into the stat getters, the central <code>hitMonster</code> damage sink (skill-damage vs basic-attack split, crit MP refunds, basic-hit lifesteal), and <code>useConsumable</code> (potion boost) — deliberately NOT via <code>player.mods</code>, which the boon refresh zeroes. Choices persist (<code>talents</code> in the save whitelist), are cleared on class/job resets, and are strictly mutually exclusive.</p>
<p><strong>🔥 Arcane Embers — the mage finally has a rotation.</strong> Mage basic-bolt hits build Ember stacks (up to 5, shown as flame pips above the hotbar, 6-second weave window) and <strong>Fireball consumes them for +12% damage per stack</strong> (max +60%, with an &ldquo;Embers unleashed&rdquo; toast at 3+). Highest-burst class keeps its burst — but now minute-to-minute play is weave-bolts-then-detonate instead of cooldown-spam, fixing the rotation flatness without raw number changes.</p>
<p>Verified live: 9&times;3 perk table, pick modal (3 cards, heading restored after), choice persisted + double-choice blocked, Mindspring measured at exactly &times;1.20 max MP, Rampage at +10% additive into the ATK stack, Archon&rsquo;s <code>skillDmg 0.15</code> resolving via <code>talentFx()</code>, embers capping at 5 with pips rendering, consume returning exactly 1.6&times; then resetting, and the U-panel card rendering. <code>node --check</code> clean.</p>

`;
src = src.slice(0, idx) + entry + src.slice(idx);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
