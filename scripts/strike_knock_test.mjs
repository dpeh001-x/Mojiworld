// STRIKE KNOCK: bosses and stronger monsters throw the player further, along the hit's own trajectory (per user).
//  A. WEIGHT, end to end - a real touch and a real shot from each rung (ordinary, elite, Elder, boss, zodiac):
//     the ordinary hit is unchanged to the number, every rung above throws harder than the one below
//  B. DISTANCE - how far the throw carries over the stagger, per rung (printed as a table, asserted as a ladder)
//  C. TRAJECTORY - away from the side touched, up off a head, down from under a flier, along a shot's flight,
//     sideways when the floor is in the way, out from the middle of a standing ground smash
//  D. NO BUGS - finite on junk input, inside the world at its edge, never through the floor, the pinned Eclipse hold
//     does not move, reducers (warrior, Unstoppable, block) apply, Taurus keeps his authored launch, a guest gets the weight
//   node scripts/strike_knock_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11771);
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateMonsters === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  // boot into a flat field, then FREEZE the live loop: every step below is this test's own (deterministic)
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.cls = 'mage'; player.job = null; player.master = null; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    player.tree = player.tree || {}; player.tree.kbReduce = 0; player.tree.stunImmune = false;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 3500));
    game.paused = true; player._god = true;
    window.getEvasion = () => 0;                       // no dodge rolls
    Math.random = () => 0.5;                           // no heavy-stun roll (0.12), no jitter
    const T = window.__T = {};
    T.DT = 1000 / 60;
    T.floorY = () => { let best = null; const cx = player.x + player.w / 2; for (const p of game.mapData.platforms) if (p.type === 'ground' && cx >= p.x && cx <= p.x + p.w && (best === null || p.y < best)) best = p.y; return best; };
    // the player standing still on the ground at x, every timer clear
    T.stand = (x) => {
      game.monsters.length = 0; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0;
      for (const key in game.keys) game.keys[key] = false;
      player.x = x; player.vx = 0; player.vy = 0; player.hitStun = 0; player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0;
      player.dodgeTimer = 0; player.quickDashTimer = 0; player.rushTimer = 0; player.attacking = false; player._eclipseHold = null; player.hp = getMaxHp();
      const fy = T.floorY(); player.y = fy - player.h; player.onGround = true;
      for (let i = 0; i < 4; i++) { game.time++; updatePlayer(T.DT); }
      player.vx = 0; game.camera.x = Math.max(0, player.x - 480); if (typeof updateCamera === 'function') updateCamera();
      player.invulnerable = 0; player.hitStun = 0;
    };
    // a real monster of a rung, inert, touching the player from `side` (-1: it stands on the player's left)
    T.mob = (rung, side, over) => {
      const type = (rung === 'boss' || rung === 'zodiac') ? 'mooma' : 'thunderMole';
      const m = spawnMonster(player.x + 400, player.y, type, rung === 'boss' || rung === 'zodiac', rung === 'elder');
      const mm = m || game.monsters[game.monsters.length - 1];
      mm.isElite = rung === 'elite'; if (rung === 'zodiac') { mm.zodiacBoss = true; mm.zodiacSign = 'leo'; }
      mm.vx = 0; mm.vy = 0; mm.speed = 0; mm.jump = 0; mm.shoot = null; mm.traits = {}; mm.atk = 50; mm.facing = -side;
      mm.y = (player.y + player.h) - mm.h;
      mm.x = side < 0 ? (player.x + 8 - mm.w) : (player.x + player.w - 8);      // 8 px of overlap on that side
      Object.assign(mm, over || {});
      return mm;
    };
    // one world step that can land a touch / a shot; returns the velocity the hit gave
    T.hit = () => { const hp0 = player.lastHitTime; game.time++; updateMonsters(T.DT); updateProjectiles(T.DT); return { vx: +player.vx.toFixed(3), vy: +player.vy.toFixed(3), hit: player.lastHitTime !== hp0, stun: Math.round(player.hitStun) }; };
    // carry the throw: the player's own steps until the stagger ends and the feet are down (no input), max n
    T.carry = (n) => { const x0 = player.x; let peak = 0, steps = 0; for (let i = 0; i < n; i++) { game.time++; updatePlayer(T.DT); steps++; peak = Math.max(peak, Math.abs(player.vx)); if (player.hitStun <= 0 && player.onGround && Math.abs(player.vx) < 0.2) break; }
      return { dx: +(player.x - x0).toFixed(1), steps, peak: +peak.toFixed(2), y: player.y, grounded: !!player.onGround }; };
    T.shot = (o) => { const p = Object.assign({ x: player.x - 4, y: player.y + 10, w: player.w + 8, h: 20, vx: 6, vy: 0, life: 30, damage: 20, owner: 'enemy', skill: 'mbolt', color: '#f66', noGravity: true }, o); game.projectiles.push(p); return p; };
  });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const has = await ev(() => typeof _lxKbTier === 'function' && typeof _lxBodyKnock === 'function' && typeof _lxShotKnock === 'function');
  check(has, 'the build has the strike-knock rules');
  // ---- A + B. a real touch and a real shot per rung; the attacker stands on the player's LEFT, so the throw is to the right
  const rungs = ['ordinary', 'elite', 'elder', 'boss', 'zodiac'];
  const AB = await ev((rungs) => { const T = window.__T, out = {};
    for (const r of rungs) {
      const o = out[r] = {};
      T.stand(1400); const m = T.mob(r, -1); o.tier = (typeof _lxKbTier === 'function') ? _lxKbTier(m) : null;
      o.touch = T.hit(); o.touchCarry = T.carry(300);
      T.stand(1400); const s = T.mob(r, -1, { x: player.x - 500, shoot: 'mvoltzap' }); const n0 = game.projectiles.length;
      fireMonsterProjectile(s); const p = game.projectiles[n0]; game.monsters.length = 0;
      if (p) { p.vy = 0; p.vx = Math.abs(p.vx) || 6; p.x = player.x - 2; p.y = player.y + 10; o.shotTier = p._kbTier; o.shot = T.hit(); o.shotCarry = T.carry(300); } else o.shot = { hit: false };
    }
    return out; }, rungs);
  console.log('rung       tier  touch vx / vy    stun  carried   shot vx / vy     stun  carried');
  for (const r of rungs) { const o = AB[r]; console.log(`${r.padEnd(10)} ${String(o.tier).padStart(4)}  ${String(o.touch.vx).padStart(6)} / ${String(o.touch.vy).padEnd(7)} ${String(o.touch.stun).padStart(4)}  ${String(o.touchCarry.dx).padStart(6)} px  ${String(o.shot.vx).padStart(6)} / ${String(o.shot.vy).padEnd(7)} ${String(o.shot.stun).padStart(4)}  ${String(o.shotCarry && o.shotCarry.dx).padStart(6)} px`); }
  check(rungs.every((r) => AB[r].touch.hit && AB[r].shot.hit), 'A. every rung lands its touch and its shot in the harness', rungs.map((r) => [r, AB[r].touch.hit, AB[r].shot.hit]));
  check(AB.ordinary.touch.vx === 3 && AB.ordinary.touch.vy === -2.4, 'A. an ordinary monster\'s touch is unchanged: 3.0 sideways, 2.4 of lift', AB.ordinary.touch);
  check(AB.ordinary.shot.vx === 1 && AB.ordinary.shot.vy === -1.2, 'A. an ordinary monster\'s shot is unchanged: 1.0 sideways, 1.2 of lift', AB.ordinary.shot);
  const ladder = (k) => rungs.every((r, i) => i === 0 || AB[r][k].vx > AB[rungs[i - 1]][k].vx + 0.5);
  check(ladder('touch'), 'A. each rung\'s touch throws harder than the rung below (ordinary < elite < Elder < boss < zodiac)', rungs.map((r) => AB[r].touch.vx));
  check(ladder('shot'), 'A. and so does each rung\'s shot', rungs.map((r) => AB[r].shot.vx));
  check(Math.abs(AB.boss.touch.vx - 7.5) < 0.01 && Math.abs(AB.zodiac.touch.vx - 9.3) < 0.01 && Math.abs(AB.elite.touch.vx - 4.5) < 0.01 && Math.abs(AB.elder.touch.vx - 5.7) < 0.01, 'A. the touch weights are the authored ones (elite 4.5, Elder 5.7, boss 7.5, zodiac 9.3 px a frame)', rungs.map((r) => AB[r].touch.vx));
  const dl = (k) => rungs.every((r, i) => i === 0 || AB[r][k].dx > AB[rungs[i - 1]][k].dx + 4);
  check(dl('touchCarry') && dl('shotCarry'), 'B. the distance carried grows with every rung, touch and shot', rungs.map((r) => [AB[r].touchCarry.dx, AB[r].shotCarry.dx]));
  check(AB.boss.touchCarry.dx >= AB.ordinary.touchCarry.dx * 2 && AB.boss.shotCarry.dx >= AB.ordinary.shotCarry.dx * 3, 'B. a boss throws at least twice as far as an ordinary monster on a touch, three times on a shot', [AB.ordinary.touchCarry.dx, AB.boss.touchCarry.dx, AB.ordinary.shotCarry.dx, AB.boss.shotCarry.dx]);
  check(rungs.every((r) => AB[r].touchCarry.grounded && AB[r].shotCarry.grounded), 'B. every throw ends with the player standing on the ground', rungs.map((r) => [AB[r].touchCarry.steps, AB[r].shotCarry.steps]));
  // ---- C. TRAJECTORY
  const C = await ev(() => { const T = window.__T, o = {};
    const air = (y) => { player.y = y; player.onGround = false; player.vy = 0; };
    T.stand(1400); T.mob('boss', 1); o.fromRight = T.hit();                                        // it stands on the right: thrown left
    // on its head: the player's feet 6 px into the top of the box, a little right of its middle
    T.stand(1400); { const m = T.mob('boss', -1); m.y = 120; m.x = player.x + player.w / 2 - m.w / 2 - 20; air(m.y - player.h + 6); o.head = T.hit(); }
    // under a flier, in the air: the box's underside 6 px into the player's head
    T.stand(1400); { const m = T.mob('boss', -1); m.y = 60; m.x = player.x + player.w / 2 - m.w / 2 - 20; m.flies = true; m.noGravity = true; air(m.y + m.h - 6); o.underAir = T.hit(); }
    // under a body, feet on the floor: the floor turns it sideways
    T.stand(1400); { const m = T.mob('boss', -1); m.x = player.x + player.w / 2 - m.w / 2 - 20; m.y = player.y - m.h + 6; m.flies = true; m.noGravity = true; o.underFloor = T.hit(); o.underFloorY = T.carry(200); }
    // a charging body carries you with it: the player is inside the front half of a body moving right
    T.stand(1400); { const m = T.mob('boss', -1); m.x = player.x + player.w / 2 - m.w / 2 - 10; m.vx = 8; o.charge = T.hit(); }
    const shot = (extra, airborne) => { T.stand(1400); if (airborne) air(player.y - 200); T.shot(Object.assign({ _kbTier: 3 }, extra)); return T.hit(); };
    o.shotLeft = shot({ vx: -6 }); o.shotRight = shot({ vx: 6 });
    o.shotUp = shot({ vx: 0, vy: -6, x: 1400 - 30 }); o.shotDiag = shot({ vx: 4, vy: -4 });
    o.shotDownAir = shot({ vx: 0, vy: 6 }, true); o.shotDownFloor = shot({ vx: 0, vy: 6, x: 1400 - 30 });
    T.stand(1400); T.shot({ _kbTier: 3, vx: 0, vy: 0, skill: 'smash', x: player.x - 200, w: 220, y: player.y + player.h - 14, h: 28 }); o.smash = T.hit();
    T.stand(1400); T.shot({ _kbTier: 3, vx: 1.5, vy: 0, skill: 'swing' }); o.swing = T.hit();
    return o; });
  check(C.fromRight.hit && Math.abs(C.fromRight.vx + 7.5) < 0.01, 'C. touched from the right, the player is thrown left - the same weight, mirrored', C.fromRight);
  check(C.head.hit && C.head.vy < -10 && C.head.vx > 2 && C.head.vx < 4, 'C. off a boss\'s head: launched up, drifting off the side the player stood on', C.head);
  check(C.underAir.hit && C.underAir.vy > 5 && C.underAir.vy <= 8, 'C. beneath a flier, in the air: spiked down (no lift), inside the down cap', C.underAir);
  check(C.underFloor.hit && C.underFloor.vy < 0 && Math.abs(C.underFloor.vx) >= 4.4 && C.underFloorY.grounded, 'C. beneath a body with the feet on the floor: the floor turns the throw sideways, and the player lands', [C.underFloor, C.underFloorY]);
  check(C.charge.hit && C.charge.vx > 7, 'C. a charging body carries the player along its charge', C.charge);
  check(C.shotLeft.vx < -5.9 && C.shotRight.vx > 5.9, 'C. a shot throws along its own flight: left-going left, right-going right', [C.shotLeft, C.shotRight]);
  check(C.shotUp.vy < -9 && Math.abs(C.shotUp.vx) > 2, 'C. a rising shot lifts the player, with a drift off its line', C.shotUp);
  check(C.shotDiag.vx > 4 && C.shotDiag.vy < -8, 'C. a diagonal shot throws on the diagonal', C.shotDiag);
  check(C.shotDownAir.vy > 5 && C.shotDownAir.vy <= 8, 'C. a falling shot spikes an airborne player down', C.shotDownAir);
  check(C.shotDownFloor.vy < 0 && C.shotDownFloor.vx >= 3.5, 'C. a falling shot on a standing player throws sideways, away from where it landed', C.shotDownFloor);
  check(C.smash.hit && C.smash.vx > 7.4 && C.smash.vy < -4, 'C. a standing ground smash throws out from its middle, a quarter harder than a shot (7.5)', C.smash);
  check(C.swing.hit && Math.abs(C.swing.vx - 7.5) < 0.01, 'C. a heavy swing throws the way it swings, a quarter harder than a shot', C.swing);
  // ---- D. NO BUGS
  const D = await ev(() => { const T = window.__T, o = {}; if (typeof _lxStrikeKnock !== 'function') return { missing: true };
    const fin = () => Number.isFinite(player.vx) && Number.isFinite(player.vy) && Number.isFinite(player.x) && Number.isFinite(player.y);
    // junk input never poisons the player's velocity
    o.junk = []; for (const f of [() => _lxStrikeKnock(NaN, NaN, 7, 2.5, 1), () => _lxStrikeKnock(0, 0, 7, 2.5, -1), () => _lxStrikeKnock(1, 0, Infinity, 2, 1), () => _lxStrikeKnock(1, 1, 7, undefined, undefined),
      () => _lxShotKnock({}, 3), () => _lxShotKnock({ vx: NaN, vy: NaN, x: NaN }, 9), () => _lxBodyKnock({ x: NaN, y: NaN, w: NaN, h: NaN, vx: NaN }, 4, NaN), () => _lxBodyKnock({ x: 0, y: 0, w: 0, h: 0 }, 99, -5), () => _lxBodyKnock(null, 3, 1)]) {
      T.stand(1400); let threw = false; try { f(); } catch (e) { threw = true; } const c = T.carry(120); o.junk.push(!threw && fin() && c.grounded && Math.abs(player.vx) <= 14 && Math.abs(player.vy) <= 14); }
    // the world's edges hold
    const W = game.mapData.worldWidth;
    T.stand(3); T.mob('zodiac', 1); const e1 = T.hit(); T.carry(300); o.left = { hit: e1.hit, vx: e1.vx, x: player.x, ok: fin() && player.x >= 0 };
    T.stand(W - player.w - 3); T.mob('zodiac', -1); const e2 = T.hit(); T.carry(300); o.right = { hit: e2.hit, vx: e2.vx, x: player.x, ok: fin() && player.x + player.w <= W };
    // never through the floor: the hardest downward hit on a standing player, then on an airborne one just above the floor
    T.stand(1400); const fy = T.floorY(); T.shot({ _kbTier: 4, vx: 0, vy: 12, skill: 'smash' }); const f1 = T.hit(); const c1 = T.carry(300); o.floor1 = { hit: f1.hit, feet: player.y + player.h, fy, grounded: c1.grounded };
    T.stand(1400); player.y -= 30; player.onGround = false; T.shot({ _kbTier: 4, vx: 0, vy: 12, skill: 'smash', y: player.y + 10 }); const f2 = T.hit(); const c2 = T.carry(300); o.floor2 = { hit: f2.hit, vy: f2.vy, feet: player.y + player.h, fy, grounded: c2.grounded };
    // a one-way platform holds too
    const pl = game.mapData.platforms.find((p) => p.type !== 'ground' && p.w >= 120);
    if (pl) { T.stand(1400); player.x = pl.x + pl.w / 2 - player.w / 2; player.y = pl.y - player.h; player.onGround = true; game.camera.x = Math.max(0, player.x - 480); game.camera.y = Math.max(0, player.y - 300);
      T.shot({ _kbTier: 4, vx: 0, vy: 12 }); const h = T.hit(); game.time++; updatePlayer(T.DT); o.plat = { hit: h.hit, feet: +(player.y + player.h).toFixed(1), top: pl.y, over: player.x + player.w > pl.x && player.x < pl.x + pl.w }; } else o.plat = null;
    // the pinned Eclipse hold does not move
    T.stand(1400); T.mob('zodiac', -1); player._eclipseHold = { x: player.x, y: player.y }; const x0 = player.x, y0 = player.y; const he = T.hit(); for (let i = 0; i < 20; i++) { game.time++; updatePlayer(T.DT); } o.hold = { hit: he.hit, dx: player.x - x0, dy: player.y - y0 }; player._eclipseHold = null;
    // i-frames: no hit, no throw
    T.stand(1400); T.mob('boss', -1); player.invulnerable = 500; o.iframe = T.hit();
    // the player's reducers
    const touch = (prep) => { T.stand(1400); T.mob('boss', -1); prep(); const h = T.hit(); player.cls = 'mage'; player.tree.kbReduce = 0; player.blockTimer = 0; return h; };
    o.warrior = touch(() => { player.cls = 'warrior'; }); o.unstop = touch(() => { player.tree.kbReduce = 0.4; }); o.block = touch(() => { player.blockTimer = 600; });
    // Taurus keeps his authored launch; an ordinary monster with an authored multiplier keeps the old formula
    T.stand(1400); T.mob('zodiac', -1, { _playerKbMul: 4.4 }); o.taur = T.hit();
    T.stand(1400); T.mob('ordinary', -1, { _playerKbMul: 2 }); o.ordMul = T.hit();
    // what a shot carries, and what a guest reads from it
    o.xf = Array.isArray(_COOP_PJ_XF) && _COOP_PJ_XF.includes('_kbTier');
    T.stand(1400); const s = T.mob('elite', -1, { x: player.x - 500, shoot: 'mvoltzap' }); fireMonsterProjectile(s); const lst = _coopProjList(true); o.sent = lst.length ? ((lst[lst.length - 1].xf || {})._kbTier) : null;
    o.read = [_lxProjKbTier({ _bossBand: _bossHitBand({ isBoss: true, superBoss: true, level: 65, type: 'aetherion' }, 'ranged') }), _lxProjKbTier({ _bossBand: _bossHitBand({ isBoss: true, level: 50, type: 'kingKrook' }, 'ranged') }),
      _lxProjKbTier({ _bossBand: _bossHitBand({ isBoss: true, superBoss: true, level: 65, type: 'aetherion' }, 'heavy') }), _lxProjKbTier({ _bossBand: _bossHitBand({ isBoss: true, level: 50, type: 'kingKrook' }, 'heavy') }),
      _lxProjKbTier({ _gravBand: _gravHeavyBand(1, 'comet') }), _lxProjKbTier({ _zodiacSign: 'leo' }), _lxProjKbTier({ _srcType: 'kingKrook' }), _lxProjKbTier({ skill: 'swing' }), _lxProjKbTier({}), _lxProjKbTier({ _kbTier: 0, _zodiacSign: 'leo' }), _lxProjKbTier({ _kbTier: 77 })];
    // a guest's touch from the host's mirrored boss
    T.stand(1400); const gm = T.mob('boss', -1); gm._coopMirror = true; player._god = false; player.hp = getMaxHp(); game.paused = false; try { _coopFollowerContactTick(); } finally { game.paused = true; } /* bughunt guest-taken: a PAUSED guest is a ghost statue, so the tick needs the world un-paused */ o.guest = { vx: +player.vx.toFixed(3), vy: +player.vy.toFixed(3), alive: player.hp > 0 }; player._god = true;
    return o; });
  if (D.missing) check(false, 'D. the robustness checks need the strike-knock rules');
  else {
    check(D.junk.every(Boolean), 'D. junk input (NaN, zero, Infinity, empty or null attackers) never throws and never poisons the velocity', D.junk);
    check(D.left.hit && D.left.vx < -9 && D.left.ok && D.right.hit && D.right.vx > 9 && D.right.ok, 'D. thrown at the world\'s edge by a zodiac boss, the player stays inside the world', [D.left, D.right]);
    check(D.floor1.hit && D.floor1.grounded && Math.abs(D.floor1.feet - D.floor1.fy) < 1 && D.floor2.hit && D.floor2.vy > 0 && D.floor2.grounded && Math.abs(D.floor2.feet - D.floor2.fy) < 1, 'D. the hardest downward hit never puts the player through the floor (standing, and spiked from 30 px up)', [D.floor1, D.floor2]);
    check(D.plat === null || (D.plat.hit && (!D.plat.over || D.plat.feet <= D.plat.top + 1)), 'D. nor through a one-way platform', D.plat);
    check(D.hold.hit && D.hold.dx === 0 && D.hold.dy === 0, 'D. a rogue pinned by the Eclipse hold is not moved by a zodiac boss\'s throw', D.hold);
    check(!D.iframe.hit && D.iframe.vx === 0, 'D. inside i-frames there is no hit and no throw', D.iframe);
    check(Math.abs(D.warrior.vx - 3) < 0.01 && Math.abs(D.unstop.vx - 4.5) < 0.01 && Math.abs(D.block.vx - 3.75) < 0.01, 'D. the player\'s reducers scale a boss\'s throw: warrior x0.4 (3.0), Unstoppable x0.6 (4.5), a raised block x0.5 (3.75)', [D.warrior.vx, D.unstop.vx, D.block.vx]);
    check(Math.abs(D.taur.vx - 13.2) < 0.01 && Math.abs(D.taur.vy + 6.072) < 0.01, 'D. Taurus at full gallop keeps his authored launch (13.2 sideways, 6.07 of lift)', D.taur);
    check(Math.abs(D.ordMul.vx - 6) < 0.01 && Math.abs(D.ordMul.vy + 3.48) < 0.01, 'D. an ordinary monster with an authored multiplier keeps the old formula', D.ordMul);
    check(D.xf && D.sent === 1, 'D. an elite\'s shot sends its weight to a co-op guest', { xf: D.xf, sent: D.sent });
    check(JSON.stringify(D.read) === JSON.stringify([4, 3, 4, 3, 4, 4, 3, 1, 0, 0, 4]), 'D. a shot with no stamp is weighed by the rules it carries (super / story bands, Gravitos, zodiac, source type, heavy swing, none)', D.read);
    check(Math.abs(D.guest.vx - 7.5) < 0.01 && D.guest.vy < -4 && D.guest.alive, 'D. a co-op guest touched by the host\'s mirrored boss is thrown like the host', D.guest);
  }
  // ---- E. OTHER PHYSICS: ice, water, and Gravitos's 3x gravity. The throw stays a throw: it lands, inside the world, in bounds
  const E = await ev(async () => { const T = window.__T, out = [];
    const pick = (f, w) => Object.keys(MAPS).find((id) => { try { const m = MAPS[id]; return f(m) && Array.isArray(m.platforms) && m.platforms.some((p) => p.type === 'ground' && p.w >= (w || 500)); } catch (e) { return false; } });
    const maps = [['ice', pick((m) => m.isIcy)], ['water', pick((m) => m.isUnderwater && !m.isVerticalTower) || pick((m) => m.isUnderwater, 200)], ['3x gravity', MAPS.gravitosArena ? 'gravitosArena' : null]];
    for (const [kind, id] of maps) { if (!id) { out.push({ kind, id: null }); continue; }
      game.paused = false; loadMap(id); await new Promise((r) => setTimeout(r, 2500)); game.paused = true; player._god = true;
      const g = game.mapData.platforms.filter((p) => p.type === 'ground' && p.w >= 200).sort((a, b) => b.w - a.w)[0]; const x = g.x + g.w / 2;
      const row = { kind, id, world: game.mapData.worldWidth };
      for (const r of ['ordinary', 'boss', 'zodiac']) { T.stand(x); T.mob(r, -1); let h = T.hit(); if (!h.hit) { T.stand(x); T.mob(r, 1); h = T.hit(); }   /* an ordinary monster only hurts the way it faces */ const c = T.carry(900);
        row[r] = { hit: h.hit, vx: h.vx, dx: Math.abs(c.dx), steps: c.steps, grounded: c.grounded, onSurface: game.mapData.platforms.some((p) => Math.abs(player.y + player.h - p.y) < 1.5 && player.x + player.w > p.x && player.x < p.x + p.w), inWorld: player.x >= 0 && player.x + player.w <= game.mapData.worldWidth, fin: Number.isFinite(player.x + player.y + player.vx + player.vy) }; }
      out.push(row); }
    return out; });
  console.log('physics      map                 ordinary   boss      zodiac   (px carried, no input)');
  for (const r of E) console.log(r.id ? `${r.kind.padEnd(12)} ${String(r.id).padEnd(18)} ${String(r.ordinary.dx).padStart(8)}  ${String(r.boss.dx).padStart(8)}  ${String(r.zodiac.dx).padStart(8)}` : `${r.kind.padEnd(12)} (no such map)`);
  const Eok = (r) => !r.id || ['ordinary', 'boss', 'zodiac'].every((k) => (r[k].hit || k === 'ordinary') && r[k].fin && r[k].inWorld && r[k].grounded && r[k].onSurface);
  check(E.every(Eok), 'E. on ice, under water and in 3x gravity the thrown player lands standing on a surface, inside the world', E.filter((r) => !Eok(r)));
  check(E.every((r) => !r.id || ((!r.ordinary.hit || r.boss.dx > r.ordinary.dx) && r.zodiac.dx > r.boss.dx && r.zodiac.dx < 900)), 'E. and the ladder holds there too, with the longest throw under 900 px', E.map((r) => r.id && [r.kind, r.ordinary.dx, r.boss.dx, r.zodiac.dx]));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
