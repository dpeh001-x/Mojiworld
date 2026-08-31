// Live test: LEGOSAURUS SWINGS SLOWER AND HITS HARDER.
//
// Per user: "Stegosaurus ... the attacks dont feel impactful ... slow down the
// pace for stegosaurus attack and rush sprites animation." (Legosaurus - the
// Block-land tyrant, drawn as a green stegosaurus.)
//
// The rush needed its OWN fix - v0.30.320 claimed it came free with the swing
// ft, and that was wrong: while _braceDashing the frame picker redirects to
// the dedicated `legosaurusdash` set and asks _lxCalibFt with THAT key, so
// legosaurus.attack.ft never touched it. v0.30.322 authors
// legosaurusdash.attack.ft as ONE pass over the real move: 850ms brace
// (700 dead-still tell + 150 rear-up) then the 380ms dash as sprint churn -
// at the old flat 48ms the 9 frames looped ~2.85x across the move, sprinting
// in place mid-brace, which is the reported "very weird". Impact fires where
// damage APPLIES, not at swing launch, so a whiffed swing stays quiet -
// asserted via spies on addHitStop/addShake.
//   node scripts/legosaurus_feel_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8731; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _lxCalibFt === 'function'
  && typeof _lxFtWalk === 'function' && typeof updateProjectiles === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
// the dash checks walk the REAL frame images - wait for all 9 to decode
await page.waitForFunction(() => typeof BOSS_ATTACK_FRAMES !== 'undefined' && typeof _lxFtReadyN === 'function'
  && BOSS_ATTACK_FRAMES.legosaurusdash && _lxFtReadyN(BOSS_ATTACK_FRAMES.legosaurusdash) === 9,
  null, { timeout: 60000 });

