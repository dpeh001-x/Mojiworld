// The Everdawn Megamall as a mall (per user: "Could we improve the megamall design and layout, it feels abit bare and poor in
// design" / "Make it look like a AAA grade megamall"). One page, the real game:
//   1. the mall is built: three decks drawn as balconies, two escalators, six storefronts with their names on their own boards
//   2. Up at the foot of each escalator rides it to its deck; Up at the top rides it back down - and the concourse under it stays open
//   3. the town door works both ways: Up at the entrance goes to town, and walking in from town lands at the entrance
//   4. every merchant stands on a floor or a deck, and every prop stands on one too
//   5. the skybridge is in reach: a warrior (the shortest double jump) gets onto it from a deck's inner end
//   6. the atrium fountain (per user: "the fountain can be better improved"): its own art, asked for with the map, drawn behind
//      the escalators with its base on the floor, its water moving at rest and its show running (three patterns in turn)
//   7. what the mall costs: whole frames (a raster flush each) against the same frames with the mall's layers stubbed, paired
//      round by round; and no page errors
//   node scripts/megamall_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11871), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof tryPortal === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    game.paused = false; window._god = true; player.invulnerable = 1e9;
    try { window._perfTick = function () {}; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; } catch (e) {}   // pin the quality governor: headless trips it, and low FX changes what the mall draws
    window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__up = () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', code: 'ArrowUp', bubbles: true })), 80); };
    window.__stand = async (x, feet) => { player._lxRide = null; player.x = x - player.w / 2; player.y = feet - player.h; player.vx = 0; player.vy = 0; await __sleep(350); };
    loadMap('everdawn_megamall', 300); await __sleep(2500);
  });
  // ---- 1 ----
  const b1 = await page.evaluate(async () => {
    const cfg = _lxMallCfg(), decks = game.mapData.platforms.filter((p) => p.type === 'platform');
    for (const x of [200, 700, 1200, 1700]) { player.x = x; await __sleep(700); }   // sweep the camera so every storefront draws
    const keys = ['mall_shop_armory', 'mall_shop_apothecary', 'mall_shop_bank', 'mall_shop_gallery', 'mall_shop_boutique', 'mall_shop_cafe', 'mall_fountain'];
    const loaded = keys.filter((k) => LX_OBJECTS[k] && LX_OBJECTS[k].complete && LX_OBJECTS[k].naturalWidth > 0);
    const names = Object.keys(_lxMallBoardCache).map((k) => k.split('|')[0]);
    return { cfg: !!cfg, decks: decks.length, esc: (cfg && cfg.escalators || []).length, loaded: loaded.length, names: [...new Set(names)] };
  });
  ok('1. the mall is built: three decks, two escalators, six storefronts and the fountain loaded', b1.cfg && b1.decks === 3 && b1.esc === 2 && b1.loaded === 7, b1);
  ok('1. every shop\'s name is drawn on its own board', ['ARMORY', 'APOTHECARY', 'EVERDAWN TRUST', 'CURIO GALLERY', 'FASHIONISTA', 'SUNRISE CAFE'].every((n) => b1.names.includes(n)), b1.names);
  // ---- 2 ----
  const rides = await page.evaluate(async () => {
    const cfg = _lxMallCfg(), gy = cfg.floorY, out = [];
    for (const e of cfg.escalators) for (const up of [true, false]) {
      await __stand(up ? e.bx : e.tx, up ? gy : e.top); const was = [Math.round(player.x + player.w / 2), Math.round(player.y + player.h)];
      __up(); await __sleep(120); const riding = !!player._lxRide; await __sleep(1500);
      out.push({ up, from: was, riding, at: [Math.round(player.x + player.w / 2), Math.round(player.y + player.h)], want: up ? [e.tx, e.top] : [e.bx, gy], map: game.currentMap });
    }
    return out;
  });
  ok('2. Up at the foot of each escalator rides it to its deck, and Up at the top rides it back down', rides.length === 4 && rides.every((r) => r.riding && r.map === 'everdawn_megamall' && Math.abs(r.at[0] - r.want[0]) <= 6 && Math.abs(r.at[1] - r.want[1]) <= 2), rides);
  const open = await page.evaluate(() => { const g = game.mapData.platforms.filter((p) => p.type === 'ground'); return { grounds: g.length, span: g[0] && [g[0].x, g[0].x + g[0].w], blockers: game.mapData.platforms.filter((p) => p.type !== 'ground' && p.y > 380).length }; });
  ok('2. the concourse under the escalators stays open: one unbroken floor, nothing low enough to block a walk', open.grounds === 1 && open.span[0] === 0 && open.span[1] === 1800 && open.blockers === 0, open);
  // ---- 3 ----
  const door = await page.evaluate(async () => {
    const po = game.portals.find((p) => p.dest === 'town'); await __stand(po.x, 480); __up(); await __sleep(2500);
    const inTown = game.currentMap === 'town';
    const back = (MAPS.town.portals || []).find((p) => p.dest === 'everdawn_megamall'); await __stand(back.x, back.y || 480); __up(); await __sleep(2500);
    return { po: po.x, inTown, back: game.currentMap, at: Math.round(player.x + player.w / 2) };
  });
  ok('3. Up at the entrance goes to town, and walking in from town lands at the entrance', door.inTown && door.back === 'everdawn_megamall' && door.at >= door.po - 10 && door.at <= door.po + 180, door);
  // ---- 4 ----
  const stand = await page.evaluate(() => {
    const ps = game.mapData.platforms, top = (x, y) => ps.some((p) => x >= p.x - 2 && x <= p.x + p.w + 2 && Math.abs(p.y - y) <= 1);
    const npcs = (game.npcs || []).map((n) => ({ n: n.name, x: n.x, feet: (n.y != null ? n.y : 436) + 44 })).map((n) => ({ ...n, on: top(n.x, n.feet) }));
    const props = (MAP_PROPS.everdawn_megamall || []).map((p) => ({ k: p.key, x: p.x, y: p.y, on: top(p.x, p.y) }));
    return { npcs, props };
  });
  ok('4. every merchant stands on the floor or a deck', stand.npcs.length === 5 && stand.npcs.every((n) => n.on), stand.npcs.filter((n) => !n.on));
  ok('4. every prop stands on the floor or a deck', stand.props.length >= 10 && stand.props.every((p) => p.on), stand.props.filter((p) => !p.on));
  // ---- 5 ----
  const sky = await page.evaluate(async () => {
    const sb = game.mapData.platforms.filter((p) => p.type === 'platform').sort((a, b) => a.y - b.y)[0], deck = game.mapData.platforms.find((p) => p.type === 'platform' && p.x < sb.x);
    const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k === ' ' ? ' ' : k, code: k === ' ' ? 'Space' : k, bubbles: true }));
    await __stand(deck.x + deck.w - 18, deck.y);
    key('ArrowRight', true); key(' ', true); await __sleep(200); key(' ', false); await __sleep(120); key(' ', true); await __sleep(260); key(' ', false);
    await __sleep(1100); key('ArrowRight', false); await __sleep(400);
    return { feet: Math.round(player.y + player.h), sky: sb.y, x: Math.round(player.x + player.w / 2), span: [sb.x, sb.x + sb.w] };
  });
  ok('5. a warrior double-jumps from the west deck\'s inner end onto the skybridge', sky.feet === sky.sky && sky.x >= sky.span[0] && sky.x <= sky.span[1], sky);
  // ---- 6 ----
  const fo = await page.evaluate(async () => {
    const cfg = _lxMallCfg(), f = cfg.fountain, gy = cfg.floorY;
    const asked = _lxArt2MapKeys('everdawn_megamall').includes('prop:' + f.key), inProps = (MAP_PROPS.everdawn_megamall || []).some((p) => p.key === f.key || /fountain/.test(p.key));
    // the draw order inside the after-platforms pass, and where the art lands
    const order = [], oF = window._lxMallFountain, oE = window._lxMallEscBack, oD = ctx.drawImage, own = Object.prototype.hasOwnProperty.call(ctx, 'drawImage'), blits = [];
    window._lxMallFountain = function () { order.push('fountain'); return oF.apply(this, arguments); };
    window._lxMallEscBack = function () { order.push('esc'); return oE.apply(this, arguments); };
    ctx.drawImage = function (im, x, y, w, h) { if (arguments.length === 5 && im && im.width === Math.ceil(f.w * _LX_DPR)) blits.push({ y, h, nat: LX_OBJECTS[f.key].naturalHeight }); return oD.apply(this, arguments); };   // the fountain's bake, blitted 1:1
    game.paused = true; game.camera.x = f.x - 480; player.x = 150;
    try { ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); _lxMallAfterPlatforms(); } finally { window._lxMallFountain = oF; window._lxMallEscBack = oE; if (own) ctx.drawImage = oD; else delete ctx.drawImage; }
    const art = blits[0], base = art ? +(art.y + art.h * (1 - 24 / art.nat)).toFixed(2) : null;
    // the show: every jet rests between shows, and each of the three patterns lifts the inner jets high
    const T0 = _LX_MALL_FOUNT.SHOW * 60, rest = _LX_MALL_FOUNT.jets.map((j, i) => i).every((i) => _lxMallFountainJet(i, T0 + 400) === 0 && _lxMallFountainJet(i, T0 + 700) === 0);
    const peaks = [0, 1, 2].map((p) => { let m = 0; for (let ph = 0; ph < _LX_MALL_FOUNT.SHOW_LEN; ph += 3) m = Math.max(m, _lxMallFountainJet(2, T0 + p * _LX_MALL_FOUNT.SHOW + ph)); return Math.round(m); });
    const shapes = [0, 1, 2].map((p) => _LX_MALL_FOUNT.jets.map((j, i) => i).map((i) => Math.round(_lxMallFountainJet(i, T0 + p * _LX_MALL_FOUNT.SHOW + 60))).join(','));
    // pixels: the water moves at rest (against the same two moments with the water stubbed), and the show changes the pool
    const d = _LX_DPR, rx = Math.round((f.x - f.w * 0.42 - game.camera.x) * d), ry = Math.round((gy - 175) * d), rw = Math.round(f.w * 0.84 * d), rh = Math.round(120 * d);
    const shot = (t) => { game.time = t; _lxRenderOnly = true; try { ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; } return ctx.getImageData(rx, ry, rw, rh).data; };
    const diff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); return +(s / (A.length / 4) / 3).toFixed(3); };
    const oW = window._lxMallFountainWater, a0 = shot(T0 + 420), a1 = shot(T0 + 445), sh = shot(T0 + 150);
    window._lxMallFountainWater = function () {}; let n0, n1; try { n0 = shot(T0 + 420); n1 = shot(T0 + 445); } finally { window._lxMallFountainWater = oW; }
    game.paused = false;
    return { asked, inProps, order: order.join('>'), base, floor: gy, sink: f.sink != null ? f.sink : 2, rest, peaks, shapes, moving: diff(a0, a1), still: diff(n0, n1), show: diff(a0, sh) };
  });
  ok('6. the fountain is its own art, asked for with the map and not also a map prop', fo.asked && !fo.inProps, fo);
  ok('6. it is drawn behind the escalators, its base set into the floor by its sink (per user: slightly lower)', /^fountain>esc>esc$/.test(fo.order) && fo.base !== null && fo.sink >= 6 && Math.abs(fo.base - (fo.floor + fo.sink)) <= 1, { order: fo.order, base: fo.base, sink: fo.sink });
  ok('6. its show: the jets rest between shows, and a wave, a bloom and a pulse each lift the inner jets', fo.rest && fo.peaks.every((p) => p >= 90) && new Set(fo.shapes).size === 3, { peaks: fo.peaks, shapes: fo.shapes });
  ok('6. its water moves at rest (beyond the scene\'s own motion) and the show changes the pool', fo.moving > fo.still * 2 + 0.15 && fo.show > fo.moving, { moving: fo.moving, still: fo.still, show: fo.show });
  // ---- 7 ----
  const cost = await page.evaluate(async () => {
    loadMap('everdawn_megamall', 900); await __sleep(1500);
    for (const x of [0, 450, 840]) { player.x = x + 480; await __sleep(700); }   // decode and bake everything once
    game.paused = true;
    const names = ['_lxMallAtmos', '_lxMallAfterPlatforms', '_lxMallSigns', '_lxMallFront', '_lxMallPlatDraw'], orig = {}; for (const n of names) orig[n] = window[n];
    const set = (stub) => { for (const n of names) window[n] = !stub ? orig[n] : n === '_lxMallPlatDraw' ? function (sx, p) { return p.type !== 'ground'; } : function () {}; };
    const frame = () => { game.time++; const t0 = performance.now(); _lxRenderOnly = true; try { ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; _lxDrawFrame(performance.now()); } finally { _lxRenderOnly = false; } ctx.getImageData(0, 0, 1, 1); return performance.now() - t0; };
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1], ratios = [], full = [];
    try {
      for (let r = 0; r < 12; r++) for (const cx of [0, 450, 840]) {
        game.camera.x = cx; player.x = cx + 480; const m = {};
        for (const stub of (r % 2 ? [true, false] : [false, true])) { set(stub); const a = []; for (let i = 0; i < 10; i++) a.push(frame()); m[stub] = med(a.slice(2)); }
        ratios.push(m[false] / m[true]); full.push(m[false]);
      }
    } finally { set(false); game.paused = false; }
    return { ratio: +med(ratios).toFixed(3), frame: +med(full).toFixed(2), ms: +(med(full) - med(full) / med(ratios)).toFixed(2) };
  });
  // The share moves with machine load (the mall's own cost holds at ~5 ms in a software raster while the rest of the frame speeds up
  // or slows down: 1.33 at a 27 ms frame, 1.48 at 16.5 ms), so this is a guard against gross regressions, not a benchmark: the
  // build before the bakes, the backdrop tint and the 1:1 blits measured 1.72.
  ok(`7. the mall's layers add ${Math.round((cost.ratio - 1) * 100)}% to a whole frame, ${cost.ms} ms (budget 60%, software raster, paired)`, cost.ratio < 1.6, cost);
  ok('7. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log((fail ? 'FAIL(' + fail + ')' : 'PASS(0)') + ' - ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
