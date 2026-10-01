// The megamall's splendor pass (per user: "continue the megamall redesign make more splendor", then "use ludo.ai to generate the
// images such as the chandelier and carpet"), on top of the megamall-aaa build. One page, the real game, frames rendered whole:
//   1. three crystal chandeliers (their art) hang in the mall, the grand one over the atrium: each is drawn, still drawn at low FX
//   2. each clears every slab: it ends above the deck or bridge beneath it (the grand one hangs behind the bridge's glass rail)
//   3. the polished concourse: once its art has decoded, the floor's one bake carries the storefronts' reflections (the marble
//      under each differs from the plain floor), the gold compass-rose medallion before the fountain and the rose carpet before
//      the entrance; two gold flower urns (map props) frame the atrium, mirrored about it, each mirrored in the floor too
//   4. string lights hang along every balcony rail, and twinkle; gold rosettes on the deck fascias' seams, a gold sunburst in
//      the entrance's arch, a sheen that sweeps the marquee
//   5. no page errors
// The build before fails 1-4 (megamall_test's section 7 still guards what the mall's layers cost, these included).
//   node scripts/megamall_splendor_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11872), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 320) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    game.paused = false; window._god = true; player.invulnerable = 1e9;
    try { window._perfTick = function () {}; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; } catch (e) {}   // pin the quality governor (headless trips it)
    loadMap('everdawn_megamall', 900); await sleep(1500);
    for (const x of [0, 450, 840]) { player.x = x + 480; await sleep(900); }   // decode and bake everything once
    const cfg = typeof _lxMallCfg === 'function' ? _lxMallCfg() : null, gy = (cfg && cfg.floorY) || 480, d = _LX_DPR;
    game.paused = true;
    const grab = (x, y, w, h) => ctx.getImageData(Math.round(x * d), Math.round(y * d), Math.round(w * d), Math.round(h * d)).data;
    const shot = (t, rect) => { game.time = t; _lxRenderOnly = true; try { ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; } return grab(...rect); };
    const diff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); return +(s / (A.length / 4) / 3).toFixed(2); };
    const stubbed = (name, fn) => { const o = window[name]; window[name] = function () {}; try { return fn(); } finally { window[name] = o; } };
    const px = (cv, x, y) => Array.from(cv.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data);
    const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    // ---- 1 / 2 ----
    const chs = (cfg && cfg.chandeliers) || [];
    out.chand = chs.map((ch) => {
      const S = (ch.w || 180) / 184; game.camera.x = ch.x - 480; player.x = ch.x - player.w / 2;
      const rect = [480 - 80 * S, 4, 160 * S, 130 * S], T = 6000;
      const on = shot(T, rect), off = stubbed('_lxMallChandeliers', () => shot(T, rect));
      LX_PERF.lowFx = true; let low;
      try { const a = shot(T, rect), b = stubbed('_lxMallChandeliers', () => shot(T, rect)); low = diff(a, b); } finally { LX_PERF.lowFx = false; }
      const bake = _lxMallBakes['chand' + (cfg.lux || {}).chandelier + ch.w + '|' + d]; let lowest = -1;
      if (bake) { const im = bake.getContext('2d').getImageData(0, 0, bake.width, bake.height).data; for (let y = bake.height - 1; y >= 0 && lowest < 0; y--) for (let x = 0; x < bake.width; x++) if (im[(y * bake.width + x) * 4 + 3] > 24) { lowest = y; break; } }
      const bottom = lowest < 0 ? null : +(ch.y + (lowest + 1) / d).toFixed(1);
      const under = game.mapData.platforms.filter((p) => p.type !== 'ground' && ch.x >= p.x && ch.x <= p.x + p.w).map((p) => p.y).sort((a, b) => a - b)[0];
      return { x: ch.x, w: ch.w, drawn: diff(on, off), low, bottom, slab: under != null ? under : gy };
    });
    // ---- 3 ----
    const fk = Object.keys(_lxMallBakes).find((k) => k.indexOf('floor') === 0) || '', floor = _lxMallBakes[fk];
    out.floorKey = fk.replace(/\|[\d.]+$/, '');
    if (floor) {
      const ww = game.mapData.worldWidth, bottom = (game.mapData.worldHeight || H) + 40, plain = document.createElement('canvas'); plain.width = floor.width; plain.height = floor.height;
      const pc = plain.getContext('2d'); pc.scale(d, d); pc.translate(0, -gy); _lxMallFloorArt(pc, cfg, ww, gy, bottom);
      const props = (MAP_PROPS[game.currentMap] || []).filter((p) => p.y >= gy - 4 && /mall_shop_/.test(p.key));
      out.refl = props.map((p) => { const a = px(plain, p.x, 12), b = px(floor, p.x, 12); return { key: p.key, dist: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) }; });
      out.sun = px(floor, cfg.atriumX || 900, 42); out.carpet = cfg.entrance ? px(floor, cfg.entrance.x, 30) : null;
      out.urns = (MAP_PROPS[game.currentMap] || []).filter((p) => p.key === 'mall_flower_urn').map((p) => { const a = px(plain, p.x, 10), b = px(floor, p.x, 10), im = LX_OBJECTS[p.key];
        return { x: p.x, y: p.y, ok: !!im && im.naturalWidth > 0, dist: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) }; });
    }
    // the string lights on every rail (in the rail's own bake: a bulb of its middle swag sits where the art puts it), and their
    // twinkle (two moments of the west deck's rail, with and without it)
    const deckP = game.mapData.platforms.filter((p) => p.type !== 'ground'), lim = LX_OBJECTS[(cfg.lux || {}).lights];
    out.lights = deckP.map((p) => { const b = _lxMallBakes['rail' + p.w + 'L|' + d], G = lim && _lxMallSwagGeom(lim, p.w); if (!b || !G) return { w: p.w, bulb: null };
      return { w: p.w, bulb: px(b, 1 + G.posts[2] - _LX_MALL_SWAG.hooks[0] * G.aw + 0.5 * G.aw, 45 + G.top + 0.706 * G.ah) }; });
    { const p = deckP[0]; game.camera.x = Math.max(0, p.x - 100); player.x = p.x + p.w + 300; const RR = [p.x - game.camera.x, p.y - 44, Math.min(p.w, 900), 30];
      const a = shot(9000, RR), b = shot(9040, RR), c = stubbed('_lxMallLuxLights', () => shot(9000, RR)), e = stubbed('_lxMallLuxLights', () => shot(9040, RR));
      out.twinkle = diff(a, b); out.twinkleOff = diff(c, e); }
    // ---- 4 ----
    const deck = _lxMallBakes['deck490|' + d]; out.rosette = deck ? px(deck, 62.5 + 2.7, 20.25) : null;   // a petal of the first seam's rosette
    game.camera.x = 0; player.x = 600; const arch = [cfg.entrance.x - 50, gy - 176, 100, 34];
    out.fanlight = diff(shot(7000, arch), stubbed('_lxMallLuxEntrance', () => shot(7000, arch)));
    game.camera.x = (cfg.marquee.x || 900) - 480; const mqR = [480 - 160, cfg.marquee.y - 16, 320, 32];
    const sign = (t) => { game.time = t; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, W, H); _lxMallSigns(); return grab(...mqR); };
    const A = sign(420 * 20 + 24), B = sign(420 * 20 + 24 + 54); let changed = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) changed++;
    out.sheen = changed;
    game.paused = false;
    return out;
  });
  const ch = R.chand || [], grand = ch.slice().sort((a, b) => b.w - a.w)[0];
  ok('1. three chandeliers hang in the mall, the grand one over the atrium', ch.length === 3 && !!grand && grand.x === 900, ch.map((c) => [c.x, c.w]));
  ok('1. each one is drawn, and still drawn at low FX', ch.length === 3 && ch.every((c) => c.drawn > 6 && c.low > 4), ch.map((c) => [c.x, c.drawn, c.low]));
  ok('2. each clears every slab: it ends above the deck or bridge beneath it', ch.length === 3 && ch.every((c) => c.bottom !== null && c.bottom <= c.slab), ch.map((c) => [c.x, c.bottom, c.slab]));
  ok('3. the floor\'s one bake carries the polish, every mirrored piece and its own art decoded', /\|lux(\d+)\/\1:2\/2$/.test(R.floorKey || '') && !/\|lux0\//.test(R.floorKey), R.floorKey);
  ok('3. each storefront is mirrored in the marble below it (it differs from the plain floor there)', (R.refl || []).length >= 4 && R.refl.every((r) => r.dist >= 12), R.refl);
  const gold = (p) => !!p && p[0] > 150 && p[0] - p[2] > 80 && p[1] > 100;   // warm gold, lit or shaded (the pink marble and fascia fail it)
  ok('3. a gold compass rose is inlaid before the fountain, and a rose carpet lies before the entrance', gold(R.sun) && !!R.carpet && R.carpet[0] > 170 && R.carpet[0] - R.carpet[1] > 50 && R.carpet[2] > R.carpet[1], { sun: R.sun, carpet: R.carpet });
  const U = R.urns || [];
  ok('3. two gold flower urns stand on the floor, mirrored about the atrium, each mirrored in the polish', U.length === 2 && U.every((u) => u.ok && u.y === 480 && u.dist >= 12) && Math.abs(U[0].x + U[1].x - 1800) <= 4, U);
  ok('4. string lights hang along every balcony rail (in its bake: an amber bulb where the art puts one)', (R.lights || []).length === 3 && R.lights.every((l) => !!l.bulb && l.bulb[0] > 200 && l.bulb[1] > 130 && l.bulb[2] < 150), R.lights);
  ok('4. the lights twinkle (the rail changes between two moments, and not without them)', R.twinkle > R.twinkleOff * 2 + 0.3, { on: R.twinkle, off: R.twinkleOff });
  ok('4. gold rosettes sit on the deck fascias\' seams', gold(R.rosette), R.rosette);
  ok('4. a gold sunburst fills the entrance\'s arch', R.fanlight > 3, R.fanlight);
  ok('4. a sheen sweeps the marquee (the same bulb phase, with and without it)', R.sheen > 150, R.sheen);
  ok('5. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
