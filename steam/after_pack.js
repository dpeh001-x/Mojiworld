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
exports.default = async function afterPack(context) {
  const res = resourcesDir(context);
  const m = buildManifest(path.join(res, 'app'));
  if (!m.files['mojiworld_game.html']) throw new Error('[integrity] no mojiworld_game.html under ' + path.join(res, 'app'));
  fs.writeFileSync(path.join(res, 'integrity.json'), JSON.stringify(m));
  console.log('[integrity] fingerprinted ' + Object.keys(m.files).length + ' code files');
};
