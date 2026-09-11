// The Singularity's floor, through both form changes and under drift.
//
// Per user (2026-09-11): "in gravitos map make sure the platform for the entrance/exit portal
// does not get removed as gravitos changes form. Also make the platforms in the map drift
// similarly to pq stage 2 but to a larger extent."
//
// gravitos_arena_test.mjs drives the collapse through the REAL form transitions (killMonster);
// this one drives the collapse hooks directly so it can leave the platforms mid-swing first,
// and it is where the drift itself is measured. Asserts: the doomed pairs drop, the ground and
// every portal's floor survive, the floating platforms move further than the Spire's and come
// back, a pad riding a y:320 platform keeps its offset, the collapse finds a platform mid-drift,
// and a fresh entry restores the authored floor.
//   node scripts/gravitos_floor_drift_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11521); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxGravCollapse === 'function' && typeof _tickSpireDrift === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.level = 99; player.cls = player.cls || 'warrior';
    loadMap('gravitosArena', 300); await sleep(600); game.paused = true;
    const out = {};
    const plats = () => (game.mapData.platforms || []).map((p) => ({ x: p.x, y: p.y, w: p.w, type: p.type, bx: p._driftBaseX, ax: p._driftAx, ay: p._driftAy, doomed: !!p._lxDoomed }));
    const floorOf = (x) => { const y = _defaultPortalY(x); const p = (game.mapData.platforms || []).find((q) => q.y === y && x >= q.x && x <= q.x + q.w); return p ? { x: p.x, y: p.y, type: p.type } : null; };
    out.authored = plats(); out.portals = (game.mapData.portals || []).map((po) => ({ x: po.x, dest: po.dest, y: _defaultPortalY(po.x), floor: floorOf(po.x) }));
    out.padsBefore = (game.mapData.launchPads || []).map((q) => ({ x: q.x, y: q.y, floor: q._spireFloor }));
    const p320 = (game.mapData.platforms || []).find((p) => (p._driftBaseX != null ? p._driftBaseX : p.x) === 500 && p.y === 320);
    const pad320 = (game.mapData.launchPads || []).find((q) => q.y === 320 && q.x >= 480 && q.x <= 720);
    const padOff0 = pad320 && p320 ? pad320.x - p320.x : null;
    // The sway is sin(game.time * 2pi/360 + phase): a full period is 360 ticks of game.time, after
    // which a platform is back where it was at t0 (not necessarily at its authored x - t0 is
    // wherever the clock happened to be). Its authored x is the CENTRE of the sweep.
    const t0 = game.time | 0; _tickSpireDrift(); const x0 = p320 ? p320.x : null; let maxDev = 0, padOffMax = 0, minX = 1e9, maxX = -1e9;
    for (let i = 1; i <= 360; i++) { game.time = t0 + i; _tickSpireDrift(); if (p320) { maxDev = Math.max(maxDev, Math.abs(p320.x - 500)); minX = Math.min(minX, p320.x); maxX = Math.max(maxX, p320.x); if (pad320) padOffMax = Math.max(padOffMax, Math.abs((pad320.x - p320.x) - padOff0)); } }
    out.drift = { maxDev: +maxDev.toFixed(1), backToStart: p320 ? +Math.abs(p320.x - x0).toFixed(1) : null, sweepCentre: p320 ? +((minX + maxX) / 2).toFixed(1) : null, padOffsetWander: +padOffMax.toFixed(1), groundMoved: (game.mapData.platforms || []).some((p) => p.type === 'ground' && p._driftAx), centreMoved: (game.mapData.platforms || []).some((p) => p.y === 260 && p._driftAx) };
    game.time = t0 + 90; _tickSpireDrift();   // leave the platforms mid-swing, then collapse the way the form changes do
    out.swungX = p320 ? +p320.x.toFixed(1) : null;
    const tick = (ms) => { for (let k = 0; k < ms / 16; k++) _lxGravArenaTick(16); };
    _lxGravCollapse(2); tick(1200); out.after2 = plats();
    _lxGravCollapse(3); tick(1200); out.after3 = plats();
    out.portalsAfter = (game.mapData.portals || []).map((po) => ({ x: po.x, y: _defaultPortalY(po.x), floor: floorOf(po.x) }));
    out.padsAfter = (game.mapData.launchPads || []).map((q) => ({ x: q.x, y: q.y }));
    loadMap('sanctum', 100); await sleep(300); loadMap('gravitosArena', 300); await sleep(600); game.paused = true;
    out.reentry = plats().length;
    return out;
  });
  const has = (list, x, y) => list.some((p) => (p.bx != null ? p.bx : p.x) === x && p.y === y);
  console.log('authored', r.authored.length, 'platforms; portals', JSON.stringify(r.portals));
  console.log('drift', JSON.stringify(r.drift), '| swung to', r.swungX, '| pads', JSON.stringify(r.padsBefore));
  ok('the arena authors eight platforms', r.authored.length === 8, r.authored.length);
  ok('every portal stands on the ground slab', r.portals.length >= 1 && r.portals.every((po) => po.floor && po.floor.type === 'ground'), r.portals);
  ok('form 2 drops the y:180 perches (mid-swing)', !has(r.after2, 340, 180) && !has(r.after2, 1700, 180) && r.after2.length === 6, r.after2.length);
  ok('form 3 drops the y:320 pair (mid-swing)', !has(r.after3, 500, 320) && !has(r.after3, 1500, 320) && r.after3.length === 4, r.after3.length);
  ok('the ground, the centre and the y:380 ledges survive both', has(r.after3, 0, 480) && has(r.after3, 900, 260) && has(r.after3, 140, 380) && has(r.after3, 1880, 380));
  ok("every portal's floor is untouched after both collapses", r.portalsAfter.every((po, i) => po.floor && po.floor.type === 'ground' && po.y === r.portals[i].y), r.portalsAfter);
  ok('the three ground pads survive; the two y:320 pads fell with their platforms', r.padsAfter.length === 3 && r.padsAfter.every((q) => q.y === 480), r.padsAfter);
  ok('floating platforms drift, and further than the Spire (>= 40px)', r.drift.maxDev >= 40, r.drift);
  ok('...sweeping about their authored x, and back where they started after a full period', r.drift.backToStart != null && r.drift.backToStart <= 1.5 && Math.abs(r.drift.sweepCentre - 500) <= 2, r.drift);
  ok('the ground and the centre anchor never drift', r.drift.groundMoved === false && r.drift.centreMoved === false, r.drift);
  ok('a pad riding a drifting platform keeps its offset on it', r.drift.padOffsetWander <= 0.5, r.drift);
  ok('a fresh entry restores all eight platforms', r.reentry === 8, r.reentry);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
