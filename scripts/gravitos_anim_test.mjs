// Gravitos animates like a colossus: an eased punch and a
// weighted, blended stride.
//
// Per user: "lets work on smoothening out gravitos, the punch animation very
// choppy and the walk animation can be really much improved."
//
// All the art existed (9-frame punch + walk sets per form) — the drivers were
// the problem:
//   PUNCH  9 frames spread linearly over the whole 1.1-1.5s window (~7fps,
//          hard cuts). Now t^1.55 eased, completing at 85% of the window and
//          holding, drawn as ONE sprite per frame (v0.30.x: the crossfade is
//          gone per user — "overlapping sprites ... like a shadow style, I do
//          not like that" — replaced by sub-frame motion, asserted below).
//   WALK   one global 80ms cadence for every boss — a 380px colossus at a
//          duelist's step rate — with hard cuts. Now stature-scaled (~130ms
//          for Gravitos, 80ms untouched for human-scale bosses) and blended.
//
// Instrumented at _drawBossSprite (a global function binding — rebinding it
// intercepts every unqualified call, the same technique the boot-gate suite
// uses on castSkill). ctx.drawImage is NOT a reliable spy here: the sprite
// path bakes frames through _lxDrawSoft composites, and _lxShrinkFrames swaps
// decoded Images for canvases with no .src — both lessons from a first version
// of this suite that measured nothing.
//   node scripts/gravitos_anim_test.mjs [port]
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
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawMonster === 'function' && typeof loadMap === 'function',
  null, { timeout: 120000 });
