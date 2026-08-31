// Live test: LEGOSAURUS SWINGS SLOWER AND HITS HARDER.
//
// Per user: "Stegosaurus ... the attacks dont feel impactful ... slow down the
// pace for stegosaurus attack and rush sprites animation." (Legosaurus - the
// Block-land tyrant, drawn as a green stegosaurus.)
//
// The rush needs no separate fix: braceDash holds atkAnimUntil through both
// phases, so the dash PLAYS the attack set - one ft array on legosaurus.attack
// re-paces both. Impact fires where damage APPLIES, not at swing launch, so a
// whiffed swing stays quiet - asserted via spies on addHitStop/addShake.
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

const r = await page.evaluate(() => {
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
ok('the trait declares the impact and the REAL swing projectile carries it',
  r.spawned && r.trait && r.trait.impactMs === 110 && r.trait.impactShake === 9
  && r.swingCarries && r.swingCarries.impactMs === 110,
  { trait: r.trait, projectile: r.swingCarries });
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