const r = await page.evaluate(async () => {
  if (typeof _lxIsSanctuary === 'function') { try { window._lxIsSanctuary = () => false; } catch (e) {} }
  if (!game.camera) game.camera = { x: 0, y: 0 };
  const out = {};

  // ---- pacing: the ft array is authored and the walker honours it ----
  out.ft = _lxCalibFt('legosaurus', 'attack');
  out.ftSum = Array.isArray(out.ft) ? out.ft.reduce((a, c2) => a + c2, 0) : 0;
  if (Array.isArray(out.ft)) {
    // pin the clock so the frame the walker returns is a pure function of offset
    const realNow = performance.now.bind(performance);
    const NOW = 1000000;
    performance.now = () => NOW;
    const frames = Array.from({ length: 9 }, (_, i) => ({ id: i, complete: true, naturalWidth: 10 }));
    const at = (off) => _lxFtWalk(frames, 9, out.ft, off - (NOW % out.ftSum), false).id;
    out.frameAt0 = at(0);
    out.frameAt69 = at(69);     // inside frame 0's 70ms dwell
    out.frameAt71 = at(71);     // just past it
    out.frameAt400 = at(399);   // cumsum 70+70+75+85=300, +100 ends AT 400 - 399 is inside frame 4 (400 exactly is the boundary)
    performance.now = realNow;
  }
  // old flat pacing for contrast: 48ms/frame puts 400ms at frame 8
  out.oldFrameAt400 = Math.floor(400 / 48);

  // ---- the RUSH: the dedicated legosaurusdash set has its own ft, and the
  // ---- REAL picker path (_bossAttackFrame, asked with the dash key exactly
  // ---- as the draw redirect asks it) walks one pass over the 1230ms move ----
  out.dashFt = _lxCalibFt('legosaurusdash', 'attack');
  out.dashSum = Array.isArray(out.dashFt) ? out.dashFt.reduce((a, c2) => a + c2, 0) : 0;
  out.dashReady = (typeof BOSS_ATTACK_FRAMES !== 'undefined' && BOSS_ATTACK_FRAMES.legosaurusdash)
    ? _lxFtReadyN(BOSS_ATTACK_FRAMES.legosaurusdash) : -1;
  if (Array.isArray(out.dashFt) && out.dashReady === 9) {
    const realNow2 = performance.now.bind(performance);
    const NOW2 = 5000000;
    performance.now = () => NOW2;
    // _mobAnimPhase returns -_animStAt (walker adds its own now), so a stub
    // anchored at NOW2-offset reads as "offset ms into the attack state"
    const dAt = (off) => {
      const stub = { _animSt: 'attack', _animStAt: NOW2 - off, _animSeed: 0 };
      const img = _bossAttackFrame('legosaurusdash', stub);
      const fr = BOSS_ATTACK_FRAMES.legosaurusdash;
      for (let i = 0; i < fr.length; i++) if (fr[i] === img) return i;
      return -1;
    };
    out.dash = { at0: dAt(0), at400: dAt(400), at699: dAt(699), at720: dAt(720), at860: dAt(860), at1229: dAt(1229) };
    performance.now = realNow2;
  }

  // ---- hit-region coverage: the player-attack box must cover the pixels the
  // ---- player actually sees. Measured live: drawMonster driven directly,
  // ---- drawImage spy -> world rects via the scene transform (shadow draw
  // ---- carries the pure view transform), alpha-scanned opaque union. Facing
  // ---- forced RIGHT = the authored (unmirrored) basis. Before v0.30.325 the
  // ---- idle box covered 296px of a 517px-wide dino - 145px of tail and 76px
  // ---- of head were unhittable air, and ox leaned the box toward the head
  // ---- while the art is tail-heavy.
  const coverage = async (stName, force) => {
    game.monsters = [];
    spawnMonster(600, 380, 'legosaurus', true);
    game.paused = false;
    { const _o = document.getElementById('boss-intro-overlay'); if (_o) _o.classList.remove('on'); }
    const mb = game.monsters[0];
    game.camera.x = 0; game.camera.y = 0;
    player.x = 1400; player.y = 400;
    const P = CanvasRenderingContext2D.prototype.drawImage;
    const main = document.getElementById('game');
    let un = null;
    // deterministic frame walk: pin the clock and step 53ms (< the shortest
    // authored dwell), re-anchoring the state each step - time-based sampling
    // is dwell-weighted and misses short frames, under-reading the union
    const realNowC = performance.now.bind(performance);
    const BASEC = 9000000;
    for (let i = 0; i < 18; i++) {
      performance.now = () => BASEC + i * 53;
      force(mb);
      mb._animSt = stName; mb._animStAt = BASEC; mb._animSeed = 0;
      const recs = [];
      CanvasRenderingContext2D.prototype.drawImage = function (img) {
        const a = arguments, t = this.getTransform();
        if (this.canvas === main) recs.push({ img, d: [...a].slice(1), tr: [t.a, t.d, t.e, t.f] });
        return P.apply(this, arguments);
      };
      mb.facing = 1;
      try { drawMonster(mb); } finally { CanvasRenderingContext2D.prototype.drawImage = P; }
      const fr = recs.find(q => q.img && q.img.src && /legosaurus/.test(q.img.src) && q.d.length >= 4);
      const sh = recs.find(q => q !== fr);
      if (!fr || !sh) continue;
      const Vs = sh.tr[0], Ve = sh.tr[2], Vf = sh.tr[3];
      const lx = fr.tr[0] / Vs, ly = fr.tr[1] / Vs;
      const wx = (fr.tr[2] - Ve) / Vs, wy = (fr.tr[3] - Vf) / Vs;
      const dn = fr.d.length, dx = fr.d[dn - 4], dy = fr.d[dn - 3], dw = fr.d[dn - 2], dh = fr.d[dn - 1];
      const e1 = wx + lx * dx, e2 = wx + lx * (dx + dw), f1 = wy + ly * dy, f2 = wy + ly * (dy + dh);
      const c = document.createElement('canvas'); c.width = fr.img.naturalWidth; c.height = fr.img.naturalHeight;
      const x2 = c.getContext('2d', { willReadFrequently: true }); x2.drawImage(fr.img, 0, 0);
      const d2 = x2.getImageData(0, 0, c.width, c.height).data;
      let L = 1e9, R = -1;
      for (let y = 0; y < c.height; y += 3) for (let xx = 0; xx < c.width; xx += 2)
        if (d2[(y * c.width + xx) * 4 + 3] > 10) { if (xx < L) L = xx; if (xx > R) R = xx; }
      if (R < 0) continue;
      const gx1 = Math.min(e1, e2) + (L / c.width) * Math.abs(e2 - e1);
      const gx2 = Math.min(e1, e2) + ((R + 1) / c.width) * Math.abs(e2 - e1);
      un = un ? { x1: Math.min(un.x1, gx1), x2: Math.max(un.x2, gx2) } : { x1: gx1, x2: gx2 };
    }
    performance.now = realNowC;
    mb._abFrame = -1;
    const box = _atkMonBox(mb);
    game.monsters = [];
    if (!un || !box) return null;
    const ix = Math.max(0, Math.min(un.x2, box.x + box.w) - Math.max(un.x1, box.x));
    return { artW: Math.round(un.x2 - un.x1), boxW: Math.round(box.w),
      covered: Math.round(1000 * ix / (un.x2 - un.x1)) / 1000,
      ratio: Math.round(1000 * box.w / (un.x2 - un.x1)) / 1000 };
  };
  out.covIdle = await coverage('idle', (mb) => { mb.vx = 0; mb.atkAnimUntil = 0; mb._frameIsAttack = false; });
  out.covAttack = await coverage('attack', (mb) => { mb.atkAnimUntil = performance.now() + 5000; mb._frameIsAttack = true; });
  out.hbNow = { idle: _lxAtkHitbox('legosaurus', 'idle'), attack: _lxAtkHitbox('legosaurus', 'attack') };

  // ---- impact config reaches the projectile through the REAL swing ----
  game.monsters = []; game.projectiles = [];
  spawnMonster(500, 300, 'legosaurus', true);
  const m = game.monsters[0];
  out.spawned = !!m;
  out.trait = m && m.traits && m.traits.bigMelee
    ? { impactMs: m.traits.bigMelee.impactMs, impactShake: m.traits.bigMelee.impactShake } : null;
  let swingP = null;
  if (m) {
    player.x = m.x + m.w + 40; player.y = m.y; player.hp = Math.max(500, player.hp);
    for (let f = 0; f < 900 && !swingP; f++) {
      game.time++;
      try { updateMonsters(16); } catch (e) {}
      swingP = (game.projectiles || []).find((p) => p && p.skill === 'swing' && p._swingType === 'legosaurus');
    }
  }
  out.swingCarries = swingP ? { impactMs: swingP._impactMs, impactShake: swingP._impactShake } : null;

  // ---- the juice fires when damage APPLIES - and only then ----
  // spawning a BOSS opened the intro overlay and paused the game - and
  // _diffDmg returns 0 while paused BY DESIGN (the documented driven-clock
  // trap), which is why the first run saw the juice fire with zero damage.
  game.paused = false;
  { const _o = document.getElementById('boss-intro-overlay'); if (_o) _o.classList.remove('on'); }
  const realStop = window.addHitStop, realShake = window.addShake;
  let stops = [], shakes = [];
  window.addHitStop = (ms) => { stops.push(ms); };
  window.addShake = (a) => { shakes.push(a); };
  game.monsters = [];
  const hit = (overlap) => {
    stops = []; shakes = [];
    game.projectiles = [{ x: overlap ? player.x : player.x + 900, y: player.y, vx: 0, vy: 0,
      w: 60, h: 60, life: 10, damage: 5000, owner: 'enemy', skill: 'swing',   // big enough to survive DEF mitigation - 5 floored to 0 on a geared save
      _impactMs: 110, _impactShake: 9, noGravity: true }];
    player.invulnerable = 0; player.dodgeIframes = 0; player.hp = Math.max(400, player.hp);
    const hp0 = player.hp;
    try { updateProjectiles(16); } catch (e) {}
    return { lost: hp0 - player.hp, stops: stops.slice(), shakes: shakes.slice() };
  };
  out.landed = hit(true);
  out.whiffed = hit(false);
  window.addHitStop = realStop; window.addShake = realShake;
  game.projectiles = []; game.monsters = [];
  return out;
});
await b.close(); srv.kill();

