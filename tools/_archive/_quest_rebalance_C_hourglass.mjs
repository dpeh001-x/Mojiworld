// Phase 1 Batch C — Hourglass arc (fix backwards 44->34->30->24 curve into a
// rising one) + 2 high-level visit quests. Lengthen, sync prose, rising rewards.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // q_visit_glasswind: 40 -> 46 (18/16/12) ; xp 5800 -> 6200
  { old: `kind: 'kill', target: 'mirageStalker', count: 40,`,
    neu: `kind: 'kill', target: 'mirageStalker', count: 46,` },
  { old: `objectives: [ { target: 'mirageStalker', count: 16 }, { target: 'glasswindHare', count: 14 }, { target: 'razorgale', count: 10 } ],`,
    neu: `objectives: [ { target: 'mirageStalker', count: 18 }, { target: 'glasswindHare', count: 16 }, { target: 'razorgale', count: 12 } ],` },
  { old: `Bring back the harvest from 16 stalkers, 14 hares and 10 razorgales`,
    neu: `Bring back the harvest from 18 stalkers, 16 hares and 12 razorgales` },
  { old: `rewards: { mojicoins: 11500, exp: 5800, gearChance: 1.0, gearSlot: 'accessory', gearTier: 3, potions: { hp_l: 5 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 11500, exp: 6200, gearChance: 1.0, gearSlot: 'accessory', gearTier: 3, potions: { hp_l: 5 } },  // v0.26.823 — +15% length, xp nudge` },

  // q_visit_wayfarer: 34 -> 40 (16/14/10) ; xp 7200 -> 7600
  { old: `kind: 'kill', target: 'mournshade', count: 34,`,
    neu: `kind: 'kill', target: 'mournshade', count: 40,` },
  { old: `objectives: [ { target: 'mournshade', count: 14 }, { target: 'lanternWisp', count: 12 }, { target: 'echoKnight', count: 8 } ],`,
    neu: `objectives: [ { target: 'mournshade', count: 16 }, { target: 'lanternWisp', count: 14 }, { target: 'echoKnight', count: 10 } ],` },
  { old: `Put down 14 mournshades, 12 lantern-wisps and 8 echo-knights`,
    neu: `Put down 16 mournshades, 14 lantern-wisps and 10 echo-knights` },
  { old: `rewards: { mojicoins: 14500, exp: 7200, gearChance: 1.0, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, mp_l: 2 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 14500, exp: 7600, gearChance: 1.0, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, mp_l: 2 } },  // v0.26.823 — +18% length, xp nudge` },

  // q_hourglass_1 (L51): 44 -> 50 (24/16/10) ; 9500/5000 -> 10000/5200
  { old: `kind: 'kill', target: 'emberling', count: 44,`,
    neu: `kind: 'kill', target: 'emberling', count: 50,` },
  { old: `objectives: [ { target: 'emberling', count: 22 }, { target: 'cinderling', count: 14 }, { target: 'forgewight', count: 8 } ],`,
    neu: `objectives: [ { target: 'emberling', count: 24 }, { target: 'cinderling', count: 16 }, { target: 'forgewight', count: 10 } ],` },
  { old: `Clear 22 emberlings from the slag, 14 cinderlings off the forge-floor and 8 forgewights`,
    neu: `Clear 24 emberlings from the slag, 16 cinderlings off the forge-floor and 10 forgewights` },
  { old: `rewards: { mojicoins: 9500, exp: 5000, potions: { hp_m: 6 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 10000, exp: 5200, potions: { hp_m: 6 } },  // v0.26.823 — arc curve fix (rising)` },

  // q_hourglass_2 (L55): 34 -> 42 (18/14/10) ; 11000/5500 -> 11500/5800
  { old: `kind: 'kill', target: 'anglerfish', count: 34,`,
    neu: `kind: 'kill', target: 'anglerfish', count: 42,` },
  { old: `objectives: [ { target: 'anglerfish', count: 14 }, { target: 'drownedCur', count: 12 }, { target: 'bonebosn', count: 8 } ],`,
    neu: `objectives: [ { target: 'anglerfish', count: 18 }, { target: 'drownedCur', count: 14 }, { target: 'bonebosn', count: 10 } ],` },
  { old: `Cull the 14-strong anglerfish chorus, the 12 drowned curs pack-hunting the broken decks, and the 8 bonebosns`,
    neu: `Cull the 18-strong anglerfish chorus, the 14 drowned curs pack-hunting the broken decks, and the 10 bonebosns` },
  { old: `rewards: { mojicoins: 11000, exp: 5500, potions: { hp_l: 4 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 11500, exp: 5800, potions: { hp_l: 4 } },  // v0.26.823 — arc curve fix (rising)` },

  // q_hourglass_3 (L61): 30 -> 38 (16/12/10) ; 12000/6000 -> 13000/6500
  { old: `kind: 'kill', target: 'mirageStalker', count: 30,`,
    neu: `kind: 'kill', target: 'mirageStalker', count: 38,` },
  { old: `objectives: [ { target: 'mirageStalker', count: 12 }, { target: 'razorgale', count: 10 }, { target: 'glasswindHare', count: 8 } ],`,
    neu: `objectives: [ { target: 'mirageStalker', count: 16 }, { target: 'razorgale', count: 12 }, { target: 'glasswindHare', count: 10 } ],` },
  { old: `Intercept 12 stalkers, 10 razorgales and 8 hares, and the chain holds.`,
    neu: `Intercept 16 stalkers, 12 razorgales and 10 hares, and the chain holds.` },
  { old: `rewards: { mojicoins: 12000, exp: 6000, potions: { hp_l: 4, mp_l: 2 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 13000, exp: 6500, potions: { hp_l: 4, mp_l: 2 } },  // v0.26.823 — arc curve fix (rising)` },

  // q_hourglass_4 (L65): 24 -> 32 (14/10/8) ; 13500/6800 -> 15000/7500 +gear 0.40/T4
  { old: `kind: 'kill', target: 'sepulchreHound', count: 24,`,
    neu: `kind: 'kill', target: 'sepulchreHound', count: 32,` },
  { old: `objectives: [ { target: 'sepulchreHound', count: 10 }, { target: 'boneWraith', count: 8 }, { target: 'lichkin', count: 6 } ],`,
    neu: `objectives: [ { target: 'sepulchreHound', count: 14 }, { target: 'boneWraith', count: 10 }, { target: 'lichkin', count: 8 } ],` },
  { old: `Cull 10 sepulchre hounds where the echoes pool, snuff 8 lantern-skulled bone wraiths (extinguish the flame, that\\'s the soul), and put down 6 lichkin twice over`,
    neu: `Cull 14 sepulchre hounds where the echoes pool, snuff 10 lantern-skulled bone wraiths (extinguish the flame, that\\'s the soul), and put down 8 lichkin twice over` },
  { old: `rewards: { mojicoins: 13500, exp: 6800, potions: { hp_l: 5 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 15000, exp: 7500, gearChance: 0.40, gearTier: 4, potions: { hp_l: 5 } },  // v0.26.823 — arc curve fix + penultimate gear drop` },

  // q_hourglass_5 (L68 boss capstone): 15000/7500 0.60/T4 -> 17000/8500 0.70/T4/acc
  { old: `rewards: { mojicoins: 15000, exp: 7500, gearChance: 0.60, gearTier: 4, potions: { hp_l: 5, full: 2 } },  // v0.26.435 — level-curve rebalance (arc capstone)`,
    neu: `rewards: { mojicoins: 17000, exp: 8500, gearChance: 0.70, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, full: 2 } },  // v0.26.823 — capstone bump (below Lv90 apex, above ch.4)` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} hourglass/high-visit edits applied.`);
