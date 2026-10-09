// v0.30.1678 ac-steam - electron-builder afterPack hook: fingerprint the game's code from the PACKAGED files (see integrity.js).
// Runs after extraResources are copied and before signing / the distributable, on every `npm run dist:*`. A build that
// carries no game file fails here, loudly, instead of shipping an install that could not be checked.
'use strict';
const fs = require('fs');
const path = require('path');
const { buildManifest } = require('./integrity');
function resourcesDir(context) {
  if (context.electronPlatformName === 'darwin') {
    return path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents', 'Resources');
  }
  return path.join(context.appOutDir, 'resources');
}
// v0.30.1692 fuses - split out so the integrity test can run it without a real Electron binary
function writeIntegrity(context) {
  const res = resourcesDir(context);
  const m = buildManifest(path.join(res, 'app'));
  if (!m.files['mojiworld_game.html']) throw new Error('[integrity] no mojiworld_game.html under ' + path.join(res, 'app'));
  fs.writeFileSync(path.join(res, 'integrity.json'), JSON.stringify(m));
  console.log('[integrity] fingerprinted ' + Object.keys(m.files).length + ' code files');
}
// v0.30.1692 fuses - ELECTRON'S OWN HARDENING SWITCHES (per user: suggestion 3), flipped in the packaged binary before it is signed:
// it can no longer be started as a plain Node.js program (ELECTRON_RUN_AS_NODE), have code injected through NODE_OPTIONS, or take
// the --inspect debugger switches. These are settings inside Electron itself (@electron/fuses), nothing added to the game; the
// build fails loudly if they cannot be set rather than shipping without them.
function appBinary(context) {
  const name = context.packager.appInfo.productFilename;
  if (context.electronPlatformName === 'darwin') return path.join(context.appOutDir, name + '.app');
  if (context.electronPlatformName === 'win32') return path.join(context.appOutDir, name + '.exe');
  return path.join(context.appOutDir, context.packager.executableName || name);
}
async function setFuses(binary, darwin) {
  const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
  await flipFuses(binary, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: !!darwin,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
  });
}
exports.writeIntegrity = writeIntegrity;
exports.setFuses = setFuses;
exports.default = async function afterPack(context) {
  writeIntegrity(context);
  await setFuses(appBinary(context), context.electronPlatformName === 'darwin');
  console.log('[fuses] run-as-node, NODE_OPTIONS and --inspect are off in ' + path.basename(appBinary(context)));
};
