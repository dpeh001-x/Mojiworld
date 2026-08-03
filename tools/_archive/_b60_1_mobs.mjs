// L60-70 bestiary fill · 1/2 — six new monster types via sprite aliases
// (vigil_vermillion precedent, zero new art): gravebloom/wiltfang/sporewraith
// (Gloomspore Verge, Lv62-64) + marrowgeist/cryptbinder/ossuarySentinel
// (Ossuary Sprawl, Lv66-69). Stats interpolated on the L60-70 punish curve
// between glasswind (L61-63) and the Lantern wall (L66-70).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const SEP_LINE = `  sepulchreHound:  { name:'Sepulchre Hound',  w:72, h:58, color:'#888070', shell:'#3a3a2a', hp:6800,  atk:430, def:40, evasion:175, exp:7600,  mojicoins:3000, speed:1.9, jump:7,                                  signature:'Packs of three. Coordinated lunge.',      traits:{ packHunter:true } },`;

const NEW_TYPES = SEP_LINE + `
  // v0.26.880 — L60-70 GAP FILL (Gloomspore Verge + Ossuary Sprawl rosters).
  // Sprites reuse existing art via MONSTER_SPRITE_ALIASES; stats sit on the
  // band curve between glasswind (L61-63) and the Lantern wall (L66-70).
  gravebloom:      { name:'Gravebloom',       w:112, h:88, color:'#7a4a8a', shell:'#4a2a5a', hp:17500, atk:520, def:80,  evasion:150, exp:12500, mojicoins:5000, speed:0.5, jump:3,  shoot:'mseed',     shootCd:1900, signature:'A bloom that remembers being buried. Spits grave-seeds.' },
  wiltfang:        { name:'Wiltfang',         w:72,  h:58, color:'#6a7a50', shell:'#2a3a1a', hp:9500,  atk:540, def:50,  evasion:195, exp:11500, mojicoins:4600, speed:2.0, jump:7,                                  signature:'Blight-rotted pack hound. Hunts in wilted threes.', traits:{ packHunter:true } },
  sporewraith:     { name:'Sporewraith',      w:60,  h:75, color:'#9ad0a0', shell:'#3a5a3a', hp:9800,  atk:560, def:45,  evasion:210, exp:13000, mojicoins:5400, speed:1.4, jump:0,  shoot:'mspore',    shootCd:1800, flies:true, signature:'A ghost that grew a garden. Sheds choking spores.' },
  marrowgeist:     { name:'Marrowgeist',      w:55,  h:72, color:'#c8c0d8', shell:'#3a3a5a', hp:11000, atk:600, def:45,  evasion:215, exp:14800, mojicoins:6200, speed:1.5, jump:0,  shoot:'mdark',     shootCd:1600, signature:'Marrow given grievance. Slips between heartbeats.', traits:{ phasesOut:{ dur:600, cdMs:5000 } } },
  cryptbinder:     { name:'Cryptbinder',      w:82,  h:92, color:'#d8c8a0', shell:'#5a4a2a', hp:13500, atk:580, def:60,  evasion:150, exp:15400, mojicoins:6500, speed:0.6, jump:0,  shoot:'mbonechip', shootCd:1700, signature:'Binds stray bones into walls. Caster.', traits:{ groundSpikes:true, bigMelee:{ kind:'swing', dmgMul:1.6, range:125, swingW:210, swingH:95, cdMs:6200, telegraphMs:600 } } },
  ossuarySentinel: { name:'Ossuary Sentinel', w:110, h:130, color:'#aaa8c0', shell:'#3a3a4a', hp:28000, atk:760, def:110, evasion:140, exp:22000, mojicoins:8800, speed:0.9, jump:6,                                 signature:'The ossuary\\'s last oath, armored in donors.', traits:{ bigMelee:{ kind:'swing', dmgMul:2.0, range:150, swingW:240, swingH:110, cdMs:6000, telegraphMs:620 } } },`;

