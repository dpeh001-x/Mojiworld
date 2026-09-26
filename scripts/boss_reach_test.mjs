// Three boss basics that could not touch a grounded player: King Krook's Fire Breath, his claw swipe, Barnaby's haymaker.
// Per the 2026-09-26 full audit.
//  - FIRE BREATH fired on `t % 90 === 0` - but t is the boss pattern clock, a float that advances ~18.4 ms a step (x1.18
//    in phase 2), so it never lands on a multiple of 90: the toast and the mouth glow played and no shot ever left.
//  - The CLAW (Krook) and the HAYMAKER (Barnaby) spawn their hit box at a fixed fraction of the boss's height, written
//    before v0.30.420 grew every hitbox to the art: Krook's box ends 117 px above a grounded player's head (a full jump
//    still misses by 22), Barnaby's 16.5 px above it - only a jumper could be hit.
// Measured at the projectile step: every enemy box of the move is tested against the player's standing box each time
// updateProjectiles runs (the claw lives 8 steps). A player standing in front of each boss, on the same floor.
//   node scripts/boss_reach_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9990);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateProjectiles === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 60; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  loadMap('forest', 300); game.paused = false; await sleep(1200);
  const floorY = player.y + player.h;   // the player's own floor (spawned on it)
  // watch every enemy box of the move against the player's standing box, at each projectile step
  let watch = null;
  const _up = window.updateProjectiles;
  const _ovl = (x, y, p) => x < player.x + player.w && x + p.w > player.x && y < player.y + player.h && y + p.h > player.y;
  window.updateProjectiles = function () {
    // a box that connects is removed INSIDE this step, so test it before the step too: where it is and where it moves to
    if (watch) for (const p of game.projectiles) { if (p && p.owner === 'enemy' && watch.skills.includes(p.skill)) { if (!watch.first) watch.first = { p: [p.x, p.y, p.w, p.h].map(Math.round), pl: [player.x, player.y, player.w, player.h].map(Math.round) }; watch.seen.add(p); if (_ovl(p.x, p.y, p) || _ovl(p.x + (p.vx || 0), p.y + (p.vy || 0), p)) watch.hit.add(p); } }
    const r = _up.apply(this, arguments);
    if (watch) for (const p of game.projectiles) {
      if (!p || p.owner !== 'enemy' || !watch.skills.includes(p.skill)) continue;
      watch.seen.add(p);
      const ov = p.x < player.x + player.w && p.x + p.w > player.x && p.y < player.y + player.h && p.y + p.h > player.y;
      if (ov) watch.hit.add(p);
      watch.lowest = Math.max(watch.lowest, p.y + p.h - player.y);   // > 0 = the box reaches the player's top
    }
    return r;
  };
  const drive = async (type, setup, skills, steps, map) => {
    // an arena with one flat floor: an open map puts him on a platform above the player (the forest has them)
    try { loadMap(map, 600); } catch (e) {} game.paused = false; await sleep(1500);
    try { _dismissBossIntro(); } catch (e) {} await sleep(300);
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + 260, player.y - 300, type, true);
    try { _dismissBossIntro(); } catch (e) {}
    game.paused = false;
    for (let i = 0; i < 90 && !m.onGround; i++) await sleep(16);   // let him land on the floor
    const px0 = m.x + m.w + 16;                                     // stand just in front of his face
    watch = { skills, seen: new Set(), hit: new Set(), lowest: -1e9 };
    const t0 = game.time | 0;
    while (((game.time | 0) - t0) < steps) {
      const _gap = watch.skills.includes('firebomb') ? 220 : 16; player.x = (m.facing > 0) ? (m.x + m.w + _gap) : (m.x - player.w - _gap);   // the breath is a cone from his mouth: a player hugging his chest is under it player.vx = 0; player.y = m.y + m.h - player.h; player.vy = 0; player.onGround = true; player.hp = player.maxHp = 1e9; player.invulnerable = 0;   // on HIS floor
      setup(m, (game.time | 0) - t0);
      await new Promise((z) => requestAnimationFrame(z));
    }
    const out = { first: watch.first, shots: watch.seen.size, hits: watch.hit.size, reachPx: Math.round(watch.lowest), bossH: m.h, onGround: !!m.onGround, px0: Math.round(px0) };
    watch = null; game.monsters.length = 0; game.projectiles.length = 0;
    return out;
  };
  const pinKrook = (m) => { m._krookInit = true; m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m._dirRollT = 1e12; m._dirStanceT = 1e12; m.evasion = 0; m.facing = 1; };
  const out = {};
  // fire breath: enter the pattern once, let it run its 1.5 s
  out.breath = await drive('kingKrook', (m, s) => { pinKrook(m); if (s === 0) { m.patternState = 'fireBreath'; m.patternTimer = 0; m._fireAnnounced = false; } if (m.patternState !== 'fireBreath' && s < 60) { m.patternState = 'fireBreath'; } }, ['firebomb'], 130, 'krookThrone');
  // claw
  out.claw = await drive('kingKrook', (m, s) => { pinKrook(m); if (s === 0) { m.patternState = 'claw'; m.patternTimer = 0; m._kFired = false; } }, ['claw'], 60, 'krookThrone');
  // Barnaby's haymaker, thrown on the ground (jump 0: a hop takes the punch into the air, which is fair)
  out.fist = await drive('young_confused_barnaby', (m, s) => { m.evasion = 0; m.facing = 1; m.jump = 0; if (s % 10 === 0 && m.onGround && m._bxState !== 'jab' && Math.abs((m.y + m.h) - (player.y + player.h)) < 6) { m._bxState = 'jab'; m._bxT = 0; m._bxJabs = 1; } }, ['barnFist'], 140, 'krookThrone');   // a flat floor under both (his own arena has a step)
  window.updateProjectiles = _up;
  return out;
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.breath.shots > 0, 'King Krook\'s FIRE BREATH actually fires its cone (was: toast and glow, no shot)', R.breath);
ok(R.breath.hits > 0, '...and the cone can reach a player standing in front of him', R.breath);
ok(R.claw.shots > 0 && R.claw.hits > 0, 'his CLAW swipe can hit a grounded player at his flank (the box ended 117 px above their head)', R.claw);
ok(R.fist.shots > 0 && R.fist.hits > 0, 'Barnaby\'s HAYMAKER can hit a grounded player in front of him (was: jumpers only)', R.fist);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
