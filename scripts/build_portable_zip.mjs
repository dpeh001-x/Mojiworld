// Build the player-facing PORTABLE ZIP: download → unzip → double-click
// Mojiworld.cmd → play. No installs: the zip carries the official
// OpenJS-signed node.exe, so the launch chain (cmd.exe → node.exe) is
// signed end to end — SAC/SmartScreen-friendly without a code-signing cert.
//
// The file list is NOT maintained here: it is read from steam/package.json's
// extraResources filter — the same single source of truth the Steam depot
// ships from, kept honest by scripts/steam_depot_boot_test.mjs.
//
// Usage:  node scripts/build_portable_zip.mjs [--zip] [--node <path-to-node.exe>]
//   default: stages to scripts/_tmp_portable/Mojiworld/ and verifies
//   --zip:   additionally produces Mojiworld-<ver>-windows-portable.zip (7za)
//   --node:  node.exe to bundle (default: the running process.execPath)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const STAGE_ROOT = path.join(ROOT, 'scripts', '_tmp_portable');
const STAGE = path.join(STAGE_ROOT, 'Mojiworld');
const args = process.argv.slice(2);
const DO_ZIP = args.includes('--zip');
const NODE_SRC = args.includes('--node') ? args[args.indexOf('--node') + 1] : process.execPath;

const ver = /GAME_VERSION = 'v(\d+\.\d+\.\d+)'/.exec(fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8'));
if (!ver) { console.error('ABORT: GAME_VERSION not found'); process.exit(1); }
const VERSION = ver[1];

// ---- the ship list: steam extraResources filter + launcher extras ----------
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'steam', 'package.json'), 'utf8'));
const filter = pkg.build.extraResources.find(e => e.from === '..').filter;
const LAUNCHER_EXTRAS = ['serve.js', 'Mojiworld.cmd'];

fs.rmSync(STAGE_ROOT, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

const cpDir = (rel) => { fs.cpSync(path.join(ROOT, rel), path.join(STAGE, rel), { recursive: true }); };
const cpFile = (rel) => {
  const dst = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), dst);
};

let files = 0, dirs = 0;
for (const entry of filter) {
  if (entry.endsWith('/**')) { cpDir(entry.slice(0, -3)); dirs++; }
  else { cpFile(entry); files++; }
}
for (const rel of LAUNCHER_EXTRAS) { cpFile(rel); files++; }

// bundled runtime: just node.exe — serve.js is dependency-free
if (!fs.existsSync(NODE_SRC)) { console.error('ABORT: node.exe not found at ' + NODE_SRC); process.exit(1); }
fs.mkdirSync(path.join(STAGE, 'node'), { recursive: true });
fs.copyFileSync(NODE_SRC, path.join(STAGE, 'node', 'node.exe'));

fs.writeFileSync(path.join(STAGE, 'PLAY_ME_FIRST.txt'), [
  'MOJIWORLD ' + 'v' + VERSION + ' — portable edition',
  '=================================================',
  '',
  'TO PLAY:  double-click  Mojiworld.cmd',
  'Your browser opens the game. That is the whole install.',
  '',
  'If Windows asks "Do you want to open this file?" choose Open / Run —',
  'the launcher only runs Windows\' own cmd.exe and the official signed',
  'Node.js runtime bundled in the node\\ folder. Nothing else executes.',
  '',
  'Good to know:',
  ' - Unzip the WHOLE folder first (do not run from inside the zip window).',
  ' - A minimized black window named "Mojiworld server" stays open while you',
  '   play — that is the local game server. Close it to stop the game, or',
  '   just leave it; it uses almost nothing.',
  ' - Your save lives in your browser (per this PC + browser). Back it up',
  '   in-game via Settings if you switch machines.',
  ' - No internet needed after unzipping. Co-op needs internet.',
  '',
  'Problems? The hosted version always works, no download needed:',
  '  https://raw.githack.com/dpeh001-x/Mojiworld/main/mojiworld_game.html',
].join('\r\n'));

// ---- verify the stage is playable ------------------------------------------
const must = ['mojiworld_game.html', 'serve.js', 'Mojiworld.cmd', 'node/node.exe',
  'data/anim_calib.js', 'sw.js', 'steam/higgsfield/cinematics/clip_prologue_pov.mp4',
  // v0.30.x — .webp, not .png. This post-stage check asserted a file that has
  // never existed in the repo, so the portable zip aborted every time it was
  // built. The asset is Sprites/ui/block_shield.webp and the game asks for the
  // .webp too (with an emoji onerror fallback), so only this list was wrong.
  'Sprites/ui/block_shield.webp', 'PLAY_ME_FIRST.txt'];
for (const rel of must) {
  if (!fs.existsSync(path.join(STAGE, rel))) { console.error('ABORT: staged file missing: ' + rel); process.exit(1); }
}
const du = (d) => { let n = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name); n += e.isDirectory() ? du(p) : fs.statSync(p).size; } return n; };
const bytes = du(STAGE);
console.log(`staged v${VERSION}: ${dirs} asset trees + ${files} files, ${(bytes / 1e9).toFixed(2)} GB -> ${STAGE}`);

if (DO_ZIP) {
  const zipName = `Mojiworld-v${VERSION}-windows-portable.zip`;
  const zipPath = path.join(STAGE_ROOT, zipName);
  const sevenZa = path.join(ROOT, 'steam', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
  if (fs.existsSync(sevenZa)) {
    execFileSync(sevenZa, ['a', '-tzip', '-mx=5', zipPath, STAGE], { stdio: 'inherit' });
  } else {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Compress-Archive -Path '${STAGE}' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`], { stdio: 'inherit' });
  }
  console.log(`zip: ${zipPath} (${(fs.statSync(zipPath).size / 1e9).toFixed(2)} GB)`);
}