const reps = [
  { old: SEP_LINE, neu: NEW_TYPES },
  // natural levels (mandatory — gap-based scaler treats missing as Lv1)
  { old: `  mournshade: 66, lanternWisp: 67, echoKnight: 68, pathsBane: 70,                 // wayfarersLantern (Lv 68)`,
    neu: `  mournshade: 66, lanternWisp: 67, echoKnight: 68, pathsBane: 70,                 // wayfarersLantern (Lv 68)
  gravebloom: 62, wiltfang: 63, sporewraith: 64,                                  // v0.26.880 — Gloomspore Verge
  marrowgeist: 66, cryptbinder: 67, ossuarySentinel: 69,                          // v0.26.880 — Ossuary Sprawl` },
  // bestiary bounties (auto-expand into b_* quests)
  { old: `  boneWraith:   { npc:'Old Rye',      count:5,  flavor:'Lantern-skulled wraiths drifting the catacombs. The flame is the soul — extinguish it.' },`,
    neu: `  boneWraith:   { npc:'Old Rye',      count:5,  flavor:'Lantern-skulled wraiths drifting the catacombs. The flame is the soul — extinguish it.' },
  gravebloom:      { npc:'Oakhart',  count:6, flavor:'Something is blooming out of the old graves past the thicket. It is NOT a flower. Stop watering it with travellers.' },
  wiltfang:        { npc:'Petunia',  count:6, flavor:'Wilted hounds running the Verge in threes. They smell of compost and bad intentions.' },
  sporewraith:     { npc:'Oakhart',  count:5, flavor:'Ghosts gone green — every sigh sheds spores. Hold your breath and put them down gently.' },
  marrowgeist:     { npc:'Old Rye',  count:5, flavor:'Past the catacombs the marrow itself walks. It phases out when struck — time your second swing.' },
  cryptbinder:     { npc:'Old Rye',  count:5, flavor:'Bone-binders raising walls of femurs in the Sprawl. Interrupt the masonry.' },
  ossuarySentinel: { npc:'Old Rye',  count:3, flavor:'The Sprawl\\'s armoured wardens. Every plate a donation. Every swing a eulogy.' },` },
  // sprite aliases (reuse existing painted sets)
  { old: `  vigil_vermillion: 'young_bloodthirsty_vermillion',`,
    neu: `  vigil_vermillion: 'young_bloodthirsty_vermillion',
  // v0.26.880 — L60-70 gap-fill mobs reuse late-game art (stats re-tuned)
  gravebloom: 'meloncholy', wiltfang: 'sepulchreHound', sporewraith: 'wraith',
  marrowgeist: 'boneWraith', cryptbinder: 'shardlich', ossuarySentinel: 'echoKnight',` },
  // sprite-types registry (so the loader fetches the aliased files)
  { old: `  // tier 5 (late mid)
  'skeleton', 'mummy', 'zombie', 'wraith',`,
    neu: `  // tier 5 (late mid)
  'skeleton', 'mummy', 'zombie', 'wraith',
  // v0.26.880 — L60-70 gap fill (aliased art)
  'gravebloom', 'wiltfang', 'sporewraith', 'marrowgeist', 'cryptbinder', 'ossuarySentinel',` },
  // floating
  { old: `  'wraith',        // ghost`,
    neu: `  'wraith',        // ghost
  'sporewraith',   // v0.26.880 — spore ghost (Gloomspore Verge)` },
  // damage-SFX families
  { old: `const _MONSTER_SFX_FAMILY_OVERRIDE = {`,
    neu: `const _MONSTER_SFX_FAMILY_OVERRIDE = {
  // v0.26.880 — L60-70 gap-fill mobs
  gravebloom: 'plant', wiltfang: 'beast', sporewraith: 'ghost',
  marrowgeist: 'ghost', cryptbinder: 'skeleton', ossuarySentinel: 'golem',` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' mob-data edits applied.');
