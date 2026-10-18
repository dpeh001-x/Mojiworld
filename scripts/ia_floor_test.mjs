// INTERDIMENSIONAL ASCENSION FLOOR (v0.30.1848, per user: "make the bottom floor stretch out the map end to end, and make the floor nicer").
// The tower is 800 px wide, the screen shows 960: the ground used to end in two caps with backdrop either side. A `cosmicFloor` map paints its ground with _lxCosmicFloorDraw.
//   1. the map carries the flag; its ground is still ONE platform x 0..800 (collision and spawns untouched) and the hero stands on it
//   2. the painter runs for the ground and the generic slab does not; another map's ground still takes the generic slab and the painter declines it
//   3. the floor covers the screen from edge to edge - the picture reaches past x = 0 and x = W, and it is a slab at least 100 px thick - with the hero at either wall and at 1280, 1920, 820 and 2560 wide
//   4. it is one cached picture, tracked by the canvas budget, and costs about one picture draw a frame; a released picture is baked again
//   5. no page errors
//   node scripts/ia_floor_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11898), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 280) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('mage'); player.job = null; player._tutorialSeen = true; player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await new Promise((r) => setTimeout(r, 2500)); player.level = 75; player._god = true;
    window.__fl = { floorDraws: [], fills: [], slab: 0, slabGround: 0, painted: 0 };
    const di = ctx.drawImage.bind(ctx); ctx.drawImage = function (img, ...a) { if (img && img === window._lxCFloorCv_probe()) window.__fl.floorDraws.push(a.slice(0, 4).map(Number)); return di(img, ...a); };
    window._lxCFloorCv_probe = () => (typeof _lxCFloorCv !== 'undefined' ? _lxCFloorCv : null);
    const fr = ctx.fillRect.bind(ctx); ctx.fillRect = function (x, y, w, h) { if (typeof _LX_CFLOOR !== 'undefined' && ctx.fillStyle === _LX_CFLOOR.bottom) window.__fl.fills.push([x, y, w, h]); return fr(x, y, w, h); };
    const dc = _drawCutePlatform; window._drawCutePlatform = function (sx, y, w, h, t, ground) { window.__fl.slab++; if (ground) window.__fl.slabGround++; return dc.apply(this, arguments); };
    const cf = _lxCosmicFloorDraw; window._lxCosmicFloorDraw = function (sx, p) { const r = cf(sx, p); if (r) window.__fl.painted++; return r; };
  });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    loadMap('interdimensionalAscension', 400); await sleep(3500); game.paused = false; player._god = true;
    const md = game.mapData; out.flag = md.cosmicFloor === true; out.ww = md.worldWidth;
    out.ground = md.platforms.filter((p) => p.type === 'ground').map((p) => [p.x, p.y, p.w, p.h]);
    for (let i = 0; i < 60 && !player.onGround; i++) await sleep(50);
    out.stands = { onGround: player.onGround, feet: Math.round(player.y + player.h), gy: out.ground[0] && out.ground[0][1] };
    window.__fl.floorDraws.length = 0; window.__fl.fills.length = 0; window.__fl.painted = 0; window.__fl.slabGround = 0; window.__fl.slab = 0;
    await sleep(1200); const frames = window.__fl.painted;
    out.map1 = { painted: window.__fl.painted, slabGround: window.__fl.slabGround, draws: window.__fl.floorDraws.length, per: window.__fl.floorDraws.length / Math.max(1, window.__fl.painted) };
    out.tracked = (typeof _lxCvLru !== 'undefined') && !!_lxCFloorCv && _lxCvLru.has(_lxCFloorCv);
    out.W = W; out.H = H;
    return out;
  });
  const cover = async (w, h, px, tag) => {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(700);
    return page.evaluate(async (px) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); player.x = px; player.vx = 0; await sleep(600);
      window.__fl.floorDraws.length = 0; window.__fl.fills.length = 0; await sleep(500);
      const d = window.__fl.floorDraws, f = window.__fl.fills; if (!d.length) return { none: true };
      const L = d[d.length - 1], bot = (game.camera.y || 0) + H;
      return { left: L[0], right: L[0] + L[2], W, camX: Math.round(game.camera.x), bottomTo: Math.max(L[1] + L[3], f.length ? f[f.length - 1][1] + f[f.length - 1][3] : 0), bot, n: d.length };   // the picture's own bottom, or the flat fill under it
    }, px);
  };
  const C = [['1280 wall-left', await cover(1280, 720, 5)], ['1280 wall-right', await cover(1280, 720, 795)], ['1920', await cover(1920, 1080, 400)], ['820', await cover(820, 600, 400)], ['2560', await cover(2560, 1080, 400)]];
  const other = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); window.__fl.painted = 0; window.__fl.slabGround = 0; loadMap('forest', 300); await sleep(2500); game.paused = false; await sleep(800);
    const d = { painted: window.__fl.painted, slabGround: window.__fl.slabGround, flag: !!game.mapData.cosmicFloor, declines: _lxCosmicFloorDraw(0, game.mapData.platforms.find((p) => p.type === 'ground')) === false };
    return d;
  });
  const rebake = await page.evaluate(async () => {   // a released picture is baked again at the next draw
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); loadMap('interdimensionalAscension', 400); await sleep(3000); game.paused = false;
    const a = _lxCFloorCv; _lxCFloorCv = null; await sleep(500); return { rebuilt: !!_lxCFloorCv && _lxCFloorCv !== a };
  });
  ok('1a. the map carries the flag and is still 800 wide with ONE ground platform x 0..800 (collision untouched)', R.flag && R.ww === 800 && JSON.stringify(R.ground) === JSON.stringify([[0, 14070, 800, 60]]), [R.flag, R.ww, R.ground]);
  ok('1b. the hero stands on it (feet on the ground line)', R.stands.onGround && R.stands.feet === R.stands.gy, R.stands);
  ok('2a. the painter runs for the ground and the generic slab does not', R.map1.painted > 5 && R.map1.slabGround === 0, R.map1);
  ok('2b. another map still takes the generic slab, and the painter declines its ground', other.painted === 0 && other.slabGround > 0 && !other.flag && other.declines, other);
  for (const [tag, c] of C) ok('3. edge to edge - ' + tag + ': the picture reaches past both sides of the screen and is a thick slab (100+ px under the surface)', !c.none && c.left <= 0 && c.right >= c.W && c.bottomTo - 14070 >= 100, c);
  ok('4a. one picture draw a frame, from one cached picture tracked by the canvas budget', R.tracked && R.map1.per <= 1.01, [R.tracked, R.map1]);
  ok('4b. a released picture is baked again at the next draw', rebake.rebuilt, rebake);
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
