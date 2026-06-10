// Phase 1 Batch B — mid-game kill/visit quests: lengthen ~30-50%, sync prose,
// trim overgenerous rewards (bathhouse/coralReef/abyssalTrench).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // q_kill_nimbusFox: 38 -> 52 (24/16/12) ; 3600/2200 -> 3900/2350
  { old: `kind: 'kill', target: 'nimbusFox', count: 38,`,
    neu: `kind: 'kill', target: 'nimbusFox', count: 52,` },
  { old: `objectives: [ { target: 'nimbusFox', count: 18 }, { target: 'cosmicMochi', count: 12 }, { target: 'wraith', count: 8 } ],`,
    neu: `objectives: [ { target: 'nimbusFox', count: 24 }, { target: 'cosmicMochi', count: 16 }, { target: 'wraith', count: 12 } ],` },
  { old: `Hera needs 18 Astrofoxes tagged, 12 Mochi resettled, and 8 wraiths put to rest`,
    neu: `Hera needs 24 Astrofoxes tagged, 16 Mochi resettled, and 12 wraiths put to rest` },
  { old: `rewards: { mojicoins: 3600, exp: 2200, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6, mp_m: 2 } },  // v0.26.434 — +elite wraith accent`,
    neu: `rewards: { mojicoins: 3900, exp: 2350, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6, mp_m: 2 } },  // v0.26.823 — +37% length rebalance (38->52)` },

  // q_visit_bathhouse: 34 -> 48 (22/18/8, wraith kept at 8 — only 2 spawn) ; 5000/2800 -> 4400/2400 (trim)
  { old: `kind: 'kill', target: 'coralImp', count: 34,`,
    neu: `kind: 'kill', target: 'coralImp', count: 48,` },
  { old: `objectives: [ { target: 'coralImp', count: 14 }, { target: 'pearlSprite', count: 12 }, { target: 'wraith', count: 8 } ],`,
    neu: `objectives: [ { target: 'coralImp', count: 22 }, { target: 'pearlSprite', count: 18 }, { target: 'wraith', count: 8 } ],` },
  { old: `Clear 14 Coral Imps, 12 Pearl Sprites and 8 wraiths,`,
    neu: `Clear 22 Coral Imps, 18 Pearl Sprites and 8 wraiths,` },
  { old: `rewards: { mojicoins: 5000, exp: 2800, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6, mp_m: 2 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 4400, exp: 2400, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6, mp_m: 2 } },  // v0.26.823 — length+22% & trim overgenerous reward`,
  },

  // q_visit_lavaCavern: 45 -> 58 (32/18/8) ; reward kept (already proportionate, longest quest)
  { old: `kind: 'kill', target: 'emberling', count: 45,`,
    neu: `kind: 'kill', target: 'emberling', count: 58,` },
  { old: `objectives: [ { target: 'emberling', count: 26 }, { target: 'fatLizard', count: 14 }, { target: 'fatDragon', count: 5 } ],`,
    neu: `objectives: [ { target: 'emberling', count: 32 }, { target: 'fatLizard', count: 18 }, { target: 'fatDragon', count: 8 } ],` },
  { old: `Cull 26 emberlings, 14 fat lizards and 5 fat dragons, recover the key,`,
    neu: `Cull 32 emberlings, 18 fat lizards and 8 fat dragons, recover the key,` },

  // q_visit_coralReef: 34 -> 48 (20/16/12) ; 4600/2600 -> 4300/2350 (trim)
  { old: `kind: 'kill', target: 'clownfish', count: 34,`,
    neu: `kind: 'kill', target: 'clownfish', count: 48,` },
  { old: `objectives: [ { target: 'clownfish', count: 14 }, { target: 'pufferfish', count: 12 }, { target: 'seahorse', count: 8 } ],`,
    neu: `objectives: [ { target: 'clownfish', count: 20 }, { target: 'pufferfish', count: 16 }, { target: 'seahorse', count: 12 } ],` },
  { old: `Clear 14 clownfish, 12 pufferfish and 8 seahorses, then the pearls are his.`,
    neu: `Clear 20 clownfish, 16 pufferfish and 12 seahorses, then the pearls are his.` },
  { old: `rewards: { mojicoins: 4600, exp: 2600, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 5, mp_m: 2 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 4300, exp: 2350, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 5, mp_m: 2 } },  // v0.26.823 — length+41% & trim overgenerous reward` },

  // q_visit_abyssalTrench: 38 -> 52 (22/18/12) ; 5400/3000 -> 4900/2650 (trim — was most overgenerous)
  { old: `kind: 'kill', target: 'anglerfish', count: 38,`,
    neu: `kind: 'kill', target: 'anglerfish', count: 52,` },
  { old: `objectives: [ { target: 'anglerfish', count: 16 }, { target: 'jellyfish', count: 14 }, { target: 'seahorse', count: 8 } ],`,
    neu: `objectives: [ { target: 'anglerfish', count: 22 }, { target: 'jellyfish', count: 18 }, { target: 'seahorse', count: 12 } ],` },
  { old: `the depths find their key again: 16 anglerfish, 14 jellyfish, 8 seahorses.`,
    neu: `the depths find their key again: 22 anglerfish, 18 jellyfish, 12 seahorses.` },
  { old: `rewards: { mojicoins: 5400, exp: 3000, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.435 — level-curve rebalance`,
    neu: `rewards: { mojicoins: 4900, exp: 2650, gearChance: 1.0, gearSlot: 'accessory', gearTier: 2, potions: { hp_m: 6 } },  // v0.26.823 — length+37% & trim overgenerous reward` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} mid-game edits applied.`);
