#!/usr/bin/env node
// Keep the desktop wrapper's version in step with the game's GAME_VERSION.
// =============================================================================
// steam/package.json carries the version electron-builder stamps onto the built
// executable and the Steam depot. It is edited by hand, so it drifts: the build
// shipped in steam/release was stamped 0.29.367 while the game inside it had
// moved 42 versions on. Nothing catches that, because the wrapper never reads
// the game file.
//
//   node tools/sync_steam_version.mjs           # report only, exit 1 on drift
//   node tools/sync_steam_version.mjs --write   # rewrite steam/package.json
//
// Run with --write before packaging; run bare in CI to fail a stale build.
// =============================================================================
import { readFile, writeFile, rename } from 'node:fs/promises';

const GAME = 'mojiworld_game.html';
const PKG = 'steam/package.json';

const html = await readFile(GAME, 'utf8');
const m = html.match(/const GAME_VERSION = 'v(\d+\.\d+\.\d+)';/);
if (!m) { console.error(`ABORT: no GAME_VERSION found in ${GAME}`); process.exit(2); }
const gameVer = m[1];

const pkgRaw = await readFile(PKG, 'utf8');
const pkg = JSON.parse(pkgRaw);
const pkgVer = pkg.version;

console.log(`game   ${GAME}      v${gameVer}`);
console.log(`wrapper ${PKG}   v${pkgVer}`);

if (pkgVer === gameVer) { console.log('\nIn sync.'); process.exit(0); }

const write = process.argv.includes('--write');
if (!write) {
  console.error(`\nDRIFT: wrapper would ship v${pkgVer} around a v${gameVer} game.`);
  console.error('Re-run with --write to fix, then rebuild.');
  process.exit(1);
}

// Preserve formatting: swap only the version line, never re-serialise the file
// (electron-builder config lives here and JSON.stringify would reflow it all).
const line = new RegExp(`("version"\\s*:\\s*")${pkgVer.replace(/\./g, '\\.')}(")`);
if (!line.test(pkgRaw)) { console.error('ABORT: could not locate the version line'); process.exit(2); }
const next = pkgRaw.replace(line, `$1${gameVer}$2`);
if (JSON.parse(next).version !== gameVer) { console.error('ABORT: rewrite failed validation'); process.exit(2); }

const tmp = PKG + '.tmp';
await writeFile(tmp, next, 'utf8');
await rename(tmp, PKG);
console.log(`\nUpdated ${PKG}: ${pkgVer} -> ${gameVer}. Rebuild to stamp it.`);
