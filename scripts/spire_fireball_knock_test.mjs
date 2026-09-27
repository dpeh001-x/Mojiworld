// SPIRE FIREBALLS PUSH YOU OFF THE PLATFORM (per user, v0.26.127: "occasional horizontal fireballs that may have a heavy
// knockback to player to push him or her out of the platform"). The fireball declared `knockback: 18` and nothing read
// it: a hit nudged the player ~10 px. An authored `knockback` on an enemy projectile now throws along its flight.
//  A. the REAL fireball (updateSpireFireballs), landed on a player standing mid-platform on the narrowest, a middling and
//     the widest floor of the Spire, from the left and from the right: the player is carried off the platform
//  B. the throw follows the fireball's flight, keeps the player inside the world, and never puts them through a floor
//  C. the player's reducers still apply; a projectile with no authored knockback is unchanged; a guest gets the field
//   node scripts/spire_fireball_knock_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11781);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateProjectiles === 'function' && typeof updateSpireFireballs === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  // boot into the Spire, then FREEZE the live loop: every step below is this test's own (deterministic; platforms do not drift)
  const setup = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.cls = 'mage'; player.job = null; player.master = null; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    player.tree = player.tree || {}; player.tree.kbReduce = 0; player.tree.stunImmune = false;
    // a level set by hand grants no HP growth (a 180-HP bar at Lv 60): give the bar a player of this level really has
    player.maxHp = (typeof _refHpAtLv === 'function') ? Math.round(_refHpAtLv(60)) : 4000;
    loadMap('clockworkSpire'); await new Promise((r) => setTimeout(r, 3500));
    game.paused = true; player._god = true; window.getEvasion = () => 0;
    const T = window.__T = {}; T.DT = 1000 / 60; T.rnd = 0.5; Math.random = () => T.rnd;
    T.floors = game.mapData.platforms.filter((p) => p.type !== 'ground' && p._spireFloor != null).sort((a, b) => a.w - b.w);
    // the player standing still in the middle of platform p, every timer clear
    T.stand = (p) => {
      game.monsters.length = 0; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0;
      for (const key in game.keys) game.keys[key] = false;
      player.x = p.x + p.w / 2 - player.w / 2; player.y = p.y - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
      player.hitStun = 0; player.invulnerable = 0; player.blockTimer = 0; player.parryWindow = 0; player.dodgeTimer = 0; player.quickDashTimer = 0; player.rushTimer = 0;
      player.attacking = false; player.hp = getMaxHp(); player._riftSurgeUntil = 0;
      for (let i = 0; i < 3; i++) { game.time++; updatePlayer(T.DT); }
      player.x = p.x + p.w / 2 - player.w / 2; player.vx = 0; player.invulnerable = 0; player.hitStun = 0;
      game.camera.x = 0; game.camera.y = Math.max(0, player.y - 300);
    };
    // the REAL fireball: the spawner's own projectile, from the left (vx 7) or the right (vx -7), set beside the player
    T.fireball = (fromLeft) => {
      T.rnd = fromLeft ? 0.49 : 0.5; game._spireFx = { nextAt: 0 }; const n0 = game.projectiles.length;
      game.paused = false; try { updateSpireFireballs(T.DT); } finally { game.paused = true; } T.rnd = 0.5;
      const p = game.projectiles[n0]; if (!p) return null;
      p.y = player.y + player.h / 2 - p.h / 2; p.x = fromLeft ? player.x - p.w - 2 : player.x + player.w + 2;
      return p;
    };
    // world steps until the shot lands (max 8), then the player's own steps until the stagger ends and the feet are down
    // (unpaused for the length of the step: a paused player cannot be harmed - _diffDmg returns 0 - and the hit must be the real one)
    T.land = () => { const t0 = player.lastHitTime; game.paused = false; try { for (let i = 0; i < 8 && player.lastHitTime === t0; i++) { game.time++; updateProjectiles(T.DT); } } finally { game.paused = true; }
      return { hit: player.lastHitTime !== t0, vx: +player.vx.toFixed(3), vy: +player.vy.toFixed(3), stun: Math.round(player.hitStun) }; };
    T.carry = (p, n) => { const x0 = player.x; let peak = 0, steps = 0, left = -1, minY = player.y, out = false;
      for (let i = 0; i < n; i++) { game.time++; updatePlayer(T.DT); steps++; peak = Math.max(peak, Math.abs(player.vx)); minY = Math.min(minY, player.y);
        if (player.x < 0 || player.x + player.w > game.mapData.worldWidth || !Number.isFinite(player.x + player.y + player.vx + player.vy)) out = true;
        if (left < 0 && (player.x >= p.x + p.w || player.x + player.w <= p.x)) left = steps;
        if (player.hitStun <= 0 && player.onGround && Math.abs(player.vx) < 0.2) break; }
      const under = game.mapData.platforms.find((q) => Math.abs(player.y + player.h - q.y) < 1.5 && player.x + player.w > q.x && player.x < q.x + q.w);
      return { dx: +(player.x - x0).toFixed(1), steps, peak: +peak.toFixed(2), rose: Math.round(p.y - player.h - minY), leftAt: left, off: left > 0, grounded: !!player.onGround, onSurface: !!under, samePlatform: under === p, out }; };
    return { bar: getMaxHp(), floors: T.floors.length, widths: [T.floors[0].w, T.floors[T.floors.length >> 1].w, T.floors[T.floors.length - 1].w], world: game.mapData.worldWidth, map: game.currentMap, declared: (String(updateSpireFireballs).match(/knockback:\s*([\d.]+)/) || [])[1] };
  });
  console.log('setup', JSON.stringify(setup));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // ---- A. the real fireball, mid-platform, on three floors, from both sides
  const A = await ev(() => { const T = window.__T, F = T.floors, out = [];
    for (const [name, p] of [['narrowest', F[0]], ['middling', F[F.length >> 1]], ['widest', F[F.length - 1]]]) for (const fromLeft of [true, false]) {
      T.stand(p); const fb = T.fireball(fromLeft); if (!fb) { out.push({ name, fromLeft, err: 'no fireball' }); continue; }
      const h = T.land(), c = T.carry(p, 400);
      out.push({ name, w: p.w, need: +(p.w / 2 + player.w / 2).toFixed(0), fromLeft, fvx: fb.vx, kb: fb.knockback, ...h, ...c, fell: Math.round((player.y + player.h - p.y) / 80) }); }
    return out; });
  console.log('floor       width  need   from   hit  thrown vx / vy     carried   off the platform');
  for (const r of A) console.log(r.err ? `${r.name} ${r.err}` : `${r.name.padEnd(10)} ${String(r.w).padStart(5)}  ${String(r.need).padStart(4)}   ${r.fromLeft ? 'left ' : 'right'}  ${r.hit ? 'yes' : 'NO '}  ${String(r.vx).padStart(7)} / ${String(r.vy).padEnd(7)}  ${String(r.dx).padStart(7)} px   ${r.off ? 'yes, at step ' + r.leftAt + ', fell ' + r.fell + ' floor(s)' : 'no'}`);
  check(A.every((r) => !r.err && r.hit), 'A. the real Spire fireball lands on the player in the harness (both sides, three floors)', A.map((r) => [r.name, r.fromLeft, r.hit, r.err]));
  check(A.every((r) => r.off), 'A. a fireball landed mid-platform carries the player off the platform - narrowest, middling and widest floor, from either side', A.map((r) => [r.name, r.w, r.fromLeft ? 'L' : 'R', r.dx, r.off]));
  check(A.every((r) => Math.abs(r.dx) >= r.need + 10), 'A. with at least 10 px to spare past the platform\'s end', A.map((r) => [r.name, r.need, r.dx]));
  // ---- B. direction, world, floors
  check(A.every((r) => (r.fromLeft ? r.vx > 0 && r.dx > 0 : r.vx < 0 && r.dx < 0)), 'B. the throw follows the fireball\'s flight: from the left to the right, from the right to the left', A.map((r) => [r.fromLeft, r.vx, r.dx]));
  check(A.every((r) => !r.out && r.grounded && r.onSurface && !r.samePlatform), 'B. every thrown player lands standing on a lower surface, inside the world, never through a floor', A.map((r) => [r.name, r.out, r.grounded, r.onSurface, r.samePlatform]));
  check(A.every((r) => r.rose < 70), 'B. the lift never reaches the floor above (floors are 80 px apart)', A.map((r) => r.rose));
  const B = await ev(() => { const T = window.__T, F = T.floors, o = {};
    // at the world's edges: the platform nearest each wall, the fireball flying toward that wall
    const byL = [...F].sort((a, b) => a.x - b.x)[0], byR = [...F].sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
    T.stand(byL); player.x = byL.x + 2; T.fireball(false); o.left = { ...T.land(), ...T.carry(byL, 400), x: player.x };
    T.stand(byR); player.x = byR.x + byR.w - player.w - 2; T.fireball(true); o.right = { ...T.land(), ...T.carry(byR, 400), x: player.x, world: game.mapData.worldWidth };
    // on the ground floor: nothing below to fall to, the player must stay on it
    const g = game.mapData.platforms.find((p) => p.type === 'ground'); T.stand(g); T.fireball(true); o.ground = { ...T.land(), ...T.carry({ x: -1e9, w: 2e9, y: g.y }, 400), feet: player.y + player.h, gy: g.y };
    // in the air between floors: thrown sideways, still lands
    T.stand(F[F.length >> 1]); player.y -= 40; player.onGround = false; T.fireball(true); o.air = { ...T.land(), ...T.carry(F[F.length >> 1], 400) };
    // the worst case, for real. First every floor from both sides (no steering on the way down) to find the longest fall,
    // then that one again with no god mode, as a rogue (no mana shield to pay for the hit) at full health.
    let worst = null; for (const p of F) for (const fromLeft of [true, false]) { T.stand(p); T.fireball(fromLeft); T.land(); const c = T.carry(p, 900); const fl = Math.round((player.y + player.h - p.y) / 80); if (c.off && (!worst || fl > worst.fl)) worst = { p, fromLeft, fl }; }
    if (worst) { const p = worst.p; player.cls = 'rogue'; T.stand(p); player._god = false; player.hp = getMaxHp(); const hp0 = player.hp; T.fireball(worst.fromLeft); const th = T.land(); const hpHit = player.hp; const tc = T.carry(p, 900);
      o.top = { hit: th.hit, max: hp0, shot: Math.round(hp0 - hpHit), fall: Math.round(hpHit - player.hp), left: Math.round(player.hp), floors: Math.round((player.y + player.h - p.y) / 80), px: Math.round(player.y + player.h - p.y), grounded: tc.grounded, onSurface: tc.onSurface };
      player._god = true; player.cls = 'mage'; player.hp = getMaxHp(); } else o.top = { hit: false };
    return o; });
  console.log(`longest fall (any floor, either side, no steering): ${B.top.floors} floors (${B.top.px} px); at full health the fireball took ${B.top.shot} and the landing ${B.top.fall} of ${B.top.max} HP`);
  check(B.top.hit && B.top.grounded && B.top.onSurface && B.top.left > B.top.max * 0.5, 'B. the longest fall a fireball can cause, taken at full health with no steering, is survived with more than half the bar', B.top);
  check(B.left.hit && !B.left.out && B.left.x >= 0 && B.right.hit && !B.right.out && B.right.x + 28 <= B.right.world + 0.01, 'B. thrown toward a wall from the platform beside it, the player stays inside the world', [B.left, B.right]);
  check(B.ground.hit && B.ground.grounded && Math.abs(B.ground.feet - B.ground.gy) < 1.5, 'B. on the ground floor the player is thrown along it and stays on it', B.ground);
  check(B.air.hit && B.air.vx > 0 && B.air.grounded && B.air.onSurface && !B.air.out, 'B. hit in mid-air, the player is thrown sideways and still lands on a surface', B.air);
  // ---- A2. the player fights it: LEFT held from the hit on, against a fireball from the left, on every floor of the Spire
  const H = await ev(() => { const T = window.__T, out = [];
    for (const p of T.floors) { T.stand(p); T.fireball(true); const h = T.land(); const x0 = player.x; let peak = 0, offAt = -1, vxAt = 0;
      game.keys['arrowleft'] = true;
      for (let i = 0; i < 240; i++) { game.time++; updatePlayer(T.DT); peak = Math.max(peak, player.x - x0); if (offAt < 0 && player.x >= p.x + p.w) { offAt = i + 1; vxAt = player.vx; } if (offAt > 0 && player.onGround) break; if (player.hitStun <= 0 && player.onGround && player.vx <= 0) break; }
      game.keys['arrowleft'] = false;
      out.push({ w: p.w, need: Math.round(p.w / 2 + player.w / 2), hit: h.hit, peak: Math.round(peak), off: offAt > 0, offAt, vxAt: +vxAt.toFixed(2) }); }
    return out; });
  const worst = H.slice().sort((a, b) => a.vxAt - b.vxAt)[0];
  console.log(`holding back, all ${H.length} floors: thrown ${Math.min(...H.map((r) => r.peak))}-${Math.max(...H.map((r) => r.peak))} px (a wall or a landing ends the longest); slowest crossing of a platform's end: ${worst.vxAt} px a frame, on the ${worst.w}-px floor at step ${worst.offAt}`);
  check(H.every((r) => r.hit && r.off), 'A2. on every floor of the Spire, a player who holds back against the throw is still carried off the platform', H.filter((r) => !r.off).slice(0, 4));
  check(H.every((r) => r.vxAt >= 4), 'A2. and is still travelling at 4 px a frame or more when crossing the end of the platform (room for the 26 px the floors drift)', [worst]);
  // ---- C. reducers, what is unchanged, junk, co-op
  const C = await ev(() => { const T = window.__T, F = T.floors, o = {}; const mid = F[F.length >> 1];
    const thrown = (prep, mk) => { T.stand(mid); prep(); if (mk) T.fireball(true); const h = T.land(); player.cls = 'mage'; player.tree.kbReduce = 0; player.blockTimer = 0; return h; };
    o.mage = thrown(() => {}, true); o.warrior = thrown(() => { player.cls = 'warrior'; }, true); o.block = thrown(() => { player.blockTimer = 600; }, true); o.unstop = thrown(() => { player.tree.kbReduce = 0.4; }, true);
    const shot = (extra) => { T.stand(mid); game.projectiles.push(Object.assign({ x: player.x - 24, y: player.y + 10, w: 22, h: 18, vx: 7, vy: 0, life: 60, damage: 10, owner: 'enemy', skill: 'fire', color: '#f72', noGravity: true }, extra)); return T.land(); };
    o.plain = shot({});                                                   // no authored knockback, no source: the ordinary nudge
    o.zero = shot({ knockback: 0 }); o.neg = shot({ knockback: -5 }); o.nan = shot({ knockback: NaN }); o.str = shot({ knockback: 'heavy' });
    o.inf = shot({ knockback: Infinity }); o.huge = shot({ knockback: 9999 });
    o.boss = shot({ _kbTier: 3 });                                         // a boss's shot, no authored knockback: the weighted throw
    o.bossAuth = shot({ _kbTier: 3, knockback: 4 });                       // authored outranks the shooter's weight
    o.up = shot({ knockback: 11, vx: 0, vy: -7, x: player.x + 3 });        // along ITS flight, whatever that is
    const far = (prep) => { T.stand(mid); prep(); T.fireball(true); T.land(); const c = T.carry(mid, 400); player.cls = 'mage'; player.blockTimer = 0; return { dx: c.dx, off: c.off }; };
    o.far = { mage: far(() => {}), warrior: far(() => { player.cls = 'warrior'; }), block: far(() => { player.blockTimer = 600; }) };
    o.xf = Array.isArray(_COOP_PJ_XF) && _COOP_PJ_XF.includes('knockback');
    T.stand(mid); T.fireball(true); const lst = _coopProjList(true); o.sent = lst.length ? (lst[lst.length - 1].xf || {}).knockback : null;
    o.fin = Number.isFinite(player.vx + player.vy + player.x + player.y);
    return o; });
  console.log(`carried from the middle of a ${A[2].w}-px floor: mage ${C.far.mage.dx} px (${C.far.mage.off ? 'off' : 'stays on'}), warrior ${C.far.warrior.dx} px (${C.far.warrior.off ? 'off' : 'stays on'}), blocking ${C.far.block.dx} px (${C.far.block.off ? 'off' : 'stays on'})`);
  check(Math.abs(setup.declared - 11) < 1e-9, 'C. the Spire fireball declares the tuned throw (11 px a frame)', setup.declared);
  check(Math.abs(C.mage.vx - 11) < 0.01 && C.mage.vy < -2.4 && C.mage.vy > -5, 'C. a standard player is thrown at the authored 11, with a low lift', C.mage);
  check(Math.abs(C.warrior.vx - 4.4) < 0.01 && Math.abs(C.block.vx - 5.5) < 0.01 && Math.abs(C.unstop.vx - 6.6) < 0.01, 'C. the player\'s reducers apply: warrior x0.4 (4.4), a raised block x0.5 (5.5), Unstoppable x0.6 (6.6)', [C.warrior.vx, C.block.vx, C.unstop.vx]);
  const ord = (h) => h.hit && h.vx === 1 && h.vy === -1.2;
  check(ord(C.plain) && ord(C.zero) && ord(C.neg) && ord(C.nan) && ord(C.str), 'C. a shot with no authored knockback (absent, 0, negative, NaN, a word) keeps the ordinary nudge, to the number', [C.plain, C.zero, C.neg, C.nan, C.str]);
  check(C.inf.hit && C.inf.vx === 14 && C.huge.hit && C.huge.vx === 14 && C.fin, 'C. an absurd authored knockback (Infinity, 9999) is clamped to the throw\'s ceiling (14)', [C.inf, C.huge]);
  check(Math.abs(C.boss.vx - 6) < 0.01 && Math.abs(C.bossAuth.vx - 4) < 0.01, 'C. a boss\'s shot keeps its weighted throw (6.0); an authored knockback outranks the weight (4.0)', [C.boss.vx, C.bossAuth.vx]);
  check(C.up.hit && C.up.vy < -9 && Math.abs(C.up.vx) < 5, 'C. the authored throw follows the shot\'s own flight (a rising shot lifts)', C.up);
  check(C.xf && C.sent === 11, 'C. the fireball\'s knockback rides to a co-op guest', { xf: C.xf, sent: C.sent });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
