// Live test: a monster's proximity swing hurts (per user: "some monsters such as drowned cur, gummibeau, skywisp
// also have a problem where it has an animation but i dont take damage even when nearby within 80px") and the
// Skywisp shows its storm-cloud cast (per user: "Skywisp attack animation doesnt indicate the cloud appearing").
//   near + facing  : a monster standing just short of body contact swings - and the swing lands
//   facing away    : no hit (the contact path's dodge-behind rule still holds)
//   out of reach   : no swing, no hit
//   cloudburst     : the caster plays its attack animation, and while the cloud telegraphs a vapour tether runs
//                    from the caster into it (drawn by the hazard, so a co-op guest's mirror draws it too)
//   node scripts/mob_swing_hit_test.mjs [port]   (MOJI_GAME_FILE honored)
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
const CASES = [['witheringTide', 'drownedCur'], ['candyCanyon', 'gummy'], ['skyGarden', 'skywisp']];
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const run = (map, type, mode) => page.evaluate(async ([map, type, mode]) => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {}
    ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    loadMap(map); await wait(1200);
    game.monsters.length = 0; if (game.hazards) game.hazards.length = 0; if (game.projectiles) game.projectiles.length = 0;
    const ground = Math.min(...game.mapData.platforms.filter((p) => p.type === 'ground').map((p) => p.y));
    const PX = 600; player.x = PX; player.y = ground - player.h; player.vx = 0; player.vy = 0;
    player.maxHp = 1e7; player.hp = 1e7; player.invulnerable = 0; player._god = false;
    spawnMonster(0, 0, type, false);
    const m = game.monsters[game.monsters.length - 1];
    const name = m.label || m.type;
    // gap between edges: just short of the touch box (a swing, not a bump), or far out of reach
    const pw = player.w, reach = 0.7 * m.w - pw / 2;
    const gap = mode === 'far' ? m.w * 1.6 : Math.max(4, reach * 0.45);
    // facing away is LOCKED: the AI turns an idle monster back to the player between our ticks
    if (mode === 'away') Object.defineProperty(m, 'facing', { configurable: true, get: () => 1, set() {} });
    // only this monster: the Drowned Cur's packCall summons hounds that bite under the same name
    const solo = () => { for (let i = game.monsters.length - 1; i >= 0; i--) if (game.monsters[i] !== m) game.monsters.splice(i, 1); };
    const place = () => { solo(); m.x = PX + pw + gap; m.y = ground - m.h; m.vx = 0; m.vy = 0; m._mskTimer = 1e9;
      if (mode !== 'away') m.facing = -1; if (game.hazards) game.hazards.length = 0; };
    place();
    // pin after EVERY AI step, not every 40 ms: between ticks a hopper (Gummibeau, jump 5) could start a hop and
    // never be "standing still", so it never swung and the run proved nothing
    const _oUM = window.updateMonsters;
    window.updateMonsters = function () { const r = _oUM.apply(this, arguments); try { place(); } catch (e) {} return r; };
    const touching = typeof aabb === 'function' && typeof _mobTouchBox === 'function' ? aabb(player, _mobTouchBox(m)) : null;
    let hits = 0, swingsSeen = 0, lastSw = 0, swingHits = 0, wasDone = !!m._swHitDone;
    const t0 = performance.now();
    while (performance.now() - t0 < 6500) {
      await wait(40); game.paused = false; place();
      player.x = PX; player.vx = 0; if (player.hp < 5e6) player.hp = 1e7;
      if (m._swingUntil && m._swingUntil !== lastSw) { swingsSeen++; lastSw = m._swingUntil; }
      if (player._lastDamageSource === name) { hits++; player._lastDamageSource = null; }
      if (m._swHitDone && !wasDone) swingHits++; wasDone = !!m._swHitDone;   // the swing itself connected
    }
    window.updateMonsters = _oUM;
    return { type, mode, gap: Math.round(gap), touching, hits, swingHits, swingsSeen, name };
  }, [map, type, mode]);
  for (const [map, type] of CASES) {
    const near = await run(map, type, 'near'), away = await run(map, type, 'away'), far = await run(map, type, 'far');
    ok(`${type}: standing just short of you (not touching), its swing HURTS you`, near.touching === false && near.swingHits >= 1 && near.hits >= 1, near);
    ok(`${type}: facing away, its swing does not land (dodge-behind still works)`, away.swingHits === 0, away);
    ok(`${type}: out of reach, its swing does not land`, far.swingHits === 0, far);
  }
  // the Skywisp's cloud cast
  const cast = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    loadMap('skyGarden'); await wait(1200);
    game.monsters.length = 0; game.hazards.length = 0; game.particles.length = 0;
    spawnMonster(0, 0, 'skywisp', false);
    const m = game.monsters[game.monsters.length - 1];
    m.x = player.x + 260; m.y = player.y - 120; m.facing = 1;
    const now = performance.now();
    const r = MONSTER_SKILL_FNS.cloudburst(m);
    const cloud = game.hazards.find((h) => h.type === 'mob_cloudburst');
    const origin = cloud && Math.abs(cloud.srcX - (m.x + m.w / 2)) < 1 && Math.abs(cloud.srcY - (m.y + m.h * 0.4)) < 1;
    // count the tether's middle stroke (#9fc4ef) while telegraphing and after
    const tether = (tick) => { if (!cloud) return -1; cloud.tick = tick; let n = 0; const P = CanvasRenderingContext2D.prototype, o = P.stroke;
      P.stroke = function () { if (this === ctx && String(this.strokeStyle).toLowerCase() === '#9fc4ef') n++; return o.apply(this, arguments); };
      try { drawHazards(); } catch (e) { n = -2; } finally { P.stroke = o; } return n; };
    const during = tether(10), after = tether((cloud && cloud.warn || 42) + 5);
    return { ret: r, anim: (m.atkAnimUntil || 0) > now + 300, attacking: typeof _mobAttackAnim === 'function' && _mobAttackAnim(m),
      facesPlayer: m.facing === ((player.x + player.w / 2) >= (m.x + m.w / 2) ? 1 : -1), cloud: !!cloud, origin, during, after,
      coop: typeof _COOP_HZ_XF !== 'undefined' && _COOP_HZ_XF.includes('srcX') && _COOP_HZ_XF.includes('srcY') };
  });
  ok('Skywisp cast: the cloud forms', cast.cloud && cast.ret !== false, cast);
  ok('Skywisp cast: it turns to you and plays its attack animation', cast.anim && cast.attacking && cast.facesPlayer, cast);
  ok('Skywisp cast: the cloud remembers where it was cast from (and co-op carries it)', cast.origin && cast.coop, cast);
  ok('Skywisp cast: a vapour tether runs from it into the cloud while it telegraphs, and is gone once the rain starts', cast.during >= 1 && cast.after === 0, cast);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== PROXIMITY SWINGS HIT + SKYWISP CAST ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
