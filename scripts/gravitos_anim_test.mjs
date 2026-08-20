// Gravitos animates like a colossus: an eased, crossfaded punch and a
// weighted, blended stride.
//
// Per user: "lets work on smoothening out gravitos, the punch animation very
// choppy and the walk animation can be really much improved."
//
// All the art existed (9-frame punch + walk sets per form) — the drivers were
// the problem:
//   PUNCH  9 frames spread linearly over the whole 1.1-1.5s window (~7fps,
//          hard cuts). Now t^1.55 eased, completing at 85% of the window and
//          holding, drawn as a crossfaded frame PAIR.
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
    && typeof BOSS_WALK_FRAMES !== 'undefined' && ready(BOSS_WALK_FRAMES.gravitos)
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

  // ---- PUNCH ----
  {
    const m = mk('gravitos');
    m.patternState = 'crush';
    const seen = []; let pairTicks = 0, ticks = 0, fadedAlpha = false, frame8At = null, errCt = 0;
    for (let t = 0; t <= 1500; t += 16) {
      m.patternTimer = t; simNow += 16; ticks++;
      const drawn = tick(m, punchArr);
      if (drawn.some(d => d.err)) errCt++;
      const fr = drawn.filter(d => d.i != null);
      if (fr.length >= 2) { pairTicks++; if (fr[1].alpha < 1) fadedAlpha = true; }
      if (fr.length) {
        if (!seen.includes(fr[0].i)) seen.push(fr[0].i);
        if (frame8At === null && fr[0].i === 8) frame8At = t;
      }
    }
    out.punch = { distinct: seen.length, pairTicks, ticks, fadedAlpha, frame8At, errCt };
  }

  // ---- WALK (gravitos vs a human-scale control) ----
  const runWalk = (type) => {
    const m = mk(type);
    m.patternState = 'idle';
    const arr = walkArrs[type];
    const holds = []; let cur = null, curAt = 0, pairTicks = 0, fadedAlpha = false;
    for (let t = 0; t <= 2600; t += 16) {
      simNow += 16;
      m.vx = 2.2; m._animXV = 2; m._walkLatch = true;
      const drawn = tick(m, arr).filter(d => d.i != null);
      if (drawn.length >= 2) { pairTicks++; if (drawn[1].alpha < 1) fadedAlpha = true; }
      if (drawn.length) {
        const f = drawn[0].i;
        if (f !== cur) { if (cur !== null) holds.push(t - curAt); cur = f; curAt = t; }
      }
    }
    const avgHold = holds.length ? Math.round(holds.reduce((a2, b2) => a2 + b2, 0) / holds.length) : 0;
    return { avgHold, frames: holds.length, pairTicks, fadedAlpha };
  };
  out.walkGrav = runWalk('gravitos');
  out.walkBarn = runWalk('young_confused_barnaby');

  performance.now = realNow;
  game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('punch    :', JSON.stringify(r.punch));
console.log('walk grav:', JSON.stringify(r.walkGrav));
console.log('walk barn:', JSON.stringify(r.walkBarn));

const p = r.punch || {}, wg = r.walkGrav || {}, wb = r.walkBarn || {};
ok('the punch plays through all nine frames', p.distinct >= 9, { distinct: p.distinct });
ok('the punch CROSSFADES — two frames drawn, the second fading in',
   p.pairTicks > p.ticks * 0.4 && p.fadedAlpha === true, { pairTicks: p.pairTicks, of: p.ticks });
ok('the punch completes by 85% of its window and holds through recovery (eased, was linear-to-the-end)',
   p.frame8At != null && p.frame8At <= 1300, { frame8At: p.frame8At });
ok('Gravitos strides at a colossus cadence (~130ms/frame, was the global 80ms)',
   wg.avgHold >= 110 && wg.avgHold <= 170, { avgHold: wg.avgHold });
ok('...and his stride crossfades too', wg.pairTicks > 0 && wg.fadedAlpha === true,
   { pairTicks: wg.pairTicks });
ok('a human-scale boss keeps the brisk 80ms cadence it was tuned at',
   wb.avgHold >= 60 && wb.avgHold <= 100, { avgHold: wb.avgHold });
ok('walk frames actually cycle for both', wg.frames >= 8 && wb.frames >= 8,
   { grav: wg.frames, barn: wb.frames });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
