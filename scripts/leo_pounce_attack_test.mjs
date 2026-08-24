// Live test: REGULUS'S SUN POUNCE.
//
// Per user: "make it an attack where before pouncing there is a windup signal
// and when he pounces and lands in the radius which is calibrated near to the
// players current coordinate the last 2 seconds ago, deals high damage."
//
// Driven on a DETERMINISTIC clock — `game.time++; updateMonsters(16)` — through
// a REALLY-spawned Regulus. Four traps this file exists to stay clear of, every
// one of them paid for on this branch:
//   - a hand-built monster object never runs the AI (spawnMonster sets fields
//     the update loop gates on);
//   - waiting on requestAnimationFrame tests nothing: the page sits on the
//     title screen with game.time frozen at 0 and the boss AI never ticks;
//   - game.paused = true makes _diffDmg return 0 BY DESIGN, so the world must
//     genuinely be unpaused for any damage assertion to mean anything;
//   - "hp dropped a lot" is not evidence THIS attack landed — every damage
//     assertion is keyed on player._lastDamageSource.
//   node scripts/leo_pounce_attack_test.mjs [port]
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
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof updateMonsters === 'function'
  && typeof _lxAttackZones === 'function' && typeof LEO_POUNCE_R !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = { tune: { R: LEO_POUNCE_R, frac: LEO_POUNCE_FRAC, lag: LEO_POUNCE_LAG } };
  game.paused = false;
  const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
  out.maxHp = maxHp;
  // A title-screen player has no maxHp written from class stats, and the
  // %-of-maxHP path multiplies by exactly that field.
  const reset = () => { player.maxHp = player.maxHp || maxHp;
    player.hp = maxHp; player.invulnerable = 0; player._god = false;
    player.blockTimer = 0; player._aegis = false; player.vx = 0; player.vy = 0;
    player._lastDamageSource = null; };
  reset();
  // The expectation must walk the SAME mitigation chain the attack does -
  // the class DR is applied BEFORE _diffDmg. Skipping it made a correct 137
  // look like a 13-point shortfall against a naive 150.
  const drOf = () => (player.cls === 'warrior' && typeof _warriorDr === 'function') ? _warriorDr() : 1;
  const expectNow = () => { const mh = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
    return _diffDmg(Math.max(1, Math.floor(Math.floor(mh * LEO_POUNCE_FRAC) * drOf())), 0, true); };
  out.expect = expectNow();

  const WW = (game.mapData && game.mapData.worldWidth) || 800;
  out.worldWidth = WW;
  game.monsters = []; game.projectiles = [];
  spawnMonster(Math.round(WW * 0.78), 380, 'zodiac_leo', true);
  const leo = game.monsters[0];
  if (!leo) { out.spawnFailed = true; return out; }
  out.sign = leo.zodiacSign;
  out.bossW = leo.w;
  out.cls = player.cls;
  out.warriorDr = (typeof _warriorDr === 'function') ? _warriorDr() : null;

  // Regulus parks well clear of Solar Mane's 140 px burn radius, which would
  // otherwise bleed into every hp reading.
  const A = Math.round(WW * 0.34);     // where the player will stand
  const BOSSX = Math.min(WW - leo.w - 20, A + 340);
  out.geom = { WW, A, BOSSX, bossW: leo.w, apartPx: (BOSSX + leo.w / 2) - (A + player.w / 2) };
  const park = (x) => { player.x = x; player.y = 400; player.vx = 0; player.vy = 0; };
  const zone = () => _lxAttackZones().find(q => q.kind === 'smash' && q.color === '#ffdd66') || null;
  let ts = 0;
  // Hold the world still and let the trail fill. Regulus is pinned 620 px away:
  // Solar Mane burns anything inside 140 px, and that burn would contaminate
  // every hp reading later.
  const hold = (n, x) => { for (let i = 0; i < n; i++) {
    game.time++; ts += 16;
    leo.patternState = 'idle'; leo.patternTimer = 0; leo.x = BOSSX; leo.vx = 0;
    park(x); reset(); game.paused = false; updateMonsters(16);
  } };
  // Run the pounce and log every tick of it.
  const run = (n, onTick) => {
    const log = [];
    for (let i = 0; i < n; i++) {
      game.time++; ts += 16;
      const hp0 = player.hp;
      if (onTick) onTick(i);
      player.vx = 0;                   // the player is standing, not sliding
      updateMonsters(16);
      const z = zone();
      let anim = null; try { anim = _zodiacAnimTick(leo, ts).state; } catch (e) {}
      log.push({ i, st: leo.patternState, mk: !!leo._leoMarking, mx: leo._leoPounceX,
        air: !leo.onGround, lx: leo.x + leo.w / 2, px: player.x + player.w / 2,
        d: hp0 - player.hp, src: player._lastDamageSource || null, anim,
        zx: z ? z.x + z.w / 2 : null, zw: z ? z.w : null, zp: z ? z.prog : null,
        ph: leo.phase, landed: !!leo._leoLanded, tl: leo._leoTrail ? leo._leoTrail.length : -1,
        inv: Math.round(player.invulnerable || 0), hp: Math.round(player.hp), pz: !!game.paused,
        pt: Math.round(leo.patternTimer), og: !!leo.onGround, vx: +leo.vx.toFixed(2), vy: +leo.vy.toFixed(2),
        gap: leo._leoPounceX == null ? null : Math.round(leo._leoPounceX - (leo.x + leo.w / 2)),
        exp: expectNow() });
      // Keep the run alive. A dead player pauses the world and the boss AI stops
      // ticking, which silently emptied every later case in this file. hp is topped
      // up AFTER the sample is taken, so the per-tick delta above is untouched.
      player.hp = maxHp; game.paused = false; player.dead = false;
      if (i > 40 && leo.patternState === 'idle') break;
    }
    return log;
  };
  const arm = () => { leo._stagger = 0; leo._staggerCd = 0; leo._dirOpenT = 0;
    leo.patternState = 'pounceWindup'; leo.patternTimer = 0;
    leo._leoPounceX = null; leo._leoPounceY = null; leo._leoMarking = false;
    leo._leoLanded = false; leo._leoWasAir = false; };
  const digest = (L) => {
    const mk = L.find(s => s.mk) || null;
    const hi = L.findIndex(s => s.src === 'the Sun Pounce');
    const wind = L.filter(s => s.st === 'pounceWindup');
    return {
      ticks: L.length, markX: mk ? mk.mx : null,
      windup: wind.length, leap: L.filter(s => s.st === 'pounceLeap').length,
      air: L.filter(s => s.air).length,
      pounceAnim: L.filter(s => s.air && s.anim === 'pounce').length,
      zWind: wind.filter(s => s.zx != null).length,
      zLeap: L.filter(s => s.st === 'pounceLeap' && s.zx != null).length,
      zx: mk ? mk.zx : null, zw: mk ? mk.zw : null,
      p0: wind.length ? wind[0].zp : null, p1: wind.length ? wind[wind.length - 1].zp : null,
      hit: hi >= 0, dmg: hi >= 0 ? L[hi].d : null, exp: hi >= 0 ? L[hi].exp : null,
      invAtHit: hi >= 0 ? L[hi].inv : null, invBefore: hi > 0 ? L[hi - 1].inv : null,
      phases: [...new Set(L.map(s => s.ph))],
      tail: L.slice(-4).map(s => ({ i: s.i, st: s.st, mk: s.mk, ph: s.ph, landed: s.landed, tl: s.tl, pt: s.pt, og: s.og })),
      around: L.filter(s => s.i >= 30 && s.i <= 44).map(s => ({ i: s.i, st: s.st, pt: s.pt, tl: s.tl, og: s.og, vy: s.vy, mk: s.mk })),
      flight: L.filter(s => s.st === 'pounceLeap').slice(0, 60).filter((_, k) => k % 6 === 0).map(s => ({ i: s.i, gap: s.gap, vx: s.vx, vy: s.vy, og: s.og })),
      landedAt: hi >= 0 ? L[hi].lx : (L.find(s => s.st === 'pounceLeap' && !s.air) || {}).lx ?? null,
      playerAt: hi >= 0 ? L[hi].px : (L[L.length - 1] || {}).px,
      end: L.length ? L[L.length - 1].st : null,
      endMk: L.length ? L[L.length - 1].mk : null,
      endMx: L.length ? L[L.length - 1].mx : null,
    };
  };

  // ---- CASE A: the player never moves. The circle lands on them. ----
  hold(200, A);
  out.trail = { n: leo._leoTrail.length,
    span: leo._leoTrail.length ? leo._leoTrail[leo._leoTrail.length - 1].t - leo._leoTrail[0].t : 0 };
  reset(); arm();
  out.A = digest(run(400));
  out.A.stood = A + player.w / 2;

  // ---- CASE B: the player leaves once the circle is down. ----
  leo.patternState = 'idle'; leo.patternTimer = 0;
  leo._leoMarking = false; leo._leoPounceX = null; leo._leoPounceY = null;
  leo._leoTrail = [];
  hold(200, A);
  reset(); arm();
  let fledTo = null;
  out.B = digest(run(400, (i) => {
    // step out of the ring ONE tick after the mark exists - early enough that a
    // tracking implementation would still have time to re-aim onto the new spot
    if (i === 3 && leo._leoPounceX != null) {
      player.x = Math.max(0, leo._leoPounceX - LEO_POUNCE_R - 130);
      player.y = 400; player._lastDamageSource = null;
      fledTo = player.x + player.w / 2;
    }
  }));
  out.B.fledTo = fledTo;

  // ---- a STRANDED flag must never draw a circle ----
  // The flag is cleared at the top of the leo AI, but that AI does not run while
  // the boss is staggered, so the zone itself has to read the pattern state.
  leo.patternState = 'idle'; leo._leoMarking = true;
  leo._leoPounceX = A; leo._leoPounceY = 400;
  out.strandedZone = !!zone();
  leo._leoMarking = false; leo._leoPounceX = null; leo._leoPounceY = null;

  // ---- CASE C: left alone, does he reach for it himself? ----
  player._god = true;                  // survive an unsupervised lion
  leo.patternState = 'idle'; leo.patternTimer = 0;
  leo._leoMarking = false; leo._leoPounceX = null; leo._leoPounceY = null;
  const seen = {};
  for (let i = 0; i < 4000; i++) {
    game.time++;
    if (i % 3 === 0) park(A + (i % Math.max(40, Math.round(WW * 0.3))));   // wander so he has a live trail
    game.paused = false; player.hp = maxHp;
    updateMonsters(16);
    if (leo.patternState) seen[leo.patternState] = (seen[leo.patternState] || 0) + 1;
  }
  out.C = { seen, sawPounce: !!(seen.pounceWindup || seen.pounceLeap) };

  // ---- no other sign got this by accident ----
  out.otherSigns = [];
  for (const k of ['zodiac_taurus', 'zodiac_virgo', 'zodiac_aries']) {
    game.monsters = [];
    try { spawnMonster(1200, 380, k, true); } catch (e) { continue; }
    const o = game.monsters[0]; if (!o) continue;
    let hitPounce = false;
    game.monsters[0].x = BOSSX;
    for (let i = 0; i < 900; i++) { game.time++; park(A); updateMonsters(16);
      if (o.patternState === 'pounceWindup' || o.patternState === 'pounceLeap') hitPounce = true; }
    if (hitPounce) out.otherSigns.push(k);
  }
  game.monsters = []; player._god = false;
  return out;
});

