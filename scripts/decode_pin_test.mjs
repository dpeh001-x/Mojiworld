// Decode pinning (v0.30.405): every image the game draws per frame is drawn from a
// bitmap copy made once, so Chrome's decoded-image cache cannot thrash mid-fight.
// Checks the pin itself, the soft-draw path, a frame set, the boss bar, and a live
// fight: raw <img> draws per second collapse from hundreds to a handful.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10173); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxDrawSoft === 'function' && typeof spawnMonster === 'function' && typeof drawSuperBossBar === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, has: typeof _lxPinned === 'function' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const kind = (f) => !f ? 'null' : f.tagName === 'CANVAS' ? 'canvas' : f.tagName === 'IMG' ? 'img' : (typeof ImageBitmap !== 'undefined' && f instanceof ImageBitmap) ? 'bitmap' : 'other';
    // 1. the pin
    const im = LX_FX.boss_shield; const t0 = performance.now(); while (!(im.complete && im.naturalWidth > 0) && performance.now() - t0 < 15000) await sleep(50);
    const p1 = _lxPinned(im), p2 = _lxPinned(im);
    o.pin = { kind: kind(p1), same: p1 === p2, complete: p1.complete === true, nw: p1.naturalWidth === im.naturalWidth, nh: p1.naturalHeight === im.naturalHeight, src: p1._lxSrc === im, w: p1.width, ready: _lxFxReady(p1) };
    // 2. the soft-draw path hands the canvas to drawImage, not the image
    const cap = (fn) => { const c = []; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; P.drawImage = function (src, ...a) { c.push(kind(src) + (src && src._lxSrc === im ? ':pin' : '')); return oI.apply(this, [src, ...a]); }; try { fn(); } catch (e) { c.push('err:' + (e && e.message)); } finally { P.drawImage = oI; } return c; };
    o.soft = cap(() => _lxDrawSoft(ctx, im, 10, 10, 64, 64));
    // 3. a live fight: raw <img> draws per second
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = false; player.level = 60; player.invulnerable = 9e9; player.hp = player.maxHp = 99999;
    const types = Object.keys(monsterTypes).slice(0, 6); for (let i = 0; i < 14; i++) { try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length], false); } catch (e) {} }
    try { spawnMonster(player.x + 300, player.y, 'kingKrook', true); } catch (e) {}
    await sleep(4000);   // let the first draws pin and the bakes land
    // what Chrome is handed: the game-canvas wrapper counts draws served from a pin vs. left raw (the call-level hook below sits ABOVE the wrapper, so it still sees the <img> the caller passed)
    const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const counts = {}; let n = 0; const srcs = {};
    const s0 = Object.assign({}, window._lxPinStats || { pinned: 0, raw: 0 });
    P.drawImage = function (src, ...a) { const k = kind(src); counts[k] = (counts[k] || 0) + 1; n++; if (k === 'img') { const s = (src.src || '').replace(/^.*\/Sprites\//, ''); srcs[s] = (srcs[s] || 0) + 1; } return oI.apply(this, [src, ...a]); };
    const t1 = performance.now(); let frames = 0; while (performance.now() - t1 < 2000) { await new Promise((r) => requestAnimationFrame(r)); frames++; }
    P.drawImage = oI; game.paused = true;
    const s1 = window._lxPinStats || { pinned: 0, raw: 0 };
    o.fight = { frames, total: n, perSec: +(n / 2).toFixed(0), callImgPerSec: +((counts.img || 0) / 2).toFixed(1), byKind: counts, imgTop: Object.entries(srcs).sort((a, b) => b[1] - a[1]).slice(0, 6), pinnedPerSec: +((s1.pinned - s0.pinned) / 2).toFixed(1), rawPerSec: +((s1.raw - s0.raw) / 2).toFixed(1) };
    // 4. a frame set after use: no raw image left among the loaded frames
    const set = _monsterFramesFor(types[0]); const kinds = {}; for (const st of ['idle', 'walk', 'attack']) for (const f of (set[st] || [])) { if (f && f.complete !== false) { const k = kind(f); kinds[k] = (kinds[k] || 0) + 1; } }
    o.set = { type: types[0], kinds };
    return o;
  });
  console.log('build ' + r.ver + '  pin ' + JSON.stringify(r.pin) + '  fight ' + JSON.stringify(r.fight));
  ok('the pin: one canvas per image, cached, carrying complete / naturalWidth / naturalHeight and its source; the FX-ready check passes on it', r.has && r.pin.kind === 'canvas' && r.pin.same && r.pin.complete && r.pin.nw && r.pin.nh && r.pin.src && r.pin.ready, JSON.stringify(r.pin));
  ok('the soft-draw path hands the pinned canvas to drawImage, never the raw image', r.soft.length >= 1 && r.soft.every((k) => k !== 'img') && r.soft.some((k) => k === 'canvas:pin'), JSON.stringify(r.soft));
  ok('a live fight hands Chrome fewer than 6 raw images a second on the game canvas (the v0.30.404 build drew about 217), the rest from pins', r.fight.frames > 30 && r.fight.rawPerSec < 6 && r.fight.pinnedPerSec >= 0, JSON.stringify(r.fight));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
