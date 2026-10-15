// PISCES'S BULLET HELL: A KOI DISC, SMALLER, WITH A BREATHER (per user: "reduce the size of the bullethell projectiles", "regenerate a non wave sprite", "have some 2 s pause every 20 seconds of bullet hell").
// Her 'whirl' shot was the cyan water-wave ring (a 66 px square drawn, a pinwheel at spinRate 0.35); it is now a twin-koi disc in her own violets, drawn in a 41 px square, turning at 0.2.
//   art    : p_whirl.webp and anim/whirl_0..8.webp are 768 px squares, one whole shape each, nothing on the edge, mostly violet (the old art was mostly cyan)
//   size   : a real Pisces shot is drawn in a ~41 px square (it was 66) and its hitbox is 17 px (it was 20)
//   breath : _lxPiscesHellGate - 20 s (1200 ticks) of barrage, then shut for 2 s (135 ticks), then open for another 20 s
//   live   : in her arena, with the 20 s clock forced due, no shot leaves for >= 2 s and the barrage then resumes
//   node scripts/pisces_koi_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10371);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
// ---- art
const files = ['Sprites/projectiles/p_whirl.webp', ...Array.from({ length: 9 }, (_, i) => 'Sprites/projectiles/anim/whirl_' + i + '.webp')], rep = [];
for (const f of files) {
  const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height; let edge = 0, n = 0, cy = 0, vi = 0, any = 0; const seen = new Uint8Array(W * H), st = []; let blobs = 0;
  for (let p = 0; p < W * H; p++) { const a = data[p * 4 + 3]; if (a > 60) { n++; const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2], x = p % W, y = (p / W) | 0; if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) edge++; if (g > r + 40 && b > r + 40) cy++; else if (b > g + 15) vi++; any++; } }
  for (let p0 = 0; p0 < W * H; p0++) { if (seen[p0] || data[p0 * 4 + 3] <= 10) continue; let c = 0; st.length = 0; st.push(p0); seen[p0] = 1; while (st.length) { const p = st.pop(); c++; const x = p % W, y = (p / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (seen[q] || data[q * 4 + 3] <= 10) continue; seen[q] = 1; st.push(q); } } if (c >= 12) blobs++; }
  rep.push({ f: f.split('/').pop(), W, H, edge, blobs, cyanShare: +(cy / Math.max(1, any)).toFixed(3), violetShare: +(vi / Math.max(1, any)).toFixed(3) });
}
ok('the still and the nine loop frames are 768 px squares', rep.every((r) => r.W === 768 && r.H === 768), rep.slice(0, 2));
ok('each is one whole shape with nothing on the canvas edge', rep.every((r) => r.blobs === 1 && r.edge === 0), rep.map((r) => r.blobs + '/' + r.edge).join(' '));
ok('and violet, not the old cyan wave (cyan share < 8%)', rep.every((r) => r.cyanShare < 0.08), rep.map((r) => r.cyanShare).join(' '));
// ---- live
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxPiscesHellGate === 'function' && typeof drawProjectiles === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 90; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    const out = {};
    // ---- the gate, on a stand-in
    const g0 = game.time | 0, T = (k) => { game.time = g0 + k; return _lxPiscesHellGate(fm); }, fm = {};
    const seq = [[0, true], [600, true], [1199, true], [1200, false], [1300, false], [1334, false], [1335, true], [1336, true], [2534, true], [2535, false], [2669, false], [2670, true]];
    out.gate = seq.map(([k, want]) => [k, T(k), want]); game.time = g0;
    // ---- the live size of a real shot: an enemy whirl shot drawn once, the biggest drawImage of the draw
    loadMap('zod_pisces', 200); await W8(4500); game.paused = false;
    const boss = game.monsters.find((x) => x.zodiacBoss || x.zodiacSign); if (boss) boss.currentHp = boss.maxHp = 9e12;
    const od = CanvasRenderingContext2D.prototype.drawImage; let sizes = [];
    game.projectiles.length = 0; const q = { x: player.x + 200, y: player.y - 40, vx: 1, vy: 0, w: 14, h: 14, life: 130, damage: 1, owner: 'enemy', _zodiacSign: 'pisces', _zodiacAttacker: true, skill: 'whirl', color: '#cc99ff' }; game.projectiles.push(q);
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) { if (this === ctx && a.length === 4 && a[2] > 8 && Math.abs(a[0] + a[2] / 2) < 0.6 && Math.abs(a[1] + a[3] / 2) < 0.6) sizes.push(Math.max(a[2], a[3]));   /* the spin blit draws centred on its own translate */ return od.apply(this, [img, ...a]); };
    for (let i = 0; i < 6; i++) { await frame(); } CanvasRenderingContext2D.prototype.drawImage = od;
    const want = 2 * q.w * _PROJ_SPRITE_BLIT.whirl.size * (q._zVis || 1);   // the blit draws a square of side 2r, r = p.w x blit size x _zVis
    out.shot = { w: q.w, h: q.h, side: +want.toFixed(1), seenDraw: sizes.some((z) => Math.abs(z - want) < 1.5), n: sizes.length, blit: _PROJ_SPRITE_BLIT.whirl, size: _LX_ZOD_PROJ_SIZE.whirl };
    // ---- the breather, live: due clock, count the whirl shots that leave over 7 s
    game.projectiles.length = 0; const seen = new WeakSet(), times = []; boss._hellRestUntil = null; boss._hellT0 = (game.time | 0) - 1300; const t0 = performance.now();
    while (performance.now() - t0 < 7000) { await frame(); player.x = boss.x + boss.w / 2 - 330; player.y = boss.y + boss.h - player.h; player._god = true; boss.currentHp = boss.maxHp;
      for (const p of game.projectiles) if (p && p.skill === 'whirl' && !seen.has(p)) { seen.add(p); times.push(performance.now() - t0); } }
    let gap = times.length ? times[0] : 0, gapAt = 0; for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > gap) { gap = times[i] - times[i - 1]; gapAt = times[i - 1]; }
    out.live = { shots: times.length, firstAt: times.length ? Math.round(times[0]) : null, maxGapMs: Math.round(gap), gapAt: Math.round(gapAt), after: times.filter((t) => t > gapAt + gap - 1).length };
    return out;
  });
  ok('the gate: 20 s open, 2 s (135 ticks) shut, 20 s open, shut again', R.gate.every(([k, got, want]) => got === want), R.gate.filter(([k, got, want]) => got !== want));
  ok('a real Pisces shot is drawn in a ~41 px square (the cyan ring was 66) on a 17 px hitbox, and the draw really uses that size', R.shot.side >= 36 && R.shot.side <= 46 && R.shot.seenDraw && R.shot.w === 17 && R.shot.h === 17, R.shot);
  ok('the koi disc turns at 0.2 (the old ring was 0.35: a pinwheel)', R.shot.blit && R.shot.blit.spinRate === 0.2, R.shot.blit);
  ok('live: the barrage fires, then a >= 2 s breather with no shot leaving, then it resumes', R.live.shots >= 8 && R.live.maxGapMs >= 2000 && R.live.after >= 4, R.live);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
