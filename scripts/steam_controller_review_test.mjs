// STEAM CONTROLLER REVIEW — the posture that failed review, pinned so it cannot drift back.
// ============================================================================
// Steam failed the 2026-09-14 build: "your app appears to use Steam Input, but the game does not
// appear to fully support the controller... there is no Developer created configuration or a
// Recommended Configuration causing the controller to have no functionality."
//
// The game's controller support itself is fine — it drives off the browser Gamepad API and covers
// gameplay, menus, text entry and quit. What broke it was Steam INPUT being in the picture with no
// bindings behind it: Steam captures the pad, binds it to nothing, and the game never sees a device.
//
// Two things put the app in that state, and this pins both of them off:
//   1. ISteamInput::Init — v0.30.377 made it opt-in (MOJI_STEAM_INPUT=1). Calling it declares the
//      app a Steam Input title and Steam then expects a published configuration.
//   2. the in-game actions file in the DEPOT — that is what "appears to use Steam Input" detects.
//      Dropped from build.extraResources; the .vdf stays in the repo for when support returns.
// Re-enabling either WITHOUT publishing a configuration first reproduces the failure exactly, which
// is why they are asserted together rather than one at a time.
//
// It also pins the three "cautions" from the same review, all of which were already implemented and
// none of which the reviewer could observe while the controller was dead.
// Run: node scripts/steam_controller_review_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const pkg = JSON.parse(read('steam/package.json'));
const integ = read('steam/steam_integration.js');
const game = read('mojiworld_game.html');
const iga = 'steam/controller_config/game_actions_4842650.vdf';

const extra = (pkg.build && pkg.build.extraResources) || [];
const packagesIga = JSON.stringify(extra).includes('controller_config');
const optIn = /MOJI_STEAM_INPUT\s*===\s*'1'/.test(integ);
const initGated = /if\s*\(\s*USE_STEAM_INPUT\s*&&/.test(integ);

const checks = [
  // --- the failure itself -------------------------------------------------
  ['Steam Input is opt-in, not initialised by default', optIn, optIn ? 'MOJI_STEAM_INPUT=1' : 'gate missing'],
  ['ISteamInput::Init is behind that gate', initGated],
  ['the build does not ship an in-game actions file', !packagesIga,
    packagesIga ? 'controller_config is still in extraResources' : 'not packaged'],
  ['...and the actions file is still in the repo for when support returns', fs.existsSync(path.join(ROOT, iga))],
  ['the actions file records why it is unpackaged', read(iga).includes('NOT PACKAGED TODAY')],

  // --- the three cautions, all already implemented -------------------------
  ['the Steam overlay pauses the game', /_lxAutoPause\('steam-overlay'\)/.test(game)],
  ['...and the game actually subscribes to the overlay callback',
    /SteamAPI\.onOverlay\(/.test(game) && /exposeInMainWorld\('SteamAPI'/.test(read('steam/preload.js'))],
  ['...and the main process forwards it', /onOverlayActivated\(/.test(read('steam/main.js'))],
  ['unplugging the controller pauses the game', /gamepaddisconnected[\s\S]{0,1600}?_lxAutoPause\('controller'\)/.test(game)],
  ['a pad hides the mouse cursor', /pad-cursor-hide[\s\S]{0,200}cursor: none/.test(game)],
  ['...and any real mouse movement brings it back',
    /mousemove[\s\S]{0,160}remove\('pad-cursor-hide'\)/.test(game)],

  // --- controller coverage the review asks for -----------------------------
  ['the pad can drive menus, not just gameplay', /_lxPadMode\s*=\s*'game'/.test(game) && /'menu'/.test(game)],
  ['text entry is reachable without a keyboard', /VIRTUAL KEYBOARD/.test(game)],
  ['a held stick is released if the pad vanishes', /_lxPadFlushHeld/.test(game)],
];

let bad = 0;
for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log('\nSteamworks settings this test CANNOT see — they live on the partner site:');
console.log('  * Application > Steam Input > controller template must be "None" (it is still "Custom Configuration")');
console.log('  * Store page > Basic Info > Supported Features must not claim controller support');
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
