// Phase 1 Batch A — starter quests: lengthen counts ~30-40%, sync prose numbers,
// rebalance rewards (trim the over-rich axolotl). READ-ONLY-safe exact-match edits.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // ---- q_slime_intro: 28 -> 36 (16/10/10) ; 360/220 -> 420/260 ----
  { old: `kind: 'kill', target: 'slime', count: 28,`,
    neu: `kind: 'kill', target: 'slime', count: 36,` },
  { old: `objectives: [ { target: 'slime', count: 12 }, { target: 'petalfly', count: 8 }, { target: 'snail', count: 8 } ],`,
    neu: `objectives: [ { target: 'slime', count: 16 }, { target: 'petalfly', count: 10 }, { target: 'snail', count: 10 } ],` },
  { old: `Thin all three — 12 slimes, 8 petalflies, 8 snails.`,
    neu: `Thin all three — 16 slimes, 10 petalflies, 10 snails.` },
  { old: `rewards: { mojicoins: 360, exp: 220, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.438 — generous starter potion stipend`,
    neu: `rewards: { mojicoins: 420, exp: 260, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.823 — +29% length rebalance (28->36 kills)` },

  // ---- q_snail_pace: 38 -> 46 (22/14/10) ; 420/260 -> 480/300 ----
  { old: `kind: 'kill', target: 'snail', count: 38,`,
    neu: `kind: 'kill', target: 'snail', count: 46,` },
  { old: `objectives: [ { target: 'snail', count: 18 }, { target: 'mushroom', count: 12 }, { target: 'slime', count: 8 } ],`,
    neu: `objectives: [ { target: 'snail', count: 22 }, { target: 'mushroom', count: 14 }, { target: 'slime', count: 10 } ],` },
  { old: `Clear 18 snails, 12 mushrooms and 8 slimes, and she\\'ll dig you a charm out of the lost-and-found jar.`,
    neu: `Clear 22 snails, 14 mushrooms and 10 slimes, and she\\'ll dig you a charm out of the lost-and-found jar.` },
  { old: `rewards: { mojicoins: 420, exp: 260, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 10, mp_s: 5 } },  // v0.26.438 — generous starter potion stipend`,
    neu: `rewards: { mojicoins: 480, exp: 300, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 10, mp_s: 5 } },  // v0.26.823 — +21% length rebalance (38->46 kills)` },

  // ---- q_kill_gummy: 35 -> 48 (20/16/12) ; 560/340 -> 620/380 ----
  { old: `kind: 'kill', target: 'gummy', count: 35,`,
    neu: `kind: 'kill', target: 'gummy', count: 48,` },
  { old: `objectives: [ { target: 'gummy', count: 15 }, { target: 'cookie', count: 12 }, { target: 'scorpion', count: 8 } ],`,
    neu: `objectives: [ { target: 'gummy', count: 20 }, { target: 'cookie', count: 16 }, { target: 'scorpion', count: 12 } ],` },
  { old: `Set it right: 15 Gummibeau, 12 Cookies, and 8 of the venomous scorpions.`,
    neu: `Set it right: 20 Gummibeau, 16 Cookies, and 12 of the venomous scorpions.` },
  { old: `rewards: { mojicoins: 560, exp: 340, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.438 — generous starter potion stipend`,
    neu: `rewards: { mojicoins: 620, exp: 380, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.823 — +37% length rebalance (35->48 kills)` },

  // ---- q_kill_axolotl: 36 -> 48 (18/16/14) ; 720/440 -> 640/400 (trim over-rich; drop hp_m) ----
  { old: `kind: 'kill', target: 'axolotl', count: 36,`,
    neu: `kind: 'kill', target: 'axolotl', count: 48,` },
  { old: `objectives: [ { target: 'axolotl', count: 14 }, { target: 'frog', count: 12 }, { target: 'slime', count: 10 } ],`,
    neu: `objectives: [ { target: 'axolotl', count: 18 }, { target: 'frog', count: 16 }, { target: 'slime', count: 14 } ],` },
  { old: `Quell 14 axolotls (spare Lottie), 12 frogs and 10 slimes, and he\\'ll part with a charm`,
    neu: `Quell 18 axolotls (spare Lottie), 16 frogs and 14 slimes, and he\\'ll part with a charm` },
  { old: `rewards: { mojicoins: 720, exp: 440, gearChance: 1.0, gearSlot: 'accessory', gearTier: 1, potions: { hp_m: 4, hp_s: 8, mp_s: 6 } },  // v0.26.438 — generous starter potion stipend`,
    neu: `rewards: { mojicoins: 640, exp: 400, gearChance: 1.0, gearSlot: 'accessory', gearTier: 1, potions: { hp_s: 10, mp_s: 6 } },  // v0.26.823 — length rebalance (36->48) + trim over-rich reward (drop hp_m at Lv5)` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} starter-quest edits applied.`);
