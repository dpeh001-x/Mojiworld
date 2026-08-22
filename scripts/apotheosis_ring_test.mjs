// Live test: THE TWO APOTHEOSIS RINGS.
//   · Elementalist B ("Elemental Apotheosis") -> apo_ring, the four-element
//     rune band (per user: "use this ring for elementalist B skill").
//   · Archbishop  ("Apotheosis")              -> holy_ring, a gold halo
//     (per user: "apotheosis needs a holy gold ring").
//
// The archbishop case is the one where the colour heuristic REALLY bit: its
// judgment pulse passes #fff1a0, which IS in _LX_FX_WARRIOR_COLORS, so the
// priest's holy pulse drew the WARRIOR'S TAN DUST RING five times a cast.
//
// On the ELEMENTALIST side the cause was different: no palette collision
// there (#ffee44 and friends miss both sets — asserted below so that wrong
// theory cannot creep back), but every pulse called performAround AND
// spawnSmoothExplosion, so two circles stacked and the soft grey-white
// gradient blob underneath read as dust. That one is fixed with noShock.
//
// Both are asserted through the real tick / real cast and the real draw.
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
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });   // MOJI_GAME_FILE overrides, like the other skill tests
await page.waitForFunction(() => typeof spawnSmoothExplosion === 'function' && typeof drawSmoothFx === 'function'
  && typeof _tickClassIdentity === 'function', null, { timeout: 120000 });
// the ring art streams with LX_FX; wait for decode before asserting on blits
await page.waitForFunction(() => typeof LX_FX !== 'undefined'
  && LX_FX.apo_ring && LX_FX.apo_ring.complete && LX_FX.apo_ring.naturalWidth > 0
  && LX_FX.holy_ring && LX_FX.holy_ring.complete && LX_FX.holy_ring.naturalWidth > 0,
  null, { timeout: 30000 }).catch(() => {});
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

  // ---- ARCHBISHOP: #fff1a0 is genuinely in the warrior palette ----
  out.holyRegistered = !!LX_FX.holy_ring;
  out.holyReady = !!(LX_FX.holy_ring && LX_FX.holy_ring.complete && LX_FX.holy_ring.naturalWidth > 0);
  out.abColourBuckets = _lxFxBucket('#fff1a0');            // -> 'warrior', the bug
  // what the OLD call drew, vs the new one
  const aoeBlit = (opts) => {
    game.smoothFx = [];
    const before = game.monsters; game.monsters = [];
    try { performAround(200, 0.5, opts); } catch (e) {}
    game.monsters = before;
    const fx = game.smoothFx.find(f => f.type === 'explosion');
    if (!fx) { game.smoothFx = []; return { hit: '(none)' }; }
    return blitOf(fx);
  };
  out.abLegacy = aoeBlit({ color: '#fff1a0' });
  out.abNow    = aoeBlit({ color: '#fff1a0', shockSprite: 'holy_ring', shockSpin: 0.012 });

  // LIVE: cast the real archbishop ultimate and collect its shockwaves
  const _st = window.scheduleSkillTimer;
  const _queued = [];
  window.scheduleSkillTimer = (fn) => { _queued.push(fn); };
  game.smoothFx = [];
  player.cls = 'mage'; player.job = 'priest'; player.master = 'archbishop';
  player.hp = 100; player.invulnerable = 0;
  const before2 = game.monsters; game.monsters = [];
  try { SKILL_FNS.archbishop_ult(); } catch (e) { out.abThrew = String(e).slice(0, 120); }
  for (const fn of _queued) { try { fn(); } catch (e) {} }
  game.monsters = before2;
  window.scheduleSkillTimer = _st;
  out.abLive = game.smoothFx.filter(f => f.type === 'explosion')
    .map(f => ({ sprite: f.sprite, col: f.coreCol }));
  game.smoothFx = [];

  // and the LIVE path. Apotheosis v3 (three catastrophe strikes, no hold) —
  // the ring moved from the charge pulses to each strike's departure nova, so
  // the live check casts the real skill three times and reads what the
  // strikes spawn. (Pre-v3 this drove _tickClassIdentity with a fake hold.)
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'elementalist';
  player.hp = 100; player.hitStun = 0; game.dying = 0; player.level = 99; player._god = true;
  const wasPaused = game.paused; game.paused = false;
  player.maxMp = 1000; player.mp = 1000; player.skillCooldowns = {};
  player._apoCharges = 3; player._apoHand = ['fire', 'ice', 'lightning'];
  game.smoothFx = []; game.projectiles = [];
  const spawned = [];
  for (let k = 0; k < 3; k++) {
    player.skillCooldowns = {};
    try { castSkill('elementalist_ult'); } catch (e) {}
    for (const fx of game.smoothFx) if (fx.type === 'explosion' && !fx._seen) { fx._seen = 1; spawned.push({ sprite: fx.sprite, spin: fx.spin, col: fx.coreCol }); }
  }
  game.paused = wasPaused; game.smoothFx = []; game.projectiles = [];
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
ok('LIVE: three real catastrophe strikes each spawn an apo_ring nova, none of them dust',
  r.livePulses.length >= 3 && r.livePulses.every(p => p.sprite === 'apo_ring'),
  { pulses: r.livePulses.length, sprites: [...new Set(r.livePulses.map(p => p.sprite))] });
ok('...with alternating spin direction so the three departures counter-rotate',
  new Set(r.livePulses.map(p => Math.sign(p.spin))).size === 2
    && r.livePulses.every(p => p.spin !== 0),
  { spins: r.livePulses.map(p => p.spin) });
// ---- archbishop ----
ok('the holy halo art is registered and decoded', r.holyRegistered && r.holyReady,
  { registered: r.holyRegistered, ready: r.holyReady });
ok("THE ARCHBISHOP BUG WAS REAL: its pulse colour #fff1a0 buckets as 'warrior'",
  r.abColourBuckets === 'warrior', { bucket: r.abColourBuckets });
ok("...so the priest's holy pulse used to draw the warrior TAN DUST ring",
  r.abLegacy.hit === 'dust_ring', r.abLegacy);
ok('...and now draws the gold halo instead', r.abNow.hit === 'holy_ring', r.abNow);
ok('LIVE: a real Apotheosis cast throws only holy halos, zero dust',
  r.abLive.length >= 5 && r.abLive.every(f => f.sprite === 'holy_ring'),
  { pulses: r.abLive.length, sprites: [...new Set(r.abLive.map(f => f.sprite))], threw: r.abThrew });
ok('the two ultimates stay visually distinct (rune band vs gold halo)',
  r.perColour.every(x => x.hit === 'apo_ring') && r.abNow.hit === 'holy_ring',
  { elementalist: 'apo_ring', archbishop: r.abNow.hit });
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
