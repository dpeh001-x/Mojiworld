// Hardbake updated LX_MOB_OFFSET_DATA + LX_MOB_SCALE_DATA into mob_offsets.js,
// preserving the header comment. Atomic write + node --check verify.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = new URL('../mob_offsets.js', import.meta.url);
const src = await readFile(FILE, 'utf8');

// Keep everything before the first table assignment as the header.
const marker = 'window.LX_MOB_OFFSET_DATA = {';
const idx = src.indexOf(marker);
if (idx < 0) { console.error('marker not found'); process.exit(2); }
const header = src.slice(0, idx);

const OFFSET = {
  "archon": 3, "blightElder": 43, "blockEle": 2, "blockGary": 3, "blockHupo": 2,
  "blockPopo": 2, "blockRhirhi": 3, "blockTigreal": 2, "boneGolem": -5, "boneWraith": 1,
  "bonebosn": 1, "brinekraken": 3, "cinderling": 2, "conductorMech": 5, "cookie": 1,
  "cosmicMochi": 6, "deranged_kuro": 2, "drownedCur": 2, "elderbark": 8, "emberling": 1,
  "expressTicketMech": 2, "fatDragon": 2, "fatLizard": 2, "frog": 2, "graveReaver": 22,
  "grumpsquid": 3, "gummy": 4, "lichkin": 3, "mayo": 4, "mournshade": 2,
  "nimbusFox": 2, "orange": 1, "ossuaryTyrant": 44, "pearlSprite": 2, "pufferfish": 1,
  "sandhusk": 1, "scorpion": 10, "seastar": 7, "sepulchreHound": 3, "shardlich": 7,
  "skywisp": 1, "slime": -3, "stormKitty": 2, "stump": 5, "ticketMech": 9,
  "tidefish": 1, "tideling": 1, "towerHexer": 12, "towerOssifer": 9, "towerShardling": 1,
  "towerStormcaller": 1, "voltipup": 2,
};
const SCALE = {
  "anglerfish": 1.42, "archon": 1.12, "bellowsbat": 1.33, "blightElder": 1.71, "blockGary": 1.06,
  "blockPopo": 1.16, "blockRexy": 0.9, "blockRhirhi": 0.84, "blockTigreal": 0.95, "boneWraith": 1.31,
  "bonebosn": 0.96, "brinekraken": 0.88, "cherub": 1.41, "cloudbun": 1.07, "clownfish": 1.15,
  "conductorMech": 1.22, "coralImp": 1.56, "deranged_kuro": 1.14, "drownedCur": 1.14, "echoKnight": 1.12,
  "elderbark": 1.28, "emberling": 1.52, "expressTicketMech": 1.36, "fatLizard": 1.19, "frog": 1.2,
  "glasswindHare": 0.84, "goblinScout": 1.17, "graveReaver": 0.82, "grumpsquid": 0.79, "honeyBuzz": 1.2,
  "lichkin": 1.18, "mayo": 1.24, "meloncholy": 1.25, "mirageStalker": 0.94, "mirrorSelf": 1.2,
  "mournshade": 1.05, "nimbusFox": 0.9, "orange": 1.27, "ossuaryTyrant": 2.03, "pathsBane": 1.02,
  "pearlSprite": 1.22, "petalfly": 1.4, "pinechad": 1.45, "pufferfish": 0.76, "razorgale": 1.22,
  "seasponge": 0.89, "sepulchreHound": 1.46, "seraph": 1.43, "shardlich": 0.96, "skywisp": 1.31,
  "slime": 1.48, "smithgolem": 0.65, "sparkling": 1.25, "spectreCannoneer": 1.22, "sproutle": 1.2,
  "stoneling": 1.28, "thornmaw": 1.25, "thunderMole": 0.9, "ticketMech": 1.37, "tidefish": 1.58,
  "tideling": 1.1, "tombKeeper": 0.9, "tombWraith": 1.27, "towerHexer": 1.19, "towerOssifer": 0.65,
  "towerSeer": 0.87, "towerShardling": 1.24, "towerSovereign": 0.88, "towerStormcaller": 1.12,
  "towerWarden": 0.74, "voltipup": 0.79, "willeo": 0.93, "zombie": 0.88,
};

const emit = (name, obj) => {
  const lines = Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${v},`).join('\n');
  return `window.${name} = {\n${lines}\n};\n`;
};

const out = header + emit('LX_MOB_OFFSET_DATA', OFFSET) + emit('LX_MOB_SCALE_DATA', SCALE);

const tmp = new URL('../mob_offsets.js.tmp', import.meta.url);
await writeFile(tmp, out, 'utf8');
execSync('node --check "' + tmp.pathname.replace(/^\//, '') + '"');   // verify it parses
await rename(tmp, FILE);
console.log('OK: baked ' + Object.keys(OFFSET).length + ' offsets + ' + Object.keys(SCALE).length + ' scales.');
