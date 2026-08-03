// Fiery Hideout · Batch 1 — map def (post-literal augmentation, same pattern
// as kelpForest/bubbleGrotto), portals to/from Sauro Slope, wm pin, ambient, emoji.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const WM_ANCHOR = `MAPS.kelpForest.wmX   = 992;  MAPS.kelpForest.wmY   = 300;
MAPS.bubbleGrotto.wmX = 1086; MAPS.bubbleGrotto.wmY = 318;`;

const MAPBLOCK = WM_ANCHOR + `
// =========================================================================
// v0.26.835 — THE FIERY HIDEOUT. Safe-zone rest stop carved into the basalt
// beside Sauro Slope (same post-literal augmentation pattern as the coral
// maps above). isTown — no spawns/chests. Two service NPCs: Ashka (ember
// alchemist, potion shop) + Furnax (forgemaster, full forging suite —
// buy/sell/enhance/craft/reforge/heirloom). Ludo-generated sprites at
// Sprites/npc/ashka.png + furnax.png, registered in NPC_SPRITE_FILES.
// =========================================================================
MAPS.fieryHideout = {
  name: 'The Fiery Hideout',
  bg: 'sauroSlope',                                  // shares the slope's basalt backdrop
  sky: ['#2a0d08', '#6a2415', '#b4502a'],            // darker ember den than the open slope
  worldWidth: 1100,
  levelReq: 40,                                      // matches the slope band
  fixedLayout: true,
  isTown: true,                                      // safe zone — no spawns / chests
  taxiAccessible: true,
  platforms: [
    { x: 0,   y: 480, w: 1100, h: 60, type: 'ground' },
    { x: 120, y: 390, w: 140, h: 14, type: 'platform' },   // Ashka's brew loft
    { x: 480, y: 360, w: 170, h: 14, type: 'platform' },   // central ember shelf
    { x: 840, y: 390, w: 140, h: 14, type: 'platform' },   // forge canopy
    { x: 500, y: 240, w: 130, h: 12, type: 'platform' },   // chimney overlook
  ],
  npcs: [
    { x: 300, name: 'Ashka',  role: 'emberAlchemist', color: '#ff8855' },
    { x: 860, name: 'Furnax', role: 'forgeMaster',    color: '#cc5522' },
  ],
  portals: [],
  spawns: [],
};
// Mid-slope doorway (slope exits at x:100 lavaCavern / x:2300 koopaThrone are taken)
MAPS.sauroSlope.portals.push  ({ x: 1200, dest: 'fieryHideout', name: '🔥 The Fiery Hideout (rest stop)' });
MAPS.fieryHideout.portals.push({ x: 80,   dest: 'sauroSlope',   name: '◀ Sauro Slope' });
// W-map pin — beside Sauro Slope's final pin (173,116)
MAPS.fieryHideout.wmX = 207; MAPS.fieryHideout.wmY = 104;`;

const reps = [
  { old: WM_ANCHOR, neu: MAPBLOCK },
  { old: `  sauroSlope:      'audio/ambient/lava.mp3',`,
    neu: `  sauroSlope:      'audio/ambient/lava.mp3',
  fieryHideout:    'audio/ambient/lava.mp3',   // v0.26.835 — shares the slope's lava ambience` },
  { old: `  sauroSlope:'🦎', koopaThrone:'🐢',`,
    neu: `  sauroSlope:'🦎', koopaThrone:'🐢', fieryHideout:'🔥',` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 60)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} map edits applied.`);
