#!/usr/bin/env node
// Stamp the real Steam App ID everywhere it has to match.
// =============================================================================
// The App ID appears in six places that must agree, and getting one wrong
// fails late and confusingly (a build uploads to the wrong depot; the wrapper
// initialises against Spacewar and every achievement silently no-ops). The
// pre-launch checklist calls this out: "480 means you shipped the Spacewar
// placeholder". This stamps all six from one number.
//
//   node tools/set_steam_appid.mjs            # show current state
//   node tools/set_steam_appid.mjs 3210987    # stamp it
//   node tools/set_steam_appid.mjs --reset    # back to 480 / 1000000 templates
//
// Depot IDs follow the Steamworks convention AppID+1 (Windows) / AppID+2
// (Linux). If your App Admin > Depots page shows different IDs, edit the two
// depot_*.vdf files by hand afterwards — this prints what it wrote so you can
// check against that page.
// =============================================================================
import { readFile, writeFile, rename, readdir } from 'node:fs/promises';

const APPID_TXT = 'steam/steam_appid.txt';
const APP_BUILD = 'steam/steam_upload/app_build.vdf';
const DEPOT_WIN = 'steam/steam_upload/depot_windows.vdf';
const DEPOT_LIN = 'steam/steam_upload/depot_linux.vdf';
// v0.29.x — the SIXTH place the App ID lives, and the easiest to miss because it
// is encoded in a FILENAME rather than in file contents. Steam Input looks up
// controller_config/game_actions_<appid>.vdf by App ID, so a stale name means the
// Game Actions File is silently never found and every controller binding is dead.
// It sat at game_actions_480.vdf long after the real App ID was stamped.
const CTRL_DIR = 'steam/controller_config';

const arg = process.argv[2];
const reset = arg === '--reset';

const cur = (await readFile(APPID_TXT, 'utf8')).trim();
const curBuild = await readFile(APP_BUILD, 'utf8');
const shownIds = [...curBuild.matchAll(/"(?:AppID|\d{6,})"\s*"?(\d+)?"?/g)]
  .map(m => m[1]).filter(Boolean);

if (!arg) {
  console.log(`steam_appid.txt : ${cur}${cur === '480' ? '   <-- Spacewar placeholder, NOT shippable' : ''}`);
  console.log(`app_build.vdf   : AppID ${(curBuild.match(/"AppID"\s*"(\d+)"/) || [])[1]}`);
  const depots = [...curBuild.matchAll(/"(\d+)"\s*"depot_\w+\.vdf"/g)].map(m => m[1]);
  console.log(`depots          : ${depots.join(', ') || '(none found)'}`);
  console.log('\nUsage: node tools/set_steam_appid.mjs <your-app-id>');
  process.exit(cur === '480' ? 1 : 0);
}

const appId = reset ? '480' : String(arg).trim();
if (!reset && !/^\d{3,8}$/.test(appId)) {
  console.error(`ABORT: "${arg}" is not a plausible App ID (expected 3-8 digits).`);
  process.exit(2);
}
const buildId = reset ? '1000000' : appId;
const winId = reset ? '1000001' : String(Number(appId) + 1);
const linId = reset ? '1000002' : String(Number(appId) + 2);

// --- atomic, verified writes ------------------------------------------------
const put = async (path, text, expect) => {
  const tmp = path + '.tmp';
  await writeFile(tmp, text, 'utf8');
  const back = await readFile(tmp, 'utf8');
  if (back !== text) { console.error(`ABORT: ${path} round-trip mismatch`); process.exit(2); }
  for (const e of expect) {
    if (!back.includes(e)) { console.error(`ABORT: ${path} missing "${e}" after write`); process.exit(2); }
  }
  await rename(tmp, path);
};

// steam_appid.txt: bare number + trailing newline, nothing else. The Steam
// client parses this literally — a stray BOM or comment breaks init.
await put(APPID_TXT, appId + '\n', [appId]);

// app_build.vdf: the AppID field plus the two depot keys.
let ab = curBuild;
const oldApp = (ab.match(/"AppID"\s*"(\d+)"/) || [])[1];
const oldDepots = [...ab.matchAll(/"(\d+)"\s*"(depot_\w+\.vdf)"/g)];
if (!oldApp || oldDepots.length !== 2) {
  console.error('ABORT: app_build.vdf does not have the expected AppID + 2 depot entries.');
  process.exit(2);
}
ab = ab.replace(/("AppID"\s*")\d+(")/, `$1${buildId}$2`);
for (const [, id, file] of oldDepots) {
  const next = file.includes('windows') ? winId : linId;
  ab = ab.replace(new RegExp(`"${id}"(\\s*)"${file}"`), `"${next}"$1"${file}"`);
}
await put(APP_BUILD, ab, [`"${buildId}"`, `"${winId}"`, `"${linId}"`]);

// depot_*.vdf: each declares its own DepotID.
for (const [path, id] of [[DEPOT_WIN, winId], [DEPOT_LIN, linId]]) {
  const raw = await readFile(path, 'utf8');
  if (!/"DepotID"\s*"\d+"/.test(raw)) {
    console.error(`ABORT: ${path} has no DepotID field.`); process.exit(2);
  }
  await put(path, raw.replace(/("DepotID"\s*")\d+(")/, `$1${id}$2`), [`"${id}"`]);
}

// controller_config/game_actions_<appid>.vdf — rename, not a content edit.
let ctrlFrom = null, ctrlTo = null;
try {
  const files = await readdir(CTRL_DIR);
  const cur = files.find(f => /^game_actions_\d+\.vdf$/.test(f));
  if (cur) {
    const want = `game_actions_${appId}.vdf`;
    if (cur !== want) {
      await rename(`${CTRL_DIR}/${cur}`, `${CTRL_DIR}/${want}`);
      ctrlFrom = cur; ctrlTo = want;
    } else { ctrlFrom = cur; ctrlTo = cur; }
  }
} catch (e) { /* no controller_config — Steam Input simply not wired */ }

console.log(reset ? 'Reset to placeholders.\n' : 'Stamped.\n');
console.log(`  steam_appid.txt        ${cur} -> ${appId}`);
console.log(`  app_build.vdf AppID    ${oldApp} -> ${buildId}`);
console.log(`  windows depot          ${oldDepots.find(d => d[2].includes('windows'))[1]} -> ${winId}`);
console.log(`  linux depot            ${oldDepots.find(d => d[2].includes('linux'))[1]} -> ${linId}`);
if (ctrlFrom) {
  console.log(`  game actions file      ${ctrlFrom}${ctrlTo !== ctrlFrom ? ' -> ' + ctrlTo : '  (already correct)'}`);
} else {
  console.log('  game actions file      (none found in steam/controller_config)');
}
if (!reset) {
  console.log('\nCheck those depot IDs against Steamworks > App Admin > Depots, then rebuild');
  console.log('so steam_appid.txt is baked into the packaged app.');
}
