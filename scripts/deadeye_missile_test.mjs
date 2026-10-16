// DEADEYE PROTOCOL'S ROUNDS ARE ANIMATED MISSILE-ARROWS (per user: "change the bullet sprites to missile looking arrows", "make the spiral and flame tail intense", "Make the arrow head gold and the spiral and the fire green",
// "can we animate these arrows", "Ludo credits are back, animate it"). The Overclock round and the Execute Round were a bullet and a drill bullet in cyan; they are a gold-tipped steel arrow with a green energy spiral and a green
// rocket-flame tail now, each with a nine-frame ludo.ai loop (the flame licks, the spiral's coils crackle) that never moves the arrow (the engine aims it).
//   art    : the stills and the 2 x 9 frames are whole (right canvases, nothing on an edge), the arrowhead is gold, the light is green not cyan, the arrowhead holds still across a loop, the frames really differ
//   wiring : _BULT_ANIM_KEY and _PROJ_ANIM_KEYS carry both rounds, the game serves nine decoded frames for each
//   live   : a live Overclock and a live Execute round draw several different loop frames over a second
//   node scripts/deadeye_missile_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10391);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
const ROUNDS = [{ key: 'p_ult_marksman', W: 512, H: 224, name: 'Overclock' }, { key: 'p_deadeye_execute', W: 640, H: 288, name: 'Execute' }];
const isGold = (r, g, b, a) => a > 200 && r > 150 && g > 100 && b < 130 && r > b + 55;
async function look(f) {
  const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height; let edge = 0, n = 0, gr = 0, cy = 0, x0 = W, x1 = 0, hs = 0, hn = 0, hy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4, a = data[k + 3]; if (a > 14) { if (x < x0) x0 = x; if (x > x1) x1 = x; } if (a > 60) { n++; if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) edge++; const r = data[k], g = data[k + 1], b = data[k + 2]; if (g > r + 30 && g > b + 30) gr++; if (b > r + 25 && b > g - 10 && g > r + 10) cy++; } }
  const hx0 = x0 + Math.round((x1 - x0) * 0.86); for (let y = 0; y < H; y++) for (let x = hx0; x < W; x++) { const k = (y * W + x) * 4; if (isGold(data[k], data[k + 1], data[k + 2], data[k + 3])) { hs += x; hy += y; hn++; } }
  return { W, H, edge, green: gr / Math.max(1, n), cyan: cy / Math.max(1, n), gold: hn, hx: hn ? hs / hn : -1, hy: hn ? hy / hn : -1, data };
}
for (const R of ROUNDS) {
  const S = await look('Sprites/projectiles/' + R.key + '.webp'), F = []; for (let i = 0; i < 9; i++) F.push(await look('Sprites/projectiles/anim/' + R.key + '_' + i + '.webp'));
  ok(R.name + ': the still and the nine frames are ' + R.W + ' x ' + R.H + ' with nothing on a canvas edge', [S, ...F].every((f) => f.W === R.W && f.H === R.H && f.edge === 0), [S, ...F].map((f) => f.W + 'x' + f.H + '/' + f.edge).join(' '));
  ok(R.name + ': a GOLD arrowhead, GREEN light (>= 18% of the ink), no cyan (< 3%) in every frame', [S, ...F].every((f) => f.gold > 150 && f.green >= 0.18 && f.cyan < 0.03), [S, ...F].map((f) => f.gold + '/' + f.green.toFixed(2) + '/' + f.cyan.toFixed(3)).join(' '));
  ok(R.name + ': the arrowhead holds still through the loop (its gold mass moves under 6 px)', F.every((f) => Math.hypot(f.hx - F[0].hx, f.hy - F[0].hy) < 6), F.map((f) => (Math.round(Math.hypot(f.hx - F[0].hx, f.hy - F[0].hy) * 10) / 10)).join(' '));
  let diffs = 0; for (let i = 1; i < 9; i++) { let s = 0; const a = F[i - 1].data, b = F[i].data; for (let k = 0; k < a.length; k += 4) s += Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 3] - b[k + 3]); if (s / (R.W * R.H) > 1.0) diffs++; }
  ok(R.name + ': the loop really animates (consecutive frames differ in at least 7 of 8 steps)', diffs >= 7, { differing: diffs });
}
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _projAnimFrame === 'function' && typeof _BULT_ANIM_KEY !== 'undefined', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('archer'); player.level = 90; player.job = 'sniper'; player.master = 'marksman'; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('forest', 200); await W8(2500); game.paused = false; game.monsters = [];
    const out = { keys: { ov: _BULT_ANIM_KEY.bult_marksman, ex: _BULT_ANIM_KEY.bult_deadeye_exec, setOv: _PROJ_ANIM_KEYS.has('p_ult_marksman'), setEx: _PROJ_ANIM_KEYS.has('p_deadeye_execute') }, served: {}, drawn: {} };
    for (const k of ['p_ult_marksman', 'p_deadeye_execute']) { let n = 0; for (let i = 0; i < 100 && n < 9; i++) { _projAnimFrame(k); await W8(100); const arr = PROJ_ANIM_FRAMES[k]; n = arr ? arr.filter((f) => f && (f.tagName === 'CANVAS' || (f.complete && f.naturalWidth > 0))).length : 0; } out.served[k] = n; }
    const o = window._projAnimFrame, seen = { p_ult_marksman: new Set(), p_deadeye_execute: new Set() }; window._projAnimFrame = function (k, off) { const r = o.apply(this, arguments); if (seen[k] && r) seen[k].add(r); return r; };
    const gy = Math.max(...(game.mapData.platforms || []).filter((p) => p.type === 'ground').map((p) => p.y)); player.x = 300; player.y = gy - player.h; player.facing = 1;
    for (const [bspr, w, h] of [['bult_marksman', 56, 18], ['bult_deadeye_exec', 84, 26]]) game.projectiles.push({ x: player.x + 90, y: player.y - 30, vx: 0.2, vy: 0, w, h, life: 9000, damage: 0, owner: 'player', skill: 'marksman_ult', bspr, bsprKeepAspect: true, noGravity: true, color: '#ffd27a' });
    const t0 = performance.now(); while (performance.now() - t0 < 1400) { await frame(); for (const p of game.projectiles) if (p && p.skill === 'marksman_ult') { p.life = 9000; p.x = player.x + 90; p.vx = 0; } }
    window._projAnimFrame = o; out.drawn = { ov: seen.p_ult_marksman.size, ex: seen.p_deadeye_execute.size };
    return out;
  });
  ok('_BULT_ANIM_KEY and _PROJ_ANIM_KEYS carry both rounds', R.keys.ov === 'p_ult_marksman' && R.keys.ex === 'p_deadeye_execute' && R.keys.setOv && R.keys.setEx, R.keys);
  ok('the game serves nine decoded frames for each round', R.served.p_ult_marksman === 9 && R.served.p_deadeye_execute === 9, R.served);
  ok('live: an Overclock round and an Execute Round each draw at least 5 different loop frames in 1.4 s', R.drawn.ov >= 5 && R.drawn.ex >= 5, R.drawn);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
