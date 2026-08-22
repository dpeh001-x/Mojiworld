// Live test: ELEMENTAL APOTHEOSIS charge ring (per user: "remove the dust
// circle in apotheosis skill, change it something unique").
//
// The circle was performAround's OWN generic radial-gradient shockwave: every
// pulse called performAround (which ends by spawning one at full radius) AND
// spawnSmoothExplosion, so two circles stacked and the soft grey-white blob
// underneath read as dust. (My first theory — that #ffee44 hit the warrior
// palette and pulled in dust_ring — was WRONG; that colour is not in the set.
// The legacy assertion below pins the truth so the theory cannot creep back.)
// Asserted through the real tick + draw: the generic shockwave is suppressed
// for this caller only, every pulse draws the new apo_ring, and the colour
// heuristic still serves the callers that do rely on it.
//   node scripts/apotheosis_ring_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const OUT = process.env.LX_SHOT_DIR || '.';

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
await page.waitForFunction(() => typeof spawnSmoothExplosion === 'function' && typeof drawSmoothFx === 'function'
  && typeof _tickClassIdentity === 'function', null, { timeout: 120000 });
// the ring art streams with LX_FX; wait for decode before asserting on blits
await page.waitForFunction(() => typeof LX_FX !== 'undefined' && LX_FX.apo_ring
  && LX_FX.apo_ring.complete && LX_FX.apo_ring.naturalWidth > 0, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true; game.camera.x = 0;
  out.artReady = !!(LX_FX.apo_ring && LX_FX.apo_ring.complete && LX_FX.apo_ring.naturalWidth > 0);
  out.registered = !!LX_FX.apo_ring;
  // which LX_FX image does one explosion blit?
  const blitOf = (fx) => {
    game.smoothFx = [fx];
    fx.radius = fx.maxRadius * 0.6;
    fx.life = Math.max(1, fx.maxLife - 8);   // age it: at frame 0 the spin angle is legitimately 0
    let hit = null, rotated = false;
    const P = CanvasRenderingContext2D.prototype;
    const od = P.drawImage, orr = P.rotate;
    P.drawImage = function (img) {
      for (const k in LX_FX) if (LX_FX[k] === img) hit = k;
      return od.apply(this, arguments);
    };
    P.rotate = function (a) { if (a) rotated = true; return orr.apply(this, arguments); };
    try { drawSmoothFx(false); } catch (e) { hit = 'THREW:' + e; }
    P.drawImage = od; P.rotate = orr;
    game.smoothFx = [];
    return { hit, rotated };
  };
  const mk = (col, opts) => {
    game.smoothFx = [];
    spawnSmoothExplosion(400, 300, 200, col, col + '55', opts || {});
    return game.smoothFx[game.smoothFx.length - 1];
  };
  // the four colours the Apotheosis pulse actually cycles
  const COLS = ['#ff5522', '#66ddff', '#ffee44', '#aa66ff'];
  out.perColour = COLS.map(c => ({ c, ...blitOf(mk(c, { sprite: 'apo_ring', spin: 0.018 })) }));
  // the OLD behaviour, to show the bug was real: same colours, no override
  out.legacy = COLS.map(c => ({ c, ...blitOf(mk(c)) }));
  // the heuristic must still serve its original callers
  out.warriorSlam = blitOf(mk('#ffcc66'));
  out.rogueSmoke  = blitOf(mk('#9944cc'));

  // performAround's own shockwave: present by default, gone with noShock
  const aoeShock = (opts) => {
    game.smoothFx = [];
    const before = game.monsters; game.monsters = [];
    try { performAround(200, 0.5, opts); } catch (e) {}
    game.monsters = before;
    const n = game.smoothFx.filter(f => f.type === 'explosion' && !f.sprite).length;
    game.smoothFx = [];
    return { shockwaves: n };
  };
  out.plainAoe = aoeShock({ color: '#ffee44' });
  out.apoAoe   = aoeShock({ color: '#ffee44', noShock: true });

  // and the LIVE path: drive the real charge tick and see what it spawns
  player.cls = 'mage'; player.hp = 100; player.hitStun = 0; game.dying = 0;
  const wasPaused = game.paused; game.paused = false;
  game.keys = game.keys || {}; game.keys.b = true;
  player._warCharge = { skillId: 'elementalist_ult', cls: 'mage', slotKey: 'b',
                        start: 0, frames: 90, power: 0 };
  game.smoothFx = [];
  const spawned = [];
  for (let t = 0; t <= 40; t++) {
    game.time = t;
    try { _tickClassIdentity(1); } catch (e) {}
    for (const fx of game.smoothFx) if (fx.type === 'explosion' && !fx._seen) { fx._seen = 1; spawned.push({ sprite: fx.sprite, spin: fx.spin, col: fx.coreCol }); }
  }
  game.paused = wasPaused; player._warCharge = null; game.keys.b = false; game.smoothFx = [];
  out.livePulses = spawned;
  return out;
});

