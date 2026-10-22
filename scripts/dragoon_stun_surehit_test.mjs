// DRAGOON'S G AND B (a tester's video: "G works very weird when my character is stunned ... once i recovered from stun the attack continues", "as for B, every spear doesnt seem to hit the boss, and the boss seems to take 2 instances of damage").
//   G : Sky Lance's dive LANDS when the hero lands. A hero stunned mid-dive used to fall to the floor and stand there with dragoonSlam set - no impact, the chained dives paused behind it - until the stun ended.
//   B : Skyfall Dominion's nine lances and its closing shockwave roll no miss. A live cast on Regulus (evasion 503) used to land 2 of 9 lances and miss the slam.
//   live G : the impact fires while the stun is still running (>= 500 ms of it left), with the slam flag cleared; an unstunned dive still impacts
//   live B : on the Leo boss every lance and the slam reaches hitMonster and none is a MISS
//   node scripts/dragoon_stun_surehit_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10451);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof hitMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 85; player.job = 'knight'; player.master = 'dragoon';
    player.maxHp = player.hp = 9e9; player.maxMp = player.mp = 99999; player.baseAtk = 600; player.invulnerable = 9e9;
    const out = { fn: typeof _lxDragoonSlamLand };
    // ---------------- G, in the forest
    loadMap('forest', 300); await W8(3000); game.paused = false; game.monsters = [];
    const gy = Math.max(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    const mob = spawnMonster(900, gy - 80, 'mushroom', false, false); mob.currentHp = mob.maxHp = 9e12; mob.vx = 0; mob.speed = 0; mob.shoot = null;
    const dive = async (stunAtMs, stunMs) => { game.projectiles = []; for (const k of Object.keys(player.skillCd || {})) player.skillCd[k] = 0; if (player.cooldowns) player.cooldowns = {}; player.stunTimer = 0; player.invulnerable = 9e9;
      player.x = 600; player.y = gy - player.h; player.vy = 0; player.onGround = true; mob.x = 900; mob.y = gy - mob.h; await frame();
      const imp = []; const op = window.performAround; const t0 = performance.now(); window.performAround = function (r, d, o) { if (o && o.bossMul === 2.2) imp.push({ t: Math.round(performance.now() - t0), st: Math.round(player.stunTimer || 0), slam: player.dragoonSlam }); return op.apply(this, arguments); };
      castSkill('dragoon_skylance'); let stunned = false;
      while (performance.now() - t0 < 3000) { await frame(); if (stunAtMs != null && !stunned && performance.now() - t0 >= stunAtMs) { stunned = true; player._god = false; player.stunTimer = stunMs; } }
      window.performAround = op; player.stunTimer = 0; return imp; };
    out.free = await dive(null, 0); await W8(600); out.stunned = await dive(150, 6000);
    // ---------------- B, on Regulus (evasion 503)
    loadMap('zod_leo', 300); await W8(3500); game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const boss = game.monsters.find((m) => m && m.type === 'zodiac_leo'); if (!boss) return { ...out, err: 'no boss' };
    boss._introDone = true; boss.currentHp = boss.maxHp = 9e12; boss.aggroTarget = null; boss.vx = 0; boss.speed = 0; boss.shoot = null;
    const log = [], miss = []; const oh = window.hitMonster; window.hitMonster = function (m, dmg, crit, skill) { const b = m.currentHp; const r = oh.apply(this, arguments); if (m === boss) log.push({ skill, dealt: Math.round(b - m.currentHp) }); return r; };
    const odn = game.damageNumbers.push.bind(game.damageNumbers); game.damageNumbers.push = function (...a) { for (const d of a) if (d && !d.taken && /miss/i.test(String(d.text || ''))) miss.push(1); return odn(...a); };
    const gy2 = Math.max(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y)); player._god = true; player.x = boss.x + boss.w / 2 - 300; player.y = gy2 - player.h; player.vy = 0;
    out.boss = { ev: boss.evasion }; castSkill('dragoon_ult'); const t0 = performance.now(); while (performance.now() - t0 < 5000) await frame();
    window.hitMonster = oh; out.B = { shard: log.filter((r) => r.skill === 'shard').length, aoe: log.filter((r) => r.skill === 'aoe').length, zero: log.filter((r) => r.dealt <= 0).length, miss: miss.length };
    return out;
  });
  ok('the landing is its own function (_lxDragoonSlamLand)', R.fn === 'function', R.fn);
  ok('G: an unstunned dive still impacts', !R.err && R.free && R.free.length >= 1, R.free);
  const first = R.stunned && R.stunned[0];
  ok('G: stunned mid-dive, the impact fires WHILE the stun is running (>= 500 ms of it left), slam flag cleared', !!first && first.st >= 500 && !first.slam, R.stunned);
  ok('B: Regulus is the evasive target (503)', R.boss && R.boss.ev >= 400, R.boss);
  ok('B: all nine lances and the shockwave reach the boss and none is a MISS', R.B && R.B.shard === 9 && R.B.aoe >= 1 && R.B.miss === 0 && R.B.zero === 0, R.B);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
