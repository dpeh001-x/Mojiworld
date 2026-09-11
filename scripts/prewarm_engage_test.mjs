// A pack is ready before you reach it: the monster prewarm prepares every set on its own.
//
// Per user: "Work on improving the lag when fighting multiple monsters". The engage probe
// (scripts/perf_engage_probe.mjs) found the hitch: the prewarm would not bake a frame until the DRAW
// path had shrunk its set, so a pack the player had not reached yet was never prepared, and attack
// frames were never queued at all. Engaging such a pack minted 98 sync pins and 80-120 downscales in
// one second - 10 frames drawn, the worst 224 ms. This spawns 28 monsters of 8 types out of sight,
// never draws them, and checks that every idle, walk and attack set is shrunk within 9 s, that
// engaging them then mints almost nothing, and that the calm map does not hitch while it works.
//   node scripts/prewarm_engage_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11691), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxPrewarmDrain === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; loadMap('forest', 300); game.paused = false; });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const types = Object.keys(monsterTypes).slice(0, 8);
    const ww = (game.mapData && game.mapData.worldWidth) || 2400, px = Math.max(120, Math.min(player.x, ww * 0.25)), gx = Math.min(ww - 260, px + 1300);
    player.x = px; game.paused = false;
    const odm = window.drawMonster; window.drawMonster = function () {};   // out of sight: nothing prepares the pack by drawing it
    for (let i = 0; i < 28; i++) try { spawnMonster(gx + (i % 7 - 3) * 60, player.y - 40, types[i % types.length]); } catch (e) {}
    const sets = []; for (const ty of types) { const st = _monsterFramesFor(ty); for (const mode of ['idle', 'walk', 'attack']) { const a = st && st[mode]; if (Array.isArray(a) && a.length) sets.push({ ty, mode, a }); } }
    // prepared = drawing it mints nothing: the slot is a canvas (its bake or pin), its pin already exists, or it is a 404; _lxShrunk
    // itself is only stamped by the next scan, which nothing makes until the pack is drawn
    const prepared = (im) => !im || im.tagName === 'CANVAS' || (typeof _lxPinCache !== 'undefined' && _lxPinCache.has(im)) || (im.complete && !(im.naturalWidth > 0));
    const final = (s) => s.a.every(prepared);
    const t0 = performance.now(), dts = []; let readyMs = -1, last = t0;
    while (performance.now() - t0 < 9000) {
      game.paused = false; await new Promise((res) => requestAnimationFrame(res)); const now = performance.now(); dts.push(now - last); last = now;
      if (readyMs < 0 && sets.every(final)) readyMs = now - t0;
      if (readyMs >= 0 && now - t0 > readyMs + 500) break;
    }
    window.drawMonster = odm;
    const unready = sets.filter((s) => !final(s)).map((s) => s.ty + '/' + s.mode + ':' + s.a.filter((im) => !prepared(im)).length);
    const oce = document.createElement, made = { pins: 0, plain: 0 };
    document.createElement = function (t, ...x) { if (String(t).toLowerCase() === 'canvas') { const s = (new Error().stack || '').split('\n')[2] || ''; if (/_lxPinned/.test(s)) made.pins++; else if (/_lxPlainOf/.test(s)) made.plain++; } return oce.call(document, t, ...x); };
    player.x = gx - 30; player.vx = 0; const e0 = performance.now(); let frames = 0, worst = 0, l2 = e0;
    while (performance.now() - e0 < 1000) { game.paused = false; await new Promise((res) => requestAnimationFrame(res)); const n = performance.now(); worst = Math.max(worst, n - l2); l2 = n; frames++; }
    document.createElement = oce; dts.sort((a, b) => a - b);
    return { types, sets: sets.length, attackSets: sets.filter((s) => s.mode === 'attack').length, readyMs: Math.round(readyMs), unready, calm: { frames: dts.length, p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), max: +dts[dts.length - 1].toFixed(1) }, engage: { frames, worst: +worst.toFixed(1), ...made } };
  });
  console.log(JSON.stringify(r));
  ok(`every frame of every idle, walk and attack set is prepared while the pack is out of sight (${r.sets} sets, ready in ${r.readyMs} ms)`, r.sets > 0 && r.unready.length === 0, r.unready.slice(0, 8));
  ok('attack frames are part of the prewarm: every attack set is prepared too', r.attackSets > 0 && !r.unready.some((u) => /\/attack:/.test(u)), { attackSets: r.attackSets, unreadyAttack: r.unready.filter((u) => /\/attack:/.test(u)).slice(0, 4) });
  ok('engaging the prepared pack mints almost nothing: <= 8 pins and <= 40 downscales in the first second', r.engage.pins <= 8 && r.engage.plain <= 40, r.engage);
  ok('the prewarm does not hitch the calm map: 95% of calm frames under 34 ms', r.calm.p95 < 34, r.calm);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
