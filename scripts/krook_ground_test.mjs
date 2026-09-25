// KING KROOK KEEPS HIS FEET ON THE FLOOR AND HOLDS STILL UNDER THE PLAYER (v0.30.968).
//
// Per user, with a clip: "movement is horribly weird with sliding and he is levitating off the
// ground". Two mechanisms, both proven here against the live arena (krookThrone's baked perches
// are 200 / 200 / 240 px wide; Krook's hitbox is 347 x 344):
//   1. LEVITATION - the generic boss platform-leap launched him at a perch narrower than his body
//      and checkPlatformCollision rested him on it, most of him hanging over nothing. His own
//      JUMP SLAM arc could park him the same way. Now: no leap at such a ledge, no rest on one.
//   2. SLIDING - his AI re-set m.facing exactly every tick (overriding bossAI's shared dead band)
//      while the idle shuffle always drove toward the player's centre; under his belly the sign
//      of dx flipped every few frames and he moonwalked on the spot. Now: shared dead band +
//      a standoff on the shuffle.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/krook_ground_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11357';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
// static: the three edits are present
const src = readFileSync(PAGE, 'utf8');
check(/const _LX_BOSS_LEDGE_MIN_FRAC = 0\.7;/.test(src), 'static: the ledge-width fraction is declared');
check(/if \(p\.w < m\.w \* _LX_BOSS_LEDGE_MIN_FRAC\) continue;/.test(src), 'static: _bossSeekPlatform refuses ledges narrower than the body');
check(/if \(_ledgeMinW && p\.type !== 'ground' && p\.w < _ledgeMinW\) continue;/.test(src), 'static: checkPlatformCollision never rests a boss on one');
check(!/const dx = \(player\.x \+ player\.w\/2\) - \(m\.x \+ m\.w\/2\);\n\s*m\.facing = dx > 0 \? 1 : -1;\n\n\s*if \(m\.patternState === 'idle'\)/.test(src), 'static: Krook no longer overrides the shared facing dead band every tick');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  const arena = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 90; player.hp = player.maxHp = 999999; player._god = true;
    loadMap('krookThrone', 1200); await new Promise((r) => setTimeout(r, 2500)); game.paused = false;
    try { document.body.classList.remove('cinematic', 'sb-active'); } catch (e) {}
    const k = (game.monsters || []).find((m) => m && m.type === 'kingKrook');
    const perches = game.mapData.platforms.filter((p) => p.type === 'platform');
    return { k: k && { w: k.w, h: k.h, isBoss: !!k.isBoss, boss: !!k.boss, feet: k.y + k.h }, perches: perches.map((p) => [p.x, p.y, p.w]), ground: game.mapData.platforms.find((p) => p.type === 'ground').y };
  });
  check(!!arena.k, 'the arena spawns King Krook', J(arena.k));
  check(arena.perches.length === 3 && arena.perches.every((p) => p[2] < arena.k.w), 'his arena has three perches, all narrower than he is', J(arena.perches));
  // 1a. the player perches on the right ledge for ten seconds: he never leaps at it, never rests on it
  const perch = await page.evaluate(async () => {
    const k = (game.monsters || []).find((m) => m && m.type === 'kingKrook'); const ledge = game.mapData.platforms.find((p) => p.type === 'platform' && p.x > 900);
    let launches = 0; const oSeek = _bossSeekPlatform; window._bossSeekPlatform = function (m, dt) { const vy0 = m.vy; const rv = oSeek.apply(this, arguments); if (m.vy < 0 && m.vy !== vy0) launches++; return rv; };
    const keep = setInterval(() => { player.x = ledge.x + ledge.w / 2 - player.w / 2; player.y = ledge.y - player.h; player.vy = 0; player.onGround = true; }, 100);
    let parked = 0, n = 0, states = new Set(); const t0 = performance.now();
    await new Promise((done) => { const iv = setInterval(() => { n++; const feet = k.y + k.h; if (k.onGround && feet < 470) { parked++; states.add(k.patternState); } if (performance.now() - t0 > 10000) { clearInterval(iv); clearInterval(keep); done(); } }, 40); });
    window._bossSeekPlatform = oSeek;
    return { launches, parked, n, states: [...states], feet: Math.round(k.y + k.h) };
  });
  check(perch.launches === 0, '1a. player on a perch for 10 s: the platform-leap never launches him at it', J(perch));
  check(perch.parked === 0, '    and he is never found standing above the floor', `parked ${perch.parked}/${perch.n} samples, states ${J(perch.states)}`);
  // 1b. his own JUMP SLAM over a perch: he comes down on the floor, not the ledge
  const slam = await page.evaluate(async () => {
    const k = (game.monsters || []).find((m) => m && m.type === 'kingKrook'); const ledge = game.mapData.platforms.find((p) => p.type === 'platform' && p.x > 900);
    const ground = game.mapData.platforms.find((p) => p.type === 'ground').y;
    let out = [];
    for (let i = 0; i < 3; i++) {
      // stand him so his hitbox overlaps the ledge, player just beyond it, then force the slam
      k.x = ledge.x - k.w * 0.4 + i * 30; k.y = ground - k.h; k.vx = 0; k.vy = 0; k.onGround = true;
      player.x = ledge.x + ledge.w + 60; player.y = ground - player.h; player.vy = 0;
      // the pattern's own take-off sits in a 50 ms timer window the harness can skip under load, so
      // the slam's impulse (vy -14, five px a frame toward the player) is applied here as well - the
      // arc is the fixture; the rule under test is where it comes down.
      k.patternState = 'jumpSlam'; k.patternTimer = 300; k._kFired = false; k._stagger = 0; k._dirOpenT = 0;   // an open-window roll cancels patterns and zeroes upward vy
      k.vy = -14; k.vx = 5; k.onGround = false;
      let peak = ground, restedOn = null; const t0 = performance.now();
      await new Promise((done) => { const iv = setInterval(() => { const feet = k.y + k.h; peak = Math.min(peak, feet); if (k.onGround && performance.now() - t0 > 400) { restedOn = Math.round(feet); } if (restedOn != null || performance.now() - t0 > 3000) { clearInterval(iv); done(); } }, 16); });
      out.push({ peak: Math.round(peak), restedOn, ledgeY: ledge.y });
    }
    return out;
  });
  check(slam.every((s) => s.peak < s.ledgeY), '1b. the forced JUMP SLAM clears the ledge height every time (the arc crosses it)', J(slam));
  check(slam.every((s) => s.restedOn === arena.ground), '    and he lands on the floor every time, never on the ledge', J(slam.map((s) => s.restedOn)));
  // 2. the player stands under his centre on the floor: facing settles, no shuffle
  const belly = await page.evaluate(async () => {
    const k = (game.monsters || []).find((m) => m && m.type === 'kingKrook'); const ground = game.mapData.platforms.find((p) => p.type === 'ground').y;
    k.x = 500; k.y = ground - k.h; k.vx = 0; k.vy = 0; k.patternState = 'idle'; k.patternTimer = 0; k._kString = null; k._kRecoverMs = 0;
    const under = () => { player.x = k.x + k.w / 2 - player.w / 2; player.y = ground - player.h; player.vy = 0; player.onGround = true; };
    under(); await new Promise((r) => setTimeout(r, 120));   // let the tick before the first sample see him already there
    const keep = setInterval(under, 30);
    let flips = 0, moved = 0, n = 0, last = k.facing; const t0 = performance.now();
    await new Promise((done) => { const iv = setInterval(() => { if (k.patternState === 'idle') { n++; if (k.facing !== last) flips++; last = k.facing; if (Math.abs(k.vx) > 0.5) moved++; } if (performance.now() - t0 > 3000) { clearInterval(iv); clearInterval(keep); done(); } }, 20); });
    return { flips, moved, n };
  });
  check(belly.n > 40 && belly.flips <= 2, '2. player under his belly for 3 s: facing flips at most twice (was every few frames)', J(belly));
  check(belly.moved === 0, '    and the idle shuffle holds still instead of sliding through the player', `moving in ${belly.moved}/${belly.n} idle samples`);
  // 2b. the player walks away: he still turns and shuffles after them
  const chase = await page.evaluate(async () => {
    const k = (game.monsters || []).find((m) => m && m.type === 'kingKrook'); const ground = game.mapData.platforms.find((p) => p.type === 'ground').y;
    k.x = 700; k.y = ground - k.h; k.vx = 0; k.patternState = 'idle'; k.patternTimer = 0;
    player.x = 100; player.y = ground - player.h; player.vy = 0;
    await new Promise((r) => setTimeout(r, 700));
    const left = { facing: k.facing, vx: +k.vx.toFixed(2), idle: k.patternState === 'idle' };
    player.x = 1300; await new Promise((r) => setTimeout(r, 700));
    const right = { facing: k.facing, vx: +k.vx.toFixed(2), idle: k.patternState === 'idle' };
    return { left, right };
  });
  check((!chase.left.idle || (chase.left.facing === -1 && chase.left.vx < 0)) && (!chase.right.idle || (chase.right.facing === 1 && chase.right.vx > 0)), '2b. a player at range is still turned toward and shuffled after', J(chase));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
