// B6 — Aether Climb (v0.30.462). Per user: "improve on the platforms of B6 expedition, it should
// mimic Pq stage 2 but be an upgraded version of it also include occasional purple void obstacles".
//
// Reachability is the load-bearing claim, so it is checked against a MEASURED constant rather than a
// chosen one: a running plain jump on B6 (gravityMul 0.9, getJump 10, speed 2.1) carries 132 px
// horizontally, and every crossing is verified at the WORST drift phase — the pair's relative
// amplitude is analytic because all floors share one angular frequency, so the worst case is
// static gap + |v_i - v_j|, not something to sample and hope about.
//   node scripts/b6_climb_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.461: a rigid ladder pinned at x=50/500, crossings 21-302 px, no drift, no
// obstacles.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10351); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const REACH_PLAIN = 132;                 // measured in-engine; see the header
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAPS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const o = { ver: GAME_VERSION };
    loadMap('tower_b6', 300); await sleep(900);
    const md = game.mapData;
    const ps = (md.platforms || []).filter((p) => p.type === 'platform').slice().sort((a, b) => b.y - a.y);
    o.floors = ps.length;
    o.drifting = ps.filter((p) => p._driftAx != null || p._driftAy != null).length;
    // widths: an arch, not a straight line
    const w = ps.map((p) => p.w);
    o.width = { min: Math.min(...w), max: Math.max(...w), first: w[0], mid: w[Math.floor(w.length / 2)], last: w[w.length - 1] };
    // x spread: the shipped ladder used two columns only
    o.distinctX = new Set(ps.map((p) => Math.round(p._driftBaseX != null ? p._driftBaseX : p.x))).size;
    // WORST-CASE crossings: static edge gap + the pair's relative drift amplitude
    const rel = (a1, p1, a2, p2) => Math.hypot(a1 * Math.cos(p1) - a2 * Math.cos(p2), a1 * Math.sin(p1) - a2 * Math.sin(p2));
    const cr = [];
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1], c = ps[i];
      const ax = a._driftBaseX != null ? a._driftBaseX : a.x, cx = c._driftBaseX != null ? c._driftBaseX : c.x;
      const stat = (cx > ax + a.w) ? (cx - (ax + a.w)) : ((ax > cx + c.w) ? (ax - (cx + c.w)) : 0);
      const relH = rel(a._driftAx || 0, a._driftPhase || 0, c._driftAx || 0, c._driftPhase || 0);
      cr.push(stat + relH);
    }
    o.crossing = { n: cr.length, min: +Math.min(...cr).toFixed(1), max: +Math.max(...cr).toFixed(1),
      mean: +(cr.reduce((s, g) => s + g, 0) / cr.length).toFixed(1) };
    // the void tears
    o.tears = (game.hazards || []).filter((h) => h && h.type === 'void_tear');
    o.tearCount = o.tears.length;
    o.tearsRideFloors = o.tears.every((h) => h._spireFloor != null);
    const tf = o.tears.map((h) => h._spireFloor).sort((a, b) => a - b);
    o.tearFloors = tf;
    o.tearsNeverAdjacent = tf.every((f, i) => i === 0 || f - tf[i - 1] >= 2);
    // every tear must leave a landing on its shelf
    o.tearsLeaveLanding = o.tears.every((h) => {
      const p = (md.platforms || []).find((q) => q && q._spireFloor === h._spireFloor);
      return p ? (p.w - h.w) >= 30 : false;
    });
    // DRIFT actually moves the floors in-engine
    const before = ps.slice(0, 6).map((p) => +p.x.toFixed(2));
    for (let i = 0; i < 90; i++) { try { _tickSpireDrift(); } catch (e) { return Object.assign(o, { err: String(e.message).slice(0, 90) }); } game.time = (game.time | 0) + 1; await sleep(4); }
    const after = ps.slice(0, 6).map((p) => +p.x.toFixed(2));
    o.driftMoved = before.some((v, i) => Math.abs(v - after[i]) > 0.5);
    o.driftMax = Math.max(...before.map((v, i) => Math.abs(v - after[i])));
    // and the tears travel with their shelf
    o.tearFollows = o.tears.length === 0 ? null : o.tears.every((h) => {
      const p = (md.platforms || []).find((q) => q && q._spireFloor === h._spireFloor);
      return p ? Math.abs((h.x - p.x) - (h._b6Dx || 0)) < 3 : false;
    });
    // the map still matches the tower's own frame
    o.world = { w: md.worldWidth, h: md.worldHeight, groundY: md.groundY };
    o.inBounds = ps.every((p) => (p._driftBaseX != null ? p._driftBaseX : p.x) >= 20 && ((p._driftBaseX != null ? p._driftBaseX : p.x) + p.w) <= md.worldWidth - 20);
    return o;
  });
  if (r.err) throw new Error(r.err);
  console.log(`build ${r.ver}  ${r.floors} floors  crossings ${r.crossing.min}-${r.crossing.max}px  ${r.tearCount} void tears`);
  ok('B6 is a generated climb, not the old two-column ladder', r.floors >= 20 && r.distinctX >= 12,
    `${r.floors} floors across ${r.distinctX} distinct x positions (shipped build: 2)`);
  ok('every floor drifts, like the Spire it mimics', r.drifting === r.floors, `${r.drifting}/${r.floors}`);
  ok('...and the drift actually moves them in-engine', r.driftMoved, `max move ${r.driftMax.toFixed(1)}px over 90 ticks`);
  ok('the width profile is an arch, not a straight taper', r.width.mid > r.width.first && r.width.mid > r.width.last,
    `${r.width.first} -> ${r.width.mid} -> ${r.width.last} (min ${r.width.min}, max ${r.width.max})`);
  ok(`every crossing stays inside the MEASURED plain-jump reach at the worst drift phase`, r.crossing.max <= REACH_PLAIN,
    `worst ${r.crossing.max}px vs ${REACH_PLAIN}px measured (shipped build: 302px)`);
  ok('...and the climb is consistent rather than lurching', r.crossing.max - r.crossing.min <= 110,
    `${r.crossing.min} to ${r.crossing.max}, mean ${r.crossing.mean} (shipped: 21 to 302)`);
  ok('occasional purple void tears are present', r.tearCount >= 3 && r.tearCount <= 9, `${r.tearCount} tears on floors ${r.tearFloors.join(',')}`);
  ok('...never on two consecutive floors', r.tearsNeverAdjacent, r.tearFloors.join(','));
  ok('...each seated on a floor, leaving a landing on that shelf', r.tearsRideFloors && r.tearsLeaveLanding,
    `seated ${r.tearsRideFloors}, landing left ${r.tearsLeaveLanding}`);
  ok('...and they travel with the shelf as it drifts', r.tearFollows === true, String(r.tearFollows));
  ok('the climb stays inside the tower walls', r.inBounds, JSON.stringify(r.world));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
