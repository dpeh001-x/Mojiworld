// The ward shield never reads pixels back while drawing (per user: "reduce the lag for boss fights especially gravitos").
// v0.30.1513 sized the shield to the boss's body by drawing each frame into a 64 px canvas and calling getImageData - on a
// GPU-baked frame that is a readback that waits for the whole GPU queue: 28-341 ms per new frame at CPU x4, 23 of them in
// six seconds of Gravitos form 3. The bounds now come from the frame's FILE, decoded off the main thread and cached by file.
//   1. drawing a warded boss calls getImageData 0 times (the old build: once per frame image it had not measured)
//   2. the answer lands (within 3 s) and is a sane box inside the frame
//   3. it is cached by FILE: a second Image of the same file answers at once, with the same box
//   [MOJI_SERVE_ROOT / PORT] node scripts/boss_ward_probe_async_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10031); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await new Promise((res) => setTimeout(res, 300)); game.paused = true; player.level = 60;
    game.monsters.length = 0; spawnMonster(player.x + 220, player.y, 'kingKrook', true);
    const m = game.monsters.filter((x) => x && x.type === 'kingKrook').pop(); if (!m) return Object.assign(o, { err: 'no boss' });
    game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
    // count getImageData calls made while the shield is being drawn
    const P = CanvasRenderingContext2D.prototype, gid = P.getImageData; let inShield = 0, reads = 0;
    P.getImageData = function () { if (inShield > 0) reads++; return gid.apply(this, arguments); };
    const ws = window._drawBossWardShield; window._drawBossWardShield = function () { inShield++; try { return ws.apply(this, arguments); } finally { inShield--; } };
    const draw = () => { m._wardUntil = (game.time | 0) + 90; try { drawMonster(m); } catch (e) { o.drawErr = String(e && e.message); } };
    // a warded boss, drawn until its frame's answer is in (and 20 frames past it)
    let img = null, f = null, n = 0; const t0 = performance.now();
    while (performance.now() - t0 < 3000) { draw(); n++; img = m._lxDrawRect && m._lxDrawRect.img; f = img && _lxSpriteBodyFrac(img); if (f) break; await new Promise((res) => setTimeout(res, 40)); }
    o.landMs = Math.round(performance.now() - t0); o.f = f;
    for (let i = 0; i < 20; i++) { draw(); n++; await new Promise((res) => setTimeout(res, 10)); }
    o.reads = reads; o.draws = n;
    window._drawBossWardShield = ws; P.getImageData = gid;
    // cached by FILE: a fresh Image of the same file answers at once
    const srcObj = img && img._lxSrc && typeof img._lxSrc === 'object' ? img._lxSrc : img; const url = srcObj && srcObj.src;
    if (url) { const im2 = new Image(); im2.src = url; await new Promise((res) => { im2.onload = res; im2.onerror = res; setTimeout(res, 3000); });
      const t1 = performance.now(); o.f2 = _lxSpriteBodyFrac(im2); o.f2ms = +(performance.now() - t1).toFixed(2); o.url = url.split('/Sprites/').pop(); }
    return o;
  });
  console.log('build ' + r.ver + '  ' + JSON.stringify({ landMs: r.landMs, draws: r.draws, reads: r.reads, f: r.f, url: r.url, f2ms: r.f2ms, err: r.err || r.drawErr }));
  ok('drawing a warded boss reads no pixels back (getImageData during the shield draw)', !r.err && r.draws > 20 && r.reads === 0, `${r.reads} reads over ${r.draws} warded draws`);
  const f = r.f; ok('the body answer lands within 3 s and is a sane box inside the frame', !!f && f.l >= 0 && f.t >= 0 && f.r <= 1 && f.b <= 1 && f.r - f.l > 0.1 && f.b - f.t > 0.1, f ? `landed in ${r.landMs} ms: ${JSON.stringify(f)}` : 'never landed');
  ok('the answer is cached by FILE: a second Image of the same file answers at once with the same box', !!r.f2 && !!f && r.f2.l === f.l && r.f2.r === f.r && r.f2.t === f.t && r.f2.b === f.b && r.f2ms < 2, `${r.url}: ${JSON.stringify(r.f2)} in ${r.f2ms} ms`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
