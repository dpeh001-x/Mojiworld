// SCORPIO'S VENOM IS A RAPID GUN AIMED AT THE PLAYER
// ============================================================================
// Per user: "the projectile should be aimed like a rapid gun aimed at the player". Both of her volleys used to throw a
// fixed fan (vx from the shot's index, vy -7 to -9) and venom takes no fall, so every shard flew up and off the top of the
// arena and almost never met a standing player. This drives the live boss through both volleys and catches every venom
// shard at the moment it is pushed:
//   1. the sting fires 5 shards in phase 1 and 9 in phase 3, the eruption 3 and 5 - one at a time, not all in one frame,
//      and far enough apart (gap x speed >= the ~59 px a shard draws) to read as bullets, not one segmented drill
//   2. each shard heads for the player's centre AS IT LEAVES (inside the phase's spread), whichever side the player is on
//   3. at the phase's speed (11 / 13 px a step), and straight: it has not curved by the end of the run
//   4. a player who stands still in front of a whole burst is hit ONCE (the burst ends inside the hit's invulnerability)
//   node scripts/scorpio_venom_gun_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9781);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Sting');
  await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/warrior/i.test(el.textContent || '')) { el.click(); break; } } });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  // a queued story beat holds game.paused - mark every beat seen before the map loads or the sim never steps
  await page.evaluate(() => { player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; });
  await page.evaluate(() => { player.level = 90; loadMap('forest', 300); });
  await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
    try { _lxCineHold(0); } catch (e) {}
    game.paused = false; player._god = true;
    const frames = async (n) => { const t0 = game.time; const d = Date.now() + 8000; while (game.time - t0 < n && Date.now() < d) await sleep(4); };
    game.monsters.length = 0;
    const m = spawnMonster(1200, 300, 'zodiac_scorpio', true, false);
    if (!m) return { err: 'no scorpio' };
    await frames(40);
    const shots = [];
    const _push = game.projectiles.push;
    game.projectiles.push = function (...ps) {
      for (const p of ps) if (p && p.skill === 'venom') shots.push({ p, t: game.time, x: p.x + p.w / 2, y: p.y + p.h / 2, vx: p.vx, vy: p.vy,
        tx: player.x + player.w / 2, ty: player.y + player.h / 2 });
      return _push.apply(this, ps);
    };
    // park her: no lunge, no stagger (the punish window that opens when an attack ends pauses her AI), and the player stands
    // still on her LEFT or RIGHT
    const park = (side) => { m.vx = 0; m._zLungeMs = 0; m._zLungeCd = 99999; m._zSpentMs = 0; m._stagger = 0; m._staggerCd = 1e9; player.vx = 0; player.x = m.x + m.w / 2 + side * 360 - player.w / 2; };
    const run = async (state, side, phaseHp, n) => {
      m.currentHp = m.maxHp * phaseHp; await frames(3);
      park(side); shots.length = 0;
      m.patternState = state; m.patternTimer = 0; m._stung = false; m._erupted = false;
      for (let i = 0; i < n; i++) { park(side); if (m.patternState !== state) break; await frames(1); }
      const out = shots.map((s) => ({ t: s.t, v: Math.hypot(s.vx, s.vy), err: Math.abs(Math.atan2(Math.sin(Math.atan2(s.vy, s.vx) - Math.atan2(s.ty - s.y, s.tx - s.x)), Math.cos(Math.atan2(s.vy, s.vx) - Math.atan2(s.ty - s.y, s.tx - s.x)))),
        vx: s.vx, vy: s.vy, nowVx: s.p.vx, nowVy: s.p.vy, life: s.p.life, side }));
      return { phase: m.phase, out };
    };
    const R = {};
    R.sting1R = await run('sting', 1, 1, 80);
    R.sting1L = await run('sting', -1, 1, 80);
    R.sting3 = await run('sting', 1, 0.2, 90);
    R.burrow1 = await run('burrow', -1, 1, 100);
    R.burrow3 = await run('burrow', 1, 0.2, 100);
    // ONE HIT: mortal, standing still in the burst's path; count the hits by the invulnerability they open
    player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 1e9;
    m.currentHp = m.maxHp * 0.2; await frames(3); park(1);
    let hits = 0, prevInv = player.invulnerable; m.patternState = 'sting'; m.patternTimer = 0; m._stung = false; shots.length = 0;
    for (let i = 0; i < 90; i++) { park(1); await frames(1); if (prevInv <= 0 && player.invulnerable > 0) hits++; prevInv = player.invulnerable; if (m.patternState !== 'sting') break; }
    // let the last shards land, with her held in idle so no second volley starts
    for (let i = 0; i < 40; i++) { park(1); m.patternState = 'idle'; m.patternTimer = 0; await frames(1); if (prevInv <= 0 && player.invulnerable > 0) hits++; prevInv = player.invulnerable; }
    R.oneHit = { hits, fired: shots.length };
    player._god = true; game.projectiles.push = _push; game.monsters.length = 0; game.projectiles.length = 0;
    return R;
  });
  if (R.err) ok('scorpio spawned', false, R.err);
  else {
    const SPREAD = { 1: 0.04, 3: 0.08 }, SPEED = { 1: 11, 3: 13 };
    const volley = (name, r, want, ph) => {
      const ts = r.out.map((s) => s.t), frames = new Set(ts).size;
      ok(`${name}: phase ${ph}, ${want} shards`, r.phase === ph && r.out.length === want, { phase: r.phase, n: r.out.length, ts });
      ok(`${name}: one at a time (${want} different frames, not one volley)`, frames === want, ts);
      const apart = ts.slice(1).map((t, i) => (t - ts[i]) * SPEED[ph]);
      ok(`${name}: a shard length apart (>= 59 px), so the burst reads as bullets`, apart.length && apart.every((d) => d >= 59), apart);
      ok(`${name}: every shard heads for the player as it leaves (within ${SPREAD[ph]} rad)`, r.out.length && r.out.every((s) => s.err <= SPREAD[ph] + 0.01), r.out.map((s) => +s.err.toFixed(3)));
      ok(`${name}: at ${SPEED[ph]} px a step`, r.out.length && r.out.every((s) => Math.abs(s.v - SPEED[ph]) < 0.01), r.out.map((s) => +s.v.toFixed(2)));
      ok(`${name}: and straight (no fall)`, r.out.length && r.out.every((s) => s.life <= 0 || (Math.abs(s.nowVx - s.vx) < 1e-6 && Math.abs(s.nowVy - s.vy) < 1e-6)), r.out.map((s) => [s.vy, s.nowVy]));
    };
    volley('sting, player on her right', R.sting1R, 5, 1);
    volley('sting, player on her left', R.sting1L, 5, 1);
    ok('sting: the shards go the player\'s way on each side', R.sting1R.out.every((s) => s.vx > 0) && R.sting1L.out.every((s) => s.vx < 0), [R.sting1R.out.map((s) => s.vx), R.sting1L.out.map((s) => s.vx)]);
    volley('sting, phase 3', R.sting3, 9, 3);
    volley('eruption', R.burrow1, 3, 1);
    volley('eruption, phase 3', R.burrow3, 5, 3);
    ok('a player standing still in front of a phase-3 burst is hit ONCE', R.oneHit.fired === 9 && R.oneHit.hits === 1, R.oneHit);
  }
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
let pass = 0;
console.log('\n=== SCORPIO VENOM GUN ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
