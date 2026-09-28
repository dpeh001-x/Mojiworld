// A monster's proximity swing lands ON ITS STRIKE FRAME. v0.30.1310 opened the swing's hit (_lxSwingReachHit) at a
// fixed 40% of the swing, but each monster's strike (its longest-held frame: the blow, picked from its art) sits anywhere
// from 30% to 80% of it: the Elderbark hit you 0.3 s before its slam was drawn, a Thunderpork 0.07 s after its spark.
// (Also pinned: the FIRST proximity swing of a type was timed over one frame, fixed in v0.30.1331 (its decoded-frame count is only tallied while it
// is drawn attacking): an 86 ms "swing" whose hit opened 34 ms in, on frame 0, and whose rest ran out before it ended.)
// For each monster below (early, middle and late strikes, one flier), its first swing and the next, on a controlled clock:
//  - the hit window opens within 4 ms of the strike frame first being drawn, and the frame on screen then IS the strike
//  - the swing is timed over all its frames, the window running from the strike to its end
//   node scripts/prox_strike_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11795);
const TYPES = ['sparkSprite', 'blockEle', 'skeleton', 'seraph', 'fatDragon', 'elderbark'];   // blows at 30%, 30%, 48%, 49% (a flier), 57%, 80% (its last frame) of the swing
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
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__psHold = setInterval(hold, 1);   // no live step between samples
    player.x = 900; player.y = 480 - player.h; player.vx = 0; player.vy = 0; game.camera.x = 420; game.camera.y = 0;
    for (const type of TYPES) {
      game.monsters.length = 0;
      const m = spawnMonster(player.x, 480 - 140, type, false, false) || game.monsters[game.monsters.length - 1];
      // centres half a monster-width apart: inside the swing's reach (1.2 w) and its hit box, on the ground
      m.x = player.x + player.w / 2; m.y = 480 - m.h; m.onGround = true; m.vx = 0; m.vy = 0; m.facing = -1;
      const set = _monsterFramesFor(type), t0w = performance.now();
      while (!(set.attack && set.attack.filter((f) => f && f.complete && f.naturalWidth > 0).length === set.attack.length && set.attack.length >= 9) && performance.now() - t0w < 30000) { _monsterStateFrame(m); await sleep(50); }
      const ft = _lxCalibFt(type, 'attack'); let strike = 0, b = -1; ft.forEach((v, i) => { if (v > b) { b = v; strike = i; } });
      m._animPX = m.x; m._animXV = 0; m._walkLatch = false; m.atkAnimUntil = 0; m._swingUntil = 0; m._proxRestUntil = 0; m._proxAtk = false;
      m._animSt = null; m._atkStrikeMs = undefined; m._swStrikeAt = 0; m._swHitDone = false; m._shootWindup = 0; m._postShotHold = 0;
      // the picker and the hit test both read performance.now(): run them on a CONTROLLED clock, 2 ms a step
      // TWO swings: the first of a fresh type (its decoded-frame count not yet tallied) and the next one after its rest
      const P = performance, orig = P.now, t0 = orig.call(P); let t = t0, sw = null, lastStamp = 0; const swings = [], seen = [];
      P.now = () => t;
      try {
        for (let e = 0; e <= 3600 && swings.length <= 2; e += 2) { t = t0 + e; m.x = player.x + player.w / 2; m.vx = 0;
          const f = set.attack.indexOf(_monsterStateFrame(m)); if (!seen.length || seen[seen.length - 1][1] !== f) seen.push([e, f]);
          if (m._swStrikeAt > 0 && m._swStrikeAt !== lastStamp) { lastStamp = m._swStrikeAt; if (swings.length === 2) break;
            sw = { start: e, strikeAt: -1, hitAt: -1, frameAtHit: -1, open: 0, swingMs: Math.round(m._swStrikeEnd - t) }; swings.push(sw); }
          if (!sw) continue;
          if (sw.strikeAt < 0 && f === strike) sw.strikeAt = e - sw.start;
          if (_lxSwingReachHit(m)) { sw.open++; if (sw.hitAt < 0) { sw.hitAt = e - sw.start; sw.frameAtHit = f; } } }
      } finally { P.now = orig; }
      out[type] = { strike, ft: ft.join('/'), swings: swings.map((x) => ({ strikeAt: x.strikeAt, hitAt: x.hitAt, frameAtHit: x.frameAtHit, openMs: x.open * 2, swingMs: x.swingMs })), frames: seen.map((x) => x[0] + ':f' + x[1]).join(' ') };
    }
    clearInterval(window.__psHold); game.monsters.length = 0; return out;
  }, TYPES);
  for (const type of TYPES) { const r = R[type];
    ['first', 'second'].forEach((nm, i) => { const w = r.swings[i] || { strikeAt: -1, hitAt: -1, frameAtHit: -1, openMs: 0, swingMs: 0 };
      check(w.strikeAt > 0 && w.hitAt > 0 && Math.abs(w.hitAt - w.strikeAt) <= 4 && w.frameAtHit === r.strike,
        `${type}, ${nm} swing: lands on its strike frame (f${r.strike} drawn at ${w.strikeAt} ms; the hit opened at ${w.hitAt} ms)`, Object.assign({ ft: r.ft }, w));
      check(w.hitAt > 0 && w.swingMs > 600 && Math.abs(w.openMs - (w.swingMs - w.hitAt)) <= 6,
        `${type}, ${nm} swing: timed over its whole swing (${w.swingMs} ms), the window running from the strike to its end`, w); });
    if (bad) console.log('   frames: ' + r.frames); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${total - bad}/${total} checks passed`); process.exit(bad ? 1 : 0);
