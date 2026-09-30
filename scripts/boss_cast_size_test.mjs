// A BOSS KEEPS ITS SIZE WHEN A CAST SET TAKES OVER (v0.30.1470). Per user (a recording): "krook has a sprite that suddenly
// becomes small then back to normal again". A cast set's key (King Krook's kingKrookstomp, Aetherion's astral, the Gravitos
// punch / soul / laser sets) was set the moment its pattern began, but its art only draws once the boss is PLANTED (no
// movement for 140 ms). In between, his idle / walk frame was drawn under the cast set's key, so it took the cast set's size
// calibration - kingKrookstomp has only an attack entry, so idle fell back to s 1 against his own 1.6: 62% size for the
// first ~0.2 s of every stomp that began on the move.
//   1. a stomp that starts while he walks: every body frame of its first 500 ms is drawn at his own size (within 6% of
//      his idle or walk height, both measured first);
//   2. the body frames drawn before he plants are his own (idle / walk), and the stomp art still takes over once he plants;
//   3. the stomp art itself is drawn at his size (the attack calibration is untouched);
//   4. the same for Aetherion's Astral Judgement (idle s 1.58, the astral set attack-only; it grew his body 1.8x).
//   node scripts/boss_cast_size_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10281); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _drawBossSprite === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(1500); game.paused = false; player._god = true; player.invulnerable = 1e9;
    // the effective drawn height of the boss body: the tallest drawImage inside one _drawBossSprite call, through the transform
    let cur = null; const rec = []; window.__raf = 0; window.__dbs = 0; (function tick() { window.__raf++; requestAnimationFrame(tick); })();
    const oD = window._drawBossSprite, P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;
    window._drawBossSprite = function (sprite, m) {
      window.__dbs++; const mine = !!(m && m === window.__lxWatch); if (mine) cur = { h: 0, atk: !!arguments[4], ps: m.patternState, pt: m.patternTimer | 0, key: m._gravStarKey || m._aeAstralKey || null, t: performance.now() };
      try { return oD.apply(this, arguments); } finally { if (mine && cur) { rec.push(cur); cur = null; } }
    };
    P.drawImage = function (img) { if (cur && this === ctx) { const a = arguments, t = this.getTransform(); const dh = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : (img.naturalHeight || img.height); let fr = 1; try { const b = _spriteContentBox(img), sh = img.naturalHeight || img.height; if (b && b.bottom > b.top && sh) fr = (b.bottom - b.top + 1) / sh; } catch (e) {} const eh = Math.abs(dh * Math.hypot(t.b, t.d)) * fr; if (eh > cur.h) cur.h = eh; } return oDI.apply(this, arguments); };
    const run = async (type, castKey, start, stop, castState) => {
      const out = { type };
      game.monsters.length = 0; const floor = player.y + player.h;
      const got = spawnMonster(player.x + 420, floor - monsterTypes[type].h, type, true); const m = (got && got.type) ? got : game.monsters.filter((x) => x && x.type === type).pop();
      if (!m) return Object.assign(out, { err: 'no ' + type });
      m.currentHp = m.maxHp = 1e12; window.__lxWatch = m;
      const hold = async (ms, fn) => { const e = performance.now() + ms; while (performance.now() < e) { fn(); player.x = m.x - 320; player.vx = 0; await sleep(16); } };   // the camera follows the player: he stays in view
      // decode: his idle set and the cast set (a warm-up cast loads it), then settle back to idle
      const ready = (fr) => fr && fr.length && fr.every((f) => f && ((f.complete && f.naturalWidth > 0) || f.tagName === 'CANVAS'));
      for (let i = 0; i < 3; i++) { start(m); await hold(1600, () => {}); stop(m); await hold(400, () => {}); }
      const t0 = performance.now(); while (!(ready(BOSS_IDLE_FRAMES[type]) && ready(BOSS_ATTACK_FRAMES[castKey])) && performance.now() - t0 < 30000) await sleep(200);
      out.decoded = ready(BOSS_IDLE_FRAMES[type]) && ready(BOSS_ATTACK_FRAMES[castKey]);
      // his idle height, planted and still
      const x0 = m.x; const still = () => { stop(m); m.vx = 0; m.x = x0; };
      await hold(1200, still); rec.length = 0; await hold(600, still);
      const idleH = rec.filter((r) => r.h > 0).map((r) => r.h).sort((a, b) => a - b); if (!idleH.length) return Object.assign(out, { err: 'no idle draws of ' + type + ' (off screen or a starved frame rate)' }); out.idleH = +idleH[idleH.length >> 1].toFixed(1);
      // walk, then start the cast on the move (the way the AI starts it: patternState + timer at 0). The boss's own machine
      // can call a forced cast off (the shared boss code resets patterns from outside), so an attempt counts only when the
      // cast really ran through the first 400 ms; up to four attempts, each from a planted idle.
      out.attempts = 0;
      for (let at = 0; at < 4; at++) {
        out.attempts++;
        await hold(500, still);
        rec.length = 0; await hold(700, () => { stop(m); m.vx = 3; m.facing = 1; });
        const wk = rec.slice(-12).filter((r) => r.h > 0).map((r) => r.h).sort((a, b) => a - b); out.walkR = wk.length ? +(wk[wk.length >> 1] / out.idleH).toFixed(3) : 1;
        rec.length = 0; const tc = performance.now(); const _r0 = window.__raf, _d0 = window.__dbs, _g0 = game.time;
        start(m);
        await hold(900, () => {});
        const w = rec.filter((r) => r.h > 0 && r.ps === castState).map((r) => ({ dt: Math.round(r.t - tc), r: +(r.h / out.idleH).toFixed(3), st: r.atk ? 'attack' : 'body', key: r.key }));
        out.early = w.filter((x) => x.dt < 500); out.late = w.filter((x) => x.dt >= 500);
        out.started = w.length > 0 && w[0].dt < 100 && w.some((x) => x.dt >= 400);
        if (out.started && out.early.length >= 6) { out.diag = null; break; }
        out.diag = { raf: window.__raf - _r0, bossDraws: window.__dbs - _d0, gameTime: game.time - _g0, states: [...new Set(rec.map((r) => r.ps))], ps: m.patternState, onScreenX: Math.round(m.x - game.camera.x) };
      }
      stop(m); m.currentHp = 0; window.__lxWatch = null;
      return out;
    };
    const res = {};
    try { res.krook = await run('kingKrook', 'kingKrookstomp', (m) => { m.patternState = 'stomp'; m.patternTimer = 0; m._kAnnounced = false; m._kFired = false; }, (m) => { m.patternState = 'idle'; m.patternTimer = 0; }, 'stomp'); } catch (e) { res.krook = { err: String(e.message).slice(0, 160) }; }
    try { res.aeth = await run('aetherion', 'aetherionastral', (m) => { if (m._ae) { m._ae.st = 'astral'; m._ae.t = 0; m._ae.astralFired = false; } }, (m) => { if (m._ae) { m._ae.st = 'idle'; m._ae.t = 0; } m.patternState = 'idle'; }, 'astral'); } catch (e) { res.aeth = { err: String(e.message).slice(0, 160) }; }
    window._drawBossSprite = oD; P.drawImage = oDI;
    return { ver: GAME_VERSION, res };
  });
  console.log('build ' + R.ver);
  const k = R.res.krook, a = R.res.aeth;
  const span = (arr) => arr && arr.length ? [Math.min(...arr.map((x) => x.r)), Math.max(...arr.map((x) => x.r))] : null;
  const band = (o, x) => x.st === 'attack' ? Math.abs(x.r - 1) <= 0.15 : (x.r >= Math.min(1, o.walkR) * 0.94 && x.r <= Math.max(1, o.walkR) * 1.06);
  const brief = (arr) => (arr || []).filter((x, i) => i % 3 === 0).slice(0, 12).map((x) => x.dt + 'ms ' + x.r + ' ' + x.st);
  if (k.diag) console.log('krook diag ' + JSON.stringify(k.diag)); if (a.diag) console.log('aeth diag ' + JSON.stringify(a.diag));
  const bad = (o) => o.err || (!o.decoded && 'frames did not decode') || (!o.started && 'the cast did not run through its first 400 ms in ' + o.attempts + ' attempts') || ((o.early || []).length < 6 && 'under 6 draws in 500 ms (a starved headless frame rate - rerun alone)');
  if (bad(k)) ok('King Krook harness: ' + bad(k), false, k.diag || null);
  else {
    ok('King Krook: a stomp that starts on the move - every frame of its first 500 ms is his own size (body within 6% of his idle / walk)', k.early.every((x) => band(k, x)), { idleH: k.idleH, walkR: k.walkR, span: span(k.early), frames: brief(k.early) });
    ok('...he draws his own body frames until he plants, then the stomp art takes over', k.early.some((x) => x.st === 'body') && k.late.some((x) => x.st === 'attack'), { early: [...new Set(k.early.map((x) => x.st))], late: [...new Set(k.late.map((x) => x.st))] });
    ok('...and the stomp art is drawn at his size (its calibration unchanged)', k.late.filter((x) => x.st === 'attack').length >= 5 && k.late.filter((x) => x.st === 'attack').every((x) => Math.abs(x.r - 1) <= 0.15), { span: span(k.late.filter((x) => x.st === 'attack')) });
  }
  if (bad(a)) ok('Aetherion harness: ' + bad(a), false, a.diag || null);
  else ok('Aetherion: Astral Judgement starting on the move keeps his size too (body within 6% of his idle / walk)', a.early.every((x) => band(a, x)), { idleH: a.idleH, walkR: a.walkR, span: span(a.early), frames: brief(a.early) });
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
