// FIGHT LAG, damage-number atlases off the main thread (v0.30.1239). Per user: "reduce the lag of the game especially
// fights and boss fights even more". An atlas build was the fight's biggest hitch (44-105 ms of main thread at 4x CPU);
// the figure atlases are now built on a Worker running the game's own _lxDnAtlasBuild.
//   - WORKER: the Worker starts (OffscreenCanvas + transferToImageBitmap available)
//   - OFF-THREAD: a miss builds nothing on the main thread; the atlas lands in the cache as an ImageBitmap within 1.5 s
//   - COST: the main thread pays under a quarter of a synchronous build + first draw per atlas
//   - PIXELS: a Worker atlas matches the same atlas built on the main thread
//   - FALLBACK: _LX_DN_WORKER_ON = false builds on the main thread, in the same frame
//   - LIVE: a real fight draws its numbers from atlases with no main-thread builds, no page errors
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=12401] node scripts/dn_atlas_worker_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12401';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxDnAtlasGet === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; player.job = 'berserker'; loadMap('mushroom', 600); await W8(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    const hasW = typeof _lxDnWorker === 'function';
    out.worker = hasW ? !!_lxDnWorker() : false;
    let mainBuilds = 0; const ob = window._lxDnAtlasBuild; window._lxDnAtlasBuild = function () { mainBuilds++; return ob.apply(this, arguments); };
    const dpr = typeof _lxDnAtlasDpr === 'function' ? _lxDnAtlasDpr(Math.max(0.25, Math.min(3, _LX_DPR))) : _LX_DPR;
    const d = { big: true }, col = '#ff9a3c', key = (b0, px) => b0 + '|' + px + '|' + '01' + '0' + '|' + col + '|' + '10' + '|' + dpr;
    _lxDnAtlasTrim(1); _LX_DN_ATLAS.clear(); _lxDnAtlasPx = 0;
    // OFF-THREAD + COST: ten misses
    const t0 = performance.now(); const pxs = [];
    for (let i = 0; i < 10; i++) { const px = 20 + i * 2.5; pxs.push(px); _lxDnAtlasBudget = 1; _lxDnAtlasGet(27, px, 27, d, col, false, true, false, dpr); }
    out.postMs = +((performance.now() - t0) / 10).toFixed(2); out.mainBuildsAtPost = mainBuilds;
    let landed = 0; const tw = performance.now(); while (performance.now() - tw < 1500) { landed = pxs.filter((px) => { const a = _LX_DN_ATLAS.get(key(27, px)); return a && a.cv; }).length; if (landed === 10) break; await W8(20); }
    out.landed = landed; out.landedMs = Math.round(performance.now() - tw);
    const any = _LX_DN_ATLAS.get(key(27, pxs[0])); out.kind = any && any.cv ? any.cv.constructor.name : null;
    // the synchronous build + first draw, for the cost comparison
    window._lxDnAtlasBuild = ob;
    const syncMs = []; for (let i = 0; i < 6; i++) { const t = performance.now(); const at = ob(27, 40 + i * 2.5, 27, d, col, false, true, false, dpr); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(at.cv, 0, 0, 4, 4, -10, -10, 4, 4); ctx.restore(); syncMs.push(performance.now() - t); }
    syncMs.sort((a, b) => a - b); out.syncMs = +syncMs[3].toFixed(2);
    // the worker side, same measure: post + (after landing) first draw + readback
    const wMs = []; for (let i = 0; i < 6; i++) { const px = 60 + i * 2.5; const t = performance.now(); _lxDnAtlasBudget = 1; _lxDnAtlasGet(27, px, 27, d, col, false, true, false, dpr); let dt = performance.now() - t; let a; const tw2 = performance.now(); while (!(a = _LX_DN_ATLAS.get(key(27, px))) && performance.now() - tw2 < 1500) await W8(10); if (a) { const t2 = performance.now(); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(a.cv, 0, 0, 4, 4, -10, -10, 4, 4); ctx.restore(); dt += performance.now() - t2; } wMs.push(dt); }
    wMs.sort((a, b) => a - b); out.workerMs = +wMs[3].toFixed(2);
    // PIXELS: the Worker's atlas against the same one built here
    const A = _LX_DN_ATLAS.get(key(27, pxs[4])), B = ob(27, pxs[4], 27, d, col, false, true, false, dpr);
    if (A && B) { const grab = (src, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const a = grab(A.cv, B.cv.width, B.cv.height), b = grab(B.cv, B.cv.width, B.cv.height); let diff = 0, big = 0; for (let i = 0; i < a.length; i++) { const dd = Math.abs(a[i] - b[i]); diff += dd; if (dd > 40) big++; }
      out.pixels = { sameSize: A.cv.width === B.cv.width && A.cv.height === B.cv.height, meanDiff: +(diff / a.length).toFixed(3), over40: big, of: a.length }; }
    // FALLBACK
    if (hasW) { _LX_DN_WORKER_ON = false; _lxDnAtlasBudget = 1; const px = 90.5; _lxDnAtlasGet(27, px, 27, d, col, false, true, false, dpr); const a = _LX_DN_ATLAS.get(key(27, px)); out.fallback = !!(a && a.cv && a.cv.tagName === 'CANVAS'); _LX_DN_WORKER_ON = true; }
    // LIVE: a fight in the low-effects mode a heavy fight runs in
    _lxDnAtlasTrim(1); _LX_DN_ATLAS.clear(); _lxDnAtlasPx = 0;
    game.paused = false; player._god = true; player.mp = player.maxMp = 9999; let blits = 0, liveBuilds = 0;
    window._lxDnAtlasBuild = function () { liveBuilds++; return ob.apply(this, arguments); };
    const obl = window._lxDnAtlasBlit; window._lxDnAtlasBlit = function () { const ok = obl.apply(this, arguments); if (ok) blits++; return ok; };
    const lf = window._perfLowFx; window._perfLowFx = () => true;
    const T = setInterval(() => { try { player.mp = 9999; const m = game.monsters.find((x) => x && x.currentHp > 0); if (m) { player.x = m.x - 120; player.facing = 1; } for (const id of ['slash', 'powerStrike', 'groundSlam', 'rush']) if (!((player.skillCooldowns || {})[id] > 0)) castSkill(id); } catch (e) {} }, 120);
    await W8(4000); clearInterval(T); window._perfLowFx = lf; window._lxDnAtlasBlit = obl; window._lxDnAtlasBuild = ob;
    out.liveBlits = blits; out.liveMainBuilds = liveBuilds; out.dead = typeof _lxDnWDead !== 'undefined' ? _lxDnWDead : null;
    return out;
  });
  check(r.worker === true, 'WORKER: the atlas Worker starts', J({ worker: r.worker }));
  check(r.mainBuildsAtPost === 0 && r.landed === 10 && r.kind === 'ImageBitmap', 'OFF-THREAD: ten misses build nothing on the main thread; all ten land as ImageBitmaps within 1.5 s', J({ mainBuilds: r.mainBuildsAtPost, landed: r.landed, ms: r.landedMs, kind: r.kind }));
  check(r.workerMs < r.syncMs * 0.25, 'COST: the main thread pays under a quarter of a synchronous build + first draw per atlas', J({ workerMs: r.workerMs, syncMs: r.syncMs, postMs: r.postMs }));
  const P = r.pixels || {};
  check(P.sameSize && P.meanDiff < 0.5 && P.over40 <= P.of * 0.001, 'PIXELS: a Worker atlas matches the same atlas built on the main thread', J(P));
  check(r.fallback === true, 'FALLBACK: _LX_DN_WORKER_ON = false builds on the main thread in the same frame', J({ fallback: r.fallback }));
  check(r.liveBlits > 20 && r.liveMainBuilds === 0 && r.dead === false, 'LIVE: a real fight draws its numbers from atlases, none built on the main thread', J({ blits: r.liveBlits, mainBuilds: r.liveMainBuilds, dead: r.dead }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
