// The enemy meteor must hurt along its whole fall, not only where it lands.
//
// Per user, on a Virga's Domain screenshot: "I only take damage at the end of
// the animation of enemy meteor, please modify to make the hurtbox to be whole
// pillar." meteor_warn draws a meteor falling from the top of the viewport to
// the ground across its timer, but resolved damage in the single frame where
// life hit 0 — so it swept through a player standing partway down and did
// nothing until it reached the floor.
//
// Driven on the real hazard ticker with the player parked at different heights.
//   node scripts/meteor_pillar_hitbox_test.mjs [port]
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
await page.waitForFunction(() => typeof updateProjectiles === "function" && typeof loadMap === 'function', null, { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.level = 99; player.cls = 'mage';           // no warrior DR muddying the numbers
  loadMap('zod_virgo');
  await new Promise(s => setTimeout(s, 800));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  game.monsters = [];                                // the boss itself is not under test
  game.paused = false;

  // Fire one Virga-style pillar centred on a chosen x, park the player at a
  // chosen height, and run the hazard ticker until the meteor has landed.
  const run = (playerY, laneOffset) => {
    game.hazards.length = 0;
    // A big pool on purpose: the harness's level-99 dummy has a tiny maxHp
    // (setting level does not recompute stats), so the pass-through killed it
    // outright and the landing then correctly skipped a corpse — which read as
    // "the landing stopped working" when it had not.
    player.hp = 1e7; player.invulnerable = 0; player.blockTimer = 0;
    const camY = (game.camera && game.camera.y) || 0;
    player.x = 600 + laneOffset; player.y = playerY; player.vy = 0;
    const cx = 600 + player.w / 2;
    game.hazards.push({ type: 'meteor_warn', x: cx, y: 440, cx, timer: 55,
      damage: 4000, color: '#ffeecc', owner: 'enemy', radius: 90 });
    const before = player.hp;
    let firstHitFrame = null, hpAfterFall = null;
    const hits = [];
    for (let f = 0; f < 90; f++) {
      const hpBefore = player.hp;
      updateProjectiles(16);
      player.invulnerable = 0;                       // don't let iframes hide a second hit
      if (player.hp < hpBefore) {
        hits.push({ f, lost: hpBefore - player.hp });
        if (firstHitFrame === null) firstHitFrame = f;
      }
      if (!game.hazards.length) { hpAfterFall = player.hp; break; }
    }
    if (hpAfterFall === null) hpAfterFall = player.hp;
    return { hit: hpAfterFall < before, firstHitFrame, lost: before - hpAfterFall, hits, camY };
  };

  const GROUND_Y = 480 - player.h;
  out.onGround   = run(GROUND_Y, 0);      // standing where it lands
  out.midAir     = run(240, 0);           // partway down the pillar
  out.highUp     = run(120, 0);           // near the top of the fall
  out.outOfLane  = run(240, 400);         // same height, well outside the column
  game.hazards.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('on ground :', JSON.stringify(r.onGround));
console.log('mid-air   :', JSON.stringify(r.midAir));
console.log('high up   :', JSON.stringify(r.highUp));
console.log('out of lane:', JSON.stringify(r.outOfLane));

ok('a player standing where it lands is still hit (landing behaviour kept)',
   r.onGround.hit === true, r.onGround);
ok('a player PARTWAY DOWN the pillar is hit as it passes — the reported bug',
   r.midAir.hit === true, r.midAir);
ok('...and is hit DURING the fall, not only at the end',
   r.midAir.firstHitFrame != null && r.midAir.firstHitFrame < 50, { frame: r.midAir.firstHitFrame });
ok('a player high in the column is hit EARLIER than one lower down',
   r.highUp.firstHitFrame != null && r.midAir.firstHitFrame != null
   && r.highUp.firstHitFrame < r.midAir.firstHitFrame,
   { high: r.highUp.firstHitFrame, mid: r.midAir.firstHitFrame });
ok('someone outside the column is NOT hit (it is a pillar, not the whole room)',
   r.outOfLane.hit === false, r.outOfLane);
ok('a grounded player takes BOTH the pass-through and the landing (landing not lost)',
   (r.onGround.hits || []).length >= 2, { hits: r.onGround.hits });
ok('the landing is the heavier of the two (pass-through is the lighter half)',
   (r.onGround.hits || []).length >= 2
   && r.onGround.hits[r.onGround.hits.length - 1].lost > r.onGround.hits[0].lost,
   { hits: r.onGround.hits });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