await page.waitForFunction(() => {
  const ready = (arr) => arr && arr.length >= 9 && (arr._readyN >= 9
    || arr.slice(0, 9).every(f => f && ((f.complete && f.naturalWidth > 0) || (!f.src && f.width > 0))));
  return typeof BOSS_ATTACK_FRAMES !== 'undefined' && ready(BOSS_ATTACK_FRAMES.gravitospunch)
    && ready(BOSS_ATTACK_FRAMES.legosaurusdash)
    && typeof BOSS_WALK_FRAMES !== 'undefined' && ready(BOSS_WALK_FRAMES.gravitos)
    && ready(BOSS_WALK_FRAMES.legosaurus)
    && ready(BOSS_WALK_FRAMES.young_confused_barnaby);
}, null, { timeout: 45000 }).catch(() => {});

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  game.paused = true;
  player.x = 500; player.y = 400; game.camera.x = 300; game.camera.y = 0;

  const mk = (type) => {
    const t = monsterTypes[type];
    const m = Object.assign({}, t, { type, name: t.name, w: t.w, h: t.h,
      x: 700, y: 420 - t.h, vx: 0, vy: 0, onGround: true,
      currentHp: Math.floor((t.hp || 1000) * 0.8), maxHp: t.hp || 1000,
      isBoss: true, boss: true, level: t.level || 60, facing: -1, patternState: 'idle', patternTimer: 0 });
    game.monsters.length = 0; game.monsters.push(m);
    return m;
  };
  const idxIn = (arr, img) => (arr ? arr.indexOf(img) : -1);
  const punchArr = BOSS_ATTACK_FRAMES.gravitospunch;
  const walkArrs = { gravitos: BOSS_WALK_FRAMES.gravitos, young_confused_barnaby: BOSS_WALK_FRAMES.young_confused_barnaby };

  const realNow = performance.now.bind(performance);
  let simNow = realNow();
  performance.now = () => simNow;
  const realDBS = _drawBossSprite;

  // one tick: run drawMonster with _drawBossSprite intercepted
  const tick = (m, arr) => {
    const drawn = [];
    _drawBossSprite = function (img, mm, sx, sy, isAtk, b2) {
      const i = idxIn(arr, img);
      if (i >= 0) drawn.push({ i, alpha: +ctx.globalAlpha.toFixed(2) });
      return realDBS.apply(this, arguments);
    };
    try { drawMonster(m); } catch (e) { drawn.push({ err: String(e).slice(0, 60) }); }
    _drawBossSprite = realDBS;
    return drawn;
  };
  // v0.30.x — the smoothing is now a TRANSFORM, so watch ctx.translate: a
  // non-zero offset during a hold is the sub-frame motion doing its job.
  const tickT = (m, frames) => {
    const P = CanvasRenderingContext2D.prototype;
    const ot = P.translate;
    let moved = 0, maxAbs = 0;
    P.translate = function (x, y) {
      if (x || y) { moved++; maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y)); }
      return ot.apply(this, arguments);
    };
    const drawn = tick(m, frames);
    P.translate = ot;
    return { drawn, moved, maxAbs: +maxAbs.toFixed(2) };
  };

  // ---- PUNCH ----
  {
    const m = mk('gravitos');
    m.patternState = 'crush';
    const seen = []; let pairTicks = 0, ticks = 0, fadedAlpha = false, frame8At = null, errCt = 0;
    let moveTicks = 0, maxOff = 0; const arriveAt = {};
    for (let t = 0; t <= 1500; t += 16) {
      m.patternTimer = t; simNow += 16; ticks++;
      const _tt = tickT(m, punchArr);
      const drawn = _tt.drawn;
      if (_tt.moved) { moveTicks++; maxOff = Math.max(maxOff, _tt.maxAbs); }
      if (drawn.some(d => d.err)) errCt++;
      const fr = drawn.filter(d => d.i != null);
      if (fr.length >= 2) { pairTicks++; if (fr[1].alpha < 1) fadedAlpha = true; }
      if (fr.length) {
        if (!seen.includes(fr[0].i)) { seen.push(fr[0].i); arriveAt[fr[0].i] = t; }
        if (frame8At === null && fr[0].i === 8) frame8At = t;
      }
    }
    // gaps between consecutive frame arrivals, and how long frame 8 is held
    const _g = [];
    for (let k = 1; k <= 8; k++) if (arriveAt[k] != null && arriveAt[k - 1] != null) _g.push(arriveAt[k] - arriveAt[k - 1]);
    out.punch = { distinct: seen.length, pairTicks, ticks, fadedAlpha, frame8At, errCt, moveTicks, maxOff,
      gaps: _g, maxGap: _g.length ? Math.max(..._g) : -1,
      hold8: frame8At != null ? 1500 - frame8At : -1 };
  }

  // ---- WALK (gravitos vs a human-scale control) ----
  const runWalk = (type) => {
    const m = mk(type);
    m.patternState = 'idle';
    const arr = walkArrs[type];
    const holds = []; let cur = null, curAt = 0, pairTicks = 0, fadedAlpha = false, moveTicks = 0, maxOff = 0;
    for (let t = 0; t <= 2600; t += 16) {
      simNow += 16;
      m.vx = 2.2; m._animXV = 2; m._walkLatch = true;
      const _tt = tickT(m, arr);
      const drawn = _tt.drawn.filter(d => d.i != null);
      if (_tt.moved) { moveTicks++; maxOff = Math.max(maxOff, _tt.maxAbs); }
      if (drawn.length >= 2) { pairTicks++; if (drawn[1].alpha < 1) fadedAlpha = true; }
      if (drawn.length) {
        const f = drawn[0].i;
        if (f !== cur) { if (cur !== null) holds.push(t - curAt); cur = f; curAt = t; }
      }
    }
    const avgHold = holds.length ? Math.round(holds.reduce((a2, b2) => a2 + b2, 0) / holds.length) : 0;
    return { avgHold, frames: holds.length, pairTicks, fadedAlpha, moveTicks, maxOff };
  };
  out.walkGrav = runWalk('gravitos');
  out.walkBarn = runWalk('young_confused_barnaby');

  // ---- NO GLIDING (per user: attack/idle poses only while planted; a moving
  // boss must draw its stride) ----
  const classify = (m, frames) => {
    // which set is being drawn this tick: punch / walk / other
    const walkArr = BOSS_WALK_FRAMES[m.type] || [];
    const drawn = [];
    const _di2 = _drawBossSprite;
    _drawBossSprite = function (img) {
      if (frames.indexOf(img) >= 0) drawn.push('atkset');
      else if (walkArr.indexOf(img) >= 0) drawn.push('walk');
      else drawn.push('other');
      return _di2.apply(this, arguments);
    };
    try { drawMonster(m); } catch (e) { drawn.push('err'); }
    _drawBossSprite = _di2;
    return drawn[0] || 'none';
  };
  {
    // (a) gravitos mid-crush while MOVING -> must draw the WALK set
    const m = mk('gravitos');
    m.patternState = 'crush'; m.patternTimer = 400;
    let moving = { atkset: 0, walk: 0, other: 0, none: 0, err: 0 };
    for (let i = 0; i < 30; i++) {
      simNow += 16;
      m.vx = 2.4; m._animXV = 2; m._walkLatch = true;   // genuinely moving
      const c = classify(m, punchArr);
      moving[c] = (moving[c] || 0) + 1;
    }
    out.glideMoving = moving;
    // (b) the same crush PLANTED -> the punch set draws (attacks intact)
    m.vx = 0; m._animXV = 0; m._walkLatch = false;
    simNow += 400;   // let the planted window (140ms) elapse with no movement
    let planted = { atkset: 0, walk: 0, other: 0, none: 0, err: 0 };
    for (let i = 0; i < 30; i++) {
      simNow += 16;
      m.vx = 0; m._animXV = 0; m._walkLatch = false;
      m.patternTimer = 400 + i * 16;
      const c = classify(m, punchArr);
      planted[c] = (planted[c] || 0) + 1;
    }
    out.glidePlanted = planted;
    game.monsters.length = 0;
  }
  {
    // (c) the Legosaurus DASH set survives while moving — its motion IS the
    // art, and the v0.29.938 planted gate had silently benched it.
    const m = mk('legosaurus');
    m._braceDashing = true; m._bdPhase = 'dash';
    const dashArr = BOSS_ATTACK_FRAMES.legosaurusdash || [];
    let dash = { atkset: 0, walk: 0, other: 0, none: 0, err: 0 };
    for (let i = 0; i < 30; i++) {
      simNow += 16;
      m.vx = 8; m._animXV = 6; m._walkLatch = true;
      m.atkAnimUntil = performance.now() + 400;
      const c = classify(m, dashArr);
      dash[c] = (dash[c] || 0) + 1;
    }
    out.glideDash = dash;
    game.monsters.length = 0;
  }

  // ---- SUB-FRAME MOTION, measured on the helper itself ----
  // (the ctx.translate spy above also catches the camera / body transforms —
  // it read 570px, which is the camera, not this.)
  {
    const H = 380, N = 9;
    let maxAbs = 0, nonZero = 0, samples = 0, maxStep = 0, prev = null;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 12; k++) {
        const f = k / 12;
        const sm = _bossSubFrameMotion(f, i, N, H);
        samples++;
        const a = Math.max(Math.abs(sm.dx), Math.abs(sm.dy));
        if (a > 0.01) nonZero++;
        maxAbs = Math.max(maxAbs, a);
        if (prev) maxStep = Math.max(maxStep, Math.abs(sm.dx - prev.dx), Math.abs(sm.dy - prev.dy));
        prev = sm;
      }
    }
    // continuity across the loop seam: last sample of the cycle vs the first
    const first = _bossSubFrameMotion(0, 0, N, H);
    const last = _bossSubFrameMotion(11 / 12, N - 1, N, H);
    out.subFrame = {
      samples, nonZero, maxAbs: +maxAbs.toFixed(2), maxStep: +maxStep.toFixed(2),
      seamDy: +Math.abs(last.dy - first.dy).toFixed(2),
    };
  }

  performance.now = realNow;
  game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('punch    :', JSON.stringify(r.punch));
