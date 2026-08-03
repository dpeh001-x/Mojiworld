import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const anchor = m[0];
if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(3); }

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span><span class="pill bug">bug</span> Quest pass 2 — effort-fair rewards, story-arc gating, a fifth Dawn Fragment</span></h2>
<p><strong>Work-to-reward model.</strong> Built an effort model over every kill quest (&Sigma; kills &times; mob HP vs reward); the healthy band is ~25 EXP / ~47 coins per 1,000 effort-HP. Four big grinds paid 30&ndash;40% under band and are now fixed: <em>Tend the Wayfarer&rsquo;s Vigil</em> (the game&rsquo;s heaviest grind, worst rate of all 17 quests &rarr; 19,500c/10,000xp with echo-knights 10&rarr;8), <em>A Clean Shard for Skirra</em> (out-worked Hourglass III at the same level yet paid less &rarr; 15,500c/8,200xp), <em>Reef Toll</em> (&rarr;5,600/3,000) and <em>Sing Back the Depths</em> (&rarr;6,100/3,250), plus band nudges for the Forge-Key, Hourglass III exp, and the two starter inversions. <em>Bathhouse Cleansing</em> still over-paid 2&times; (its mobs are weak for Lv40) &mdash; fixed by counts (34/28/8) instead of a journal-visible reward cut. Boss-quest curve audited and left alone (Smith/Aetherion pay identical per-HP rates; Gravitos/Twelve bonuses are intentional toppers).</p>
<p><strong>Story arcs now actually gate.</strong> No story quest had a prereq &mdash; a Lv68 player could open Hourglass V first, and since Hourglass V and <em>The Warden&rsquo;s Refusal</em> both target Aetherion, <strong>one kill silently completed both</strong>. The engine now accepts prereq arrays, the Hourglass chapters chain I&rarr;II&rarr;III&rarr;IV&rarr;V, Hourglass V requires <code>['q_hourglass_4','q_boss_aetherion']</code> (the &ldquo;second confrontation&rdquo; is now really second), and Gravitos softly requires the Warden first (Act 4&rsquo;s stated order) &mdash; deliberately NOT gated on all twelve Zodiacs. The 5-chapter Hourglass arc also finally pays into the saga: new Dawn Fragment <em>The Stilled Hour</em> (journal pips now 5).</p>
<p><strong>Feasibility &amp; coherence.</strong> <em>Sweet Tooth</em> (Lv4) and <em>Pond Patrol</em> (Lv5) unlocked 8&ndash;11 levels before their monsters exist &mdash; now Lv11/Lv15. <em>Slow &amp; Steady</em> asked Lv1 players for mushrooms that only live in the Lv9 Fungal Hollow &mdash; objective swapped to petalflies (desc rewritten). Sunset Coast is now taxi-listable so Captain Plum&rsquo;s Hourglass II turn-in doesn&rsquo;t demand a cross-world hike. Stale prose fixed: PQ finale&rsquo;s &ldquo;STAGE 5&rdquo; copy (4-stage chain), Skirra&rsquo;s renamed hamlet, Aries&rsquo; desc now ties The First-Born to the Twelve Houses. Removed Milo&rsquo;s dead pre-v0.26.309 dialog branch that mislabelled the Carriage as &ldquo;Stage 2&rdquo;. Journal active cards now show a green <strong>&ldquo;&#8617; Return to &lt;giver&gt;&rdquo;</strong> pill when a hand-in quest&rsquo;s objectives are done (was toast-only).</p>
<p>Verified live: all new rewards/counts load, every count still equals its objectives sum, Hourglass V stays locked with ch.4 done but the Warden unfought and unlocks with both, saga total reads 5, the beach taxi flag is live, and the Return-to-giver pill renders. <code>node --check</code> clean.</p>

`;
src = src.replace(anchor, entry + anchor);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
