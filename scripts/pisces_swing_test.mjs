// PISCES'S SWING STRIKE IS AN ANIMATED PEARL COMET, NOT A WAVE (per user: "regenerate a non wave sprite for this strike using ludo.ai", "this needs to be regenerated to something nicer", "C", "animate it with ludo").
// Her signature swing was an unshaped one (no LX_SWING_SHAPE row): one still, a twisted purple water-wave, stretched over the hitbox. It is now a glowing pearl pulling braided fish-tail ribbons (ludo.ai),
// a SHAPED THRUST swing with a nine-frame set (fx/anim/swing_zodiac_pisces_0..8, ludo.ai): a small orb at the tail (0-3 grow), the comet on the hit (4), the trail dissolving (5-8).
//   art    : the still is a 640 x 256 whole shape (nothing on the canvas edge, violet not cyan); the nine frames are whole, on one padded canvas, frame 4 = the still, the orb frames small, the trail frames fading
//   shape  : LX_SWING_SHAPE.zodiac_pisces is a THRUST with n 9, k 4 and the frames' pad shares; _lxSwingAnim serves the nine decoded frames
//   live   : in her arena a real swing spawns her strike and the draw plays the frame set (orb, comet, trail)
//   node scripts/pisces_swing_test.mjs [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const sharp = require('sharp'); const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10381);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) : '')); };
async function stats(f) {
  const { data, info } = await sharp(path.join(ROOT, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height;
  let edge = 0, cy = 0, any = 0, blobs = 0, x0 = W, x1 = 0, y0 = H, y1 = 0, sum = 0; const seen = new Uint8Array(W * H), st = [];
  for (let p = 0; p < W * H; p++) { const a = data[p * 4 + 3]; sum += a; if (a > 60) { const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2], x = p % W, y = (p / W) | 0; any++; if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) edge++; if (g > r + 40 && b > r + 40) cy++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  for (let p0 = 0; p0 < W * H; p0++) { if (seen[p0] || data[p0 * 4 + 3] <= 10) continue; let c = 0; st.length = 0; st.push(p0); seen[p0] = 1; while (st.length) { const p = st.pop(); c++; const x = p % W, y = (p / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (seen[q] || data[q * 4 + 3] <= 10) continue; seen[q] = 1; st.push(q); } } if (c >= 40) blobs++; }
  return { W, H, edge, blobs, any, sum, cyan: any ? cy / any : 0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
}
const S = await stats('Sprites/fx/swing_zodiac_pisces.webp');
ok('the still is a 640 x 256 braided comet: nothing on the canvas edge, a few pieces at most, violet not cyan, a wide band', S.W === 640 && S.H === 256 && S.edge === 0 && S.blobs >= 1 && S.blobs <= 6 && S.cyan < 0.08 && S.bw / S.bh >= 2.6 && S.bw >= 0.9 * S.W, { W: S.W, H: S.H, edge: S.edge, blobs: S.blobs, cyan: +S.cyan.toFixed(3), content: [S.bw, S.bh] });
const F = []; for (let i = 0; i < 9; i++) F.push(await stats('Sprites/fx/anim/swing_zodiac_pisces_' + i + '.webp'));
ok('the nine frames share one padded canvas (896 x 512), none touching its edge, each one body plus its sparkles (<= 20 pieces)', F.every((f) => f.W === 896 && f.H === 512 && f.edge === 0 && f.blobs >= 1 && f.blobs <= 20), F.map((f) => f.W + 'x' + f.H + '/' + f.edge + '/' + f.blobs).join(' '));
ok('frame 4 is the still (as wide as the still content) and the three before it are the orb and its growth (frame 0, the danger orb and its ring, under a quarter of the comet, then rising)', Math.abs(F[4].bw - S.bw) < 8 && F[0].sum < 0.25 * F[4].sum && F[0].sum <= F[1].sum && F[1].sum <= F[2].sum && F[2].sum <= F[3].sum + 1, F.map((f) => Math.round(f.sum / 1000)).join(' '));
ok('the trail streaks on and then thins out: frames 7 and 8 each carry less light than the one before, frame 8 under 70% of the comet frame', F[8].sum < 0.7 * F[4].sum && F[7].sum < F[6].sum && F[8].sum < F[7].sum, F.slice(4).map((f) => Math.round(f.sum / 1000)).join(' '));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxSwingAnim === 'function' && typeof LX_SWING_SHAPE !== 'undefined', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((r) => setTimeout(r, ms)), frame = () => new Promise((r) => requestAnimationFrame(r));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'story-beat-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; window._perfTick = () => {}; applyClass('warrior'); player.level = 90; player._god = true; player.invulnerable = 9e9; player.maxHp = player.hp = 9e9;
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    loadMap('zod_pisces', 200); await W8(4500); game.paused = false;
    const m = game.monsters.find((x) => x.zodiacBoss || x.zodiacSign); if (!m) return { err: 'no boss' }; m.currentHp = m.maxHp = 9e12;
    const shape = LX_SWING_SHAPE.zodiac_pisces; let an = null; for (let i = 0; i < 80 && !(an && an.length === 9); i++) { await W8(100); try { an = _lxSwingAnim('zodiac_pisces'); } catch (e) {} }
    const od = CanvasRenderingContext2D.prototype.drawImage, used = new Set(); let swung = false;
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { if (this === ctx && an && an.length) { const k = an.indexOf(im); if (k >= 0) used.add(k); } return od.apply(this, [im, ...a]); };
    m._bigMeleeCd = 0; const t0 = performance.now();
    while (performance.now() - t0 < 9000) { await frame(); player.x = m.x + m.w / 2 - 200; player.y = m.y + m.h - player.h; player._god = true; m.currentHp = m.maxHp; if (game.projectiles.some((p) => p && p._swingType === 'zodiac_pisces')) swung = true; if (swung && !game.projectiles.some((p) => p && p._swingType === 'zodiac_pisces') && !(m._bigMeleeFiring)) break; }
    CanvasRenderingContext2D.prototype.drawImage = od;
    // the windup ghost's reveal edge: draw her ghost half revealed on a cleared canvas and read the column profile - a hard clip drops the whole ghost within a pixel or two, a feathered edge falls over ~20% of the art
    const cv = ctx.canvas, camX = game.camera.x; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
    const z = { sg: { type: 'zodiac_pisces', mb: { x: camX + 100, y: 140, w: 311, h: 339 }, facing: 1 }, x: camX + 330, y: 230, w: 332, h: 132, prog: 0.5 }; ctx.save(); const drew = _lxSwingGhost(z); ctx.restore();
    const im = ctx.getImageData(0, 0, cv.width, cv.height), colA = new Float64Array(cv.width); for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) colA[x] += im.data[(y * cv.width + x) * 4] + im.data[(y * cv.width + x) * 4 + 1] + im.data[(y * cv.width + x) * 4 + 2];   /* the game canvas is opaque: after the clear it is black, the ghost adds light */
    let pk = 0; const sm = []; for (let x = 0; x < cv.width; x++) { let a = 0, n = 0; for (let d = 0; d <= 0; d++) if (x + d >= 0 && x + d < cv.width) { a += colA[x + d]; n++; } sm.push(a / n); pk = Math.max(pk, sm[x]); }
    let drop = 0, lit = 0; for (let x = 1; x < sm.length; x++) { drop = Math.max(drop, (sm[x - 1] - sm[x]) / Math.max(1, pk)); if (sm[x] > 0.05 * pk) lit++; }
    return { swung, shape, frames: an ? an.length : 0, used: [...used].sort(), type: m.zodiacSign || m.type, ghost: { drew, peak: Math.round(pk), maxColumnDrop: +drop.toFixed(3), litColumns: lit } };
  });
  ok('LX_SWING_SHAPE.zodiac_pisces is a THRUST swing with a nine-frame set (strike on frame 4) and the frames\' pad shares', R.shape && R.shape[0] === 'THRUST' && R.shape[2] && R.shape[2].n === 9 && R.shape[2].k === 4 && Math.abs(R.shape[2].p[0] - 0.2) < 0.01 && Math.abs(R.shape[2].p[1] - 0.5) < 0.01, R.shape);
  ok('the game serves all nine decoded frames of the set', R.frames === 9, { frames: R.frames });
  ok('a real Pisces swing spawns her strike, and the draw plays the frame set (the orb, the comet and the trail all reach the canvas)', R.swung === true && R.used && R.used.includes(4) && R.used.some((k) => k <= 3) && R.used.some((k) => k >= 5), { swung: R.swung, used: R.used, type: R.type });
  ok('the windup ghost reveals the comet with a soft edge, not a straight cut (no column of the ghost drops more than 12% of its peak against the next)', R.ghost && R.ghost.drew && R.ghost.litColumns > 40 && R.ghost.maxColumnDrop < 0.12, R.ghost);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