console.log('walk grav:', JSON.stringify(r.walkGrav));
console.log('walk barn:', JSON.stringify(r.walkBarn));
console.log('glide: moving-crush', JSON.stringify(r.glideMoving), '| planted-crush', JSON.stringify(r.glidePlanted), '| lego dash', JSON.stringify(r.glideDash));

const p = r.punch || {}, wg = r.walkGrav || {}, wb = r.walkBarn || {}, sf = r.subFrame || {};
ok('the punch plays through all nine frames', p.distinct >= 9, { distinct: p.distinct });
// v0.30.x — the crossfade is REMOVED (per user: overlapping sprites read as a
// shadow). These two pin the replacement: exactly one sprite per frame, and
// the smoothing carried by a sub-frame TRANSFORM instead.
ok('NO OVERLAPPING SPRITES: the punch draws one frame per tick, never a faded second',
   p.pairTicks === 0 && p.fadedAlpha === false, { pairTicks: p.pairTicks, faded: p.fadedAlpha, of: p.ticks });
ok('...and is smoothed by sub-frame MOTION instead: a small, continuous, always-moving offset',
   sf.nonZero > sf.samples * 0.8 && sf.maxAbs > 0.3 && sf.maxAbs < 8 && sf.maxStep < 1.5 && sf.seamDy < 1.0,
   sf);
