// Phase 2b — bind quests to giver NPCs (handIn turn-in). Appends giver+handIn to each name line.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

// nameLine (exact) -> giver
const MAP = [
  [`name: 'A Slimy Welcome', icon: '🟢', levelReq: 1,`, 'Nurse Joyce'],
  [`name: 'Slow & Steady', icon: '🐌', levelReq: 1,`, 'Nurse Joyce'],
  [`name: 'Sweet Tooth', icon: '🍬', levelReq: 4,`, 'Auntie Innie'],
  [`name: 'Pond Patrol', icon: '🦎', levelReq: 5,`, 'Old Arlen'],
  [`name: 'Foxhunt Among the Stars', icon: '🦊', levelReq: 30,`, 'Hera'],
  [`name: 'Recover the Forge-Key', icon: '🔥', levelReq: 35,`, 'Brok'],
  [`name: 'Reef Toll', icon: '🐚', levelReq: 38,`, 'Brok'],
  [`name: 'Sing Back the Depths', icon: '🪸', levelReq: 42,`, 'Old Arlen'],
  [`name: 'A Clean Shard for Skirra', icon: '🌬', levelReq: 61,`, 'Skirra'],
  [`name: 'Hourglass I — Iron Echoes', icon: '⌛', levelReq: 51,`, 'Brok'],
  [`name: 'Hourglass II — Drowned Cartography', icon: '⌛', levelReq: 55,`, 'Captain Plum'],
  [`name: 'Hourglass III — Brittle Steppes', icon: '⌛', levelReq: 61,`, 'Wynn'],
  [`name: 'Hourglass IV — The Catacombs Remember', icon: '⌛', levelReq: 65,`, 'Old Rye'],
];

let n = 0;
for (const [line, giver] of MAP) {
  const c = src.split(line).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${line.slice(0, 50)}...`); process.exit(2); }
  src = src.replace(line, line + ` giver: '${giver}', handIn: true,`);
  n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} giver bindings applied.`);
