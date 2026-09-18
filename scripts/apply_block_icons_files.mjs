// The Block (A) icon, in the skill icons' style - the art half, run by the ship chain AFTER it re-syncs these files:
//   1. the five chosen icons (scripts/gen_block_icons.mjs candidates: warrior v4, rogue v3, mage v4, archer v3,
//      shield v4) go to Sprites/ui/block_<class>.webp - each checked against the hash it was chosen at;
//   2. sw.js: the files are REPLACED under their own names, so the asset cache moves on one generation - otherwise a
//      returning browser keeps serving the old icons from its cache (see the notes in sw.js).
// Source: LX_BLOCK_SRC (default %TEMP%/block_icons_pick). Idempotent; LF/CRLF preserved.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LX_BLOCK_SRC || path.join(process.env.TEMP || '.', 'block_icons_pick');
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const BLOCK_ICONS = {
  warrior: '049c14b0db00b1173a7e3126c5bd7e48fa3b2a92a297f1991264752bd9916c87',
  rogue: '1c11efdb426f34c10b4395ffbb4c81796605edf67ff228dc6fb703c998735f2b',
  mage: '1f93c599c600dcfde7ab9a055ade461644a7bc1970b5ac5d3951dcd4d4571034',
  archer: '9c2e48e07b8b14921c8848a4b2b46d03d24a4cf97c234db600d7d11971692323',
  shield: '5f242980880f1a8989823c0099ca026e603333bc12e42240e36239536897e780',
};

// 1. the art
for (const [cls, want] of Object.entries(BLOCK_ICONS)) {
  const dst = path.join(ROOT, 'Sprites', 'ui', `block_${cls}.webp`);
  if (existsSync(dst) && sha(readFileSync(dst)) === want) { console.log(`block_${cls}.webp: already in place`); continue; }
  const f = path.join(SRC, `block_${cls}.webp`);
  if (!existsSync(f)) abort('missing chosen icon ' + f);
  const b = readFileSync(f); if (sha(b) !== want) abort(`block_${cls}.webp in ${SRC} is not the chosen icon`);
  writeFileSync(dst + '.tmp', b); renameSync(dst + '.tmp', dst);
  console.log(`block_${cls}.webp: installed (${b.length} bytes)`);
}

// 2. the cache key; the version this ship will carry is the private build's GAME_VERSION + 1 (what the chain writes)
const SW = path.join(ROOT, 'sw.js');
const raw = readFileSync(SW, 'utf8'), crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
if (s.includes('block-icons')) { console.log('sw.js: already bumped'); process.exit(0); }
let ver = 'v0.30.x';
try { const g = readFileSync(process.env.LX_GAME_FILE || path.join(ROOT, 'mojiworld_game.html'), 'utf8').match(/GAME_VERSION = 'v0\.30\.(\d+)'/); if (g) ver = 'v0.30.' + (Number(g[1]) + 1); } catch (e) {}
const re = /^const CACHE = 'mojiworld-assets-v(\d+)';[^\n]*$/m;
const m = s.match(re); if (!m) abort('sw.js: CACHE line not found');
if ((s.match(/^const CACHE = /gm) || []).length !== 1) abort('sw.js: CACHE line not unique');
const n = Number(m[1]);
s = s.replace(re, [
  '// ' + ver + ' - v' + n + ' -> v' + (n + 1) + '. Sprites/ui/block_warrior / rogue / mage / archer / shield.webp are REPLACED under',
  '// their own names (the Block icons repainted in the skill icons\' style - block-icons), so a returning browser would',
  '// otherwise keep the old ones.',
  "const CACHE = 'mojiworld-assets-v" + (n + 1) + "';   // " + ver + ' - the Block icons in the skill icons\' style',
].join('\n'));
writeFileSync(SW + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(SW + '.tmp', SW);
console.log('sw.js: CACHE v' + n + ' -> v' + (n + 1));
