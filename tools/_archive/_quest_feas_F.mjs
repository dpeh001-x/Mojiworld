// Quest pass 2 · Batch F — feasibility: quests no longer unlock levels before
// their targets exist; Lv1 snail quest no longer demands Lv9-map mushrooms;
// Captain Plum's beach becomes taxi-listable for Hourglass II turn-ins.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // q_kill_gummy: levelReq 4 -> 11 (gummy/cookie/scorpion live in candyCanyon, map lvl 12)
  { old: `name: 'Sweet Tooth', icon: '🍬', levelReq: 4, giver: 'Auntie Innie', handIn: true,`,
    neu: `name: 'Sweet Tooth', icon: '🍬', levelReq: 11, giver: 'Auntie Innie', handIn: true,   // v0.26.831+ — was 4; targets only spawn in candyCanyon (map lvl 12)` },

  // q_kill_axolotl: levelReq 5 -> 15 (axolotl/frog live in bubblegumSwamp, map lvl 16)
  { old: `name: 'Pond Patrol', icon: '🦎', levelReq: 5, giver: 'Old Arlen', handIn: true,`,
    neu: `name: 'Pond Patrol', icon: '🦎', levelReq: 15, giver: 'Old Arlen', handIn: true,   // v0.26.831+ — was 5; targets only spawn in bubblegumSwamp (map lvl 16)` },

  // q_snail_pace: mushrooms only spawn in Fungal Hollow (lvl 9) — swap the objective
  // to petalfly so the whole quest is doable in the Lv1 starter forest.
  { old: `objectives: [ { target: 'snail', count: 22 }, { target: 'mushroom', count: 14 }, { target: 'slime', count: 10 } ],`,
    neu: `objectives: [ { target: 'snail', count: 22 }, { target: 'petalfly', count: 14 }, { target: 'slime', count: 10 } ],   // v0.26.831+ — mushroom (Fungal Hollow, lvl 9) swapped for petalfly so a Lv1 can finish` },
  { old: `Worse, the Fungal Hollow shrooms have crept down to vote on who owns the milestones, and slimes keep oozing across the cart-ruts.`,
    neu: `Worse, the petalflies have drifted down to fog the milestones with pollen, and slimes keep oozing across the cart-ruts.` },
  { old: `Clear 22 snails, 14 mushrooms and 10 slimes, and she\\'ll dig you a charm out of the lost-and-found jar.`,
    neu: `Clear 22 snails, 14 petalflies and 10 slimes, and she\\'ll dig you a charm out of the lost-and-found jar.` },

  // sunsetBeach: taxi-listable so Captain Plum (Hourglass II giver) is a warp away
  { old: `    // v0.25.621 — bumped 1 → 5 per user "push beginner maps up 3-8" ask.
    // Spawns are snail/slime/orange (Lv 1-7); player entering at Lv 5
    // finds appropriate-difficulty mobs that the new EXP curve can grind.
    levelReq: 5,`,
    neu: `    // v0.25.621 — bumped 1 → 5 per user "push beginner maps up 3-8" ask.
    // Spawns are snail/slime/orange (Lv 1-7); player entering at Lv 5
    // finds appropriate-difficulty mobs that the new EXP curve can grind.
    levelReq: 5,
    taxiAccessible: true,   // v0.26.831+ — Captain Plum gives/receives Hourglass II here; Lv55 players need a warp, not a hike` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} feasibility edits applied.`);
