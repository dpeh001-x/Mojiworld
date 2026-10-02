// A TELEPORT ONTO THE WEIGHT-BEARER'S STAIR LANDS AT ITS LEFT PORTAL (v0.30.1540). Per user: "when teleporting to the stairways
// of the weightbearer map it should teleport at the leftside portal if not the character will fall off the map". The W-map
// (and its recent strip, and the taxi) call loadMap(id) with no entryX; on a vertical-tower map that stood the hero at the
// map's centre at its first ground's height - under the Stair's colonnade, with nothing below.
//   - the W-map's own pick still loads with no entryX (the path this pins);
//   - from the Zodiac Sanctum, loadMap('weightbearerStair') lands on the Sanctum landing beside the left door, clear of its
//     trigger, stands there for 2.5 s and never drops below the map;
//   - a walk-in through the Sanctum door still arrives at the same spot (entryX given: unchanged);
//   - info: every other vertical-tower map entered the same way, and whether the hero falls there.
//   node scripts/stair_arrival_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10421);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 500) : '')); };
const game = readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
{ const i = game.indexOf("mode: 'travel',"); const j = game.indexOf('onPick:', i); const body = game.slice(j, game.indexOf('_wmRenderRecent();', j));
  ok("the W-map's pick loads the map with no entryX (the path that fell)", i > 0 && /loadMap\(id\);/.test(body)); }
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof MAPS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { window._perfTick = () => {}; } catch (e) {}
    player.level = 90; player._god = true; game.paused = false;
    // follow the hero for ms: where it ends up, the deepest it went, whether the map changed under it
    const watch = async (ms) => { const map0 = game.currentMap, wh = (game.mapData && game.mapData.worldHeight) || 600; let maxY = -1e9; const t0 = performance.now();
      while (performance.now() - t0 < ms) { maxY = Math.max(maxY, player.y + player.h); await sleep(40); }
      return { map: game.currentMap, left: game.currentMap !== map0, x: Math.round(player.x), cx: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), maxFeet: Math.round(maxY), onGround: !!player.onGround, wh }; };
    const out = {};
    loadMap('zodiacHall'); await sleep(2000);
    // exactly what the W-map's onPick does
    loadMap('weightbearerStair'); out.arrive0 = { x: Math.round(player.x), y: Math.round(player.y) }; out.tp = await watch(2500);
    const door = (game.mapData.portals || []).filter((p) => p.dest === 'zodiacHall').sort((a, b) => a.x - b.x)[0]; out.door = door ? { x: door.x, y: door.y } : null;
    out.landing = (game.mapData.platforms || []).find((p) => p.type === 'ground'); out.landing = out.landing && { x: out.landing.x, y: out.landing.y, w: out.landing.w };
    // a walk-in through the Sanctum door: tryPortal's own arithmetic (entryX given) - the arrival this mirrors
    loadMap('zodiacHall'); await sleep(1500);
    { const off = 50 + player.w / 2 + 6; const ex = door.x + (door.x < MAPS.weightbearerStair.worldWidth / 2 ? off : -off); loadMap('weightbearerStair', ex, door.y - 80); out.walk = await watch(2000); }
    // info: every other vertical-tower map, entered the same position-less way
    out.towers = {};
    for (const id of Object.keys(MAPS)) { const m = MAPS[id]; if (!m || !m.isVerticalTower || id === 'weightbearerStair' || m.isBossArena) continue;
      try { loadMap(id); const w = await watch(1800); out.towers[id] = { fell: w.maxFeet > w.wh + 40 || w.left, feet: w.feet, wh: w.wh, cx: w.cx, onGround: w.onGround }; } catch (e) { out.towers[id] = 'error ' + e.message; } }
    return out;
  });
  const t = R.tp, d = R.door, L = R.landing;
  console.log('teleport arrival:', JSON.stringify({ arrive0: R.arrive0, tp: t, door: d, landing: L }));
  ok('the teleport keeps the hero on the Stair (no fall-through, no bounce back through the door)', t.map === 'weightbearerStair' && !t.left, t);
  ok('it never drops below the map', t.maxFeet <= t.wh, { maxFeet: t.maxFeet, worldHeight: t.wh });
  ok('it stands on the Sanctum landing (the first tread, under the left door)', t.onGround && L && Math.abs(t.feet - L.y) <= 4 && t.cx >= L.x && t.cx <= L.x + L.w, { feet: t.feet, landingY: L && L.y });
  ok('beside the left door, clear of its 50 px trigger', d && Math.abs(t.cx - d.x) > 50 && Math.abs(t.cx - d.x) < 200, { heroCentre: t.cx, doorX: d && d.x });
  ok('the same spot a walk-in through that door reaches', Math.abs(R.walk.cx - t.cx) <= 2 && Math.abs(R.walk.feet - t.feet) <= 2 && R.walk.map === 'weightbearerStair', { walk: R.walk });
  console.log('info - the other vertical-tower maps, entered without a position:', JSON.stringify(R.towers));
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
