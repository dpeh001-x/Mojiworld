// Quest pass 2 · Batch G — story-arc gating. The Hourglass chapters and the
// boss leg had NO prereqs (level gates only): a Lv68 player could start
// Hourglass V first, and because Hourglass V + The Warden's Refusal both
// target 'aetherion', ONE kill completed BOTH ("second confrontation"
// collapsed into the first). Engine gains array-prereq support; chapters chain.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // ENGINE 1: tickQuestUnlocks — array-tolerant prereq ([].concat handles string or array)
  { old: `    if (q.prereq && !(player.quests.completed && player.quests.completed[q.prereq])) continue;`,
    neu: `    if (q.prereq && !(player.quests.completed && [].concat(q.prereq).every(p => player.quests.completed[p]))) continue;   // v0.26.831+ — prereq may be a string or an array (all required)` },

  // ENGINE 2: _injectGiverQuests offer filter — same array tolerance
  { old: `             (!q.prereq || completed[q.prereq]) && (!q.cls || q.cls === player.cls)) {`,
    neu: `             (!q.prereq || [].concat(q.prereq).every(p => completed[p])) && (!q.cls || q.cls === player.cls)) {` },

  // Hourglass chain: II..V each require the previous chapter
  { old: `name: 'Hourglass II — Drowned Cartography', icon: '⌛', levelReq: 55, giver: 'Captain Plum', handIn: true,`,
    neu: `name: 'Hourglass II — Drowned Cartography', icon: '⌛', levelReq: 55, giver: 'Captain Plum', handIn: true, prereq: 'q_hourglass_1',` },
  { old: `name: 'Hourglass III — Brittle Steppes', icon: '⌛', levelReq: 61, giver: 'Wynn', handIn: true,`,
    neu: `name: 'Hourglass III — Brittle Steppes', icon: '⌛', levelReq: 61, giver: 'Wynn', handIn: true, prereq: 'q_hourglass_2',` },
  { old: `name: 'Hourglass IV — The Catacombs Remember', icon: '⌛', levelReq: 65, giver: 'Old Rye', handIn: true,`,
    neu: `name: 'Hourglass IV — The Catacombs Remember', icon: '⌛', levelReq: 65, giver: 'Old Rye', handIn: true, prereq: 'q_hourglass_3',` },
  // Hourglass V: needs ch.4 AND the first Aetherion fight (desc says "a SECOND time")
  { old: `name: 'Hourglass V — The Shardfather Speaks', icon: '⌛', levelReq: 68,`,
    neu: `name: 'Hourglass V — The Shardfather Speaks', icon: '⌛', levelReq: 68, prereq: ['q_hourglass_4', 'q_boss_aetherion'],   // v0.26.831+ — "a second time" now true: requires the first Warden fight, and fixes one kill completing both quests` },

  // Gravitos: soft story gate — the Warden before the Weight-Bearer (Act 4 order).
  // Deliberately NOT gated on q_zodiac_twelve (would wall the ending behind 12 boss fights).
  { old: `name: 'Petition the Weight-Bearer', icon: '🌌', levelReq: 90,`,
    neu: `name: 'Petition the Weight-Bearer', icon: '🌌', levelReq: 90, prereq: 'q_boss_aetherion',   // v0.26.831+ — Act 4 reads "Convince the Warden, then the Weight-Bearer"; now enforced` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} story-gating edits applied.`);