ok('the attack carries an authored frame-timing array totalling ~775ms',
  Array.isArray(r.ft) && r.ft.length === 9 && r.ftSum === 775,
  { ft: r.ft, sumMs: r.ftSum, was: '48ms flat = 432ms/cycle' });
ok('the walker honours the dwells - frame boundaries land where the array says',
  r.frameAt0 === 0 && r.frameAt69 === 0 && r.frameAt71 === 1 && r.frameAt400 === 4,
  { at0: r.frameAt0, at69: r.frameAt69, at71: r.frameAt71, at400: r.frameAt400,
    note: 'the old flat 48ms put 400ms at frame ' + r.oldFrameAt400 + ' - the whole swing was over before it read' });
ok('the RUSH set carries its own ft - one 1230ms pass = 850 brace + 380 dash',
  Array.isArray(r.dashFt) && r.dashFt.length === 9 && r.dashSum === 1230 && r.dashReady === 9,
  { ft: r.dashFt, sumMs: r.dashSum, framesReady: r.dashReady,
    was: 'flat 48ms = the 9 frames looped ~2.85x across the move, sprinting in place mid-brace' });
ok('the real picker walks it: dead-still tell, rear-up at 700, sprint through the dash, settle at the end',
  r.dash && r.dash.at0 === 0 && r.dash.at400 === 0 && r.dash.at699 === 0
  && r.dash.at720 === 1 && r.dash.at860 === 2 && r.dash.at1229 === 8,
  r.dash);
