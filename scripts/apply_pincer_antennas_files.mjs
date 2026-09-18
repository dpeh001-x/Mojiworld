// The Pincer grows no antennas - the art half, run by the ship chain AFTER it re-syncs these files from origin:
//   1. scripts/fix_pincer_antennas.mjs rewrites Sprites/monsters/idle/scorpion_5.webp and _6.webp in place (it checks
//      each frame is the exact file it was measured on, or already fixed);
//   2. sw.js: the two frames are REPLACED under their own names, so the asset cache key moves on one generation -
//      otherwise a returning browser keeps serving the antennas from its cache (see the notes in sw.js).
// Idempotent; exact-count anchors; LF/CRLF preserved.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };

// 1. the frames
try { process.stdout.write(execFileSync(process.execPath, [path.join(HERE, 'fix_pincer_antennas.mjs')], { cwd: ROOT, encoding: 'utf8' })); }
catch (e) { abort('frame fix failed: ' + String(e.stderr || e.message).trim()); }

// 2. the cache key. The version this ship will carry is the private build's GAME_VERSION + 1 (what the chain's
// version bump writes), so the note can name it.
const SW = path.join(ROOT, 'sw.js');
const raw = readFileSync(SW, 'utf8'), crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
if (s.includes('pincer-antennas')) { console.log('sw.js: already bumped'); process.exit(0); }
let ver = 'v0.30.x';
try { const g = readFileSync(process.env.LX_GAME_FILE || path.join(ROOT, 'mojiworld_game.html'), 'utf8').match(/GAME_VERSION = 'v0\.30\.(\d+)'/); if (g) ver = 'v0.30.' + (Number(g[1]) + 1); } catch (e) {}
const re = /^const CACHE = 'mojiworld-assets-v(\d+)';[^\n]*$/m;
const m = s.match(re); if (!m) abort('sw.js: CACHE line not found');
if ((s.match(/^const CACHE = /gm) || []).length !== 1) abort('sw.js: CACHE line not unique');
const n = Number(m[1]);
s = s.replace(re, [
  '// ' + ver + ' - v' + n + ' -> v' + (n + 1) + '. Sprites/monsters/idle/scorpion_5.webp and scorpion_6.webp are REPLACED under their own',
  '// names (the Pincer\'s stray antennas cut out - pincer-antennas), so a returning browser would otherwise keep them.',
  "const CACHE = 'mojiworld-assets-v" + (n + 1) + "';   // " + ver + ' - the Pincer\'s idle 5-6 without antennas',
].join('\n'));
writeFileSync(SW + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(SW + '.tmp', SW);
console.log('sw.js: CACHE v' + n + ' -> v' + (n + 1));
