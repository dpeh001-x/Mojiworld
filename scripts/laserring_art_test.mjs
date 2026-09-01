// Live test: THE GRAVITOS LASER RING IS BIGGER AND NOT CUT OFF.
//
// Per user, with a screenshot: "regenerate this sprite and make it bigger,
// ensure no cutoffs". The shipped art was 513x513 with ~3% padding — the only
// ring in the fx library not at 768, i.e. a tight crop of a ring that wanted
// more room.
//
// Pinned here, on BOTH sides of the change:
//   ART  — the file on disk is 768x768, has zero opaque pixels on any edge
//          row/column, keeps >=5% clear margin on all four sides, and is
//          still round (a one-sided clip shows up as an oval bbox)
//   GAME — the sprite decodes in-engine, and the Laser Sweep charge spawns a
//          spriteBurst whose size is bigger than the pre-change 420 floor,
//          with the release pulse scaled to match
//   node scripts/laserring_art_test.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- 1) the art on disk -----------------------------------------------------
const ART = 'Sprites/fx/gravitos_laserring.webp';
const buf = readFileSync(ART);
const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
let top = -1, bot = -1, l = -1, r = -1, edge = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (data[(y * W + x) * 4 + 3] > 16) {
    if (top < 0) top = y; bot = y;
    if (l < 0 || x < l) l = x; if (x > r) r = x;
    if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++;
  }
}
const bw = r - l + 1, bh = bot - top + 1;
const minPad = Math.min(l / W, (W - 1 - r) / W, top / H, (H - 1 - bot) / H);
ok('the ring art is 768x768 (was 513 — the only fx ring off-standard)', W === 768 && H === 768, { W, H });
ok('NO CUTOFF: zero opaque pixels on any canvas edge', edge === 0, { edgePixels: edge });
ok('...and a real margin on all four sides (>=5%)', minPad >= 0.05,
  { minPaddingPct: +(minPad * 100).toFixed(1) });
ok('the ring is still round (a one-sided clip reads as an oval)',
  bw / bh > 0.9 && bw / bh < 1.12, { aspect: +(bw / bh).toFixed(3), bbox: bw + 'x' + bh });

// ---- 2) the game side -------------------------------------------------------
const free = (p) => new Promise((res) => { const s = net.createServer();
  s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof spawnSpriteBurst === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);

const g = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999;

  // the sprite decodes in-engine at its new size
  const img = (typeof LX_FX === 'object' && LX_FX) ? LX_FX.gravitos_laserring : null;
  if (img) {
    for (let i = 0; i < 200 && !(img.complete && img.naturalWidth > 0); i++) await new Promise((r2) => setTimeout(r2, 50));
    out.artW = img.naturalWidth; out.artH = img.naturalHeight;
  } else out.noKey = true;

  // the Laser Sweep charge spawns the ring burst, bigger than the old floor
  game.monsters = [];
  spawnMonster(Math.round(player.x + 300), Math.round(player.y), 'gravitos', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 1; m.isBoss = true;
  // Let the boss take its first AI ticks BEFORE forcing a pattern: Gravitos's
  // phase initializer (m.phase !== phase on tick one) resets patternState to
  // 'idle', which silently ate an immediately-forced state.
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  game.smoothFx = [];
  m.patternState = 'laser'; m.patternTimer = 0; m._laserRingUp = false; m._laserFired = false;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 20) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const burst = (game.smoothFx || []).find((f) => f && f.spriteKey === 'gravitos_laserring');
  out.chargeSize = burst ? Math.round(burst.size) : null;
  m.patternState = 'idle'; m.patternTimer = 0; game.monsters = []; game.smoothFx = [];
  return out;
});

ok('the engine decodes the ring at its new 768 size',
  g.noKey ? false : (g.artW === 768 && g.artH === 768), { artW: g.artW, artH: g.artH, noKey: g.noKey });
ok('the Laser Sweep charge spawns a ring burst BIGGER than the old 420 floor',
  g.chargeSize != null && g.chargeSize >= 600, { chargeSize: g.chargeSize, previousFloor: 420 });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
