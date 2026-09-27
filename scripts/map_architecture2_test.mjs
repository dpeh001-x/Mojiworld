// Five more generic maps are re-planned with real floor and platform architecture (the second batch).
//
// Per user: "do five more generic maps the same way" - approved after review. Distorted Threshold, Verdant Hollow,
// Withering Tide 2 (the Drowned Hold), Thunder Plateau and Wildflower Plains were flat ground under a repeating zigzag of
// platforms; each now has a shaped floor (raised and sunken ground joined by walkable ramps) and a planned structure - a
// great gate, two waterfall dells, a drowned harbour, storm mesas, flower terraces. This reads the maps the game actually
// builds (MAPS after the Stage Editor bake) and walks them:
//   1. each map keeps its width and every portal where it was (on its platform, or on the ground at y 480);
//   2. each has its shaped floor and its planned platforms (more than one ground piece; the designed platform count);
//   3. every platform is reachable from the ground under the game's own conservative jump model (90 up, 120 across),
//      even with the per-load height/width jitter going the wrong way at both ends;
//   4. the hero walks each map from one end to the other and back without getting stuck (a hop or two where a walk
//      starts is tolerated - the flat layouts show the same; the ramps themselves are pinned by ground_ramp_test).
// The build before fails 2 for all five.   node scripts/map_architecture2_test.mjs   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11741), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
// portals: [x, authored y] - a y under 470 stands on a platform at that height, otherwise on the ground at 480
const SPEC = {
  distortedThreshold: { W: 2200, plats: 16, portals: [[290, 400], [2016, 400]] },
  verdantHollow: { W: 2400, plats: 15, portals: [[141, 480], [1227, 480], [2320, 480]] },
  witheringTide2: { W: 2800, plats: 17, portals: [[100, 480], [2640, 480]] },
  thunderPlateau: { W: 1900, plats: 14, portals: [[152, 472], [1756, 476]] },
  wildflowerPlains: { W: 2400, plats: 13, portals: [[260, 480], [2110, 380]] },
};
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && typeof MAPS === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (SPEC) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) { applyClass('warrior'); player.level = 30; }
    player._tutorialSeen = true; player._god = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    const ov = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    for (const k of Object.keys(SPEC)) {
      const m = MAPS[k], P = m.platforms || [], gr = P.filter((p) => p.type === 'ground'), fl = P.filter((p) => p.type !== 'ground');
      const q = gr.slice(), Rch = new Set(q);
      while (q.length) { const s = q.pop(); for (const t of fl) { if (Rch.has(t)) continue; const rise = s.y - t.y + (s.type !== 'ground' ? 10 : 0) + 10, gap = -ov(s, t) + 10;
        if (rise <= 90 && gap <= 120 + Math.max(0, -rise) * 0.8) { Rch.add(t); q.push(t); } } }
      const portals = (m.portals || []).map((p) => ({ x: p.x, y: p.y == null ? null : p.y, dest: p.dest }));
      const portalOK = SPEC[k].portals.every(([px, py]) => {
        const po = portals.find((p) => Math.abs(p.x - px) <= 1); if (!po || (po.y != null && po.y !== py)) return false;
        if (py < 470) return fl.some((f) => px >= f.x && px <= f.x + f.w && f.y === py);
        const g = gr.find((p) => px >= p.x && px < p.x + p.w); return !!g && g.y === 480;
      });
      loadMap(k, 60); for (let i = 0; i < 6; i++) { await sleep(120); game.monsters.length = 0; }
      game.paused = true;
      const W = game.mapData.worldWidth, walk = (key, until) => { for (const kk in game.keys) game.keys[kk] = false; game.keys[key] = true; let n = 0, last = player.x, stuck = 0, air = 0;
        while (n++ < 3000 && !until()) { game.time++; try { game.monsters.length = 0; player.hp = 1e7; updatePlayer(16); } catch (e) {} if (Math.abs(player.x - last) < 0.05) stuck++; else stuck = 0; if (!player.onGround) air++; last = player.x; if (stuck > 60) break; }
        game.keys[key] = false; return { x: Math.round(player.x), stuck: stuck > 60, air }; };
      const right = walk('arrowright', () => player.x + player.w >= W - 40), left = walk('arrowleft', () => player.x <= 40);
      game.paused = false;
      out[k] = { W: m.worldWidth, ground: gr.length, plats: fl.length, reach: Rch.size - gr.length, portalOK, portals, right, left };
    }
    return out;
  }, SPEC);
  for (const [k, s] of Object.entries(SPEC)) {
    const r = R[k];
    ok(`${k}: keeps its width and every portal where it was`, r.W === s.W && r.portalOK, { W: r.W, portals: r.portals });
    ok(`${k}: has its shaped floor and planned platforms (${s.plats})`, r.ground > 1 && r.plats === s.plats, { ground: r.ground, platforms: r.plats });
    ok(`${k}: every platform reachable under the game's jump model even with worst-case jitter`, r.reach === r.plats, { reachable: r.reach, of: r.plats });
    ok(`${k}: walkable end to end and back, never stuck`, !r.right.stuck && !r.left.stuck && r.right.air <= 40 && r.left.air <= 40 && r.right.x > s.W - 120 && r.left.x < 100, { right: r.right, left: r.left });
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
