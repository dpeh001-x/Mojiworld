// STAIR-SOLID (per user: "The stairs should be like actual stairs whereby i will need to jump up. Also the blackoutline needs to be neatly
// lining the stairs"). The Weight-Bearer's Stair used to be walkable: a ground piece has no side wall, so held Right snapped the hero up
// every 30 px riser. Now (map flag solidRisers):
//   1. only the Stair carries the flag;
//   2. held Right from the Sanctum landing stops at the first riser's face and stays there (feet 1040, never up on the tread);
//   3. Right + jump climbs it: the hero is on landing A (feet 890) inside 25 s;
//   4. walking left steps DOWN every riser to the Sanctum landing (no wall faces that way);
//   5. a drop from above still lands on a tread's top;
//   6. a hero set down inside a riser by one step is stopped at its face; one set down deeper than a step (a blink through several
//      steps, a spawn) still snaps onto the tread, so nobody is trapped;
//   7. the keyline is ONE line along the profile: dark on every tread top and straight up every riser seam, level (nothing rises above
//      it - the studs are gone), and no page errors.
// The build before fails 2-3 and 7.   node scripts/stair_solid_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11853), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], J = (x) => JSON.stringify(x).slice(0, 420);
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(async () => {
    const s = (ms) => new Promise((r) => setTimeout(r, ms));
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 80; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos;
    await s(2500); const vi = document.getElementById('void-intro-overlay'); if (vi) vi.classList.remove('show');
    loadMap('weightbearerStair', 300); await s(2500); game.paused = false;
    // the harness keeps the hero alive and un-interrupted; it never touches the hero's x or y except where a step says so
    window.__keep = setInterval(() => { player.hp = player.maxHp; player.invulnerable = 9e6; game.paused = false; }, 100);
    window.__at = () => ({ cx: Math.round(player.x + player.w / 2), l: Math.round(player.x), r: Math.round(player.x + player.w), feet: Math.round(player.y + player.h), gnd: !!player.onGround, map: game.currentMap });
    window.__put = async (cx, feet) => { player.x = cx - player.w / 2; player.y = feet - player.h; player.vx = 0; player.vy = 0; await s(500); };
  });
  const at = () => ev(() => window.__at());
  const hold = async (key, ms, until) => { await page.keyboard.down(key); const t0 = Date.now(); let a = await at(); while (Date.now() - t0 < ms && !(until && until(a))) { await sleep(120); a = await at(); } await page.keyboard.up(key); await sleep(250); return at(); };

  // [1] only the Stair carries the flag
  const flags = await ev(() => Object.keys(MAPS).filter((k) => MAPS[k].solidRisers));
  ok('[1] only the Weight-Bearer\'s Stair is flagged solidRisers', flags.length === 1 && flags[0] === 'weightbearerStair', flags);

  // [2] held Right stops at the first riser
  await ev(() => window.__put(300, 1040));
  const a2 = await hold('ArrowRight', 20000, (a) => a.r >= 518);   // until it arrives: a loaded machine walks slowly
  await sleep(800);
  ok('[2] held Right from the Sanctum landing stops at the first riser (right edge at its face x=520, feet still 1040)', a2.r >= 518 && a2.r <= 522 && a2.feet === 1040 && a2.gnd, a2);
  const a2b = await hold('ArrowRight', 1500);
  ok('[2b] and keeps standing there (nothing pops it up the tread)', a2b.r >= 518 && a2b.r <= 522 && a2b.feet === 1040, a2b);

  // [3] Right + jump climbs
  const t3 = Date.now(); let a3 = await at();
  await page.keyboard.down('ArrowRight');
  while (Date.now() - t3 < 25000 && !(a3.feet <= 890 && a3.cx >= 1060)) { await page.keyboard.down('Space'); await sleep(70); await page.keyboard.up('Space'); await sleep(330); a3 = await at(); }
  await page.keyboard.up('ArrowRight'); await sleep(300);
  ok('[3] Right + jump climbs the first flight: on or above landing A (feet <= 890, past x=1060) inside 25 s', a3.feet <= 890 && a3.cx >= 1060, { a3, s: Math.round((Date.now() - t3) / 1000) });

  // [4] walking left steps down every riser
  await ev(() => window.__put(840, 950));
  const a4 = await hold('ArrowLeft', 14000, (a) => a.feet === 1040 && a.cx < 480);
  ok('[4] held Left from step 3 steps down every riser to the Sanctum landing (feet 1040, left of the first riser)', a4.feet === 1040 && a4.cx < 500 && a4.gnd, a4);

  // [5] a drop from above lands on the tread's top
  await ev(() => window.__put(700, 700)); await sleep(1200);
  const a5 = await at();
  ok('[5] a drop from above lands on the tread (centre 700: feet 980)', a5.feet === 980 && a5.gnd, a5);

  // [6] set down inside a riser
  await ev(() => window.__put(540, 1040));   // 30 px into the first tread (top 1010)
  const a6 = await at();
  ok('[6a] set down one step inside the first riser: stopped at its face, on the landing (right edge 520, feet 1040)', a6.r <= 522 && a6.feet === 1040 && a6.gnd, a6);
  await ev(() => window.__put(580, 1065));   // 55 px into the tread: deeper than a step
  const a6b = await at();
  ok('[6b] set down deeper than a step (55 px): snaps onto the tread (feet 1010), never trapped', a6b.feet === 1010 && a6b.gnd, a6b);

  // [7] the keyline
  await ev(() => window.__put(300, 1040)); await sleep(800);
  const R = await ev(async () => {
    LX_PERF.veryLowFx = true; LX_PERF.veryLowFxUntil = performance.now() + 60000;   // the frame-time governor may or may not have the front haze on in a slow headless run; a haze over the line would lift it
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (let i = 0, same = 0, last = null; i < 50 && same < 4; i++) { await new Promise((r) => setTimeout(r, 120)); const c = game.camera.x + ',' + game.camera.y; same = c === last ? same + 1 : 0; last = c; }   // the camera has settled: the canvas shows the frame the numbers describe
    await frame(); await frame();
    const cv = document.getElementById('gameCanvas') || document.querySelector('canvas'), main = cv.getContext('2d'), dpr = cv.width / W;
    const camX = game.camera.x, camY = Math.round(game.camera.y || 0), img = main.getImageData(0, 0, cv.width, cv.height).data;
    const px = (wx, wy) => { const x = Math.round((wx - camX) * dpr), y = Math.round((wy - camY) * dpr); if (x < 2 || y < 2 || x > cv.width - 2 || y > cv.height - 2) return null; const i = (y * cv.width + x) * 4; return 0.3 * img[i] + 0.59 * img[i + 1] + 0.11 * img[i + 2]; };
    const G = game.mapData.platforms.filter((p) => p.type === 'ground').sort((a, b) => a.x - b.x);
    const out = { treads: { n: 0, dark: 0, bad: [] }, risers: { n: 0, dark: 0, bad: [] } };
    for (let k = 0; k < G.length; k++) {
      const p = G[k];
      for (const f of [0.25, 0.5, 0.75]) {
        const wx = p.x + p.w * f; if (wx - camX < 20 || wx - camX > W - 20) continue;
        // the line: darkest sample within 2 px of the tread top; above it: sample 5 and 8 px up (sky), must not hold a stud
        let line = 255; for (let d = -2; d <= 2; d++) { const v = px(wx, p.y + d); if (v != null) line = Math.min(line, v); }
        const up5 = px(wx, p.y - 5), up8 = px(wx, p.y - 8), below = px(wx, p.y + 6);
        if (up5 == null || up8 == null || below == null) continue;
        out.treads.n++;
        if (line < 45 && line < up8 - 15 && line < below - 15) out.treads.dark++; else if (out.treads.bad.length < 4) out.treads.bad.push({ k, wx: Math.round(wx), line: Math.round(line), up8: Math.round(up8), below: Math.round(below) });
      }
      const N = G[k + 1]; if (!N || N.y >= p.y) continue;
      const seam = N.x; if (seam - camX < 20 || seam - camX > W - 20) continue;
      // the riser: the whole height between the lower tread top (p.y) and the next one up (N.y), sampled at 25/50/75 %
      let darkN = 0, n = 0; for (const f of [0.25, 0.5, 0.75]) { const wy = N.y + (p.y - N.y) * f; let line = 255; for (let d = -2; d <= 2; d++) { const v = px(seam + d, wy); if (v != null) line = Math.min(line, v); } n++; if (line < 45) darkN++; }
      out.risers.n++; if (darkN === n) out.risers.dark++; else if (out.risers.bad.length < 4) out.risers.bad.push({ k, seam, darkN });
    }
    LX_PERF.veryLowFx = false; LX_PERF.veryLowFxUntil = 0; LX_PERF.lowFx = false; LX_PERF.slowFrames = 0;
    // the studs: paint one tread as the game does and count what sits on it (_cuteDecor / _cuteDroops), with and without the footless bit
    out.decor = {}; const md = game.mapData, th = _pickFloorTheme(md), tint = { top: md.platTint.top, body: md.platTint.body, exact: true }, p2 = G[2], v = _lxGroundJoin(p2);
    const oD = window._cuteDecor, oR = window._cuteDroops; let nD = 0, nR = 0; window._cuteDecor = function () { nD++; return oD.apply(this, arguments); }; window._cuteDroops = function () { nR++; return oR.apply(this, arguments); };
    const cv2 = document.createElement('canvas'); cv2.width = 200; cv2.height = 200; const c2 = cv2.getContext('2d');
    try { _paintCutePlatform(c2, 20, 30, p2.w, p2.h, tint, true, 1, th, v); out.decor.stair = nD + nR; nD = nR = 0; _paintCutePlatform(c2, 20, 30, p2.w, p2.h, tint, true, 1, th, v & ~4096); out.decor.plain = nD + nR; out.decor.footless = !!(v & 4096); } finally { window._cuteDecor = oD; window._cuteDroops = oR; }
    return out;
  });
  ok('[7a] the keyline is dark along every tread top on screen', R.treads.n >= 6 && R.treads.dark === R.treads.n, R.treads);
  ok('[7b] nothing sits on a stair tread (no studs or drips painted), while the same piece without the footless bit still gets them', R.decor.footless && R.decor.stair === 0 && R.decor.plain > 0, R.decor);
  ok('[7c] the keyline runs straight up every riser seam on screen', R.risers.n >= 3 && R.risers.dark === R.risers.n, R.risers);
  ok('[8] no page errors', errs.length === 0, errs);
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
