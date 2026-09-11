// Stacked platforms do not paint over each other.
//
// Per user: "ensure that platforms dont overlap such as in this image which results in an unsightly
// overlap". Terrain v3/v4 hangs a face, a keel and roots or icicles below a floating platform's one-way
// box; where a map stacks two platforms closer than that art is deep, the upper one painted over the lower
// one's top. The underside is now cut to the room below (_lxPlatDepthCap -> _cuteDepthCap). This loads the
// maps that stack platforms tightly, twice each (loading jitters platform heights), and checks with the
// painter's own geometry that no floating platform's art reaches another platform's surface, that the
// tight maps really are cut, and that a platform with open air below keeps its full depth.
//   node scripts/platform_overlap_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11699), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p)), headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const MAPS_T = ['wayfarersLantern2', 'honeycombHollow', 'innerDimension', 'sauroSlope', 'fieryHideout', 'wayfarersLantern', 'town', 'forest'];
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _cuteGeom === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async (list) => {
    if (typeof _lxPlatDepthCap !== 'function' || typeof _cuteDepthCap !== 'function') return { missing: true };
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), out = { maps: {}, bad: [], boxOverlap: 0 };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const bx = (q) => (q._driftBaseX != null ? q._driftBaseX : q.x), by = (q) => (q._driftBaseY != null ? q._driftBaseY : q.y);
    for (const id of list) for (let load = 0; load < 2; load++) {
      loadMap(id, 300); await sleep(900); game.paused = false; await sleep(120);
      const th = _pickFloorTheme(game.mapData), built = !!(_CUTE_MAT[th] && _CUTE_MAT[th].built), ps = game.mapData.platforms, rec = out.maps[id] = out.maps[id] || { capped: 0, full: 0, floating: 0 };
      for (const a of ps) {
        if (!a || a.type === 'ground') continue; rec.floating++;
        const G1 = built ? _cuteBuiltGeom(_cuteGeom(a.w, a.h, false), a.w, a.h, false) : _cuteGeom(a.w, a.h, false), G = _cuteDepthCap(G1, _lxPlatVariant(a) | (_lxPlatDepthCap(a) << 4), false, a.h);
        if (G !== G1) rec.capped++; else rec.full++;
        const depth = G.depth != null ? G.depth : Math.ceil(G.faceH + (G.keel || 0) + (G.hang || 0));
        for (const b of ps) {
          if (b === a || !b || Math.min(bx(a) + a.w, bx(b) + b.w) - Math.max(bx(a), bx(b)) <= 4) continue;
          const dy = by(b) - by(a); if (dy <= 0) continue;
          if (dy <= a.h + 2) { out.boxOverlap++; continue; }   // the boxes themselves touch: a layout fact, not art
          if (depth > dy - 2 && out.bad.length < 8) out.bad.push([id, load, Math.round(bx(a)), Math.round(by(a)), a.w, Math.round(dy), depth]);
          if (depth > dy - 2) rec.bad = (rec.bad || 0) + 1;
        }
      }
    }
    return out;
  }, MAPS_T);
  if (r.missing) { ok('the depth cap exists (_lxPlatDepthCap, _cuteDepthCap)', false); }
  else {
    console.log(JSON.stringify(r.maps));
    ok('no floating platform\'s art reaches the surface of a platform below it (8 maps, 2 loads each)', r.bad.length === 0, r.bad);
    ok('the tightly stacked maps really are cut to fit', (r.maps.wayfarersLantern2 || {}).capped > 0 && (r.maps.honeycombHollow || {}).capped > 0, { wl2: r.maps.wayfarersLantern2, honey: r.maps.honeycombHollow });
    ok('a platform with open air below keeps its full depth', (r.maps.forest || {}).full > 0, r.maps.forest);
    console.log('pairs whose one-way boxes themselves touch (layout, not art):', r.boxOverlap);
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
