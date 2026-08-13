// Sky Lance (Dragoon) on a platform-poor / underwater map.
//
// Tester: "When using Sky Lance, I blink twice, then fall pass through
// platforms then slam on the floor."
//
// Two causes, both fixed here:
//   apex   hunted for the top VISIBLE PLATFORM; open water has none, so it fell
//          to a 200 px hop â€” a blink, three times over. Now: nearest ON-SCREEN
//          monster, 225 px above it.
//   slam   made EVERY one-way platform non-solid (v0.26.149), so the dive only
//          stopped on 'ground'. Now it punches through exactly ONE.
//
// Runs on a real map with real platforms, and simulates the fall frame by frame
// through the game's own physics rather than asserting the constants.
//   node scripts/skylance_underwater_test.mjs [port]
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
await page.waitForFunction(() => typeof _lxSkyLanceApex === 'function' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = false;
  player.cls = 'warrior'; player.job = 'knight'; player.master = 'dragoon';
  player.hp = Math.max(1, player.maxHp || 100);

  // --- A. apex snaps to a monster, 225 px above, even with NO platform above.
  const mob = { x: player.x + 260, y: 300, w: 40, h: 40, currentHp: 100, type: 'slime' };
  game.monsters.length = 0; game.monsters.push(mob);
  game.camera.x = 0; game.camera.y = 0;
  player.x = 100; player.y = 460;
  const ap = _lxSkyLanceApex();
  out.apex = { x: ap.x, y: ap.y, gotTarget: !!ap.target,
    aboveMob: (mob.y - ap.y), snappedToMobX: Math.abs((ap.x + player.w / 2) - (mob.x + mob.w / 2)) < 2 };

  // --- B. no monster on screen -> still a real rise, not a platform hunt.
  game.monsters.length = 0;
  player.y = 460;
  const ap2 = _lxSkyLanceApex();
  out.noTarget = { x: ap2.x, rise: 460 - ap2.y };

  // --- C. the dive punches through exactly ONE platform.
  // Build a clean column: three one-way platforms then solid ground.
  const plats = game.mapData.platforms;
  const saved = plats.slice();
  plats.length = 0;
  plats.push({ x: 0, y: 300, w: 400, h: 12, type: 'platform' });
  plats.push({ x: 0, y: 380, w: 400, h: 12, type: 'platform' });
  plats.push({ x: 0, y: 460, w: 400, h: 12, type: 'platform' });
  plats.push({ x: 0, y: 560, w: 400, h: 40, type: 'ground' });

  player.x = 100; player.y = 200; player.vy = 0; player.onGround = false;
  player.dragoonSlam = 1; player._slamPierceLeft = 1;
  player.dropThrough = false;
  let landedY = null, frames = 0;
  for (let i = 0; i < 400 && landedY === null; i++) {
    player.vy += 0.5;
    player.y += player.vy;
    checkPlatformCollision(player);
    frames++;
    if (player.onGround) landedY = player.y + player.h;
  }
  out.slam = { landedAtBottom: landedY, frames, pierceLeft: player._slamPierceLeft | 0 };

  // --- D. with NO slam flag the player lands on the first platform (control).
  player.x = 100; player.y = 200; player.vy = 0; player.onGround = false;
  player.dragoonSlam = 0; player._slamPierceLeft = 0;
  let normalY = null;
  for (let i = 0; i < 400 && normalY === null; i++) {
    player.vy += 0.5; player.y += player.vy;
    checkPlatformCollision(player);
    if (player.onGround) normalY = player.y + player.h;
  }
  out.normalLand = normalY;

  plats.length = 0; for (const p of saved) plats.push(p);
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('apex        ->', JSON.stringify(r.apex));
console.log('no target   ->', JSON.stringify(r.noTarget));
console.log('slam        ->', JSON.stringify(r.slam), ' (platforms at 300/380/460, ground 560)');
console.log('no-slam land->', r.normalLand);

ok('the apex targets an on-screen monster', r.apex.gotTarget === true, r.apex);
ok('it rises ~225 px ABOVE that monster', Math.abs(r.apex.aboveMob - 225) <= 2, { above: r.apex.aboveMob });
ok('it teleports horizontally onto the monster', r.apex.snappedToMobX === true, r.apex);
ok('with no monster on screen it still rises 225 px (no 200px blink, no platform hunt)',
   Math.abs(r.noTarget.rise - 225) <= 2 && r.noTarget.x === null, r.noTarget);
ok('the slam punches through exactly ONE platform', r.slam.landedAtBottom === 380, { landedAt: r.slam.landedAtBottom, expected: 380 });
ok('it does NOT fall all the way to the ground floor any more', r.slam.landedAtBottom !== 560, { landedAt: r.slam.landedAtBottom });
ok('the pierce budget is spent, not left open', r.slam.pierceLeft === 0, { left: r.slam.pierceLeft });
ok('a normal fall still lands on the FIRST platform (slam-only behaviour)', r.normalLand === 300, { landedAt: r.normalLand });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

