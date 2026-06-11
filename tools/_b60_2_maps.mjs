// L60-70 bestiary fill · 2/2 — Gloomspore Verge (Lv62) + Ossuary Sprawl (Lv67)
// maps, portal chains, wm pins, bgm/ambient, emoji. Post-literal augmentation.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const PIN = `MAPS.thornspireThicket.wmX = 1140; MAPS.thornspireThicket.wmY = 150;`;
const BLOCK = PIN + `
// =========================================================================
// v0.26.880 — L60-70 GAP FILL: two new hunting grounds before the Lantern
// wall. Gloomspore Verge (Lv 62, east of Thornspire Thicket — the bloom
// gone graveyard) and Ossuary Sprawl (Lv 67, east of Hollow Sepulchre — the
// bone fields). Rosters mix the six new aliased types with underused
// late-game mobs (thornmaw/elderbark/pinechad · lichkin/shardlich/hound).
// =========================================================================
MAPS.gloomsporeVerge = {
  name: 'Gloomspore Verge',
  bg: 'fungalHollow',
  sky: ['#1a2415', '#2e3a22', '#4a5a36'],
  worldWidth: 2800,
  levelReq: 62,
  taxiAccessible: true,
  platforms: [
    { x: 0,    y: 480, w: 2800, h: 60, type: 'ground' },
    { x: 220,  y: 392, w: 170, h: 14, type: 'platform' },
    { x: 540,  y: 344, w: 160, h: 14, type: 'platform' },
    { x: 860,  y: 396, w: 180, h: 14, type: 'platform' },
    { x: 1200, y: 330, w: 160, h: 14, type: 'platform' },
    { x: 1520, y: 392, w: 180, h: 14, type: 'platform' },
    { x: 1860, y: 336, w: 160, h: 14, type: 'platform' },
    { x: 2180, y: 396, w: 180, h: 14, type: 'platform' },
    { x: 2480, y: 330, w: 150, h: 14, type: 'platform' },
    { x: 1180, y: 220, w: 130, h: 12, type: 'platform' },
  ],
  portals: [],
  spawns: [
    { type: 'gravebloom',  count: 7 },
    { type: 'wiltfang',    count: 8 },
    { type: 'sporewraith', count: 6 },
    { type: 'thornmaw',    count: 6 },
    { type: 'pinechad',    count: 3 },
    { type: 'elderbark',   count: 2 },
  ],
};
MAPS.ossuarySprawl = {
  name: 'Ossuary Sprawl',
  bg: 'hollowSepulchre',
  sky: ['#0a0814', '#161024', '#241a34'],
  worldWidth: 3000,
  levelReq: 67,
  taxiAccessible: true,
  platforms: [
    { x: 0,    y: 480, w: 3000, h: 60, type: 'ground' },
    { x: 260,  y: 390, w: 180, h: 14, type: 'platform' },
    { x: 620,  y: 340, w: 170, h: 14, type: 'platform' },
    { x: 980,  y: 394, w: 180, h: 14, type: 'platform' },
    { x: 1340, y: 332, w: 160, h: 14, type: 'platform' },
    { x: 1700, y: 392, w: 190, h: 14, type: 'platform' },
    { x: 2080, y: 336, w: 170, h: 14, type: 'platform' },
    { x: 2440, y: 394, w: 180, h: 14, type: 'platform' },
    { x: 2760, y: 330, w: 160, h: 14, type: 'platform' },
    { x: 1520, y: 216, w: 140, h: 12, type: 'platform' },
  ],
  portals: [],
  spawns: [
    { type: 'marrowgeist',     count: 8 },
    { type: 'cryptbinder',     count: 7 },
    { type: 'lichkin',         count: 6 },
    { type: 'sepulchreHound',  count: 5 },
    { type: 'shardlich',       count: 4 },
    { type: 'ossuarySentinel', count: 2 },
  ],
};
MAPS.thornspireThicket.portals.push({ x: 2500, dest: 'gloomsporeVerge', name: '🥀 Gloomspore Verge (Lv 62)' });
MAPS.gloomsporeVerge.portals.push ({ x: 80,   dest: 'thornspireThicket', name: '◀ Thornspire Thicket' });
MAPS.hollowSepulchre.portals.push ({ x: 3700, dest: 'ossuarySprawl', name: '🦴 Ossuary Sprawl (Lv 67)' });
MAPS.ossuarySprawl.portals.push   ({ x: 80,   dest: 'hollowSepulchre', name: '◀ Hollow Sepulchre' });
MAPS.gloomsporeVerge.wmX = 1180; MAPS.gloomsporeVerge.wmY = 166;
MAPS.ossuarySprawl.wmX   = 524;  MAPS.ossuarySprawl.wmY   = 146;`;

const reps = [
  { old: PIN, neu: BLOCK },
  { old: `  thornspireThicket:          'audio/bgm_bloom.mp3',`,
    neu: `  thornspireThicket:          'audio/bgm_bloom.mp3',
  gloomsporeVerge:            'audio/bgm_bloom.mp3',              // v0.26.880 — shares the bloom theme
  ossuarySprawl:              'audio/bgm_hollow_sepulchre.mp3',   // v0.26.880 — shares the sepulchre theme`,
  },
  { old: `  hollowSepulchre: 'audio/ambient/cave.mp3',`,
    neu: `  hollowSepulchre: 'audio/ambient/cave.mp3',
  ossuarySprawl:   'audio/ambient/cave.mp3',   // v0.26.880`,
  },
  { old: `fieryHideout:'🔥',`,
    neu: `fieryHideout:'🔥', gloomsporeVerge:'🥀', ossuarySprawl:'🦴',`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 60) + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' map edits applied.');
