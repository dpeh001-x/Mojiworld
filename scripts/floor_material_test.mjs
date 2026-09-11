// Every place is floored in what it is built of, in its own backdrop's colours.
//
// Per user: "towns should have either wood plank style, concrete etc. that matches the theme", "there
// should be more different floors for the different biomes", "even different towns have different
// styles and should have different floors", "do not need props". This bakes every material in the
// _CUTE_MAT registry through the real _cutePlatformSprite (a floating platform and a ground) and reads
// the pixels back: the surface is at the collision line, the box is opaque, the keyline is dark, a
// built slab hangs nothing below itself, toy bricks carry studs, and a split material (moss on planks)
// keeps its face's own hue. Then the tables: every map resolves to a known floor, every town's floor
// is its own, every listed map has a sampled palette, and drawPlatforms paints with that palette.
//   node scripts/floor_material_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11697), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _cutePlatformSprite === 'function' && typeof _CUTE_MAT === 'object' && typeof _MAP_FLOOR_MATERIAL === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const P = _CUTE_PAD_TOP, out = { mats: {} }, pal = { top: '#b89a78', body: '#5a4632', exact: true };
    const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const stats = (cv, w, h, ground, theme) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W = cv.width, at = (x, y) => (y * W + x) * 4;
      const G = _CUTE_MAT[theme].built ? _cuteBuiltGeom(_cuteGeom(w, h, ground), w, h, ground) : _cuteGeom(w, h, ground);
      let solid = 0, air = 0, inside = 0, opaque = 0, below = 0, studs = 0;
      for (const f of [0.25, 0.4, 0.5, 0.6, 0.75]) { const x = Math.round(2 + w * f); if (d[at(x, P + 2) + 3] > 200) solid++; if (d[at(x, P - 5) + 3] < 40) air++; }
      for (let y = 0; y < cv.height; y++) for (let x = 6; x < W - 6; x++) { const a = d[at(x, y) + 3], ry = y - P; if (ry >= 0 && ry < h) { inside++; if (a > 230) opaque++; } if (ry > G.faceH + 3 && a > 60) below++; if (ry < 0 && ry >= -5 && a > 200) studs++; }
      const ky = P + Math.round(G.cap + 5); let key = 255; for (let x = 1; x <= 6; x++) { const i = at(x, ky); if (d[i + 3] > 150) key = Math.min(key, lum(d, i)); }
      return { solid, air, opaque: +(opaque / Math.max(1, inside)).toFixed(2), below, studs, key: key | 0 };
    };
    for (const th of Object.keys(_CUTE_MAT)) {
      const p = _cutePlatformSprite(120, 12, pal, false, th, 0), g = _cutePlatformSprite(400, 60, pal, true, th, 0);
      out.mats[th] = { built: !!_CUTE_MAT[th].built, plat: p ? stats(p, 120, 12, false, th) : null, ground: g ? stats(g, 400, 60, true, th) : null };
    }
    // split: moss on planks keeps a brown face under a green top
    const mw = _cutePlatformSprite(200, 60, { top: '#688d5c', body: '#614c34', exact: true }, true, 'mosswood', 0), md = mw.getContext('2d').getImageData(100, P + 3, 1, 40).data;
    out.split = { top: [md[0], md[1], md[2]], face: [md[35 * 4], md[35 * 4 + 1], md[35 * 4 + 2]] };
    const KNOWN = new Set(Object.keys(_CUTE_MAT).concat(['grass', 'stone', 'ice', 'lava', 'sand', 'candy', 'swamp', 'cosmic', 'honey', 'coral']));
    const cur = game.currentMap, pick = {}; for (const id of Object.keys(MAPS)) { game.currentMap = id; pick[id] = _pickFloorTheme(MAPS[id]); } game.currentMap = cur;
    out.unknown = Object.entries(pick).filter(([, m]) => !KNOWN.has(m)).map(([k, m]) => k + ':' + m);
    const towns = Object.keys(MAPS).filter((k) => MAPS[k].isTown && !MAPS[k].isVoid); out.towns = towns.map((k) => pick[k]); out.townIds = towns;
    out.noPal = Object.keys(_MAP_FLOOR_MATERIAL).filter((k) => _MAP_FLOOR_MATERIAL[k] !== 'lava' && !(MAPS[k] && MAPS[k].isVoid) && !(_MAP_FLOOR_PAL[k] && /^#[0-9a-f]{6}$/.test(_MAP_FLOOR_PAL[k].top) && /^#[0-9a-f]{6}$/.test(_MAP_FLOOR_PAL[k].body)));
    return out;
  });
  for (const [th, m] of Object.entries(r.mats)) {
    const p = m.plat, g = m.ground;
    ok(`${th}: both bakes exist, the surface is at the collision line and the box is opaque`, p && g && p.solid === 5 && g.solid === 5 && p.opaque >= 0.9 && g.opaque >= 0.9, { plat: p, ground: g });
    ok(`${th}: the keyline is dark down the edge`, p.key < 90 && g.key < 90, [p.key, g.key]);
    if (m.built) ok(`${th}: a built slab hangs nothing below itself`, p.below === 0 && g.below === 0, [p.below, g.below]);
    if (th === 'toybrick') ok('toybrick: studs stand on the surface', p.studs > 20 && g.studs > 40, [p.studs, g.studs]);
    else ok(`${th}: nothing stands above the surface of a built slab`, !m.built || (p.air >= 4 && g.air >= 4), [p.air, g.air]);
  }
  ok('moss on planks: the top is green and the face stays brown (split palette)', r.split.top[1] > r.split.top[0] && r.split.face[0] > r.split.face[1], r.split);
  ok('every map resolves to a floor the painter knows', r.unknown.length === 0, r.unknown);
  ok(`every town has a floor of its own (${r.towns.length} towns)`, new Set(r.towns).size === r.towns.length, r.townIds.map((k, i) => k + '=' + r.towns[i]).join(' '));
  ok('every listed map has a sampled palette (the Void draws no ground)', r.noPal.length === 0, r.noPal);
  // drawPlatforms paints a listed map with its material and its sampled palette
  const drawn = await page.evaluate(async () => {
    const res = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    for (const id of ['everdawn_megamall', 'town', 'hiddenPagoda']) {
      loadMap(id, 300); await sleep(1300); game.paused = false;
      const od = window._drawCutePlatform; let seen = null;
      window._drawCutePlatform = function (sx, y, w, h, tint, ground, theme) { if (!seen) seen = { top: tint && tint.top, exact: !!(tint && tint.exact), theme }; return od.apply(this, arguments); };
      await sleep(350); window._drawCutePlatform = od;
      res[id] = { seen, want: _MAP_FLOOR_PAL[id] && _MAP_FLOOR_PAL[id].top, mat: _MAP_FLOOR_MATERIAL[id] };
    }
    return res;
  });
  for (const [id, d] of Object.entries(drawn)) ok(`${id}: drawPlatforms paints it in ${d.mat} with its sampled palette`, !!d.seen && d.seen.exact && d.seen.top === d.want && d.seen.theme === d.mat, d);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
