#!/usr/bin/env node
// v0.30.1605 town-beautify (per user: "beautify azure and emerald town more"; the Azure fountains' base "flat rather than rounded"; "the
// black outline should be exactly at the floor blackline"). In the browser unless noted:
//  [1] both towns paint every floating ledge through their skin (MAPS.azureAcademia.townSkin 'azure', emeraldVillage 'emerald') - the camera
//      swept across each town - and drawing leaves every platform's box untouched
//  [2] the two new ludo pieces (azure_crystal_lamp, emerald_lantern_post) are registered, decode, and their placements glow
//  [3] the props this pass places or moves stand ON the floor's black line (rows 479-480): the lowest art row of each one's actual draw
//      (its drawImage destination rect + its bbox row) is 479 or 480, and the floor beside it is dark on those rows - the five fountains,
//      the lamp, the armillary, the lantern post, the bonsai. (Frame diffs are noisy here: the town backdrops animate off the wall clock.)
//  [4] (files) the fountains' bases are flat: the lowest solid row varies by <= 4 px across the middle 90% of the base (the rounded art
//      sagged 25 / 44 px; the straightener's cap leaves the outer corners a little rounding); same canvas, and the bbox rows are unchanged
//  [5] Emerald's three low ledges stand on posts that end ON the keyline: the lowest solid row of the bake each one blits is 479 or 480
//  [6] the air: Emerald drops pink petals as well as its leaves, Azure twinkles glints as well as its petals (dusk: no birds, no fireflies)
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree. node scripts/town_beautify_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const sharp = require('sharp'); sharp.cache(false);
const PORT = Number(process.env.PORT || 10461); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
// [4] first - no browser
const flat = async (key, table) => {
  const { data, info } = await sharp(path.join(SERVE_ROOT, 'Sprites', 'objects', key + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3], low = new Int32Array(W).fill(-1);
  for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (A(x, y) >= 160) { low[x] = y; break; }
  const Y = Math.max(...low), base = []; for (let x = 0; x < W; x++) if (low[x] >= 0 && Y - low[x] <= H * 0.12) base.push(x);
  const x0 = base[0], x1 = base[base.length - 1], m = [];
  for (let x = Math.round(x0 + (x1 - x0) * 0.05); x <= Math.round(x1 - (x1 - x0) * 0.05); x++) m.push(low[x]);
  let bot = H - 1; outer: for (let y = H - 1; y >= 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { bot = y; break outer; } } else run = 0; } }
  let top = 0; outer2: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 12) { top = y; break outer2; }
  return { key, sag: Math.max(...m) - Math.min(...m), row: [top, bot, W, H].join(','), table };
};
const F = [await flat('azure_large_waterfountain', '299,1982,1984,1984'), await flat('azure_waterfountain', '250,849,850,850')];
ok('[4] the fountains\' bases are flat (within 4 px across the middle 90%; the rounded art sagged 25 / 44 px), same canvas and bbox rows', F.every((f) => f.sag <= 4 && f.row === f.table), F.map((f) => `${f.key} sag ${f.sag} px, ${f.row}`).join('; '));
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = { ver: GAME_VERSION, skin: {}, props: [], posts: [], air: {} };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player._god = true; window._perfLowFx = () => false; window.drawPlayer = () => {}; game.paused = false;
    const cv = document.getElementById('game'), g2 = cv.getContext('2d', { willReadFrequently: true });
    const hold = (cx) => { if (window.__h) cancelAnimationFrame(window.__h); const f = () => { game.camera.x = cx; game.camera.y = 0; player.x = cx + 900; window.__h = requestAnimationFrame(f); }; f(); };
    // the game's own draw calls, recorded for a few frames: the town backdrop animates off the wall clock, so frame diffs are noisy - the
    // destination rect of a prop's draw (and the pixels of a ledge's bake) say exactly where its art lands
    const record = async (ms) => { const P = CanvasRenderingContext2D.prototype, d0 = P.drawImage, got = [];
      P.drawImage = function (im, ...a) { if (this.canvas === cv) got.push(Object.assign(a.length >= 8 ? { im, x: a[4], y: a[5], w: a[6], h: a[7] } : { im, x: a[0], y: a[1], w: a[2] != null ? a[2] : im.width, h: a[3] != null ? a[3] : im.height }, { cam: game.camera.x })); return d0.call(this, im, ...a); };   // cam: the camera AT the draw (sub-step smoothing moves it)
      try { await sleep(ms); } finally { P.drawImage = d0; } return got; };
    const floorRows = (sx) => { const d = g2.getImageData(sx, 460, 1, 50).data, r = []; for (let i = 0; i < 50; i++) if (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2] < 70) r.push(460 + i); return r; };
    for (const map of ['azureAcademia', 'emeraldVillage']) {
      loadMap(map, 200); await sleep(2500);
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'dialog']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      window.updateAmbient0 = window.updateAmbient0 || updateAmbient; window.updateAmbient = () => {}; game.ambient.length = 0;
      const md = game.mapData, plats = (md.platforms || []).filter((p) => p.type !== 'ground'), snap = JSON.stringify(plats.map((p) => [p.x, p.y, p.w, p.h]));
      const drawn = new Set(); const f0 = window._lxSkinPlatDraw; if (typeof f0 === 'function') window._lxSkinPlatDraw = function (sx, p) { const r = f0.apply(this, arguments); if (r) drawn.add(p); return r; };
      for (let cx = 0; ; cx += 800) { const c = Math.min(cx, Math.max(0, (md.worldWidth || 1600) - cv.width)); hold(c); await sleep(350); if (c >= (md.worldWidth || 1600) - cv.width) break; }
      o.skin[map] = { set: md.townSkin || null, ledges: plats.length, skinned: plats.filter((p) => drawn.has(p)).length, still: JSON.stringify(plats.map((p) => [p.x, p.y, p.w, p.h])) === snap };
      if (typeof f0 === 'function') window._lxSkinPlatDraw = f0;
      // [3] the props this pass places or moves: the lowest art row of each one's actual draw, and the floor's dark rows beside it
      const SCOPE = ['azure_large_waterfountain', 'azure_waterfountain', 'azure_crystal_lamp', 'atrium_armillary', 'emerald_lantern_post', 'pagoda_bonsai'];
      for (const q of MAP_PROPS[map].filter((r) => SCOPE.includes(r.key))) {
        const img = LX_OBJECTS[q.key]; if (!img) { o.props.push({ map, key: q.key, x: q.x, low: 'no art' }); continue; }
        for (let i = 0; i < 150 && !(img.complete && img.naturalWidth && LX_OBJECTS_META[q.key] && LX_OBJECTS_META[q.key].bboxBottomY != null); i++) await sleep(100);   // decoded, and its bounds read
        const meta = LX_OBJECTS_META[q.key]; if (!meta || meta.bboxBottomY == null) { o.props.push({ map, key: q.key, x: q.x, low: 'no bounds' }); continue; }
        const f = Math.max(0.7, Math.min(1.4, Math.max(img.naturalWidth, img.naturalHeight) / 512)), w = 80 * (q.scale || 1) * f * img.naturalWidth / img.naturalHeight;
        const cx = Math.max(0, Math.min((md.worldWidth || 1600) - cv.width, Math.round(q.x - 480))); hold(cx); await sleep(400);
        const hit = (await record(250)).find((c) => Math.abs(c.x + c.w / 2 - (q.x - c.cam)) < 1.5 && Math.abs(c.w - w) < 1.5);
        o.props.push({ map, key: q.key, x: q.x, y: q.y, low: hit ? Math.ceil(hit.y + hit.h * (meta.bboxBottomY + 1) / img.naturalHeight) - 1 : 'not drawn',
          floor: [w / 2 + 6, w / 2 + 16, -w / 2 - 6, -w / 2 - 16].map((d) => Math.round(q.x - cx + d)).filter((sx) => sx >= 0 && sx < cv.width).map((sx) => floorRows(sx).join(',')).find((r) => /479,480/.test(r)) || 'no keyline beside it' });   // four columns beside it: one may be covered
      }
      if (map === 'emeraldVillage') for (const p of plats.filter((p) => p.y >= 395)) {   // [5] the low ledges' posts: the lowest solid row of the bake it blits
        const cx = Math.max(0, Math.min((md.worldWidth || 1600) - cv.width, Math.round(p.x - 400))); hold(cx); await sleep(400);
        const b = (await record(250)).find((c) => c.im instanceof HTMLCanvasElement && Math.abs(c.y - (p.y - 3)) < 0.5 && Math.abs(c.x - (p.x - 7 - c.cam)) < 1.5);
        let low = 'not drawn'; if (b) { const d = b.im.getContext('2d').getImageData(0, 0, b.im.width, b.im.height).data, k = b.im.height / b.h; let r = -1;
          for (let y = 0; y < b.im.height; y++) for (let x = 0; x < b.im.width; x++) if (d[(y * b.im.width + x) * 4 + 3] > 64) r = y; low = Math.floor(b.y + (r + 1) / k - 0.001); }
        o.posts.push({ x: p.x, y: p.y, low });
      }
      // [6] the air at dusk: count the types of 600 updates' spawns
      window.updateAmbient = window.updateAmbient0; game._forcePhase = 18; _LX_DAYPH.t = 0; game.ambient = [];
      const seen = {}; const push0 = game.ambient.push; game.ambient.push = function (q) { const k = q.type + ' ' + q.color; seen[k] = (seen[k] || 0) + 1; return push0.call(this, q); };
      for (let i = 0; i < 600; i++) updateAmbient();
      o.air[map] = seen; game._forcePhase = null; _LX_DAYPH.t = 0;
    }
    o.reg = ['azure_crystal_lamp', 'emerald_lantern_post'].map((k) => ({ k, listed: LX_OBJECTS_FILES.includes(k), dec: !!(LX_OBJECTS[k] && LX_OBJECTS[k].naturalWidth),
      glow: Object.values(MAP_PROPS).flat().filter((q) => q && q.key === k).map((q) => !!(q.glow && q.glow.r > 0 && q.glow.a > 0)) }));
    return o;
  });
  console.log('build ' + R.ver);
  const S = R.skin, okSkin = (m, want) => S[m] && S[m].set === want && S[m].ledges > 0 && S[m].skinned === S[m].ledges && S[m].still;
  ok('[1] both towns paint every floating ledge through their skin, and no ledge box moves', okSkin('azureAcademia', 'azure') && okSkin('emeraldVillage', 'emerald'), JSON.stringify(S));
  ok('[2] the lamp and the lantern post are registered, decode, and glow where they are placed', R.reg.every((r) => r.listed && r.dec && r.glow.length && r.glow.every(Boolean)), JSON.stringify(R.reg));
  const off = R.props.filter((p) => !(p.low === 479 || p.low === 480) || !/479,480/.test(p.floor)), need = ['azure_crystal_lamp', 'atrium_armillary', 'emerald_lantern_post', 'pagoda_bonsai'].filter((k) => !R.props.some((p) => p.key === k));
  ok('[3] the five fountains and the four new pieces stand on the floor\'s black line (their lowest drawn art row is 479-480, the line\'s rows)', !off.length && !need.length && R.props.filter((p) => /waterfountain/.test(p.key)).length === 5,
    (need.length ? 'missing ' + need.join(' ') + '; ' : '') + R.props.map((p) => `${p.key}@${p.x} ${p.low} (floor ${p.floor})`).join(', '));
  ok('[5] Emerald\'s three low ledges stand on posts that end on the keyline', R.posts.length === 3 && R.posts.every((p) => p.low === 479 || p.low === 480), JSON.stringify(R.posts));
  const has = (m, re) => Object.entries(R.air[m] || {}).some(([k, n]) => re.test(k) && n > 0);
  ok('[6] Emerald drops pink petals and its leaves; Azure twinkles glints among its petals', has('emeraldVillage', /^petal #ffb3c8/) && has('emeraldVillage', /^leaf #9ad876/) && has('azureAcademia', /^glint #d2e8ff/) && has('azureAcademia', /^petal #bcd8f4/), JSON.stringify(R.air));
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 400)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