ok('the trait declares the impact and the REAL swing projectile carries it',
  r.spawned && r.trait && r.trait.impactMs === 110 && r.trait.impactShake === 9
  && r.swingCarries && r.swingCarries.impactMs === 110,
  { trait: r.trait, projectile: r.swingCarries });
ok('the hit-region fractions are the measured v0.30.325 bake, tail-shifted',
  r.hbNow && r.hbNow.idle && r.hbNow.idle.w === 1.088 && r.hbNow.idle.ox === -0.0567
  && r.hbNow.attack && r.hbNow.attack.w === 1.374 && r.hbNow.attack.ox === 0.0238,
  r.hbNow);
ok('IDLE: the player-attack box covers >=85% of the visible dino and is not ballooned',
  r.covIdle && r.covIdle.covered >= 0.85 && r.covIdle.ratio >= 0.8 && r.covIdle.ratio <= 1.05,
  Object.assign({ was: 'box 296px on a 517px dino - 145px of tail + 76px of head whiffed' }, r.covIdle));
ok('ATTACK: the box tracks the wider swing poses the same way',
  r.covAttack && r.covAttack.covered >= 0.82 && r.covAttack.ratio >= 0.75 && r.covAttack.ratio <= 1.05,
  r.covAttack);
ok('a LANDED swing spends the impact - hit-stop 110 and shake 9',
  r.landed.lost > 0 && r.landed.stops.includes(110) && r.landed.shakes.includes(9),
  r.landed);
ok('a WHIFFED swing stays quiet - no damage, no stop, no shake',
  r.whiffed.lost === 0 && r.whiffed.stops.length === 0 && r.whiffed.shakes.length === 0,
  r.whiffed);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
