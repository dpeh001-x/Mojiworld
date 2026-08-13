// World ceiling. Tester: "Underwater maps such as Coral Reef Depths, put a
// ceiling so that players do not jump pass the top of the screen. Character
// should be visible."
//
// The camera clamps at world-top 0 and vertical Blink clamps at 0, but jump
// physics never did — so with 5 underwater air-jumps and 0.30 gravity the
// player sails into negative y where the camera cannot follow. The clamp now
// lives in checkPlatformCollision, which every player-integration site calls.
// This drives the REAL input path (game.keys + updatePlayer) and samples every
// frame, because a start/end check would miss a mid-jump excursion.
//   node scripts/underwater_ceiling_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updatePlayer === 'function' && typeof loadMap === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  player.cls = 'warrior'; game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';

  // --- A. Coral Reef Depths: mash jump at the surface, sample every frame ---
  loadMap('coralReef');
  await new Promise(r2 => setTimeout(r2, 200));
  out.map = { id: game.currentMap, underwater: !!game.mapData.isUnderwater, gravityMul: game.mapData.gravityMul };
  player.x = 300; player.y = 60; player.vy = 0; player.onGround = false;
  player.hp = Math.max(1, player.maxHp || 100);
  game.monsters.length = 0;                    // nothing to interrupt the mash
  let minY = 1e9, minScreenY = 1e9;
  for (let f = 0; f < 600; f++) {
    // press-release cycle so the buffer + air-jump edge logic runs for real
    game.keys[' '] = (f % 6) < 3;
    player.coyoteTime = 0;
    updatePlayer(16);
    updateCamera();
    if (player.y < minY) minY = player.y;
    const sy = player.y - game.camera.y;
    if (sy < minScreenY) minScreenY = sy;
  }
  game.keys[' '] = false;
  out.mash = { minY: Math.round(minY * 100) / 100, minScreenY: Math.round(minScreenY * 100) / 100 };

  // --- B. gravity still works: released, the player sinks back down --------
  const yAtRelease = player.y;
  for (let f = 0; f < 120; f++) updatePlayer(16);
  out.sinks = { from: Math.round(yAtRelease), to: Math.round(player.y), fell: player.y > yAtRelease + 20 };

  // --- C. a violent upward burst cannot tunnel past the clamp --------------
  player.y = 10; player.vy = -60; player.onGround = false;
  updatePlayer(16);
  out.burst = { y: player.y, vy: player.vy };

  // --- D. the ceiling is a WORLD invariant, not an underwater special ------
  loadMap('town');
  await new Promise(r2 => setTimeout(r2, 200));
  player.x = 300; player.y = 8; player.vy = -40; player.onGround = false;
  updatePlayer(16);
  out.town = { y: player.y, vy: player.vy };

  // --- E. vertical Blink from just under the top stays consistent ----------
  loadMap('coralReef');
  await new Promise(r2 => setTimeout(r2, 200));
  player.cls = 'mage'; player.mp = 9999; player.skillCooldowns = {};
  player.x = 300; player.y = 5; player.vy = 0;
  game.keys['arrowup'] = true;
  try { SKILL_FNS.blink(); } catch (e) { out.blinkErr = String(e).slice(0, 80); }
  game.keys['arrowup'] = false;
  out.blink = { y: player.y };
  for (let f = 0; f < 5; f++) updatePlayer(16);
  out.blinkSettled = { y: Math.round(player.y * 100) / 100 };
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('map    :', JSON.stringify(r.map));
console.log('mash   :', JSON.stringify(r.mash), '(600 frames of jump-spam, per-frame minimum)');
console.log('sinks  :', JSON.stringify(r.sinks));
console.log('burst  :', JSON.stringify(r.burst));
console.log('town   :', JSON.stringify(r.town));
console.log('blink  :', JSON.stringify(r.blink), '->', JSON.stringify(r.blinkSettled));

ok('the test runs on the reported map, and it is underwater', r.map.id === 'coralReef' && r.map.underwater === true, r.map);
ok('600 frames of jump-spam never carry the player above the world top', r.mash.minY >= 0, r.mash);
ok('...so the character stays fully ON SCREEN at the top', r.mash.minScreenY >= 0, r.mash);
ok('gravity is untouched: released, the player sinks back down', r.sinks.fell === true, r.sinks);
ok('a -60 vy burst clamps at the ceiling instead of tunnelling past it', r.burst.y >= 0 && r.burst.vy >= 0, r.burst);
ok('the ceiling holds on dry land too (world invariant, not an underwater special)', r.town.y >= 0, r.town);
ok('vertical Blink near the top lands AT the ceiling and stays there', r.blink.y >= 0 && r.blinkSettled.y >= 0, { cast: r.blink, settled: r.blinkSettled });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
