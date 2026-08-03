// Quest pass 2 · Batch E — work-to-reward band fixes (target ~25 exp / ~47 coins
// per 1k effort-HP for Lv30+). Underpaying grinds bumped; bathhouse over-pay
// fixed via counts; onboarding decay restored for gummy/axolotl.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // q_visit_coralReef (Lv38, 119k effort-HP): 4300/2350 -> 5600/3000
  { old: `rewards: { mojicoins: 4300, exp: 2350, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 5, mp_m: 2 } },  // v0.26.823 — length+41% & trim overgenerous reward`,
    neu: `rewards: { mojicoins: 5600, exp: 3000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 5, mp_m: 2 } },  // v0.26.831+ — effort-band fix (was 30% under ~47c/25xp per 1k effort-HP)` },

  // q_visit_abyssalTrench (Lv42, 129k effort-HP): 4900/2650 -> 6100/3250
  { old: `rewards: { mojicoins: 4900, exp: 2650, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.823 — length+37% & trim overgenerous reward`,
    neu: `rewards: { mojicoins: 6100, exp: 3250, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.831+ — effort-band fix (was 30% under band)` },

  // q_visit_glasswind (Lv61, 355k effort-HP — paid LESS than hourglass_3 for 18% more work): 11500/6200 -> 15500/8200
  { old: `rewards: { mojicoins: 11500, exp: 6200, gearChance: 1.0, gearSlot: 'accessory', gearTier: 3, potions: { hp_l: 5 } },  // v0.26.823 — +15% length, xp nudge`,
    neu: `rewards: { mojicoins: 15500, exp: 8200, gearChance: 1.0, gearSlot: 'accessory', gearTier: 3, potions: { hp_l: 5 } },  // v0.26.831+ — effort-band fix (355k effort-HP out-worked hourglass_3 yet paid less)` },

  // q_visit_wayfarer (Lv68, worst rate in game): echoKnight 10->8 (240k HP of elites was half the grind), 14500/7600 -> 19500/10000
  { old: `kind: 'kill', target: 'mournshade', count: 40,`,
    neu: `kind: 'kill', target: 'mournshade', count: 38,` },
  { old: `objectives: [ { target: 'mournshade', count: 16 }, { target: 'lanternWisp', count: 14 }, { target: 'echoKnight', count: 10 } ],`,
    neu: `objectives: [ { target: 'mournshade', count: 16 }, { target: 'lanternWisp', count: 14 }, { target: 'echoKnight', count: 8 } ],` },
  { old: `Put down 16 mournshades, 14 lantern-wisps and 10 echo-knights`,
    neu: `Put down 16 mournshades, 14 lantern-wisps and 8 echo-knights` },
  { old: `rewards: { mojicoins: 14500, exp: 7600, gearChance: 1.0, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, mp_l: 2 } },  // v0.26.823 — +18% length, xp nudge`,
    neu: `rewards: { mojicoins: 19500, exp: 10000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, mp_l: 2 } },  // v0.26.831+ — was the worst pay-rate in the game (15.8 exp/1k HP vs ~25 band); stays under the Lv90 apex (20000)` },

  // q_visit_lavaCavern (Lv35): minor under-band nudge 4200/2300 -> 4700/2500
  { old: `rewards: { mojicoins: 4200, exp: 2300, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.434 — +fat dragon elite accent`,
    neu: `rewards: { mojicoins: 4700, exp: 2500, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.831+ — effort-band nudge` },

  // q_hourglass_3 (Lv61, 302k effort): exp 6500 -> 7200 (stays under ch.4's 7500; coin ladder untouched)
  { old: `rewards: { mojicoins: 13000, exp: 6500, potions: { hp_l: 4, mp_l: 2 } },  // v0.26.823 — arc curve fix (rising)`,
    neu: `rewards: { mojicoins: 13000, exp: 7200, potions: { hp_l: 4, mp_l: 2 } },  // v0.26.831+ — exp band nudge (stays under ch.4)` },

  // q_kill_gummy: 620/380 -> 870/560 (restores monotone onboarding decay vs axolotl)
  { old: `rewards: { mojicoins: 620, exp: 380, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.823 — +37% length rebalance (35->48 kills)`,
    neu: `rewards: { mojicoins: 870, exp: 560, gearChance: 1.0, gearSlot: 'accessory', gearTier: 0, potions: { hp_s: 12, mp_s: 6 } },  // v0.26.831+ — effort fix: 12.3k effort-HP paid less per-HP than the smaller Pond Patrol` },

  // q_kill_axolotl: 640/400 -> 700/440 (keeps decay ordering above gummy's rate)
  { old: `rewards: { mojicoins: 640, exp: 400, gearChance: 1.0, gearSlot: 'accessory', gearTier: 1, potions: { hp_s: 10, mp_s: 6 } },  // v0.26.823 — length rebalance (36->48) + trim over-rich reward (drop hp_m at Lv5)`,
    neu: `rewards: { mojicoins: 700, exp: 440, gearChance: 1.0, gearSlot: 'accessory', gearTier: 1, potions: { hp_s: 10, mp_s: 6 } },  // v0.26.831+ — band alignment with Sweet Tooth` },

  // q_visit_bathhouse (Lv40): 2x over band because its mobs are weak — fix via counts (22/18/8 -> 34/28/8; wraith capped, only 2 spawn), keep 4400/2400
  { old: `kind: 'kill', target: 'coralImp', count: 48,`,
    neu: `kind: 'kill', target: 'coralImp', count: 70,` },
  { old: `objectives: [ { target: 'coralImp', count: 22 }, { target: 'pearlSprite', count: 18 }, { target: 'wraith', count: 8 } ],`,
    neu: `objectives: [ { target: 'coralImp', count: 34 }, { target: 'pearlSprite', count: 28 }, { target: 'wraith', count: 8 } ],` },
  { old: `Clear 22 Coral Imps, 18 Pearl Sprites and 8 wraiths,`,
    neu: `Clear 34 Coral Imps, 28 Pearl Sprites and 8 wraiths,` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} ratio edits applied.`);
