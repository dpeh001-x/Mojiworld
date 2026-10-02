// A big frame's hit-flash copy is baked at half size and drawn at full size (boss-fight lag, per user: "reduce the lag for
// boss fights especially gravitos"). A flash is a tinted copy of the frame cached per (frame x filter); on a boss that was a
// 1.6-2.5 MP canvas per frame, minted twice per frame of every form by the boss prewarm and again mid-fight whenever a frame
// was re-baked - an upload stall apiece. Flash frames already skip the edge feather (v0.30.261: 2-3 frames of white blowout).
//   1. a flash of a frame over 1 MP is half size, carries its full draw size (_lxDrawW / _lxDrawH), and is still a flash
//   2. small frames and every non-flash tint (status washes persist for seconds) keep full size
//   3. _lxDrawSoft draws the half copy at the full size when the caller passes none
//   4. the foot anchor of the half copy resolves through its source, scaled (bottom row within 1 px of half the source's)
//   [MOJI_SERVE_ROOT / PORT] node scripts/boss_flash_half_test.mjs      (serves mojiworld_game.html)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10032); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxTintBake === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const o = { ver: GAME_VERSION };
    const frame = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = '#8a4fd0'; g.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.8); c.complete = true; c.naturalWidth = w; c.naturalHeight = h; return c; };
    const big = frame(2054, 1214), small = frame(600, 500), big2 = frame(2054, 1214);
    const fb = _lxTintBake(big, 'brightness(2.5)'), ff = _lxTintBake(big2, 'brightness(2.0) hue-rotate(60deg) saturate(1.15)');
    const fs = _lxTintBake(small, 'brightness(2.5)'), st = _lxTintBake(big, 'brightness(0.9) hue-rotate(60deg) saturate(1.1)');
    const d = (c) => c ? { w: c.width, h: c.height, dw: c._lxDrawW || null, dh: c._lxDrawH || null, flash: !!c._lxIsFlash } : null;
    o.bigFlash = d(fb); o.bigFreezeFlash = d(ff); o.smallFlash = d(fs); o.bigStatus = d(st);
    // _lxDrawSoft with the flash tint set and no size from the caller: record the blit
    const calls = []; const P = CanvasRenderingContext2D.prototype, od = P.drawImage; const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c2 = cv.getContext('2d');
    P.drawImage = function (im, ...a) { if (this === c2) calls.push({ src: im === fb ? 'flash' : (im === big ? 'big' : (im && im.width) + 'x' + (im && im.height)), a: a.map((v) => Math.round(v)) }); return od.apply(this, [im, ...a]); };
    const prevTint = _lxMobTintFilter;
    try { _lxMobTintFilter = 'brightness(2.5)'; _lxDrawSoft(c2, big, 0, 0, undefined, undefined, {}); } catch (e) { o.drawErr = String(e && e.message); } finally { _lxMobTintFilter = prevTint; P.drawImage = od; }
    o.calls = calls;
    // the foot anchor answers through the source, scaled
    try { o.srcBot = _detectSpriteBboxBottom(big); o.flashBot = fb ? _detectSpriteBboxBottom(fb) : null; } catch (e) { o.bboxErr = String(e && e.message); }
    return o;
  });
  console.log('build ' + r.ver + '  ' + JSON.stringify({ bigFlash: r.bigFlash, bigFreezeFlash: r.bigFreezeFlash, smallFlash: r.smallFlash, bigStatus: r.bigStatus, calls: r.calls, srcBot: r.srcBot, flashBot: r.flashBot, err: r.drawErr || r.bboxErr }));
  const bf = r.bigFlash, bff = r.bigFreezeFlash;
  ok('a flash of a frame over 1 MP is half size, keeps its full draw size, and is still a flash', !!bf && bf.w === 1027 && bf.h === 607 && bf.dw === 2054 && bf.dh === 1214 && bf.flash && !!bff && bff.w === 1027 && bff.dw === 2054 && bff.flash, JSON.stringify({ bf, bff }));
  ok('small frames and status tints keep full size', !!r.smallFlash && r.smallFlash.w === 600 && r.smallFlash.h === 500 && !!r.bigStatus && r.bigStatus.w === 2054 && r.bigStatus.h === 1214 && !r.bigStatus.flash, JSON.stringify({ s: r.smallFlash, st: r.bigStatus }));
  const fc = (r.calls || []).find((c) => c.src === 'flash');
  ok('_lxDrawSoft draws the half copy at the full size', !!fc && fc.a.length >= 4 && fc.a[2] === 2054 && fc.a[3] === 1214, JSON.stringify(r.calls));
  ok('the half copy\'s foot anchor resolves through its source, scaled', r.srcBot != null && r.flashBot != null && Math.abs(r.flashBot - r.srcBot / 2) <= 1, `source ${r.srcBot}, half copy ${r.flashBot}`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
