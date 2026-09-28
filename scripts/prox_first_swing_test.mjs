// A monster's FIRST proximity swing is timed like every other one. The decoded-frame count it is measured over is only
// tallied while a monster is drawn attacking (and every frame bake resets it to 0), so the first proximity swing of a
// type read 0 - and Math.max(1, 0) || n is 1: a ONE-frame, 86 ms swing whose hit (_lxSwingReachHit, v0.30.1310) opened
// 34 ms in, on frame 0, and whose rest ran out before the swing did, so it swung again at once.
// For each monster below (strikes early to late, one flier), its first swing and the next, on a controlled clock:
//  - the first swing is timed over all its frames (its baked timing's total), the same as the second
//  - its hit opens at the same moment of the swing as the second's, on the same frame
//  - the full rest (LX_MOB_SWING_REST_MS) follows it before the next swing
//   node scripts/prox_first_swing_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11799);
const TYPES = ['blockGary', 'anglerfish', 'skeleton', 'zombie', 'mummy', 'seraph'];   // baked strikes f2, f3, f5, f6, f7, f7 (flier)
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _monsterStateFrame === 'function' && typeof _lxSwingReachHit === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async (TYPES) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('stardustAtrium'); await sleep(3500); player._god = true;
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__pfHold = setInterval(hold, 1);   // no live step between samples
    player.x = 900; player.y = 480 - player.h; player.vx = 0; player.vy = 0; game.camera.x = 420; game.camera.y = 0;
    for (const type of TYPES) {
      game.monsters.length = 0;
      const m = spawnMonster(player.x, 480 - 140, type, false, false) || game.monsters[game.monsters.length - 1];
      // centres half a monster-width apart: inside the swing's reach (1.2 w) and its hit box, on the ground
      m.x = player.x + player.w / 2; m.y = 480 - m.h; m.onGround = true; m.vx = 0; m.vy = 0; m.facing = -1;
      const set = _monsterFramesFor(type), t0w = performance.now();
      // the art decodes while the monster only stands: nothing draws it attacking, so its frame count is never tallied
      while (!(set.attack && set.attack.length >= 9 && set.attack.filter((f) => f && f.complete && f.naturalWidth > 0).length === set.attack.length) && performance.now() - t0w < 30000) { _monsterStateFrame(m); await sleep(50); }
      const ft = _lxCalibFt(type, 'attack');
      m._animPX = m.x; m._animXV = 0; m._walkLatch = false; m.atkAnimUntil = 0; m._swingUntil = 0; m._proxRestUntil = 0; m._proxAtk = false;
      m._animSt = null; m._atkStrikeMs = undefined; m._swStrikeAt = 0; m._swHitDone = false; m._shootWindup = 0; m._postShotHold = 0;
      // the picker and the hit test both read performance.now(): run them on a CONTROLLED clock, 2 ms a step
      const P = performance, orig = P.now, t0 = orig.call(P); let t = t0, sw = null, lastStamp = 0; const swings = [], seen = [];
      P.now = () => t;
      try {
        for (let e = 0; e <= 2800; e += 2) { t = t0 + e; m.x = player.x + player.w / 2; m.vx = 0;
          const f = set.attack.indexOf(_monsterStateFrame(m)); if (!seen.length || seen[seen.length - 1][1] !== f) seen.push([e, f]);
          if (m._swStrikeAt > 0 && m._swStrikeAt !== lastStamp) { lastStamp = m._swStrikeAt; if (swings.length === 2) break;
            sw = { start: e, hitAt: -1, frameAtHit: -1, open: 0, swingMs: Math.round(m._swStrikeEnd - t) }; swings.push(sw); }
          if (sw && _lxSwingReachHit(m)) { sw.open++; if (sw.hitAt < 0) { sw.hitAt = e - sw.start; sw.frameAtHit = f; } } }
      } finally { P.now = orig; }
      out[type] = { total: ft.reduce((q, v) => q + v, 0), rest: LX_MOB_SWING_REST_MS, ft: ft.join('/'),
        swings: swings.map((x) => ({ start: x.start, hitAt: x.hitAt, frameAtHit: x.frameAtHit, openMs: x.open * 2, swingMs: x.swingMs })), frames: seen.map((x) => x[0] + ':f' + x[1]).join(' ') };
    }
    clearInterval(window.__pfHold); game.monsters.length = 0; return out;
  }, TYPES);
  for (const type of TYPES) { const r = R[type], a = r.swings[0] || {}, b = r.swings[1] || {};
    check(Math.abs(a.swingMs - r.total) <= 2 && Math.abs(a.swingMs - b.swingMs) <= 2, `${type}: its first swing is timed over all its frames (${a.swingMs} ms; the next ${b.swingMs}, its timing ${r.total})`, { first: a, second: b });
    check(a.hitAt > 0 && Math.abs(a.hitAt - b.hitAt) <= 4 && a.frameAtHit === b.frameAtHit, `${type}: its first swing lands when the next one does (${a.hitAt} vs ${b.hitAt} ms in, frame ${a.frameAtHit} vs ${b.frameAtHit})`, { first: a, second: b });
    check(b.start - a.start >= r.total + r.rest - 4, `${type}: the full rest follows its first swing (next swing ${b.start - a.start} ms after it began, needs ${r.total + r.rest})`, { firstStart: a.start, secondStart: b.start });
    if (bad) console.log('   frames: ' + r.frames); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
