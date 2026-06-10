// Fiery Hideout · Batch 2 — NPC dialogue branches + dialog subtitles + sprite registry.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const SKILLS_ANCHOR = `  } else if (npc.role === 'skills') {`;

const BRANCHES = `  } else if (npc.role === 'emberAlchemist') {
    // v0.26.835 — Ashka, ember alchemist of the Fiery Hideout (potion shop).
    text =
      '*Ashka lifts a ladle of liquid ember, sniffs it, and beams at you through the steam.*\\n\\n' +
      'Welcome to the warmest apothecary in Moji! Everything here is brewed over live drake-fire — ' +
      'reds that mend, blues that spark, all bottled the same hour the slope coughs them up.\\n\\n' +
      'Mind the kettle. It minds you back.';
    opts.push({ t:'Buy Potions', cb:() => { closeDialog(); openShop('potion'); } });
    opts.push({ t:'…the kettle minds me?', cb:() => { document.getElementById('dialog-text').textContent = 'It judges. Quietly. It once refused to boil for a man who kicked a snail on the slope. Three days, cold soup. Be kind on your way up and your potions will pour warmer — that\\'s not superstition, that\\'s POLICY.'; } });
  } else if (npc.role === 'forgeMaster') {
    // v0.26.835 — Furnax, forgemaster of the Fiery Hideout. Full forging
    // service suite (mirrors Brok's: buy/sell/enhance/craft/reforge/heirloom).
    text =
      '*Furnax turns from the furnace, magma-veins glowing along his arms, hammer easy on one shoulder.*\\n\\n' +
      'Hm. You climbed the slope to find a forge that never cools. Smart.\\n\\n' +
      'Steel remembers the fire it was born in — mine remembers a volcano. Buy it, mend it, ' +
      'melt what you\\'ve outgrown into Setshards; whatever leaves this cave leaves harder than it came in.';
    opts.push({ t:'Buy Gear', cb:() => { closeDialog(); openShop('weapon'); } });
    opts.push({ t:'Sell Items', cb:() => { closeDialog(); openShop('sell'); } });
    opts.push({ t:'Enhance Gear ✦', cb:() => { closeDialog(); openEnhancementModal(); } });
    opts.push({ t:\`Craft Set Piece 🔧 (\${player.setshards || 0}◈)\`, cb:() => { closeDialog(); openCraftingModal(); } });
    opts.push({ t:\`Reforge Bench ↻ (100◈, Lv 50+)\`, cb:() => { closeDialog(); reforgeRandomEquipment(); } });
    opts.push({ t:\`Heirloom Transfer ★ (500◈)\`,     cb:() => { closeDialog(); heirloomTransfer(); } });
` + SKILLS_ANCHOR;

const reps = [
  { old: SKILLS_ANCHOR, neu: BRANCHES },
  // dialog subtitle pips
  { old: `    potion:'Apothecary', weapon:'Blacksmith', skills:'Master',`,
    neu: `    potion:'Apothecary', weapon:'Blacksmith', skills:'Master',
    emberAlchemist:'Ember Alchemist', forgeMaster:'Forgemaster',   // v0.26.835 — Fiery Hideout` },
  // sprite registry
  { old: `  'Nurse Joyce':       'elspeth.webp',`,
    neu: `  'Nurse Joyce':       'elspeth.webp',
  // v0.26.835 — Fiery Hideout service NPCs (ludo-generated, see scripts/gen_fiery_hideout_npcs.mjs)
  'Ashka':         'ashka.png',
  'Furnax':        'furnax.png',` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 60)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} NPC edits applied.`);
