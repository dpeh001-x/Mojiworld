// Live test: AETHERION'S SECOND FORM STANDS ON THE FLOOR - BOTH FEET.
//
// Per user: "aetherion2 appears to be levitating note the other foot is off the ground, push it vertically
// downwards". His form-2 stance plants one foot and lifts the other ~9 px higher; the calibration lined the
// planted one up with the floor, so the lifted one hung 7.2 px above it in every idle and attack frame.
//
// Measures what the player sees: the draw records the rect it blits (_lxDrawRect, recorded while a ward is
// up), a wrapper captures the frame image it blits, and that frame's own alpha gives the lowest opaque row of
// each foot (left / right half of the figure). World px ABOVE the floor; negative = into it. The boss runs his
// real AI in his real arena, so idle, walk and attack frames all come round.
//   node scripts/aeth2_feet_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18631; p <= 18729 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
const R = await page.evaluate(async () => {
  const raf = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const c = document.querySelector('.cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  player.level = 80; player._god = true;
  loadMap('sanctum');
  const now = () => game.time | 0;
  const steps = async (n, each) => { const s0 = now(); let g = 0; while (now() - s0 < n && g++ < 30000) { await raf(); game.paused = false; player.hp = player.maxHp; try { _dismissBossIntro(); } catch (e) {} if (each) each(); } };
  await steps(60);
  const m = game.monsters.find((x) => x && x.type === 'aetherion');
  if (!m) return { noBoss: true };
  m.currentHp = Math.floor(m.maxHp * 0.49);                 // his ascension into form 2
  await steps(150);
  let lastSprite = null;
  const _d0 = window._drawBossSprite;
  window._drawBossSprite = function (sprite, mm) { if (mm === m) lastSprite = sprite; return _d0.apply(this, arguments); };
  const floorY = 480;
  const keep = () => { m._wardUntil = (game.time | 0) + 100000; if (player.x > m.x - 200) player.x = Math.max(20, m.x - 360); };
  const cache = new Map();
  const feetOf = (img) => {
    const key = img.src || img; if (cache.has(key)) return cache.get(key);
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let minX = w, maxX = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const mid = (minX + maxX) / 2; let lowL = -1, lowR = -1;
    for (let y = h - 1; y >= 0 && (lowL < 0 || lowR < 0); y--) for (let x = minX; x <= maxX; x++) if (d[(y * w + x) * 4 + 3] > 128) { if (x < mid && lowL < 0) lowL = y; if (x >= mid && lowR < 0) lowR = y; }
    const r = { h, lowL, lowR }; cache.set(key, r); return r;
  };
  const by = { idle: [], walk: [], attack: [] };
  const sample = () => {
    const rect = m._lxDrawRect, img = lastSprite;
    if (!rect || !img || m._phaseSprite !== 'aetherion2' || !by[img._lxSt]) return;
    const f = feetOf(img), yOf = (row) => rect.y + ((row + 1) / f.h) * rect.h;
    const a = floorY - yOf(f.lowL), z = floorY - yOf(f.lowR);
    by[img._lxSt].push({ fi: img._lxFi, low: +Math.min(a, z).toFixed(1), high: +Math.max(a, z).toFixed(1) });
  };
  // his own AI for the standing and attacking poses...
  for (let s = 0; s < 400 && (by.idle.length < 6 || by.attack.length < 6); s++) { await steps(3, keep); sample(); }
  // ...and the walk set, which form 2 rarely reaches on its own inside 400 samples: held in place and told he is
  // walking (_bossMoving reads _mobWalking), so the draw picks the walk frames at his own calibration.
  const _w0 = window._mobWalking; window._mobWalking = function (mm) { return mm === m ? true : _w0.apply(this, arguments); };
  const still = () => { keep(); m._stagger = 1e9; m.patternState = 'idle'; m.vx = 0; };
  for (let s = 0; s < 120 && by.walk.length < 9; s++) { await steps(3, still); sample(); }
  window._mobWalking = _w0;
  window._drawBossSprite = _d0;
  return { by, phase: m._phaseSprite };
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const B = R.by || {}, span = (a, k) => a.length ? [Math.min(...a.map((x) => x[k])), Math.max(...a.map((x) => x[k]))] : null;
ok('he is in form 2 and every pose was sampled', !R.noBoss && R.phase === 'aetherion2' && B.idle.length >= 6 && B.walk.length >= 9 && B.attack.length >= 6,
  { phase: R.phase, idle: B.idle && B.idle.length, walk: B.walk && B.walk.length, attack: B.attack && B.attack.length });
for (const st of ['idle', 'attack']) {
  ok(`${st}: the LIFTED foot meets the floor (was 7.2 px above it)`, B[st].length && B[st].every((x) => x.high <= 2), { lifted: span(B[st], 'high') });
  ok(`${st}: the planted foot digs in no more than 12 px`, B[st].length && B[st].every((x) => x.low >= -12), { planted: span(B[st], 'low') });
}
ok('walk: the foot on the ground stays within the same band', B.walk.length && B.walk.every((x) => x.low >= -12 && x.low <= 2), { lowest: span(B.walk, 'low') });
const lows = ['idle', 'walk', 'attack'].map((st) => B[st].length ? Math.min(...B[st].map((x) => x.low)) : null);
ok('the three poses sit at one depth - no hop when he switches (within 2 px)', lows.every((v) => v != null) && Math.max(...lows) - Math.min(...lows) <= 2, { idle: lows[0], walk: lows[1], attack: lows[2] });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
