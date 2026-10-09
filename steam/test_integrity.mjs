// steam/integrity.js + steam/after_pack.js (anti-cheat layer 4). Run: node steam/test_integrity.mjs
//   [1] the afterPack hook fingerprints a packaged layout (resources/app) into resources/integrity.json
//   [2] an untouched install verifies 'ok'; [3] an edited game file, an edited data table and a removed code file read
//       'modified'; [4] no integrity.json reads 'unknown' (never silences an honest install)
//   [5] a build with no game file fails the hook; [6] debug launch switches and env are recognised, ordinary ones are not
//   [7] stats: whole numbers in range only, never down within a session, unknown keys dropped
//   [8] main.js wires it: the Steam calls check the verdict and the stats go through the filter
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const require = createRequire(import.meta.url);
const I = require('./integrity.js'); const hook = require('./after_pack.js').default;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lxint-'));
const out = path.join(tmp, 'win-unpacked'), res = path.join(out, 'resources'), app = path.join(res, 'app');
fs.mkdirSync(path.join(app, 'data'), { recursive: true });
fs.writeFileSync(path.join(app, 'mojiworld_game.html'), '<!doctype html><title>game</title>');
fs.writeFileSync(path.join(app, 'data', 'anim_calib.js'), 'var A = 1;');
fs.writeFileSync(path.join(app, 'data', 'monster_stats.js'), 'var M = 2;');
fs.writeFileSync(path.join(app, 'data', 'readme.txt'), 'not code');
const ctx = { electronPlatformName: 'win32', appOutDir: out, packager: { appInfo: { productFilename: 'Mojiworld' } } };
try {
  await hook(ctx);
  const man = I.readManifest(path.join(res, 'integrity.json'));
  ok('[1] the afterPack hook fingerprints the packaged code files', man && Object.keys(man.files).join() === 'data/anim_calib.js,data/monster_stats.js,mojiworld_game.html', man && Object.keys(man.files));
  ok('[2] an untouched install verifies ok', (await I.verify(app, man)) === 'ok');
  fs.appendFileSync(path.join(app, 'mojiworld_game.html'), '<script>cheat()</script>');
  const a = await I.verify(app, man);
  fs.writeFileSync(path.join(app, 'mojiworld_game.html'), '<!doctype html><title>game</title>');
  fs.writeFileSync(path.join(app, 'data', 'monster_stats.js'), 'var M = 0;');
  const b = await I.verify(app, man);
  fs.writeFileSync(path.join(app, 'data', 'monster_stats.js'), 'var M = 2;');
  fs.renameSync(path.join(app, 'data', 'anim_calib.js'), path.join(app, 'data', 'anim_calib.bak'));
  const c = await I.verify(app, man);
  fs.renameSync(path.join(app, 'data', 'anim_calib.bak'), path.join(app, 'data', 'anim_calib.js'));
  ok('[3] an edited game file, an edited table and a removed code file read modified', a === 'modified' && b === 'modified' && c === 'modified' && (await I.verify(app, man)) === 'ok', { a, b, c });
  ok('[4] no integrity.json reads unknown', (await I.verify(app, I.readManifest(path.join(res, 'nope.json')))) === 'unknown' && (await I.verify(app, { v: 1, files: {} })) === 'unknown');
  let threw = false; const empty = path.join(tmp, 'empty-out'); fs.mkdirSync(path.join(empty, 'resources', 'app'), { recursive: true });
  try { await hook({ electronPlatformName: 'linux', appOutDir: empty, packager: { appInfo: { productFilename: 'Mojiworld' } } }); } catch (e) { threw = true; }
  ok('[5] a build with no game file fails the hook', threw);
  const dbg = [I.debugLaunch(['app.exe', '--inspect=9229'], [], {}), I.debugLaunch(['app.exe', '--remote-debugging-port=9222'], [], {}), I.debugLaunch(['app.exe'], ['--inspect-brk'], {}),
    I.debugLaunch(['app.exe'], [], { ELECTRON_RUN_AS_NODE: '1' }), I.debugLaunch(['app.exe'], [], { NODE_OPTIONS: '--require ./x.js' })];
  const plain = [I.debugLaunch(['app.exe', '--moji-relay=wss://x', '--moji-packaged=1'], [], {}), I.debugLaunch(['app.exe'], [], { NODE_OPTIONS: '--max-old-space-size=4096' })];
  ok('[6] debug launch switches and env are recognised, ordinary ones are not', dbg.every(Boolean) && !plain.some(Boolean), { dbg, plain });
  const f = I.statsFilter();
  const s1 = f({ lifetime_kills: 10, highest_level: 5, lifetime_coins: 100.5, bosses_defeated: -1, made_up: 3 });
  const s2 = f({ lifetime_kills: 9, highest_level: 999, lifetime_coins: NaN });
  const s3 = f({ lifetime_kills: 12, highest_level: 6 });
  ok('[7] stats: whole numbers in range, never down, unknown keys dropped', JSON.stringify(s1) === '{"lifetime_kills":10,"highest_level":5}' && JSON.stringify(s2) === '{}' && JSON.stringify(s3) === '{"lifetime_kills":12,"highest_level":6}', { s1, s2, s3 });
  const main = fs.readFileSync(path.join(HERE, 'main.js'), 'utf8'), pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
  ok('[8] main.js gates the Steam calls on the verdict and filters the stats; the build runs the hook and ships integrity.js',
    /if \(!_lxSteamOk\(\)\) return false;[^\n]*steam\.achievement\.unlock/.test(main) && /_lxStatsFilter\(/.test(main) && /integrity\.verify\(ROOT/.test(main) &&
    pkg.build.afterPack === 'after_pack.js' && pkg.build.files.includes('integrity.js'));
} catch (e) { ok('the run completes', false, String(e && e.stack || e).slice(0, 300)); }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
