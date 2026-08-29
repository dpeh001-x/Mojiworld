// Live test: SOUL VORTEX PULLS FROM BELOW IN UNDERWATER MAPS.
//
// Per user, with a video (Abyssal Trench): "soul vortex does not properly suck
// monsters in underwater maps". The footage shows a pack of Pufflish and
// Hippocampi parked directly BELOW the pool for 15+ seconds, never pulled.
//
// The pull loop had two copies of
//     if (!h.follow && m.y > cy + 12) continue;   // never through the floor
// - right on land (a mob below the pool is under the floor the pool sits on),
// wrong underwater, where mobs live at every depth in open water and half of
// any pack is below the cast height. The guard made the vortex one-directional.
//
// Pinned here: below-mobs converge and DRAIN underwater; above-mobs still
// work; and on LAND the guard is untouched - a mob under the pool's floor is
// still ignored, byte-for-byte the old behaviour.
//   node scripts/soul_vortex_underwater_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

// Cast the vortex on a given map with mobs seeded around it; report each
// mob's distance to the pool centre over time plus the damage it took.
const run = (map) => page.evaluate(async (mapId) => {
  try { loadMap(mapId); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer';
  player.level = 60; player.mp = player.maxMp = 999; player._god = true;
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; player.vx = 0; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });

  // The unit under test is THE GUARD (`m.y > cy + 12` skips), which applies
  // to every mob type. Three harness generations died to physics noise -
  // collision pops, slime hop-AI, platform settling, and the flier
  // ground-slab clamp - so the probes are FROZEN: _noGravity WITHOUT flies
  // skips BOTH physics branches (no gravity, no integration, no collision,
  // no floor clamp). Nothing in the game moves them except the vortex's
  // positional pull, which is exactly the code under test: the outer suck
  // zone has no _noGravity gate, and the drain tick sits outside the
  // in-pool !_noGravity block, so pull-in and drain both still register.
  game.monsters = [];
  const px0 = player.x + player.w / 2 + player.facing * 40;
  const py0 = player.y + player.h + 20;   // where the pool's centre will sit
  const mk = (dx, dy, tag) => {
    spawnMonster(Math.round(px0 + dx), Math.round(py0 + dy), 'slime', false);
    const m = game.monsters[game.monsters.length - 1];
    m.hp = m.currentHp = 5e7; m.maxHp = 5e7; m.atk = 0; m.speed = 0; m.jump = 0;
    m._noGravity = true; m._svTag = tag;
    m.x = px0 + dx - m.w / 2; m.y = py0 + dy - m.h / 2; m.vx = 0; m.vy = 0;
    return m;
  };
  window._svHold = () => { for (const m of game.monsters) if (m && m._svTag) { m.vx = 0; m.vy = 0; } };
  // Offsets sized against the pool ellipse (RX 230 / RY 96) and suck field
  // (RX 430 / RY 300): each probe starts in the suck ring, far enough out
  // that converging to the ellipse rim (where a _noGravity mob stops) moves
  // it well past the assertion threshold.
  mk(-60,  170, 'below');        // the video's case: in the suck ring, under the pool
  mk( 80,  200, 'below2');
  mk(  0, -220, 'above');        // regression: the direction that always worked
  mk(-340,  -10, 'beside');      // horizontal reach unchanged
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; window._svHold(); if (++n > 20) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });

  SKILL_FNS.necromancer_harvest();
  const h = game.hazards.find((x) => x && x.type === 'soul_vortex');
  if (!h) return { noPool: true };
  const cx = h.cx, cy = h.y + h.h / 2;
  const d0 = {}, y0 = {};
  for (const m of game.monsters) if (m._svTag) {
    d0[m._svTag] = Math.round(Math.hypot(cx - (m.x + m.w / 2), cy - (m.y + m.h / 2)));
    y0[m._svTag] = Math.round(m.y - cy);   // premise check: below-mobs really are below at cast time
  }

  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; window._svHold(); if (++n > 360) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });

  const out = { underwater: !!(game.mapData && game.mapData.isUnderwater), d0, y0, d1: {}, hp: {}, poolAlive: game.hazards.some((x) => x && x.type === 'soul_vortex') };
  for (const m of game.monsters) if (m._svTag) {
    out.d1[m._svTag] = Math.round(Math.hypot(cx - (m.x + m.w / 2), cy - (m.y + m.h / 2)));
    out.hp[m._svTag] = m.currentHp;
  }
  game.monsters = []; game.hazards = game.hazards.filter((x) => !x || x.type !== 'soul_vortex');
  game.mapData.platforms = game.mapData.platforms.filter((p) => !p || !p._svTest);
  return out;
}, map);

const uw = await run('abyssalTrench');
ok('the test map is underwater and the below-mobs really start below (premise)',
  uw.underwater === true && uw.poolAlive && uw.y0.below > 12 && uw.y0.below2 > 12,
  { underwater: uw.underwater, poolAlive: uw.poolAlive, y0: uw.y0 });
ok('UNDERWATER: a mob below the pool is pulled toward it (the video\'s case)',
  uw.d1.below < uw.d0.below - 40,
  { before: uw.d0.below, after: uw.d1.below, note: 'previous build: parked at the rim forever; a frozen probe stops at the ellipse rim, hence -40' });
ok('UNDERWATER: the second below-mob converges too',
  uw.d1.below2 < uw.d0.below2 - 40, { before: uw.d0.below2, after: uw.d1.below2 });
ok('UNDERWATER: mobs pulled from below actually DRAIN, not just drift',
  uw.hp.below < 5e7 || uw.hp.below2 < 5e7,
  { hpBelow: uw.hp.below, hpBelow2: uw.hp.below2, note: 'inside the ellipse the tick damages everything, so convergence must reach it' });
ok('UNDERWATER: the above-mob still converges (regression)',
  uw.d1.above < uw.d0.above - 60, { before: uw.d0.above, after: uw.d1.above });

const land = await run('sauroSlope');
ok('LAND control: the map is not underwater and the pool lives', land.underwater === false && land.poolAlive, { underwater: land.underwater });
ok('LAND control: a mob below the pool centre is STILL ignored - the floor guard is untouched',
  Math.abs(land.d1.below - land.d0.below) < 40,
  { before: land.d0.below, after: land.d1.below, note: 'on land, below the pool means under the floor it sits on' });
ok('LAND control: beside-mob still gets vacuumed',
  land.d1.beside < land.d0.beside - 60, { before: land.d0.beside, after: land.d1.beside });

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