const A = r.A || {}, B = r.B || {}, C = r.C || {};
if (process.env.LXDEBUG) console.log(JSON.stringify({ bossW: r.bossW, cls: r.cls, warriorDr: r.warriorDr, maxHp: r.maxHp, Aflight: (r.A||{}).flight, Aaround: (r.A||{}).around, Btail: (r.B||{}).tail, Baround: (r.B||{}).around }, null, 1));
const pct = (v) => v == null ? null : (v / r.maxHp * 100).toFixed(1) + '%';
ok('the harness geometry fits inside the arena (self-check)',
  r.geom && r.geom.A > 0 && r.geom.BOSSX + r.geom.bossW < r.geom.WW && r.geom.apartPx > 160,
  r.geom);
ok('the tunables are live: two seconds of lag, a real radius, high damage',
  r.tune.lag === 120 && r.tune.R >= 100 && r.tune.frac >= 0.5,
  { lagFrames: r.tune.lag, seconds: r.tune.lag / 60, radiusPx: r.tune.R, fracOfMaxHp: r.tune.frac });
ok('the position trail holds more than two seconds of history',
  r.trail && r.trail.n > 120 && r.trail.span >= 120, r.trail);
ok('the windup marks WHERE THE PLAYER WAS',
  A.markX != null && Math.abs(A.markX - A.stood) < 40,
  { markX: A.markX, playerStoodAt: A.stood, offBy: A.markX == null ? null : Math.round(A.markX - A.stood) });