const dusted = (arr) => arr.filter(x => x.hit === 'dust_ring').length;
ok('the new ring art is registered and decoded', r.registered && r.artReady, { registered: r.registered, ready: r.artReady });
// pins the corrected diagnosis: these colours never hit the palette sets, so
// the dust theory was wrong and must not be re-asserted later
ok('the pulse colours do NOT hit the colour-bucket palettes (the dust theory was wrong)',
  dusted(r.legacy) === 0 && r.legacy.every(x => x.hit === null),
  { legacy: r.legacy.map(x => x.c + '->' + x.hit) });
ok("THE REAL CAUSE: a normal AoE spawns performAround's generic shockwave...",
  r.plainAoe.shockwaves === 1, r.plainAoe);
ok('...and the Apotheosis pulse suppresses it, so only its own ring remains',
  r.apoAoe.shockwaves === 0, r.apoAoe);
ok('no pulse colour draws dust any more', dusted(r.perColour) === 0, r.perColour.map(x => x.c + '->' + x.hit));
ok('every pulse colour draws apo_ring instead',
  r.perColour.every(x => x.hit === 'apo_ring'), r.perColour.map(x => x.c + '->' + x.hit));
ok('the ring spins (rotation applied on the blit)', r.perColour.every(x => x.rotated), r.perColour.map(x => x.rotated));
ok('the colour heuristic still serves its original callers (warrior dust, rogue smoke)',
  r.warriorSlam.hit === 'dust_ring' && r.rogueSmoke.hit === 'smoke_puff',
  { warrior: r.warriorSlam.hit, rogue: r.rogueSmoke.hit });
ok('LIVE: the real charge tick spawns apo_ring pulses, none of them dust',
  r.livePulses.length >= 3 && r.livePulses.every(p => p.sprite === 'apo_ring'),
  { pulses: r.livePulses.length, sprites: [...new Set(r.livePulses.map(p => p.sprite))] });
ok('...with alternating spin direction so held pulses counter-rotate',
  new Set(r.livePulses.map(p => Math.sign(p.spin))).size === 2
    && r.livePulses.every(p => p.spin !== 0),
  { spins: r.livePulses.map(p => p.spin) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

// a frame for the eye
const dataUrl = await page.evaluate(() => {
  game.smoothFx = [];
  ctx.save(); ctx.fillStyle = '#241a36'; ctx.fillRect(180, 120, 440, 360); ctx.restore();
  spawnSmoothExplosion(400, 300, 190, '#ffee44', '#ffee4455', { life: 14, sprite: 'apo_ring', spin: 0.018 });
  const fx = game.smoothFx[game.smoothFx.length - 1];
  fx.radius = 180; fx.life = 11;
  drawSmoothFx(false);
  const c = document.createElement('canvas'); c.width = 440; c.height = 360;
  c.getContext('2d').drawImage(ctx.canvas, 180, 120, 440, 360, 0, 0, 440, 360);
  game.smoothFx = [];
  return c.toDataURL('image/png');
});
(await import('node:fs')).writeFileSync(`${OUT}/apo_after.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
