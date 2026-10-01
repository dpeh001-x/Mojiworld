#!/usr/bin/env node
// v0.30.1526 - OVERPOWERED SKILLS, PART 2: CROWD CONTROL BY THE BOSS RULES (per user: "Fix all that you have suggested", after the
// audit of "skills that might be too overpowered, especially the buffs and those with miscellaneous effects").
//   SIEGE  - a Siege Volley / War Machine arrow staggers only when it lands (a miss did too); a normal foe is pinned 0.4 s as
//            before, a mini-boss goes through the stun resist, a boss is slowed (_lxSlowT) and never stunned (a stun halts its
//            signature attacks), and the slow wears off
//   TURRET - War Machine's turret lasts 30 s at rank 0 (it was 45 s on a 45 s cooldown)
//   STUNS  - Somersault Smash, Sky Lance and Eclipse Massacre (batches and snap) stun through _applyMobStatus
//   FREEZE - Magic Bolt's proc, an Ice Spike and its splash, and Pandemic Hex freeze through _applyMobStatus
//   HEX    - Pandemic Hex weakens a boss 15% and a normal foe 35%
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/nerf_cc_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11789);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = async (n) => { const t0 = game.time; for (let i = 0; i < 600 && game.time - t0 < n; i++) { game.paused = false; game.hitStop = 0; await sleep(20); } game.paused = true; };   // a hit's hit-stop skips updates while game.time runs on
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('archer'); player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._gravitosCineSeen = true;
    loadMap('forest', 300); await sleep(1500); game.paused = true;
    const hero = (cls, job, master) => { if (player.cls !== cls) applyClass(cls); player.job = job; player.master = master; player.masteries = master ? { [master]: true } : {};
      player.level = 99; player._god = true; player.invulnerable = 0; player.mp = player.maxMp = 99999; player.skillCooldowns = {}; player.skillRanks = {}; player._castLockUntil = 0; player.vx = 0; };
    const clear = () => { game.monsters.length = 0; game.projectiles.length = 0; };
    const foe = (kind, dx) => { const m = spawnMonster(player.x + (dx || 120), player.y - 10, kind === 'boss' ? 'kingKrook' : 'slime', kind === 'boss', kind === 'mini');
      Object.assign(m, { maxHp: 1e9, currentHp: 1e9, stunTimer: 0, freezeTimer: 0, _ccGraceUntil: 0, _lxSlowT: 0, evasion: 0, traits: null, isElite: false });
      if (kind === 'boss') Object.assign(m, { _wardNextAt: 1e12, _wardUntil: 0 }); return m; };
    const calls = []; const _ams = window._applyMobStatus;
    window._applyMobStatus = function (m, kind, ms) { calls.push({ m, kind, ms }); return _ams.apply(this, arguments); };
    const callsOn = (m, kind) => calls.filter((c) => c.m === m && c.kind === kind).map((c) => c.ms);
    const out = {};
    // SIEGE - one arrow at the foe, one step, then the arrow is gone
    // the arrow covers the foe with room to spare: a boss walks on its first frames and a pin-sized shot at its old centre misses
    const arrow = async (m) => { game.projectiles.push({ x: m.x - 60, y: m.y - 60, vx: 0.01, vy: 0, w: m.w + 120, h: m.h + 120, life: 20, damage: 100,
      owner: 'player', skill: 'siege', pierce: true, defBreak: true, noGravity: true }); await frames(2); game.projectiles.length = 0; };
    hero('archer', 'sniper', 'ballista'); out.siege = {};
    { clear(); const m = foe('normal'); await arrow(m); out.siege.normal = { stun: m.stunTimer | 0, hp: 1e9 - m.currentHp }; }
    { clear(); const m = foe('normal'); m.evasion = 50; const _ra = window._rollAccuracyHit; window._rollAccuracyHit = () => false;
      try { await arrow(m); } finally { window._rollAccuracyHit = _ra; } out.siege.miss = { stun: m.stunTimer | 0, hp: 1e9 - m.currentHp }; }
    { clear(); const m = foe('mini'); calls.length = 0; await arrow(m); out.siege.mini = { calls: callsOn(m, 'stun'), hp: 1e9 - m.currentHp, isMini: !!m.isMiniBoss };
      const m2 = foe('mini', 200); const _r = Math.random; Math.random = () => 0.1; try { await arrow(m2); } finally { Math.random = _r; } out.siege.miniResisted = { stun: m2.stunTimer | 0 }; }
    { clear(); const m = foe('boss'); await arrow(m); out.siege.boss = { slow: Math.round(m._lxSlowT || 0), stun: m.stunTimer | 0, isBoss: !!m.isBoss, hp: 1e9 - m.currentHp };
      await frames(30); out.siege.boss.slowAfter = Math.round(m._lxSlowT || 0); out.siege.boss.stunAfter = m.stunTimer | 0; }
    // TURRET
    clear(); player._ballistaTurrets = []; SKILL_FNS.ballista_ult(); out.turret = { life: player._ballistaTurrets[0] && player._ballistaTurrets[0].life };
    player.skillRanks = { ballista_ult: 10 }; SKILL_FNS.ballista_ult(); out.turret.life10 = player._ballistaTurrets[0] && player._ballistaTurrets[0].life;
    player._ballistaTurrets = []; player.skillRanks = {};
    // STUNS - each skill cast for real at a normal foe in reach
    const stunOf = async (cls, job, master, id, dx, wait) => { clear(); hero(cls, job, master); const m = foe('normal', dx); calls.length = 0;
      let err = null; try { castSkill(id); } catch (e) { err = String(e).slice(0, 80); } await frames(wait); const r = { ms: callsOn(m, 'stun'), err }; clear(); return r; };
    out.somersault = await stunOf('warrior', null, null, 'powerStrike', 60, 90);
    out.skylance = await stunOf('warrior', 'knight', 'dragoon', 'dragoon_skylance', 200, 150);
    out.eclipse = await stunOf('rogue', 'assassin', 'nightreaper', 'nightreaper_mark', 150, 240);
    // FREEZE - Magic Bolt's 25% proc (rolled low), an Ice Spike with splash, Pandemic Hex
    { clear(); hero('mage', null, null); const m = foe('normal'); calls.length = 0; const _r = Math.random; Math.random = () => 0.1;
      try { hitMonster(m, 100, false, 'bolt'); } finally { Math.random = _r; } out.bolt = callsOn(m, 'freeze'); }
    { clear(); const a = foe('normal', 120), b = foe('normal', 150); calls.length = 0;
      game.projectiles.push({ x: a.x + a.w / 2 - 4, y: a.y + a.h / 2 - 4, vx: 0.01, vy: 0, w: 8, h: 8, life: 20, damage: 100, owner: 'player', skill: 'ice', freeze: 1500, aoeOnHit: 90, noGravity: true });
      await frames(2); game.projectiles.length = 0; out.ice = { hit: callsOn(a, 'freeze'), splash: callsOn(b, 'freeze') }; }
    { clear(); hero('mage', 'warlock', 'hexmaster'); const bm = foe('boss', 200), m = foe('normal', 120); bm.atk = 1000; m.atk = 1000; calls.length = 0;
      SKILL_FNS.hexmaster_ult(); out.hex = { bossAtk: bm.atk, mobAtk: m.atk, freezeMob: callsOn(m, 'freeze'), freezeBoss: callsOn(bm, 'freeze'), bossFrozen: bm.freezeTimer | 0 };
      for (const x of [bm, m]) if (x._hexWeakBase != null) { x.atk = x._hexWeakBase; x._hexWeakBase = null; } }
    window._applyMobStatus = _ams; clear(); return out;
  });
  const S = R.siege;
  ok('SIEGE: a landed arrow still pins a normal foe for 0.4 s', S.normal.hp > 0 && S.normal.stun > 300 && S.normal.stun <= 400, JSON.stringify(S.normal));
  ok('SIEGE: an arrow that misses staggers nothing', S.miss.hp === 0 && S.miss.stun === 0, JSON.stringify(S.miss));
  ok('SIEGE: a mini-boss is staggered through the stun resist, and is not stunned when it resists', S.mini.calls.includes(400) && S.miniResisted.stun === 0, JSON.stringify({ mini: S.mini, resisted: S.miniResisted }));
  ok('SIEGE: a boss is slowed for 0.4 s and never stunned', S.boss.isBoss && S.boss.slow > 300 && S.boss.slow <= 400 && S.boss.stun === 0, JSON.stringify(S.boss));
  ok('SIEGE: the boss slow wears off, still without a stun', S.boss.slowAfter <= 0 && S.boss.stunAfter === 0, JSON.stringify(S.boss));
  ok('TURRET: War Machine lasts 30 s at rank 0 and 40 s at rank 10', R.turret.life === 30000 && R.turret.life10 === 40000, JSON.stringify(R.turret));
  ok('STUNS: Somersault Smash stuns 0.6 s through _applyMobStatus', R.somersault.ms.includes(600), JSON.stringify(R.somersault));
  ok('STUNS: Sky Lance stuns 0.8 s through _applyMobStatus', R.skylance.ms.includes(800), JSON.stringify(R.skylance));
  ok('STUNS: Eclipse Massacre stuns 0.2 s a batch through _applyMobStatus', R.eclipse.ms.includes(200), JSON.stringify(R.eclipse));
  ok('FREEZE: Magic Bolt freezes 0.8 s through _applyMobStatus', R.bolt.includes(800), JSON.stringify(R.bolt));
  ok('FREEZE: an Ice Spike and its splash freeze 1.5 s through _applyMobStatus', R.ice.hit.includes(1500) && R.ice.splash.includes(1500), JSON.stringify(R.ice));
  ok('FREEZE: Pandemic Hex freezes through _applyMobStatus, and a boss stays unfrozen', R.hex.freezeMob.includes(900) && R.hex.freezeBoss.includes(900) && R.hex.bossFrozen === 0, JSON.stringify(R.hex));
  ok('HEX: Pandemic Hex weakens a boss 15% and a normal foe 35%', R.hex.bossAtk === 850 && R.hex.mobAtk === 650, JSON.stringify(R.hex));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
