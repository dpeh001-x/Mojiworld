import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../CHANGELOG.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const vers = [...src.matchAll(/v0\.26\.(\d+)/g)].map(m => +m[1]);
const next = `v0.26.${Math.max(...vers) + 1}`;
const m = src.match(/<h2>v0\.26\.\d+ /);
if (!m) { console.error('no top h2'); process.exit(2); }
const anchor = m[0];
if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(3); }

const entry = `<h2>${next} <span class="tag"><span class="pill feat">feat</span><span class="pill polish">polish</span> Quest overhaul — longer quests, fairer rewards, real quest-giver NPCs</span></h2>
<p><strong>Multi-agent audit of all 29 hand-authored quests</strong> drove a full length + reward + coherence pass.</p>
<p><strong>Longer quests, fairer rewards.</strong> Lengthened 16 short kill/visit quests by ~30-50% (with the hardcoded kill-counts in every description rewritten to match): starters (e.g. <em>A Slimy Welcome</em> 28&rarr;36, <em>Sweet Tooth</em> 35&rarr;48), mid-game (<em>Foxhunt</em> 38&rarr;52, <em>Reef Toll</em> 34&rarr;48, etc.), and the high-level visits. Trimmed the rewards that sat well above the bestiary baseline (<em>Bathhouse</em> 5000&rarr;4400c, <em>Reef Toll</em> 4600&rarr;4300c, <em>Sing Back the Depths</em> 5400&rarr;4900c, the over-rich Lv5 <em>Pond Patrol</em> stipend), and lowered the <em>Endless Express</em> dynamic ceiling (~11k&rarr;9.1k coins so the side-run no longer out-pays the Stage-4 finale). Fixed the <strong>Hourglass Expedition</strong> arc whose chapter counts ran <em>backwards</em> (44&rarr;34&rarr;30&rarr;24) into a rising curve (50&rarr;42&rarr;38&rarr;32) with monotonic rewards (10k&rarr;11.5k&rarr;13k&rarr;15k&rarr;17k) and a penultimate-chapter gear drop.</p>
<p><strong>Real quest-giver NPCs (new turn-in system).</strong> Previously the named givers in quest prose (Nurse Joyce, Brok, Old Arlen, &hellip;) were pure flavour — quests auto-unlocked by level and auto-completed on the final kill, so the NPC never actually handed anything over. Added a <code>handIn</code> turn-in flow: tagged quests now flag <code>readyToHandIn</code> on the final kill (with a &ldquo;return to &lt;giver&gt; to claim your reward&rdquo; toast) instead of auto-completing, and a single <code>_injectGiverQuests()</code> hook at the dialog render point makes <strong>every</strong> giver NPC offer the quest, show live progress, and accept the turn-in &mdash; 13 quests wired across 9 NPCs (Nurse Joyce, Auntie Innie, Old Arlen, Hera, Brok&times;3, Captain Plum, Wynn, Old Rye, Skirra). One generic code path, no per-NPC dialogue rewrites; quests without a coherent giver keep the legacy auto-complete. Also fixed the <em>Endless Express</em> journal desc, which still promised a retired &ldquo;Milo opens the Express&rdquo; flow.</p>
<p>Engine verified sound by the audit (all reward fields pay out, every <code>count</code> equals its objectives sum, all potion keys valid). New flow verified live end-to-end: offer &rarr; accept &rarr; progress &rarr; hand-in defer &rarr; claim (420c granted), all 9 givers fire the dialog injection, and non-<code>handIn</code> quests still auto-complete. <code>node --check</code> clean.</p>

`;
src = src.replace(anchor, entry + anchor);
await writeFile(FILE, src, 'utf8');
console.log('Inserted ' + next);
