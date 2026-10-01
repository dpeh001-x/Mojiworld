// Riding a megamall escalator (per user: "When riding up escalator in everdawn megaball, the feet should not go below the
// escalator"). The ride carried the feet in a straight line from landing to landing - a shallower slope than the steps drawn
// between the two landing plates - so they floated over the lower steps and sank ~20 px into the upper ones. One page, the real
// ride (_lxMallRideTry / _lxMallRideStep), both escalators, both ways, sampled every 2% of the ride:
//   1. the feet never go below the surface the escalator draws (the plates, the step noses), nor float above it
//   2. every ride still starts at its landing and ends at the other one, on the floor or the deck
//   3. no page errors
// The build before fails 1.   node scripts/megamall_escalator_feet_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11873), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 320) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    window._god = true; player.invulnerable = 1e9;
    loadMap('everdawn_megamall', 900); await sleep(1500);
    const cfg = _lxMallCfg(), gy = cfg.floorY || 480, out = [];
    for (const e of cfg.escalators) for (const up of [true, false]) {
      // the surface the escalator draws, in world space: the bottom plate, the step noses (_lxMallEscGeom's a -> b), the top plate
      const d = Math.sign(e.tx - e.bx) || 1, A = { x: e.bx + d * 26, y: gy }, B = { x: e.tx - d * 26, y: e.top };
      const surf = (x) => { const u = (x - A.x) / (B.x - A.x); return u <= 0 ? gy : u >= 1 ? e.top : A.y + (B.y - A.y) * u; };
      game.paused = false; player._lxRide = null; player.x = (up ? e.bx : e.tx) - player.w / 2; player.y = (up ? gy : e.top) - player.h; player.vx = 0; player.vy = 0; player.onGround = true;
      game.camera.x = Math.max(0, Math.min(game.mapData.worldWidth - W, (up ? e.bx : e.tx) - W / 2));
      const started = typeof _lxMallRideTry === 'function' && _lxMallRideTry(), r = player._lxRide;
      game.paused = true;   // the samples below drive the ride by hand
      let sink = 0, float = 0, first = null, last = null;
      if (started && r) {
        for (let i = 0; i <= 50; i++) {
          r.at = performance.now() - (i / 50) * r.dur * 0.999; player._lxRide = r; _lxMallRideStep();
          const cx = player.x + player.w / 2, feet = player.y + player.h, s = surf(cx);
          sink = Math.max(sink, feet - s); float = Math.max(float, s - feet);
          if (i === 0) first = [Math.round(cx), Math.round(feet)]; last = [Math.round(cx), Math.round(feet)];
        }
        r.at = performance.now() - r.dur * 2; player._lxRide = r; _lxMallRideStep(); last = [Math.round(player.x + player.w / 2), Math.round(player.y + player.h)];
      }
      player._lxRide = null; game.paused = false;
      out.push({ esc: e.bx, up, started: !!started, sink: +sink.toFixed(1), float: +float.toFixed(1), first, last, want: up ? [e.tx, e.top] : [e.bx, gy], from: up ? [e.bx, gy] : [e.tx, e.top] });
    }
    return out;
  });
  ok('1. riding up and down both escalators, the feet never go below the steps or the landing plates (<= 1 px)', R.length === 4 && R.every((r) => r.started && r.sink <= 1), R.map((r) => [r.esc, r.up ? 'up' : 'down', r.sink]));
  ok('1. ...nor float above them (<= 1 px)', R.length === 4 && R.every((r) => r.started && r.float <= 1), R.map((r) => [r.esc, r.up ? 'up' : 'down', r.float]));
  ok('2. every ride starts at its landing and ends at the other one', R.length === 4 && R.every((r) => r.first && Math.abs(r.first[0] - r.from[0]) <= 1 && Math.abs(r.first[1] - r.from[1]) <= 1 && Math.abs(r.last[0] - r.want[0]) <= 1 && Math.abs(r.last[1] - r.want[1]) <= 1), R.map((r) => [r.first, r.last, r.want]));
  ok('3. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
