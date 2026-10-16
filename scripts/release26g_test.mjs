// RELEASE 26g (long-session memory, soak hunter 2026-10-17) stays fixed. One page, no reload, the renderer CPU-throttled x4 so
// idle slices are short (the condition the leak needed), three hunting maps, each cycle visiting them twice (the second entry finds the first one's bakes in the slots), three cycles:
//   [1] loadMap's hit-flash tint pre-bake queue: (a) after twelve map changes at most ONE _drain idle chain is still asking
//       (base: an endless chain per map change), (b) given idle time it empties and ends - window._lxTintPreQ is gone and
//       nothing is rescheduled. Headless Chrome hands out idle slices under 4 ms only (the queue bakes in > 4 ms slices, as
//       before), so (b) and [5] give requestIdleCallback a fast desktop's deadline (12 ms left, every 16 ms)
//   [2] canvases the budget released are not kept alive by anything: after each cycle every _lxCvTrack copy is released, GC is
//       forced, and the live canvas memory outside the budget (untracked MP) must not grow from cycle to cycle. Two caches that
//       are untracked BY DESIGN and bounded (_lxProjScaled: 16 sizes per image; _CUTE_PLAT_CACHE: 160 platform bakes) are
//       still warming up over these cycles; they are left out of the number (both are reported)
//   [3] _lxAsyncBake does not keep the canvas it superseded (`prev`) alive once its successor is tracked
//   [4] window._lxReadyGateLog keeps the boot record + the last 50 records; .length still counts every gate
//   [5] the hit flash still uses the pre-baked tint: after the queue ends most of the map's frame slots carry a brightness(2.5)
//       bake, and a hit on a monster draws flash copies that existed before the hit
//   node release26g_test.mjs [page]        PORT / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...; CPU=<rate> (default 4)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => /\.html$/.test(a));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = cand;
const PORT = Number(process.env.PORT || 15660), FILE = 'mojiworld_game.html', CPU = Number(process.env.CPU || 4);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--js-flags=--expose-gc', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {}
    const W = window.__cv = { refs: [] };   // every canvas, weakly - what is still alive after a forced GC
    const _ce = Document.prototype.createElement;
    Document.prototype.createElement = function (t) { const e = _ce.apply(this, arguments); if (String(t).toLowerCase() === 'canvas') { try { if (/_lxProjScaled|_cutePlatformSprite/.test(new Error().stack || '')) e.__lxBounded = 1; } catch (x) {} W.refs.push(new WeakRef(e)); if (W.refs.length > 80000) W.refs = W.refs.filter((w) => w.deref()); } return e; };
    const ric = window.requestIdleCallback; window.__drainSched = 0; window.__drainFns = new Set();   // the tint queue's idle chain, by its function name
    if (ric) window.requestIdleCallback = function (fn, o) { if (fn && fn.name === '_drain') { window.__drainSched++; window.__drainFns.add(fn); } return ric.call(this, fn, o); };
  });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true; player.level = 60; player.exp = 0; player.expToNext = 1e15;
    window.__clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; };
    window.__untracked = async () => { gc(); await new Promise((r) => setTimeout(r, 300)); gc(); await new Promise((r) => setTimeout(r, 300)); gc();
      let n = 0, px = 0, bpx = 0; for (const w of window.__cv.refs) { const c = w.deref(); if (c && !_lxCvLru.has(c)) { const a = (c.width || 0) * (c.height || 0); if (c.__lxBounded) { bpx += a; continue; } n++; px += a; } } return { n, mp: +(px / 1e6).toFixed(1), boundedMP: +(bpx / 1e6).toFixed(1) }; };
    window.__squeeze = () => { let k = 0; for (const [cv, e] of [..._lxCvLru]) { _lxCvRelease(cv, e); k++; } return k; };   // the budget at its hardest: every copy released
    return GAME_VERSION;
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const go = async (map) => { await page.evaluate((m) => { window.__clear(); game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { [m]: null }); loadMap(m, 300); }, map); await sleep(1500); await page.evaluate(() => window.__clear()); await sleep(5500); };
  const MAPS3 = ['forest', 'mushroom', 'sauroSlope'];
  const curve = [];
  if (on('1') || on('2') || on('5')) {
    for (let cy = 1; cy <= 3; cy++) {
      for (const m of [...MAPS3, ...MAPS3]) await go(m);
      const rel = await page.evaluate(() => window.__squeeze());
      const u = await page.evaluate(() => window.__untracked());
      curve.push(u.mp); console.log('  cycle ' + cy + ': released ' + rel + ' tracked copies; untracked canvases after GC ' + u.n + ' / ' + u.mp + ' MP (+ the two bounded caches ' + u.boundedMP + ' MP)');
    }
    // still throttled, on the last map: how many distinct chains ask for idle time in 8 s
    await page.evaluate(() => window.__drainFns.clear()); const s0 = await page.evaluate(() => window.__drainSched); await sleep(8000);
    const ch = await page.evaluate((s0) => ({ chains: window.__drainFns.size, resched8s: window.__drainSched - s0 }), s0);
    if (on('1')) ok('[1a] after 18 map changes under load at most one tint pre-bake chain is alive', ch.chains <= 1, ch);
    if (on('2')) { const grow = curve[2] - curve[0]; ok('[2] untracked canvas memory stays flat across cycles after a full release + GC (growth <= 3 MP)', grow <= 3, { curveMP: curve }); }
  }
  if (on('1') || on('5')) {   // unthrottled, idle time as a fast desktop has it, a fresh entry to a map: the queue drains and ends
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await go('sauroSlope'); await go('forest');   // a map you have played (its slots hold its bakes), left, then entered again
    await page.evaluate(() => { window.__ricOrig = window.requestIdleCallback; window.requestIdleCallback = function (fn) { if (fn && fn.name === '_drain') { window.__drainSched++; window.__drainFns.add(fn); } return setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 12 }), 16); }; });
    await go('sauroSlope');
    const t0 = Date.now(); while (Date.now() - t0 < 90000 && (Date.now() - t0 < 15000 || await page.evaluate(() => !!window._lxTintPreQ))) await sleep(1000);
    const s0 = await page.evaluate(() => window.__drainSched); await sleep(6000);
    const r1 = await page.evaluate((s0) => ({ resched6s: window.__drainSched - s0, queue: window._lxTintPreQ === undefined ? 'absent' : window._lxTintPreQ }), s0);
    r1.waitedS = Math.round((Date.now() - t0) / 1000);
    if (on('1')) ok('[1b] on a quiet map the queue empties and ends (nothing rescheduled in 6 s after)', r1.resched6s === 0 && (r1.queue === null || r1.queue === 'absent'), r1);
  }
  if (on('5')) {   // the queue ended on sauroSlope: its frame slots should carry the flash bake
    const r = await page.evaluate(async () => {
      const sleep = (t) => new Promise((r) => setTimeout(r, t));
      const types = [...new Set((MAPS[game.currentMap].spawns || []).map((s) => s && s.type).filter(Boolean))];
      let slots = 0, baked = 0; const pre = new Set();
      for (const ty of types) { const set = _monsterFramesFor(ty) || {}; for (const md of ['idle', 'walk', 'attack']) for (const im of (set[md] || [])) { if (!im || im.complete === false) continue; slots++; const b = im._lxTintBakes && im._lxTintBakes['brightness(2.5)']; if (b) { baked++; pre.add(b); } } }
      const P = CanvasRenderingContext2D.prototype, di = P.drawImage; let flash = 0, flashPre = 0;
      P.drawImage = function (s) { if (s && s._lxIsFlash) { flash++; if (pre.has(s)) flashPre++; } return di.apply(this, arguments); };
      const mons = (game.monsters || []).filter((m) => m && m.currentHp > 0 && !MONSTER_ANIMS[m.type] && types.includes(m.type));
      for (const m of mons) { m.x = player.x + 120; m.y = player.y; }
      const t0 = performance.now(); while (performance.now() - t0 < 2500) { for (const m of mons) m.hitFlash = 40; await sleep(30); }
      P.drawImage = di; if (window.__ricOrig) window.requestIdleCallback = window.__ricOrig;
      return { types, slots, baked, mons: mons.length, flash, flashPre };
    });
    ok('[5a] after the queue ends, the map\'s frame slots carry the hit-flash bake (>= 50%)', r.slots > 0 && r.baked / r.slots >= 0.5, r);
    ok('[5b] a hit draws the flash, from copies baked before the hit (>= 60% of flash draws)', r.flash > 0 && r.flashPre / r.flash >= 0.6, r);
  }
  if (on('3')) {
    const r = await page.evaluate(async () => {
      const src = (() => { for (const k in MONSTER_SPRITES) { const im = MONSTER_SPRITES[k]; if (im && im.tagName === 'IMG' && im.complete && im.naturalWidth > 200) return im.src; } return null; })();
      const im = new Image(); im.src = src; await im.decode();
      const frames = [];
      (() => { const prev = document.createElement('canvas'); prev.width = 300; prev.height = 300; frames[0] = prev; window.__prevRef = new WeakRef(prev);
        _lxAsyncBake(frames, 0, im, 64, prev); })();
      const t0 = performance.now(); while (performance.now() - t0 < 8000 && !(frames[0] && frames[0] !== window.__prevRef.deref() && frames[0].tagName === 'CANVAS' && frames[0].width <= 64)) await new Promise((r) => setTimeout(r, 50));
      const swapped = !!(frames[0] && frames[0].width <= 64 && frames[0].height <= 64); const tracked = _lxCvLru.has(frames[0]);
      window.__keepFrames = frames;   // the successor stays tracked and in its slot, as in the game
      for (let i = 0; i < 4; i++) { gc(); await new Promise((r) => setTimeout(r, 200)); }
      return { src: (src || '').split('/').pop(), swapped, tracked, prevAlive: !!window.__prevRef.deref() };
    });
    ok('[3] _lxAsyncBake: the superseded canvas is collectable once the new copy is in its slot and tracked', r.swapped && r.tracked && !r.prevAlive, r);
  }
  if (on('4')) {
    const r = await page.evaluate(async () => {
      const L = window._lxReadyGateLog, n0 = L.length; const boot0 = L.filter((x) => x && x.boot).length;
      for (let i = 0; i < 64; i++) await _lxReadyGate(game.currentMap, { cap: 40 });
      return { n0, len: L.length, present: L.filter(Boolean).length, boot0, boot: L.filter((x) => x && x.boot).length, last: !!L[L.length - 1] };
    });
    ok('[4] the ready-gate log keeps the boot record + the last 50 records, and its length counts every gate', r.len === r.n0 + 64 && r.present <= 50 + r.boot0 && r.boot === r.boot0 && r.last, r);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(`\n${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