ok('a danger circle is published for the whole windup AND the whole flight',
  A.zWind > 5 && A.zLeap > 3 && A.zw === r.tune.R * 2 && Math.abs((A.zx ?? 0) - (A.markX ?? 0)) < 2,
  { windupTicks: A.zWind, flightTicks: A.zLeap, circleCentre: A.zx, circleWidth: A.zw, markX: A.markX });
ok('...and it fills as he gathers, so the windup reads as a countdown',
  A.p0 != null && A.p1 != null && A.p1 > A.p0 + 0.3,
  { progAtStart: A.p0?.toFixed(2), progAtLaunch: A.p1?.toFixed(2), windupTicks: A.windup });
ok('he leaves the ground and holds the POUNCE pose the whole way',
  A.air > 8 && A.pounceAnim === A.air,
  { airborneTicks: A.air, ticksDrawnAsPounce: A.pounceAnim, leapTicks: A.leap });
ok('...and lands on the circle he drew', A.landedAt != null && Math.abs(A.landedAt - A.markX) < 70,
  { landedAt: A.landedAt == null ? null : Math.round(A.landedAt), markX: A.markX });
ok('standing still costs you: high damage, credited to the Sun Pounce',
  A.hit && A.dmg > 0 && A.exp != null && Math.abs(A.dmg - A.exp) <= Math.max(2, A.exp * 0.02)
  && A.dmg >= r.maxHp * 0.45,
  { dealt: A.dmg, expectedAtThatTick: A.exp, ofMaxHp: pct(A.dmg), maxHp: r.maxHp, cls: r.cls, classDr: r.warriorDr });
ok('the pattern hands control back and clears its mark',
  A.end === 'idle' && A.endMk === false && A.endMx === null,
  { endState: A.end, stillMarking: A.endMk, markX: A.endMx });
ok('having MOVED is the counterplay - the circle does not follow you',
  B.markX != null && !B.hit && Math.abs(B.markX - A.stood) < 40,
  { circleStayedAt: B.markX, playerFledTo: B.fledTo, radius: r.tune.R, tookPounceDamage: B.hit });
ok('...and that case cleans up too', B.end === 'idle' && B.endMk === false && B.endMx === null,
  { endState: B.end, marking: B.endMk, markX: B.endMx });
ok('a stranded mark cannot draw a circle - the pattern state is the authority',
  r.strandedZone === false, { zoneDrawnWhileIdle: r.strandedZone });
ok('left alone, Regulus reaches for the pounce himself', C.sawPounce,
  { patternTicksIn66s: C.seen });
ok('no other sign picked this up by accident', (r.otherSigns || []).length === 0,
  { signsThatPounce: r.otherSigns });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
