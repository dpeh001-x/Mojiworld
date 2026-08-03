#!/usr/bin/env node
// Stamp Mojiworld's identity onto the packaged Windows exe.
// =============================================================================
// electron-builder normally does this itself, but on a Windows box WITHOUT
// symlink privilege it never gets the chance: it extracts its winCodeSign
// bundle to a FRESH random cache dir on every run, and that bundle contains
// macOS .dylib symlinks, so 7za dies with "A required privilege is not held by
// the client" before rcedit is ever reached. Pre-populating the cache does not
// help — the directory name changes each run.
//
// The proper fix is to enable Developer Mode (Settings > System > For
// developers) or run the build elevated, after which `npm run dist:steamwin`
// stamps the exe on its own and this script is unnecessary.
//
// Without that, build with
//   npx electron-builder --win dir --config.win.signAndEditExecutable=false
// which succeeds but leaves the exe identifying itself as "Electron 31.7.7",
// then run this to apply the real name, version and icon.
//
//   node tools/stamp_win_exe.mjs
// =============================================================================
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXE = 'steam/release/win-unpacked/Mojiworld.exe';
const ICON = 'steam/build/icon.ico';
const PKG = JSON.parse(readFileSync('steam/package.json', 'utf8'));

if (!existsSync(EXE)) { console.error(`ABORT: ${EXE} not found — build first.`); process.exit(2); }
if (!existsSync(ICON)) { console.error(`ABORT: ${ICON} not found.`); process.exit(2); }

// Find any rcedit-x64.exe in the electron-builder cache. If none has been
// extracted yet, unpack one from the 7z WITHOUT the darwin symlinks.
const CACHE = join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
const findRcedit = () => {
  if (!existsSync(CACHE)) return null;
  for (const d of readdirSync(CACHE)) {
    const p = join(CACHE, d, 'rcedit-x64.exe');
    if (existsSync(p)) return p;
  }
  return null;
};
let rcedit = findRcedit();
if (!rcedit) {
  const sevenZip = 'steam/node_modules/7zip-bin/win/x64/7za.exe';
  const archive = readdirSync(CACHE).find((f) => f.endsWith('.7z'));
  if (!archive || !existsSync(sevenZip)) { console.error('ABORT: no rcedit and no archive to unpack.'); process.exit(2); }
  const dest = join(CACHE, archive.replace(/\.7z$/, ''));
  console.log(`unpacking ${archive} (skipping darwin symlinks)...`);
  execFileSync(sevenZip, ['x', '-bd', '-y', '-xr!darwin', join(CACHE, archive), `-o${dest}`], { stdio: 'ignore' });
  rcedit = findRcedit();
  if (!rcedit) { console.error('ABORT: rcedit still not found after unpack.'); process.exit(2); }
}
console.log(`rcedit  ${rcedit.replace(CACHE, '<cache>')}`);

// rcedit wants a 4-part file version.
const fileVersion = /^\d+\.\d+\.\d+$/.test(PKG.version) ? `${PKG.version}.0` : PKG.version;
const args = [
  EXE,
  '--set-icon', ICON,
  '--set-file-version', fileVersion,
  '--set-product-version', PKG.version,
  '--set-version-string', 'ProductName', PKG.productName || 'Mojiworld',
  '--set-version-string', 'FileDescription', PKG.productName || 'Mojiworld',
  '--set-version-string', 'CompanyName', PKG.author || PKG.productName || 'Mojiworld',
  '--set-version-string', 'LegalCopyright', `Copyright (c) ${PKG.productName || 'Mojiworld'}`,
  '--set-version-string', 'InternalName', 'Mojiworld',
  '--set-version-string', 'OriginalFilename', 'Mojiworld.exe',
];
const before = statSync(EXE).size;
execFileSync(rcedit, args, { stdio: 'inherit' });
console.log(`stamped ${EXE}`);
console.log(`  ProductName     Mojiworld`);
console.log(`  ProductVersion  ${PKG.version}`);
console.log(`  FileVersion     ${fileVersion}`);
console.log(`  icon            ${ICON}`);
console.log(`  size            ${(before / 1048576).toFixed(1)} MB -> ${(statSync(EXE).size / 1048576).toFixed(1)} MB`);
