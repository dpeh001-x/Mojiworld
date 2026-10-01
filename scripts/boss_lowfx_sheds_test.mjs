// BOSS-FIGHT GLOW FOLLOWS THE MACHINE, NOT THE BOSS (per user: "There is alot of lag in certain boss fights such as barnaby and
// gravitos, make it less laggy"). Measured in a live kit-bot fight: the Gravitos sky (_lxGravBackdropDraw) was the frame's biggest
// draw group, 1.8 screens of blending a frame, and his teleport rift (_lxGravRiftDraw) added ~1.2 more while he warned. The
// glow-only layers now follow the quality governor's tiers:
//   high (the machine keeps up):             everything, as before. This holds although _perfLowFx() is on - it is on in EVERY
//                                            boss fight on every machine, so it is not the gate; LX_PERF.lowFx (set by _perfTick
//                                            when THIS machine misses frames) is.
//   low (LX_PERF.lowFx):                     the sky drops its floor pool and bloom copy; the rift drops its two gradient glows
//   very-low:                                the sky also drops its lens halo - the disc and the motes stay
// window._lxNoLowSheds = true restores the old tiers (an in-page A/B switch). Barnaby's stun vignette is pinned in
// stun_indicator_test (5b). One page, the real arena, the governor stubbed so the tiers hold:
//   [1] high: halo, floor pool, disc and bloom all draw (motes 34), with _perfLowFx() on and very-low off
//   [2] low: halo + disc, no pool, no bloom, the motes as at high; _lxNoLowSheds brings the pool and bloom back
//   [3] very-low: the disc alone of the four, 16 motes; _lxNoLowSheds brings the halo back (the old very-low)
//   [4] the rift at high: two gradient glows; at low and very-low none, with the same tear / ring draws; _lxNoLowSheds: two again
//   [5] no page errors
// The build before fails [2]-[4].   node scripts/boss_lowfx_sheds_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11893);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }   // the real door: fade tears the title's sky loop down
    if (!player.cls) applyClass('warrior'); player.level = 100; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 1e12; player.maxHp = player.hp = 1e12;
    loadMap('gravitosArena', 300); await sleep(3000); try { closeAllModals(); } catch (e) {} game.paused = false;
    const grav = () => game.monsters.find((m) => m.type === 'gravitos' && m.currentHp > 0);
    for (let i = 0; i < 80 && !grav(); i++) await sleep(250);
    const g = grav(); if (!g) return { err: 'no gravitos' };
    for (let i = 0; i < 200 && !(_lxGfDiscArt() && _lxGravRiftImg(1) && _lxGravRingImg(1)); i++) await sleep(100);
    out.art = { disc: !!_lxGfDiscArt(), rift: !!_lxGravRiftImg(1), ring: !!_lxGravRingImg(1) };
    window._perfTick = function () {};   // the governor holds still: each draw below runs at the tier it is given
    const tier = (t) => { LX_PERF.lowFx = t !== 'high'; LX_PERF.veryLowFx = t === 'vlow'; game._lowFxCache = null; };
    const P = CanvasRenderingContext2D.prototype;
    // the sky: each blit of one _lxGravBackdropDraw() told apart by its size against the disc radius r
    const sky = () => { const r = _LX_GF_DISC.fr * W, got = { halo: 0, pool: 0, disc: 0, bloom: 0, motes: 0, other: [] }, di = P.drawImage;
      const near = (a, b) => Math.abs(a - b) < 1.5;
      P.drawImage = function (img) { const n = arguments.length, w = n >= 9 ? arguments[7] : n >= 5 ? arguments[3] : (img && img.width), h = n >= 9 ? arguments[8] : n >= 5 ? arguments[4] : (img && img.height);
        if (this === ctx) { if (near(w, r * 9) && near(h, r * 9)) got.halo++; else if (near(w, r * 9) && near(h, r * 2.2)) got.pool++;
          else if (near(w, r * 7.4) && near(h, r * 7.4)) got.disc++; else if (near(w, r * 7.4 * 1.16) && near(h, r * 7.4 * 1.16)) got.bloom++;
          else if (w <= 12) got.motes++; else got.other.push(Math.round(w) + 'x' + Math.round(h)); }
        return di.apply(this, arguments); };
      try { ctx.save(); _lxGravBackdropDraw(); ctx.restore(); } finally { P.drawImage = di; }
      return got; };
    // the rift: a blink held at 80% of its warning, both passes; gradients made, tear and ring draws
    const rift = () => { const held = { kind: 'blink', el: 0.8e9, ms: 1e9, x: g.x + g.w / 2 - 380, y: g.y + g.h / 2 }, keep = g._tpWarn, pops = _LX_GTP.pops.splice(0);
      const cnt = { grads: 0, art: 0, rings: 0 }, cg = P.createRadialGradient, oR = window._lxGravRiftAt, oG = window._lxGravRingAt;
      P.createRadialGradient = function () { if (this === ctx) cnt.grads++; return cg.apply(this, arguments); };
      window._lxGravRiftAt = function () { cnt.art++; return oR.apply(this, arguments); };
      window._lxGravRingAt = function () { cnt.rings++; return oG.apply(this, arguments); };
      g._tpWarn = held;
      try { ctx.save(); _lxGravRiftDraw(false); _lxGravRiftDraw(true); ctx.restore(); }
      finally { P.createRadialGradient = cg; window._lxGravRiftAt = oR; window._lxGravRingAt = oG; g._tpWarn = keep; _LX_GTP.pops.push(...pops); }
      return cnt; };
    for (const t of ['high', 'low', 'vlow']) {
      tier(t); const auto = { autoLow: _perfLowFx(), veryLow: _perfVeryLowFx() };
      out[t] = { ...auto, sky: sky(), rift: rift() };
      window._lxNoLowSheds = true; game._lowFxCache = null; out[t + 'Old'] = { sky: sky(), rift: rift() }; window._lxNoLowSheds = false;
    }
    tier('high'); out.phase = g._gravitosPhase || 1;
    return out;
  });
  if (R.err) throw new Error(R.err);
  const four = (s) => [s.halo, s.pool, s.disc, s.bloom].join('');
  const H = R.high, L = R.low, V = R.vlow;
  ok('[1] high: the halo, floor pool, disc and bloom all draw (motes 34), with the boss-fight auto flag _perfLowFx() on and very-low off',
    R.art.disc && four(H.sky) === '1111' && H.sky.motes === 34 && H.autoLow === true && H.veryLow === false, { art: R.art, phase: R.phase, sky: H.sky, autoLow: H.autoLow, veryLow: H.veryLow });
  ok('[2] low: the halo and disc, no floor pool, no bloom, the motes as at high; _lxNoLowSheds brings the pool and bloom back',
    four(L.sky) === '1010' && L.sky.motes === H.sky.motes && L.veryLow === false && four(R.lowOld.sky) === '1111', { sky: L.sky, old: R.lowOld.sky });
  ok('[3] very-low: the disc alone of the four, 16 motes; _lxNoLowSheds brings the halo back (the old very-low)',
    four(V.sky) === '0010' && V.sky.motes === 16 && V.veryLow === true && four(R.vlowOld.sky) === '1010', { sky: V.sky, old: R.vlowOld.sky });
  ok('[4] the rift: two gradient glows at high, none at low or very-low with the same tear and ring draws; _lxNoLowSheds: two again',
    H.rift.grads >= 2 && L.rift.grads === H.rift.grads - 2 && V.rift.grads === L.rift.grads && L.rift.art === H.rift.art && L.rift.rings === H.rift.rings
    && H.rift.art >= 3 && H.rift.rings >= 4 && R.lowOld.rift.grads === H.rift.grads && R.vlowOld.rift.grads === H.rift.grads,
    { high: H.rift, low: L.rift, vlow: V.rift, lowOld: R.lowOld.rift.grads, vlowOld: R.vlowOld.rift.grads });
  ok('[5] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
