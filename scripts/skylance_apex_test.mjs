// v0.29.477 — Sky Lance must rise to the top platform CURRENTLY VISIBLE.
//
// The old lift was `Math.max(20, player.y - 200)`: a blind 200px hop whose
// clamp was y=20, the top of the WORLD. On a vertical tower that could fling
// the Dragoon thousands of pixels above the camera.
//
// 336e08de (per user, tester "I blink twice") retargeted the apex: it no
// longer hunts the top visible PLATFORM (open water has none, so every leap
// fell to a 200 px hop) but the nearest ON-SCREEN monster, rising
// SKYLANCE_APEX_ABOVE (225) px above it; with nothing on screen it rises 225 px
// from where the player stands. The platform hunt survives only as the unwired
// _lxSkyLanceApexY_UNUSED_platformVersion. What this suite protects is
// unchanged - the lift is clamped to the VISIBLE top edge, never y=20 of the
// world, and ignores anything off camera - so the cases below test it the new
// way: monsters, not platforms (triage 2026-09-28).
//
//   node serve.js 8845 && node scripts/skylance_apex_test.mjs 8845 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const PORT = process.argv[2] || process.env.PORT || '8845';
const PAGE = process.argv[3] || FILE;
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_lxSkyLanceApexY') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const g = eval('game'), P = eval('player'), apex = eval('_lxSkyLanceApexY');
  const VW = eval('W'), VH = eval('H');          // not W/H — TDZ shadowing
  const saved = { mapData: g.mapData, camX: g.camera.x, camY: g.camera.y, x: P.x, y: P.y, h: P.h, mons: g.monsters };
  P.h = 44; P.w = 28;
  const setup = (platforms, camY, playerY, playerX) => {
    g.mapData = { platforms, worldWidth: 4000, worldHeight: camY + VH + 4000 };
    g.camera.x = 0; g.camera.y = camY;
    P.x = playerX == null ? 400 : playerX; P.y = playerY;
    return apex();
  };
  const out = {};

  // monsters are 40x40 boxes; the player is 28x44, so a target at x=394 sits
  // centred over a player at x=400 (the apex X is then 400).
  const mob = (x, y, hp) => ({ x, y, w: 40, h: 40, currentHp: hp == null ? 100 : hp });
  const aim = (mons, camY, playerY, playerX) => {
    setup([{ type: 'ground', x: 0, y: camY + VH - 60, w: 4000, h: 40 }], camY, playerY, playerX);
    g.monsters = mons;
    const a = eval('_lxSkyLanceApex')();
    return { y: a.y, x: a.x, same: a.y === apex() };
  };

  // 1. Several monsters on screen - the NEAREST one is the target, 225 px above it.
  out.nearest = aim([mob(394, 300), mob(394, 60), mob(900, 420)], 0, 460);

  // 2. A monster ABOVE the viewport is ignored even when it is the nearest.
  out.offscreenIgnored = aim([mob(394, 1925), mob(950, 2420)], 2000, 2460);

  // 3. Nothing on screen -> rise 225 px from where we stand, X untouched.
  out.noTarget = aim([], 2000, 2460);

  // 4. A tower: a target just under the top edge must clamp to the camera, not y=20.
  out.towerClamp = aim([mob(394, 13650)], 13600, 14020);

  // 5. A dead monster (currentHp 0) is not a target, even when it is nearest.
  out.deadSkipped = aim([mob(394, 380, 0), mob(394, 250)], 0, 460);

  g.mapData = saved.mapData; g.camera.x = saved.camX; g.camera.y = saved.camY;
  P.x = saved.x; P.y = saved.y; P.h = saved.h; g.monsters = saved.mons;
  return { ...out, VH };
});

ok('rises 225 px above the NEAREST on-screen monster (336e08de: target, not platform)',
   r.nearest.y === 300 - 225 && r.nearest.x === 400 && r.nearest.same, { apex: r.nearest, expected: { y: 75, x: 400 } });
ok('ignores a monster above the viewport (camera scrolled down)',
   r.offscreenIgnored.y === 2420 - 225 && r.offscreenIgnored.x === 950 + 20 - 14, { apex: r.offscreenIgnored, expected: { y: 2195, x: 956 } });
ok('with nothing on screen, rises 225 px from the player and leaves X alone',
   r.noTarget.y === 2460 - 225 && r.noTarget.x == null, { apex: r.noTarget, expected: { y: 2235, x: null } });
ok('NEVER rises above the visible top edge (the old y=20 world clamp is gone)',
   r.towerClamp.y === 13600 + 12, { apex: r.towerClamp, cameraTop: 13600, expected: 13612 });
ok('on a tower it stays on camera rather than flying to y=20',
   r.towerClamp.y > 13000, { apex: r.towerClamp });
ok('a dead monster is not a target',
   r.deadSkipped.y === 250 - 225, { apex: r.deadSkipped, expected: 25 });

const src = await page.evaluate(() => {
  const s = [...document.querySelectorAll('script')].map(x => x.textContent).join('\n');
  return {
    // cast + Lv-10 chain: const _ap = _lxSkyLanceApex(); finisher: player.y = _lxSkyLanceApex().y;
    lifts: (s.match(/const _ap = _lxSkyLanceApex\(\);|player\.y = _lxSkyLanceApex\(\)\.y;/g) || []).length,
    platformHuntUnwired: (s.match(/_lxSkyLanceApexY_UNUSED_platformVersion\(/g) || []).length === 1,
    oldGone: !/player\.y = Math\.max\(20, player\.y - 200\);/.test(s),
    mapClear: /player\.dragoonSlam = 0;\s+\/\/ v0\.29\.477/.test(s),
  };
});
ok('all three dive sites use the apex helper', src.lifts === 3, src);
ok('the old platform hunt is not wired to any dive', src.platformHuntUnwired, src);
ok('the old world-clamped hop is gone', src.oldGone, src);
ok('dragoonSlam is cleared on map load (no falling through the next map)', src.mapClear, src);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
