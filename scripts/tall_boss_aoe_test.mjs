// Player AoEs reach a tall boss at melee range, and a no-gravity monster bolt flies level.
// Per the 2026-09-26 full audit.
//  - performAround (Ground Slam, Rampage, War Cry, Dark Pulse, the Shadow Sovereign star...) measured to the monster's
//    CENTRE. v0.30.843 moved seven master skills to _lxMonHitD2 (distance to the boss's hit box) but never this shared
//    helper: from the spot King Krook parks the player (half his width + 24 px from his centre) his centre is ~248 px
//    away, so a 200 px Ground Slam landing missed a boss the player was touching.
//  - The monster-throw gravity (msplinter / mspore / mtoxic / mdark) ignored the projectile's own noGravity flag, so
//    Pisces' Dream Bolt (mdark, noGravity: true, aimed from a 339 px flyer) dropped 58 px by 200 px out and rarely
//    connected. Same per-tag physics v0.30.1013 fixed one line above for splash / shock / spore.
// CONTROLS: an ordinary monster keeps the exact centre test; a boss out of range is still missed; a throw without the
// flag still arcs.
//   node scripts/tall_boss_aoe_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9991);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof performAround === 'function' && typeof updateProjectiles === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 60; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  loadMap('krookThrone', 600); game.paused = false; await sleep(1500);
  try { _dismissBossIntro(); } catch (e) {} await sleep(300);
  const out = {};
  const place = async (type, boss) => {
    game.monsters.length = 0;
    const m = spawnMonster(player.x + 300, player.y - 300, type, boss);
    try { _dismissBossIntro(); } catch (e) {}
    game.paused = false;
    for (let i = 0; i < 120 && !m.onGround; i++) await sleep(16);
    game.paused = true;   // freeze: nothing moves between placing and swinging
    m.evasion = 0; m.currentHp = m.maxHp = 1e9;
    return m;
  };
  const swing = (m, centreDist) => {
    player.x = (m.x + m.w / 2) + centreDist - player.w / 2; player.y = (m.y + m.h) - player.h;   // on his floor, beside him
    const hp0 = m.currentHp; game.comboMult = 1; game.combo = 0;
    performAround(200, 1.5, {});
    return { hit: m.currentHp < hp0, centreDist: Math.round(Math.hypot((m.x + m.w / 2) - (player.x + player.w / 2), (m.y + m.h / 2) - (player.y + player.h / 2))), bossH: m.h };
  };
  { const m = await place('kingKrook', true); out.krookTouch = swing(m, m.w * 0.5 + 24); }            // where he parks you
  { const m = await place('kingKrook', true); out.krookFar = swing(m, m.w * 0.5 + 260); }             // well out of a 200 px slam
  { const m = await place('slime', false); out.slime = swing(m, 196); }                                 // an ordinary monster: exact centre test
  game.paused = false; game.monsters.length = 0;
  // the Dream Bolt vs a throw without the flag (updateProjectiles steps them; nothing to hit)
  game.projectiles.length = 0;
  const bolt = { x: 400, y: 100, vx: 4.5, vy: 0, w: 40, h: 40, life: 130, owner: 'enemy', skill: 'mdark', noGravity: true, damage: 1 };
  const arc = { x: 400, y: 100, vx: 4.5, vy: 0, w: 40, h: 40, life: 130, owner: 'enemy', skill: 'mdark', damage: 1 };
  game.projectiles.push(bolt, arc);
  game.paused = true;
  for (let i = 0; i < 30; i++) updateProjectiles(1000 / 60);
  out.bolt = { vyNoGrav: +bolt.vy.toFixed(2), vyArc: +arc.vy.toFixed(2) };
  game.paused = false; game.projectiles.length = 0;
  return out;
});
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.krookTouch.hit, 'a 200 px AoE hits King Krook from where he parks the player (his centre is ~248 px away)', R.krookTouch);
ok(!R.krookFar.hit, 'CONTROL: the same AoE still misses him from 260 px beyond his flank', R.krookFar);
ok(R.slime.hit, 'CONTROL: an ordinary monster inside the radius is hit by the centre test as before', R.slime);
ok(R.bolt.vyNoGrav === 0, 'Pisces\' Dream Bolt (mdark, noGravity) flies level', R.bolt);
ok(R.bolt.vyArc > 1, 'CONTROL: a monster throw without the flag still arcs', R.bolt);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
