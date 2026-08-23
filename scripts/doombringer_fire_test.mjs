// Live test: DOOMBRINGER B — Calamity Incarnate as a homing single-target barrage.
//
// Per user: "it should be one of the more powerful skills dealing good strong
// damage to 1 monster, like summoning homing fireballs."
//
// Driven through the real skill handler with real monsters, and the projectiles
// it spawns are inspected and then STEPPED so the homing is measured, not
// assumed.
//   node scripts/doombringer_fire_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS !== 'undefined' && typeof SKILLS !== 'undefined', null, { timeout: 120000 });
// the art loads lazily; touch it so the decode starts before we assert on it
await page.evaluate(() => { try { void LX_BULT_PROJ.bult_doomfire; if (typeof _projAnimFrame === 'function') _projAnimFrame('p_doom_fireball'); } catch (e) {} });
await page.waitForFunction(() => { try { const i = LX_BULT_PROJ.bult_doomfire;
  return !!(i && i.complete && i.naturalWidth > 0); } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});

const r = await page.evaluate(async () => {
  const out = {};
  out.art = (() => { const i = LX_BULT_PROJ.bult_doomfire;
    return { registered: !!i, ready: !!(i && i.complete && i.naturalWidth > 0),
             src: i ? i.src.split('/').pop() : '', animKey: _BULT_ANIM_KEY.bult_doomfire,
             inAnimSet: _PROJ_ANIM_KEYS.has('p_doom_fireball') }; })();
  out.desc = SKILLS.doombringer_ult.desc;
  out.slot = SKILLS.doombringer_ult.slot;

  // ---- set up: a boss and two chaff, all in range ----
  game.paused = true;
  player.x = 400; player.y = 400; player.hp = 9999; player.level = 60;
  player.facing = 1; player.mp = 999; player._calamityHeat = 0;
  const mk = (x, hp, boss, name) => ({ type: 'slime', name, x, y: 400, w: 60, h: 60, vx: 0, vy: 0,
    currentHp: hp, maxHp: hp, atk: 10, def: 0, level: 40, isBoss: !!boss, speed: 0, evasion: 0 });
  const boss = mk(900, 90000, true, 'BOSSY');
  const chaffNear = mk(520, 400, false, 'chaff-near');
  const chaffFar = mk(1150, 800, false, 'chaff-far');
  game.monsters = [chaffNear, boss, chaffFar];
  game.projectiles = [];
  SKILL_FNS.doombringer_ult();
  out.spawned0 = game.projectiles.length;

  // scheduleSkillTimer wraps a real setTimeout, so the volley lands on the
  // wall clock, not the sim tick: wait it out (7 shots x 80 ms + slack).
  const pump = () => new Promise(r => setTimeout(r, 700));
  await pump();
  const shots = game.projectiles.filter(p => p.owner === 'player' && p.skill === 'fire' && p.bspr === 'bult_doomfire');
  out.count = shots.length;
  const s0 = shots[0] || {};
  out.shot = { w: s0.w, h: s0.h, dmg: Math.round(s0.damage), explode: s0.explode, pierce: !!s0.pierce,
               brand: s0.doomBrand, retarget: !!s0.retarget, homingName: s0.homing && s0.homing.name };
  out.allOnBoss = shots.length > 0 && shots.every(p => p.homing === boss);
  out.nonePierce = shots.every(p => !p.pierce);
  out.atk = getAtk();

  // ---- do they actually CONVERGE? step the real projectile update ----
  const dist = (p) => Math.hypot((boss.x + boss.w / 2) - (p.x + p.w / 2), (boss.y + boss.h / 2) - (p.y + p.h / 2));
  const before = shots.map(dist);
  boss.currentHp = 90000;
  for (let i = 0; i < 26; i++) { game.time++; if (typeof updateProjectiles === 'function') updateProjectiles(); }
  const alive = shots.filter(p => game.projectiles.includes(p));
  out.closed = alive.length ? alive.map((p, i) => before[shots.indexOf(p)] - dist(p)) : [];
  out.converged = out.closed.length > 0 && out.closed.every(d => d > 0);
  out.hitSome = alive.length < shots.length;   // some already connected

  // ---- retarget: kill the mark mid-flight, the rest must re-acquire ----
  game.projectiles = [];
  game.monsters = [mk(520, 400, false, 'A'), mk(980, 5000, true, 'B')];
  const [alt, mark] = game.monsters;
  player._calamityHeat = 0;
  SKILL_FNS.doombringer_ult();
  await pump();
  const wave2 = game.projectiles.filter(p => p.bspr === 'bult_doomfire');
  mark.currentHp = 0;                                   // the mark dies mid-volley
  for (let i = 0; i < 4; i++) { game.time++; if (typeof updateProjectiles === 'function') updateProjectiles(); }
  const live = wave2.filter(p => game.projectiles.includes(p));
  out.retargeted = live.length > 0 && live.every(p => p.homing === alt);
  out.retargetSample = { of: wave2.length, live: live.length, now: live[0] && live[0].homing && live[0].homing.name };

  // ---- heat still multiplies ----
  game.projectiles = []; game.monsters = [mk(900, 90000, true, 'C')];
  player._calamityHeat = 100;
  SKILL_FNS.doombringer_ult();
  await pump();
  const hot = game.projectiles.filter(p => p.bspr === 'bult_doomfire');
  out.hotDmg = hot.length ? Math.round(hot[0].damage) : 0;
  game.monsters = []; game.projectiles = [];
  return out;
});

const expectCold = Math.round(r.atk * 4.6 + 24);
const expectHot = Math.round(r.atk * 4.6 * 1.7 + 24);
ok('the doom-fire sprite is registered, decoded and animated',
  r.art.registered && r.art.ready && /p_doom_fireball/.test(r.art.src)
  && r.art.animKey === 'p_doom_fireball' && r.art.inAnimSet, r.art);
ok('B summons SEVEN homing fires', r.count === 7, { count: r.count, firstTick: r.spawned0 });
ok('every one of them locks the SAME single target', r.allOnBoss, { target: r.shot.homingName });
ok('...and it is the boss, not the nearer chaff', r.shot.homingName === 'BOSSY', { picked: r.shot.homingName });
ok('nothing pierces any more — the screen-crossing waves are gone', r.nonePierce, {});
ok('each fire is heavy and re-brands with DOOM',
  r.shot.dmg === expectCold && r.shot.brand === 1 && r.shot.explode > 0,
  { dmg: r.shot.dmg, expected: expectCold, atk: r.atk, brand: r.shot.brand, explode: r.shot.explode });
ok('they measurably CLOSE on the target when the real update runs',
  r.converged, { closedPx: r.closed.map(v => Math.round(v)) });
ok('killing the mark mid-volley re-acquires instead of wasting the rest',
  r.retargeted, r.retargetSample);
ok('Calamity Heat still multiplies the barrage (+70% at 100)',
  r.hotDmg === expectHot, { hot: r.hotDmg, expected: expectHot, cold: r.shot.dmg });
ok('the tooltip describes the skill that now exists',
  /homing/i.test(r.desc) && /single target/i.test(r.desc) && !/blade-wave/i.test(r.desc)
  && r.slot === 'b', { slot: r.slot, desc: r.desc.slice(0, 90) + '...' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
