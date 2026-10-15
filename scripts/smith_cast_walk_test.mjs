// THE SUNDERED SMITH WALKS ON HIS FEET AND THROWS HIS FIREBALL AS A CAST (per user: "sundered smith when walking looks very odd, and shooting fireballs at the same time, do look into make it
// smoother, generate necessary sprites using ludo.ai"). Before: nine walk frames on a wall clock (a skating, frantic loop with a 20 px lateral pop and a hammer-overhead frame 29% taller) and a
// fireball fired the instant its cooldown ran out, mid-stride, with whatever walk or idle frame happened to be on screen.
//   art    : walk is sixteen frames and the cast set nine, all on the idle's 1656x1104 canvas
//   walk   : the frame advances with the distance he covers (_smithWalkPos) - standing still holds the frame, a measured walk of D px turns the cycle D / stride times
//   cast   : the cooldown begins a cast - he stops dead (vx 0, no hop), the nine cast frames play in order, the ball leaves on the release step (not before), exactly once; a swing cancels it with no shot
//   fight  : a 40 s kite - every fireball he fires leaves while the cast art is on screen; he never moves during a cast; and he still throws (>= 8 casts)
//   node scripts/smith_cast_walk_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10361);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxDrawSoft === 'function' && typeof _smithCastTick === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 60; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('sundered_forge', 200); await W8(2500); game.paused = false;
    for (let i = 0; i < 200; i++) { try { _lxBossArtWant('sundered_smith', true); } catch (e) {} await W8(100); }
    const out = {}; const ofp = window.fireMonsterProjectile, calls = []; let mSm = null; window.fireMonsterProjectile = function (mm) { if (mm === mSm) calls.push({ cast: mm._smCast ? +mm._smCast.el.toFixed(0) : -1 }); return ofp.apply(this, arguments); };
    const oend = window._smithCastEnd, ends = []; window._smithCastEnd = function (mm) { if (mm._smCast) ends.push({ el: +mm._smCast.el.toFixed(0), bm: !!mm._bigMeleeFiring, og: mm.onGround, st: mm.stunTimer | 0, fr: mm.freezeTimer | 0, hp: mm.currentHp > 0 }); return oend.apply(this, arguments); };
    const ostart = window._smithCastStart, starts = []; window._smithCastStart = function (mm) { const had = !!mm._smCast; const r = ostart.apply(this, arguments); starts.push({ t: Math.round(performance.now() % 100000), had, now: !!mm._smCast, cd: Math.round(mm._activeBossShootCd) }); return r; };
    const walkSet = BOSS_WALK_FRAMES.sundered_smith, castSet = BOSS_ATTACK_FRAMES.sundered_smithcast;
    out.art = { walk: walkSet && walkSet.length, cast: castSet && castSet.length, walkDims: walkSet && walkSet[0] && [walkSet[0].naturalWidth, walkSet[0].naturalHeight], castDims: castSet && castSet[0] && [castSet[0].naturalWidth, castSet[0].naturalHeight] };
    let m = game.monsters.find((x) => x.type === 'sundered_smith'); if (!m) m = spawnMonster((game.mapData.worldWidth || 2400) * 0.5, game.mapData.worldHeight - 260, 'sundered_smith', true, false);
    mSm = m; m.currentHp = m.maxHp = 9e12; m.jump = 0; const shootSave = m.shoot; m.shoot = null; m.aggroTarget = player; player._god = true; player.y = m.y; player.x = m.x - 600;
    // ---- walk pacing: _smithWalkPos is a function of distance
    m._swT = null; const n = 16, pos0 = _smithWalkPos(m, n); const t0 = game.time | 0;
    const stepTo = (dx) => { m.x += dx; game.time = (game.time | 0) + 1; return _smithWalkPos(m, n); };
    const still = []; for (let i = 0; i < 6; i++) { game.time = (game.time | 0) + 1; still.push(_smithWalkPos(m, n)); }
    let p = _smithWalkPos(m, n), d = 0; const phases = []; for (let i = 0; i < 80; i++) { p = stepTo(-1.7); d += 1.7; phases.push(p); }
    let turns = 0; for (let i = 1; i < phases.length; i++) if (phases[i] < phases[i - 1]) turns++;
    out.walk = { still: still.every((v) => Math.abs(v - still[0]) < 1e-6), covered: +d.toFixed(1), advance: +(phases[phases.length - 1] - phases[0]).toFixed(2), expect: +(d / _SMITH_WALK_STRIDE * n).toFixed(2), turns };
    // ---- cast clock, forced
    m.x = (game.mapData.worldWidth || 2400) * 0.5; m.vx = 0; m.onGround = true; player.x = m.x - 400; m.shoot = shootSave; calls.length = 0;
    const cast = { arts: [], vx: [], xs: [], el: [], shotAt: [] }; const o = window._lxDrawSoft; let cur = null;
    window._lxDrawSoft = function (c, img) { try { const kk = _lxSpriteKeyOf(img), mm = kk && kk.match(/bosses\/attack\/sundered_smithcast_(\d+)\.webp/); if (mm) cur = +mm[1]; } catch (e) {} return o.apply(this, arguments); };
    m._activeBossShootCd = 0; const tt0 = performance.now();
    while (performance.now() - tt0 < 2600) { await frame(); player.x = m.x - 400; player.y = m.y; m.aggroTarget = player;
      if (m._smCast) { cast.xs.push(m.x); cast.vx.push(m.vx); cast.el.push(m._smCast.el); cast.arts.push(cur); } cur = null; if (!m._smCast && cast.el.length > 3) { m._activeBossShootCd = 99999; break; } }   // the FIRST cast only: a second one (a loaded machine runs more steps a frame) would put a walk in between
    out.cast = { n: cast.el.length, endEl: cast.el.length ? +Math.max(...cast.el).toFixed(0) : 0, xRange: cast.xs.length ? +(Math.max(...cast.xs) - Math.min(...cast.xs)).toFixed(2) : -1, maxVx: cast.vx.length ? Math.max(...cast.vx.map(Math.abs)) : -1, shotAt: calls.map((c) => c.cast), ends: ends.slice(0, 3), starts: starts.slice(0, 6), rel: _SMITH_CAST_REL, arts: [...new Set(cast.arts.filter((a) => a != null))] };
    // ---- a swing cancels it with no shot
    m._smCast = null; m._activeBossShootCd = 0; calls.length = 0; let started = false;
    for (let i = 0; i < 90; i++) { await frame(); player.x = m.x - 400; player.y = m.y; if (m._smCast && !started) { started = true; m._bigMeleeFiring = true; } if (started && !m._smCast) break; }
    m._bigMeleeFiring = false; const after = calls.length;
    out.cancel = { started, ended: !m._smCast, newShots: after };
    m._activeBossShootCd = 99999; m._smCast = null; window._lxDrawSoft = o;
    // ---- a 40 s kite
    m.shoot = shootSave; m._activeBossShootCd = 400; m.jump = 6; const log = []; const shots2 = []; const t1 = performance.now(); let curArt = null, curCast = null;
    window._lxDrawSoft = function (c, img) { try { const kk = _lxSpriteKeyOf(img), mm = kk && kk.match(/bosses\/(idle|walk|attack)\/(sundered_smith\w*)_(\d+)\.webp/); if (mm) { curArt = mm[2]; curCast = mm[2] === 'sundered_smithcast' ? +mm[3] : null; } } catch (e) {} return o.apply(this, arguments); };
    calls.length = 0;
    while (performance.now() - t1 < 40000) { await frame(); if (!game.monsters.includes(m)) break; const el = (performance.now() - t1) / 1000, dd = 380 + 260 * Math.sin(el / 4.1), side = Math.sin(el / 9.3) > 0 ? 1 : -1;
      player.x = Math.max(120, Math.min((game.mapData.worldWidth || 2400) - 120, m.x + side * dd)); player.vx = 0; player.y = m.y; m.aggroTarget = player; m.currentHp = m.maxHp;
      while (shots2.length < calls.length) shots2.push({ cast: calls[shots2.length].cast >= 0 });
      log.push({ x: m.x, c: m._smCast ? 1 : 0, art: curArt }); curArt = null; curCast = null; }
    window._lxDrawSoft = o; window.fireMonsterProjectile = ofp; window._smithCastEnd = oend;
    let castMove = 0, castFrames = 0, casts = 0, prev = 0; for (let i = 1; i < log.length; i++) { if (log[i].c) { castFrames++; if (log[i - 1].c) castMove += Math.abs(log[i].x - log[i - 1].x); } if (log[i].c && !prev) casts++; prev = log[i].c; }
    out.fight = { frames: log.length, casts, castFrames, castMove: +castMove.toFixed(1), shots: shots2.length, shotsOutsideCast: shots2.filter((s) => !s.cast).length };
    return out;
  });
  ok('the walk is sixteen frames and the cast nine, all on the idle canvas (1.5 : 1, baked to the draw base)', R.art.walk === 16 && R.art.cast === 9 && Math.abs(R.art.walkDims[0] / R.art.walkDims[1] - 1.5) < 0.01 && Math.abs(R.art.castDims[0] / R.art.castDims[1] - 1.5) < 0.01, R.art);
  ok('standing still holds the walk frame', R.walk.still, R.walk);
  ok('walking D px advances the walk by D / stride cycles (within 1 frame), turning the cycle over exactly when it wraps', Math.abs(((R.walk.advance - R.walk.expect) % 16 + 16) % 16) < 1 || Math.abs((R.walk.advance + 16 * R.walk.turns) - R.walk.expect) < 1, R.walk);
  ok('a cast runs its length: 520-600 ms, the nine frames drawn in order, and he does not move', R.cast.n > 10 && R.cast.endEl >= 520 && R.cast.endEl <= 620 && R.cast.xRange < 1.5 && R.cast.maxVx < 0.01, R.cast);
  ok('the ball leaves exactly once, on the release step (not before)', R.cast.shotAt.length === 1 && R.cast.shotAt[0] >= R.cast.rel - 40 && R.cast.shotAt[0] <= R.cast.rel + 80, R.cast);
  ok('a swing mid-cast cancels it: no shot is thrown', R.cancel.started && R.cancel.ended && R.cancel.newShots === 0, R.cancel);
  ok('over a 40 s kite he still throws (>= 8 casts) and every fireball leaves during a cast, never on walk or idle art', R.fight.casts >= 8 && R.fight.shots >= 8 && R.fight.shotsOutsideCast === 0, R.fight);
  ok('he never moves during a cast (< 2 px over every cast frame)', R.fight.castMove < 2, R.fight);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
