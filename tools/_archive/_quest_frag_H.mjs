// Quest pass 2 · Batch H — the 5-chapter Hourglass arc (the game's longest
// story content) granted NO Dawn Fragment; the saga pips now count 5. Plus
// three stale-prose fixes (pq_finale stage renumber, aries Twelve tie-in,
// glasswind's renamed hamlet).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 5th fragment in the registry (act 3 — the Hourglass sits in Reckoning)
  { old: `  frag_smith:     { name: 'Forge-Ember Shard',     act: 2, from: 'The Sundered Smith' },`,
    neu: `  frag_smith:     { name: 'Forge-Ember Shard',     act: 2, from: 'The Sundered Smith' },
  frag_hourglass: { name: 'The Stilled Hour',       act: 3, from: 'The Hourglass Expedition' },   // v0.26.831+ — the 5-chapter arc finally pays into the saga`,
  },
  // saga act derivation: hourglass fragment implies Act 3
  { old: `  if (held.indexOf('frag_smith') !== -1) act = 2;`,
    neu: `  if (held.indexOf('frag_smith') !== -1) act = 2;
  if (held.indexOf('frag_hourglass') !== -1) act = 3;` },
  // grant it from the Hourglass V capstone
  { old: `rewards: { mojicoins: 17000, exp: 8500, gearChance: 0.70, gearSlot: 'accessory', gearTier: 4, potions: { hp_l: 6, full: 2 } },  // v0.26.823 — capstone bump (below Lv90 apex, above ch.4)`,
    neu: `rewards: { mojicoins: 17000, exp: 8500, gearChance: 0.70, gearSlot: 'accessory', gearTier: 4, dawnFragment: 'frag_hourglass', potions: { hp_l: 6, full: 2 } },  // v0.26.831+ — capstone now grants The Stilled Hour fragment` },

  // aries desc: tie The First-Born to the Twelve Houses quest explicitly
  { old: `desc: 'Defeat Ariel the Ember Ram — the first failed Dream-Bringer. Recover the Dawn Fragment they hoard.',`,
    neu: `desc: 'Defeat Ariel the Ember Ram — the first failed Dream-Bringer and the first of the Twelve Houses. Recover the Dawn Fragment they hoard; the other eleven signs await in The Twelve Houses.',` },

  // pq_finale desc: stale 5-stage copy (chain has been 4 stages since v0.26.309)
  { old: `desc: 'STAGE 1-4 were Milo\\'s warm-up. STAGE 5 is the real test:`,
    neu: `desc: 'STAGE 1-3 were Milo\\'s warm-up. STAGE 4 is the real test:` },

  // glasswind desc: the hamlet map has displayed as "Frosted Mansion" since v0.25.803
  { old: `desc: 'Skirra (Glasswind Hamlet) needs flawless steppe-shards`,
    neu: `desc: 'Skirra (at the Frosted Mansion hamlet) needs flawless steppe-shards` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 64)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} fragment/desc edits applied.`);
