// Stepped ground becomes a ramp you walk, not a step you pop up.
//
// Per user: "some parts with jagged floors there can be a slope or smoothing done". Sauro Slope, Dune Sands, Octopus
// Grotto and Lava Cavern build their rises from ground pieces at different heights - 28 steps of 2-28px. Walking into a
// higher piece snapped the hero up the whole rise in one frame, and walking off one dropped them through the air. Each
// step is now a ramp laid on the lower piece (_lxGroundRamps), collision follows it and it is painted over the seam.
// On Dune Sands, stepping the physics by hand:
//   1. walking up a 20px rise the feet never rise more than 4px in a step, and never leave the ground;
//   2. walking down a 16px drop the feet never fall more than 4px in a step, and never leave the ground;
//   3. both walks end level on the far piece;
//   4. the ramp is painted: beside the riser, where the step left backdrop, the floor is now drawn.
// The build before fails 1, 2 and 4.   node scripts/ground_ramp_test.mjs    MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11731), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._god = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('duneSands', 300);
    for (let i = 0; i < 20; i++) { const g0 = game.time; await sleep(300); try { game.monsters.length = 0; } catch (e) {} if (game.time - g0 >= 12) break; }
    // the steps, read off the platforms (not off the game's ramp helper, so the build before is measured the same way)
    const g = game.mapData.platforms.filter((p) => p.type === 'ground').sort((a, b) => a.x - b.x), steps = [];
    for (let i = 0; i + 1 < g.length; i++) { const a = g[i], b = g[i + 1]; if (Math.abs(b.x - (a.x + a.w)) <= 3 && a.y !== b.y) steps.push({ a, b, seam: (a.x + a.w + b.x) / 2, dy: b.y - a.y }); }
    const rise = steps.filter((s) => s.dy <= -12).sort((p, q) => p.dy - q.dy)[0], drop = steps.filter((s) => s.dy >= 12).sort((p, q) => q.dy - p.dy)[0];
    out.rise = rise && { seam: rise.seam, dy: rise.dy }; out.drop = drop && { seam: drop.seam, dy: drop.dy };
    if (!rise || !drop) return out;
    // 4 first, with the loop running: stand by the riser and compare the frame with and without the floors
    const put = (x, gy) => { player.x = x - player.w / 2; player.y = gy - player.h; player.vx = 0; player.vy = 0; player.onGround = true; };
    put(rise.seam + (rise.seam > 700 ? -330 : 330), Math.min(rise.a.y, rise.b.y)); for (const k in game.keys) game.keys[k] = false;
    for (let i = 0; i < 9; i++) { await sleep(120); game.monsters.length = 0; }
    const cv = document.getElementById('game'), cg = cv.getContext('2d'), k = cv.width / (typeof W === 'number' ? W : cv.width), camY = (game.camera && game.camera.y) || 0;
    const sx = rise.seam - 7 - game.camera.x, sy = rise.a.y - Math.abs(rise.dy) * 0.3 - camY;
    const px = () => { const dd = cg.getImageData(Math.round(sx * k) - 1, Math.round(sy * k) - 1, 3, 3).data; const m = [0, 0, 0]; for (let i = 0; i < dd.length; i += 4) { m[0] += dd[i] / 9; m[1] += dd[i + 1] / 9; m[2] += dd[i + 2] / 9; } return m.map(Math.round); };
    const fm = () => { const dd = cg.getImageData(0, 0, cv.width, cv.height).data; let t = 0; for (let i = 0; i < dd.length; i += 400) t += dd[i] + dd[i + 1] + dd[i + 2]; return Math.round(t / (dd.length / 400) / 3); };
    for (let i = 0; i < 40 && fm() < 15; i++) { await sleep(200); game.monsters.length = 0; }   // the first map after boot fades in from black
    const withF = px(); const od = window._drawCutePlatform, orr = window._lxDrawRamp;
    window._drawCutePlatform = function () {}; if (orr) window._lxDrawRamp = function () {};
    await sleep(250); const noF = px(); window._drawCutePlatform = od; if (orr) window._lxDrawRamp = orr;
    out.paint = { at: [Math.round(sx), Math.round(sy)], cam: Math.round(game.camera.x), camY, k, frameMean: fm(), withF, noF, diff: Math.abs(withF[0] - noF[0]) + Math.abs(withF[1] - noF[1]) + Math.abs(withF[2] - noF[2]) };
    // 1-3 with the loop paused: hold a direction and step the player by hand
    game.paused = true;
    const walk = (x0, gy, key, until) => {
      put(x0, gy); for (const kk in game.keys) game.keys[kk] = false; game.keys[key] = true;
      const feet = [], air = []; let n = 0;
      while (n++ < 400) { game.time++; try { game.monsters.length = 0; updatePlayer(16); } catch (e) {} feet.push(player.y + player.h); air.push(!player.onGround); if (until(player.x + player.w / 2)) break; }
      game.keys[key] = false;
      let up = 0, down = 0; for (let i = 1; i < feet.length; i++) { up = Math.max(up, feet[i - 1] - feet[i]); down = Math.max(down, feet[i] - feet[i - 1]); }
      return { steps: feet.length, maxRise: +up.toFixed(2), maxDrop: +down.toFixed(2), airborne: air.filter(Boolean).length, endFeet: Math.round(feet[feet.length - 1]) };
    };
    const hiR = rise.b, loD = drop.b;
    out.up = walk(rise.seam - 110, rise.a.y, 'arrowright', (cx) => cx > rise.seam + 40); out.up.want = hiR.y;
    out.down = walk(drop.seam - 60, drop.a.y, 'arrowright', (cx) => cx > drop.seam + 110); out.down.want = loD.y;
    game.paused = false;
    return out;
  });
  if (!r.rise || !r.drop) ok('Dune Sands has a 12px+ rise and drop to walk', false, r);
  else {
    ok(`walking up a ${-r.rise.dy}px rise: the feet never rise more than 4px in a step (no pop) and never leave the ground`, r.up.maxRise <= 4 && r.up.airborne === 0, r.up);
    ok(`walking down a ${r.drop.dy}px drop: the feet never fall more than 4px in a step and never leave the ground`, r.down.maxDrop <= 4 && r.down.airborne === 0, r.down);
    ok('both walks end level on the far piece', Math.abs(r.up.endFeet - r.up.want) <= 1 && Math.abs(r.down.endFeet - r.down.want) <= 1, { up: [r.up.endFeet, r.up.want], down: [r.down.endFeet, r.down.want] });
    ok('the ramp is painted: beside the riser, where the step showed backdrop, the floor is drawn', r.paint && r.paint.diff > 40, r.paint);
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