// v0.30.x — per user: "reduce the time gap and just hold the last frame
// slightly longer". Both measured off the real frame arrivals.
ok('the punch has TIGHTER gaps now — no long stall on the windup frame (was 333ms)',
   p.maxGap > 0 && p.maxGap <= 190, { maxGap: p.maxGap, gaps: p.gaps });
ok('...and the gaps are near-even rather than front-loaded (max is under 1.9x the min)',
   p.gaps && p.gaps.length >= 7 && p.maxGap <= Math.min(...p.gaps) * 1.9,
   { min: p.gaps && Math.min(...p.gaps), max: p.maxGap });
ok('...and the LANDED POSE holds longer (was 225ms of the 1500ms window)',
   p.hold8 >= 450 && p.hold8 <= 800, { frame8At: p.frame8At, hold8: p.hold8 });
// v0.30.x — QUICKER STRIDE (per user: "play the sprite animation faster ...
// less time gap between the frames"). v0.29.952's 130ms colossus cadence is
// reversed: the stature term now only speeds it up.
ok('Gravitos strides QUICKLY now (well under the old 130ms, and under the 80ms base)',
   wg.avgHold > 0 && wg.avgHold < 80, { avgHold: wg.avgHold });
ok('...his stride is single-sprite too (the same sub-frame motion carries it)',
   wg.pairTicks === 0 && wg.fadedAlpha === false,
   { pairTicks: wg.pairTicks, faded: wg.fadedAlpha });
ok('a human-scale boss also quickened (was 80ms, now under it) and stays quicker than none',
   wb.avgHold > 0 && wb.avgHold < 80, { avgHold: wb.avgHold });
ok('the colossus is no SLOWER than the human-scale boss any more (v0.29.952 had him 1.65x slower)',
   wg.avgHold <= wb.avgHold + 8, { grav: wg.avgHold, barn: wb.avgHold });
ok('walk frames actually cycle for both', wg.frames >= 8 && wb.frames >= 8,
   { grav: wg.frames, barn: wb.frames });
const gm = r.glideMoving || {}, gp = r.glidePlanted || {}, gd = r.glideDash || {};
ok('NO GLIDING: a moving boss never draws its attack pose — the stride plays',
   (gm.atkset || 0) === 0 && (gm.walk || 0) >= 25, gm);
ok('...while a PLANTED attack still draws the attack set (attacks intact)',
   (gp.atkset || 0) >= 25 && (gp.walk || 0) === 0, gp);
ok('the Legosaurus dash keeps its authored motion set while moving (v0.29.938 had benched it)',
   (gd.atkset || 0) >= 25, gd);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
