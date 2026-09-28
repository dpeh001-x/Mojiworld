// PATH'S BANE SWINGS THE SCYTHE HE CARRIES. Per user: "why is pathbane sprite entirely regenerated? the scythe looks
// weird", then "Redraw the swing" and "ensure the scythe is not warped". His attack set (unchanged since June) kept the
// scythe on his back while a second, sword-like blade did the swing (frames 5-6) and split the scythe's head across both
// ends of its shaft (frame 4). The nine redrawn frames were checked by eye, one scythe, rigid, in every frame; this pins
// what can be measured:
//   - FILES: nine frames on the 630x640 canvas; the rest poses (0 and 8) keep his old size (389 px) and foot row (603),
//     so the attack starts and ends on the pose his idle hands over; no frame's art touches an image edge
//   - IN GAME: the attack's rest pose draws at his idle body size (within 3%), and his strike is frame 4, the full crescent
//   - THE HIT'S CRESCENT (v0.30.1406, per user "wire it"): the heavy-swing crescent drawn over the hitbox on that beat is in his
//     trail's green, not the crimson reap that clashed with it (no red-dominant pixel, mostly green or white-hot)
//   [PORT=13897] node scripts/pathsbane_swing_art_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core'); const sharp = require('sharp');
const PORT = process.env.PORT || '13897'; let pass = 0, fail = 0;
const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  ' + JSON.stringify(d) : '')); ok ? pass++ : fail++; };
// FILES
const F = [];
for (let i = 0; i < 9; i++) {
  const { data: d, info } = await sharp(path.join(ROOT, 'Sprites', 'monsters', 'attack', `pathsBane_${i}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let x0 = W, y0 = H, x1 = -1, y1 = -1, edge = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = d[(y * W + x) * 4 + 3];
    if (a > 16 && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) edge++;
    if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  F.push({ i, W, H, h: y1 - y0 + 1, foot: y1, cx: (x0 + x1 + 1) / 2, edge });
}
check(F.every((f) => f.W === 630 && f.H === 640), 'FILES: nine frames on the 630x640 canvas', F.map((f) => f.W + 'x' + f.H));
const rest = [F[0], F[8]];
check(rest.every((f) => Math.abs(f.h - 389) <= 4 && Math.abs(f.foot - 603) <= 1) && Math.abs(F[0].cx - F[8].cx) <= 2,
  'FILES: the rest poses keep his old size (389 px) and foot row (603), and match each other', rest.map((f) => ({ h: f.h, foot: f.foot, cx: f.cx })));
check(F.every((f) => f.edge === 0), 'FILES: no frame\'s art touches an image edge (no cut blade or slash)', F.map((f) => f.edge));
{
  const { data: d } = await sharp(path.join(ROOT, 'Sprites', 'fx', 'swing_pathsBane.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, red = 0, green = 0, white = 0;
  for (let o = 0; o < d.length; o += 4) { if (d[o + 3] < 128) continue; n++; const r = d[o], g = d[o + 1], b = d[o + 2];
    if (r > g + 30 && r > b + 30) red++; else if (g > r + 30 && g > b) green++; else if (r > 190 && g > 220 && b > 190) white++; }
  check(n > 5000 && red === 0 && (green + white) / n >= 0.95, 'THE HIT\'S CRESCENT: the heavy-swing crescent is in his trail\'s green, not a crimson reap', { px: n, red, green, white });
}
// IN GAME
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: path.resolve(ROOT, process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html') } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _monsterStateFrame === 'function' && typeof _drawMonsterSprite === 'function', null, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const W8 = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  player._tutorialSeen = true; applyClass('warrior'); player.level = 90;
  try { _lxBootHold.release('menu'); } catch (e) {}
  loadMap('forest', 300); await W8(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
  player._god = true; player.invulnerable = 9e9; game.monsters.length = 0;
  const m = spawnMonster(player.x + 360, player.y - 100, 'pathsBane', false);
  const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
  const idle = await load('Sprites/monsters/idle/pathsBane_0.webp'), atk0 = await load('Sprites/monsters/attack/pathsBane_0.webp'); atk0._lxFi = 0;
  let force = null; const origSF = _monsterStateFrame;
  window._monsterStateFrame = function (mm) { if (mm === m && force) { mm._frameIsAttack = force === atk0; return force; } return origSF.apply(this, arguments); };
  // the biggest blit inside _drawMonsterSprite(m) is his sprite
  const P = CanvasRenderingContext2D.prototype, origDI = P.drawImage, origDM = _drawMonsterSprite; let inM = false, best = null;
  P.drawImage = function (...a) { if (inM) { const dw = a.length >= 9 ? a[7] : a[3], dh = a.length >= 9 ? a[8] : a[4]; if (dw * dh > (best ? best.w * best.h : 0)) best = { w: dw, h: dh }; } return origDI.apply(this, a); };
  window._drawMonsterSprite = function (mm) { if (mm !== m) return origDM.apply(this, arguments); inM = true; try { return origDM.apply(this, arguments); } finally { inM = false; } };
  // wait for a real draw of him after the reset (a cold first run can skip several frames before one lands)
  const measure = async (im) => { force = im; best = null; for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r)); await W8(200); best = null; for (let i = 0; i < 120 && !best; i++) await new Promise((r) => requestAnimationFrame(r)); return best; };
  const bi = await measure(idle), ba = await measure(atk0);
  P.drawImage = origDI; window._drawMonsterSprite = origDM; window._monsterStateFrame = origSF;
  const rowOf = (k) => (window.LX_SPRITE_BBOX || {})[k];
  const ft = (_lxAnimCalib('pathsBane', 'attack') || {}).ft || [];
  return { bi, ba, rowIdle: rowOf('monsters/idle/pathsBane_0.webp'), rowAtk: rowOf('monsters/attack/pathsBane_0.webp'), ft };
});
console.log(JSON.stringify(R));
const frac = (row) => { const [t, b, , h] = String(row || '').split(',').map(Number); return (b - t + 1) / h; };
const idleBody = R.bi && R.bi.h * frac(R.rowIdle), atkBody = R.ba && R.ba.h * frac(R.rowAtk), ratio = atkBody / idleBody;
check(!!R.bi && !!R.ba && Math.abs(ratio - 1) <= 0.03, 'IN GAME: the attack\'s rest pose draws at his idle body size (within 3%)', { idleBody: +(idleBody || 0).toFixed(1), attackBody: +(atkBody || 0).toFixed(1), ratio: +(ratio || 0).toFixed(3) });
const strike = R.ft.indexOf(Math.max(...R.ft));
check(R.ft.length === 9 && strike === 4, 'IN GAME: his strike is frame 4, the full crescent (the longest-held frame)', { ft: R.ft, strike });
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
