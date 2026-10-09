// Electron fuses in the Steam build's afterPack hook (steam/after_pack.js). Run: node steam/test_fuses.mjs
// Needs steam's devDependencies (npm ci) - without @electron/fuses or electron installed it SKIPs.
//   [1] the hook flips run-as-node, NODE_OPTIONS and --inspect off in a copy of the real Electron binary
//   [2] the fuses it leaves alone keep Electron's defaults; [3] the hook still writes integrity.json beside them
//   [4] package.json carries @electron/fuses as a dev dependency (so CI installs it)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const require = createRequire(import.meta.url);
let fz = null, electronBin = null;
try { fz = require('@electron/fuses'); electronBin = require('electron'); } catch (e) {}
if (!fz || typeof electronBin !== 'string' || !fs.existsSync(electronBin)) { console.log('SKIP test_fuses - npm ci in steam/ first (needs @electron/fuses and electron)'); process.exit(0); }
const { getCurrentFuseWire, FuseV1Options } = fz;
const DISABLE = (fz.FuseState && fz.FuseState.DISABLE) || 48;   // 1.8 does not export FuseState: a disabled fuse is the byte '0' (48)
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lxfuse-'));
try {
  const plat = process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux';
  if (plat === 'darwin') { console.log('SKIP test_fuses - run it on Windows or Linux (the .app bundle is not copied here)'); process.exit(0); }
  const out = path.join(tmp, 'out'), res = path.join(out, 'resources'), app = path.join(res, 'app');
  fs.mkdirSync(path.join(app, 'data'), { recursive: true });
  fs.writeFileSync(path.join(app, 'mojiworld_game.html'), '<!doctype html>');
  const exe = path.join(out, plat === 'win32' ? 'Mojiworld.exe' : 'mojiworld');
  fs.copyFileSync(electronBin, exe);
  const before = await getCurrentFuseWire(exe);
  await require('./after_pack.js').default({ electronPlatformName: plat, appOutDir: out, packager: { appInfo: { productFilename: 'Mojiworld' }, executableName: 'mojiworld' } });
  const after = await getCurrentFuseWire(exe);
  const off = (w, k) => w[k] === DISABLE;
  ok('[1] run-as-node, NODE_OPTIONS and --inspect are off', off(after, FuseV1Options.RunAsNode) && off(after, FuseV1Options.EnableNodeOptionsEnvironmentVariable) && off(after, FuseV1Options.EnableNodeCliInspectArguments),
    { RunAsNode: after[FuseV1Options.RunAsNode], NodeOptions: after[FuseV1Options.EnableNodeOptionsEnvironmentVariable], Inspect: after[FuseV1Options.EnableNodeCliInspectArguments] });
  const others = [FuseV1Options.EnableCookieEncryption, FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseV1Options.OnlyLoadAppFromAsar].filter((k) => k in before);
  ok('[2] the fuses it leaves alone keep their defaults', others.every((k) => after[k] === before[k]), others.map((k) => [k, before[k], after[k]]));
  ok('[3] integrity.json is still written', fs.existsSync(path.join(res, 'integrity.json')));
  const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  ok('[4] package.json lists @electron/fuses as a dev dependency', !!(pkg.devDependencies && pkg.devDependencies['@electron/fuses']));
} catch (e) { ok('the run completes', false, String(e && e.stack || e).slice(0, 300)); }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
