// THE WEIGHT-BEARER'S STAIR, POLISHED - no band across the sky, no sawtooth under the flight.
//
// Per user: "for the weightbearers stairs maps can be much improved there are weird cutoffs and the map background has a
// transluscent white horizontal cutoff". One page, the real frame loop:
//   1. the dusk/night tint - a screen fill drawn inside the tall-map world translate - covers the whole screen at every camera
//      height on the 1100 px Stair (it stopped at y = 590 - camera.y: the band), and so does the stun/freeze vignette;
//   2. the Stair's ground pieces draw no flat foot (_LX_FOOTLESS rides their join variant), a flat map's still do;
//   3. each flight's underside is one line: a single chain of the 21 pieces, never above a foot (8 px below the lowest),
//      at most ~60 px below it, and smooth (<= 3 px per 4 px);
//   4. the notches under the risers show that stone on screen (the baked tile's pixels), not the sky;
//   5. flat treads (per user: "the stairs can be non-sloped"): no seam is ramped, and each of the twenty steps up is a square
//      riser the join variant carries at its full 30 px (so its keyline runs the whole riser); no page errors;
//   6. one wall (per user: "the blocks transition should aim to be continuous"): below each riser the mortar lines either side
//      of the seam (two 6 px windows' row profiles, high-passed) correlate at lag 0 (the courses used to jump half a course);
//   7. the weather (per user: "a dark cloud misty feel without causing too much lag", then "The dark clouds can be more
//      transluscent, more aesthetic"): a darker sky (bgTint), four baked strips a frame - overcast, banks and sea before the
//      sphere's glow (which lights them) and the platforms, the haze after the entities - in <= 10 blits, no canvas made per
//      frame, the haze dropped at very-low FX, no drift under reduced motion, none on another map.
// The build before fails 1-7.   node scripts/stair_polish_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11851), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], J = (x) => JSON.stringify(x).slice(0, 360);
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 80; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos;   // a save that saw every beat has FINISHED the story - keep it mid-story
    await sleep(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    loadMap('weightbearerStair', 300); await sleep(2500); game.paused = false;
    const cv = document.getElementById('gameCanvas') || document.querySelector('canvas'), main = cv.getContext('2d'), dpr = cv.width / W;
    const standAt = async (x) => { const pl = game.mapData.platforms.filter((p) => p.type === 'ground' && x >= p.x && x < p.x + p.w).sort((a, b) => a.y - b.y)[0];
      game.paused = false; player.x = x; player.y = pl.y - player.h - 2; player.vx = 0; player.vy = 0; player.invulnerable = 0; for (let i = 0; i < 30; i++) await sleep(50); };
    // one frame's full-screen fills (>= 900 css px wide) with their screen-space y span
    const wideFills = async (want) => { const P = CanvasRenderingContext2D.prototype, oF = P.fillRect, log = [];
      P.fillRect = function (x, y, w, h) { if (this === main) { const m = this.getTransform(), sx = m.a / dpr, sy = m.d / dpr;
        if (Math.abs(w * sx) >= 900) log.push({ st: typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient', y: [Math.round(m.f / dpr + y * sy), Math.round(m.f / dpr + (y + h) * sy)] }); }
        return oF.apply(this, arguments); };
      for (let i = 0; i < 90 && !log.some(want); i++) await frame();   // the game draws on its own clock: wait for a frame that painted it
      P.fillRect = oF; return log; };
    // ---- 1. the tint and the vignette, at the foot, the middle and the top of the climb
    out.fills = [];
    for (const x of [700, 1500, 2800]) {   // v0.30.1592 - the world is 2960 wide now (the treads are 60 px, not 120)
      await standAt(x);
      game._forcePhase = 23; _LX_DAYPH.t = 0; const night = (_lxDayPhase() || {}).style || '';
      const f1 = await wideFills((f) => f.st.replace(/\s/g, '') === night.replace(/\s/g, '')); const tint = f1.filter((f) => f.st.replace(/\s/g, '') === night.replace(/\s/g, ''));
      // the perf governor sheds the full-screen stun/freeze fill on the low FX tiers under headless load: pin the tiers off
      // (and _lxNoLowSheds, the game's own A/B switch) so this measures where the fill lands, not whether the box was slow
      window._lxNoLowSheds = true; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; LX_PERF.veryLowFxUntil = Infinity; game._lowFxCache = null;
      player.frozenTimer = 4000; const f2 = await wideFills((f) => f.st === 'gradient'); player.frozenTimer = 0;
      const vig = f2.filter((f) => f.st === 'gradient');
      out.fills.push({ x, camY: Math.round(game.camera.y), night, tint: tint.map((f) => f.y), vig: vig.map((f) => f.y) });
    }
    game._forcePhase = 12; _LX_DAYPH.t = 0; _lxDayPhase();
    // ---- 2. footless pieces here, feet elsewhere
    const G = game.mapData.platforms.filter((p) => p.type === 'ground');
    out.footless = G.filter((p) => (_lxGroundJoin(p) & 4096)).length; out.ground = G.length;
    // ---- 3. the underside line
    const U = (typeof _lxStairUnder === 'function') ? _lxStairUnder(game.mapData) : null;
    if (U && U.length) { const c = U[0]; let minGap = 1e9, maxGap = -1e9, maxStep = 0;
      for (let i = 0; i < c.n; i++) { const gp = c.U[i] - c.S[i]; minGap = Math.min(minGap, gp); maxGap = Math.max(maxGap, gp); if (i) maxStep = Math.max(maxStep, Math.abs(c.U[i] - c.U[i - 1])); }
      out.under = { chains: U.length, pieces: c.ps.length, minGap: +minGap.toFixed(2), maxGap: +maxGap.toFixed(2), maxStep: +maxStep.toFixed(2) }; }
    // ---- 4. the notches show the stone: screen pixel vs the baked tile's own pixel, at every riser seam on screen
    out.notch = { n: 0, good: 0, bad: [] };
    if (U && U.length) {
      const c = U[0];
      for (const x of [900, 1400, 2000, 2700]) {
        await standAt(x); await frame(); await frame();
        const camX = game.camera.x, camY = Math.round(game.camera.y || 0);
        const img = main.getImageData(0, 0, cv.width, cv.height).data;
        for (let k = 0; k + 1 < c.ps.length; k++) {
          const a = c.ps[k], b = c.ps[k + 1], fa = a.y + a.h, fb = b.y + b.h; if (fa === fb) continue;
          const hi = fa > fb ? k + 1 : k, fHi = Math.min(fa, fb), fLo = Math.max(fa, fb), seam = b.x;
          for (const dx of [4, 10]) for (const dy of [4, (fLo - fHi) * 0.5]) {
            const wx = fa > fb ? seam + dx : seam - dx, wy = fHi + dy;
            const px = Math.round((wx - camX) * dpr), py = Math.round((wy - camY) * dpr);
            if (px < 4 || py < 4 || px > cv.width - 4 || py > cv.height - 4) continue;
            const t = c.tiles[hi]; if (!t) continue;
            const ts = t.cv.width / t.w, tx = Math.floor((wx - t.x) * ts), ty = Math.floor((wy - t.y) * ts);
            const tp = t.cv.getContext('2d').getImageData(tx, ty, 1, 1).data, i4 = (py * cv.width + px) * 4;
            const d = Math.hypot(img[i4] - tp[0], img[i4 + 1] - tp[1], img[i4 + 2] - tp[2]);
            out.notch.n++; if (tp[3] > 200 && d < 45) out.notch.good++; else if (out.notch.bad.length < 4) out.notch.bad.push({ k, wx: Math.round(wx), wy: Math.round(wy), d: Math.round(d), a: tp[3] });
          }
        }
      }
    }
    // ---- 5. flat treads: no ramps, and every step up is a riser the higher piece carries at its full height
    out.ramps = (_lxGroundRamps(game.mapData) || []).length;
    { const G2 = game.mapData.platforms.filter((p) => p.type === 'ground').sort((a, b) => a.x - b.x); out.risers = [];
      for (let k = 0; k + 1 < G2.length; k++) { const a = G2[k], b = G2[k + 1]; if (a.y === b.y) continue; const hi = a.y < b.y ? a : b, v = _lxGroundJoin(hi), e = hi === a ? (v >> 7) & 31 : (v >> 2) & 31; out.risers.push(e - Math.min(31, Math.abs(a.y - b.y))); } }   // the join carries a riser up to 31 px (5 bits); the Stair's are 42 now, so it carries 31 (the keyline no longer reads it: _lxStairProfileDraw)
    // ---- 6. one wall: below each riser, the columns either side of the seam vs two columns inside the blocks
    out.cont = { seams: 0, worst: 1, ratio: [] };
    {
      const ps6 = game.mapData.platforms.filter((p) => p.type === 'ground').sort((a, b) => a.x - b.x);   // the map's own pieces: this runs on any build
      for (const x of [900, 2000]) {
        await standAt(x); await frame(); await frame();
        const camX = game.camera.x, camY = Math.round(game.camera.y || 0), img = main.getImageData(0, 0, cv.width, cv.height).data;
        const lum = (wx, wy) => { const px = Math.round((wx - camX) * dpr), py = Math.round((wy - camY) * dpr); if (px < 2 || py < 2 || px >= cv.width - 2 || py >= cv.height - 2) return null; const i = (py * cv.width + px) * 4; return 0.3 * img[i] + 0.59 * img[i + 1] + 0.11 * img[i + 2]; };
        // a 6 px window's row profile (each row averaged across it: the courses stay, a lone head joint thins out), high-passed
        // over +-6 px so only the mortar lines are left; two windows' courses line up when those profiles correlate at lag 0
        const prof = (x0, y0, y1) => { const p = []; for (let y = y0; y <= y1; y += 0.5) { let s = 0; for (let x = x0; x < x0 + 6; x++) { const v = lum(x, y); if (v == null) return null; s += v; } p.push(s / 6); }
          return p.map((v, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 12); j <= Math.min(p.length - 1, i + 12); j++) { s += p[j]; n++; } return v - s / n; }); };
        const ncc = (xa, xb, y0, y1) => { const a = prof(xa, y0, y1), b = prof(xb, y0, y1); if (!a || !b) return null; let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return ab / Math.sqrt(Math.max(1e-9, aa * bb)); };
        for (let k = 0; k + 1 < ps6.length; k++) {
          const a = ps6[k], b = ps6[k + 1]; if (a.y === b.y || a.x + a.w !== b.x) continue;
          const lower = a.y > b.y ? a : b, y0 = lower.y + 27, y1 = Math.max(a.y + a.h, b.y + b.h) - 4;   // under the lower tread's lip shade, down to the lower foot
          if (y1 - y0 < 36) continue;
          const r = ncc(b.x - 8, b.x + 2, y0, y1); if (r == null) continue;
          out.cont.seams++; if (out.cont.ratio.length < 12) out.cont.ratio.push(+r.toFixed(2));
          if (r < out.cont.worst) { out.cont.worst = +r.toFixed(2); out.cont.at = { k, x: b.x, y0, y1, camY }; }
        }
      }
    }
    // ---- 7. the weather: one frame's blits on the main canvas, in order, against the platforms pass
    const mistOf = (img) => (typeof _LX_STAIR_MIST !== 'undefined' && _LX_STAIR_MIST.find((L) => L.cv && L.cv === img)) || null;
    // one whole game frame, bracketed by its own drawBackground calls (the game does not render on every animation frame)
    const oneFrame = async () => { const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage, oPl = window.drawPlatforms, oBg = window.drawBackground, oCE = document.createElement;
      const rec = { bg: 0, n: 0, pl: -1, halo: -1, mist: [], made: 0 }, on = () => rec.bg === 1;
      const haloOf = () => (typeof _LX_GF !== 'undefined' && _LX_GF.bakes && _LX_GF.bakes.ws_halo) || null;   // the sphere's glow (_lxStairSkyDraw)
      window.drawBackground = function () { rec.bg++; return oBg.apply(this, arguments); };
      P.drawImage = function (img, ...a) { if (this === main && on()) { rec.n++; const L = mistOf(img); if (L) rec.mist.push({ k: L.k, at: rec.n, x: +a[0].toFixed(2) }); else if (img && img === haloOf()) rec.halo = rec.n; } return oDI.apply(this, [img, ...a]); };
      window.drawPlatforms = function () { if (on()) rec.pl = rec.n; return oPl.apply(this, arguments); };
      document.createElement = function (t) { if (on() && String(t).toLowerCase() === 'canvas') rec.made++; return oCE.apply(this, arguments); };
      for (let i = 0; i < 180 && rec.bg < 2; i++) await new Promise((r) => requestAnimationFrame(r));
      P.drawImage = oDI; window.drawPlatforms = oPl; window.drawBackground = oBg; document.createElement = oCE; return rec; };
    // a headless browser paints slowly, so the frame-time governor soon turns very-low FX on (which drops the haze): each
    // recording starts from a clear governor
    const unslow = () => { LX_PERF.veryLowFx = false; LX_PERF.veryLowFxUntil = 0; LX_PERF.lowFx = false; LX_PERF.slowFrames = 0; };
    out.mist = { flag: !!game.mapData.stairMist, tint: game.mapData.bgTint || null };
    await standAt(2500); await frame(); await frame(); unslow();   // the sphere is on screen here
    { const f = await oneFrame(); const ks = [...new Set(f.mist.map((m) => m.k))];
      out.mist.keys = ks; out.mist.blits = f.mist.length; out.mist.made = f.made;
      out.mist.orderOk = f.pl > 0 && f.mist.filter((m) => m.k !== 'haze').every((m) => m.at <= f.pl) && f.mist.filter((m) => m.k === 'haze').every((m) => m.at > f.pl);
      out.mist.glowOver = f.halo > 0 && f.mist.filter((m) => m.k !== 'haze').every((m) => m.at < f.halo);
      if (typeof _lxStairMistDraw === 'function') { const t0 = performance.now(); for (let i = 0; i < 60; i++) { _lxStairMistDraw(false); _lxStairMistDraw(true); } out.mist.msPerFrame = +((performance.now() - t0) / 60).toFixed(3); } }
    { LX_PERF.veryLowFx = true; LX_PERF.veryLowFxUntil = performance.now() + 60000; await frame(); const f = await oneFrame(); out.mist.veryLow = [...new Set(f.mist.map((m) => m.k))]; unslow(); }
    { game._reduceMotion = true; await frame(); const f1 = await oneFrame(); await sleep(600); const f2 = await oneFrame(); game._reduceMotion = false;
      const far = (f) => (f.mist.find((m) => m.k === 'far') || {}).x; out.mist.still = [far(f1), far(f2)];
      await frame(); const g1 = await oneFrame(); await sleep(600); const g2 = await oneFrame(); out.mist.moving = [far(g1), far(g2)]; }
    // a flat map's ground keeps its foot, and has no weather
    loadMap('town', 300); await sleep(1500);
    out.townFootless = game.mapData.platforms.filter((p) => p.type === 'ground' && (_lxGroundJoin(p) & 4096)).length;
    { const f = await oneFrame(); out.townMist = f.mist.length; }
    return out;
  });
  const fillsOk = (key) => R.fills.length === 3 && R.fills.every((f) => f[key].length >= 1 && f[key].every((y) => y[0] <= 0 && y[1] >= 560));
  ok('1a. the night tint covers the whole screen at the foot, the middle and the top of the Stair (it stopped at 590 - camera.y)', fillsOk('tint'), J(R.fills.map((f) => ({ camY: f.camY, tint: f.tint }))));
  ok('1b. so does the stun/freeze vignette', fillsOk('vig'), J(R.fills.map((f) => ({ camY: f.camY, vig: f.vig }))));
  ok('2. the Stair\'s 21 ground pieces draw no flat foot; the town\'s still do', R.ground === 21 && R.footless === 21 && R.townFootless === 0, J({ ground: R.ground, footless: R.footless, town: R.townFootless }));
  const u = R.under || {};
  ok('3. one underside line under the whole climb: never above a foot (8 px below the lowest), at most ~80 px below (the stringer is a 35 degree diagonal under 42 px risers now), smooth (under 1 px per px)',
    u.chains === 1 && u.pieces === 21 && u.minGap >= 7.99 && u.maxGap <= 80 && u.maxStep <= 4, J(u));
  ok('4. the notches under the risers show the stone on screen, not the sky', R.notch.n >= 12 && R.notch.good / R.notch.n >= 0.9, J(R.notch));
  ok('5. flat treads: no seam is ramped and each of the 20 steps up is a riser the join carries (to its 31 px limit); no page errors', R.ramps === 0 && R.risers.length === 20 && R.risers.every((d) => d === 0) && errs.length === 0, J({ ramps: R.ramps, risers: R.risers, errs: errs.slice(0, 3) }));
  ok('6. one wall: below every riser on screen the seam\'s rows either side keep their mortar lines in line (correlation >= 0.5)', R.cont.seams >= 6 && R.cont.worst >= 0.5, J(R.cont));
  const M = R.mist || {};
  ok('7a. the weather: a darker sky and four baked strips a frame in <= 10 blits - overcast, banks and sea under the sphere glow and before the platforms, the haze after the entities - with no canvas made per frame',
    M.flag && /^rgba\(/.test(M.tint || '') && ['top', 'far', 'sea', 'haze'].every((k) => (M.keys || []).includes(k)) && M.blits <= 10 && M.orderOk && M.glowOver && M.made === 0, J(M));
  ok('7b. very-low FX drops the haze; reduced motion stills the drift (it moves otherwise); another map has none',
    (M.veryLow || []).length === 3 && !(M.veryLow || []).includes('haze') && M.still && M.still[0] === M.still[1] && M.moving && M.moving[0] !== M.moving[1] && R.townMist === 0, J({ veryLow: M.veryLow, still: M.still, moving: M.moving, town: R.townMist }));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
