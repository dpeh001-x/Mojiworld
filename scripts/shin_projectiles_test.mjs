// Live test: SHIN-SHURIKEN THROWS A KUNAI AND A SHURIKEN, NOT THE DAGGER.
//
// Per user: "For shinshuriken projectiles generate kunai and shuriken using
// ludo.ai to replace the current daggers".
//   ART   - p_kunai.webp is landscape with the TIP ON THE RIGHT (the renderer
//           rotates to the velocity vector, so a left-pointing blade would fly
//           backwards); p_shuriken.webp is square with gaps between blades;
//           both are edge-clean and in the cache-warm manifest
//   GAME  - both decode through LX_PLAYER_PROJ; casting Shin-Shuriken
//           (SKILL_FNS.smokeBomb) spawns projectiles tagged kunai / shuriken
//           and none tagged dagger
//   DRAW  - the real drawProjectiles() paints the kunai with its own aspect
//           (height < width - not squashed square) and the star square and
//           spinning; a plain skill:'dagger' projectile (the basic Z throw)
//           still draws the dagger sprite
//   node scripts/shin_projectiles_test.mjs
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

// ---- art --------------------------------------------------------------------
const measure = async (p) => {
  const { data, info } = await sharp(readFileSync(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let top = -1, bot = -1, l = -1, r = -1, edge = 0; const col = new Float64Array(W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = data[(y * W + x) * 4 + 3]; col[x] += a;
    if (a > 16) { if (top < 0) top = y; bot = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === H - 1 || x === 0 || x === W - 1) edge++; } }
  const bw = r - l + 1, bh = bot - top + 1, band = Math.max(1, Math.round(bw * 0.15)); let left = 0, right = 0;
  for (let x = l; x < l + band; x++) left += col[x]; for (let x = r - band + 1; x <= r; x++) right += col[x];
  const cx = (l + r) / 2, cy = (top + bot) / 2, rad = Math.min(bw, bh) / 2, B = 72, hit = new Float64Array(B), n = new Float64Array(B);
  for (let y = top; y <= bot; y++) for (let x = l; x <= r; x++) { const d = Math.hypot(x - cx, y - cy) / rad; if (d < 0.55 || d > 0.70) continue;
    const b = Math.min(B - 1, ((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI) * B) | 0); n[b]++; if (data[(y * W + x) * 4 + 3] > 40) hit[b]++; }
  let cov = 0, s = 0; for (let b = 0; b < B; b++) if (n[b]) { s++; if (hit[b] / n[b] > 0.5) cov++; }
  return { W, H, edge, aspect: bw / bh, tipRight: right / left, ringCoverage: s ? cov / s : 1 };
};
const K = await measure('Sprites/projectiles/p_kunai.webp'), S = await measure('Sprites/projectiles/p_shuriken.webp');
ok('p_kunai.webp: 696x319 landscape, long and thin, TIP ON THE RIGHT, edge-clean',
  K.W === 696 && K.H === 319 && K.aspect >= 2.4 && K.tipRight < 0.6 && K.edge === 0, K);
ok('p_shuriken.webp: 512x512, square, gaps between blades (not a disc), edge-clean',
  S.W === 512 && S.H === 512 && S.aspect > 0.85 && S.aspect < 1.18 && S.ringCoverage <= 0.72 && S.edge === 0, S);
const man = JSON.parse(readFileSync('data/assets_manifest.json', 'utf8'));
ok('both sprites are in the cache-warm manifest', man.includes('Sprites/projectiles/p_kunai.webp') && man.includes('Sprites/projectiles/p_shuriken.webp'), {});

// ---- game -------------------------------------------------------------------
const free = (p) => new Promise((res) => { const s = net.createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof drawProjectiles === 'function' && typeof LX_PLAYER_PROJ === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

const g = await page.evaluate(async () => {
  const out = {}; const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i > n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {} await frames(40);
  player.hp = 99999; player._god = true;
  for (let i = 0; i < 200; i++) { const a = LX_PLAYER_PROJ.kunai, s = LX_PLAYER_PROJ.shuriken; if (a && a.complete && a.naturalWidth && s && s.complete && s.naturalWidth) break; await new Promise((r) => setTimeout(r, 50)); }
  out.kunaiW = LX_PLAYER_PROJ.kunai && LX_PLAYER_PROJ.kunai.naturalWidth; out.starW = LX_PLAYER_PROJ.shuriken && LX_PLAYER_PROJ.shuriken.naturalWidth;
  // cast Shin-Shuriken
  player.mp = 9999; player.maxMp = 9999; player.facing = 1; if (player.cooldowns) player.cooldowns = {};
  game.projectiles = [];
  try { SKILL_FNS.smokeBomb(); } catch (e) { out.castErr = String(e).slice(0, 160); }
  await frames(8);
  const mine = game.projectiles.filter((p) => p.owner === 'player' && p.skill === 'dagger');
  out.kinds = {}; for (const p of mine) out.kinds[p.kind || '(none)'] = (out.kinds[p.kind || '(none)'] || 0) + 1;
  // spy the real renderer: every drawImage during one drawProjectiles pass
  const calls = []; const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) { const dw = rest.length >= 8 ? rest[6] : rest[2], dh = rest.length >= 8 ? rest[7] : rest[3];
    calls.push({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, dw, dh }); return orig.call(this, img, ...rest); };
  const spinBefore = (mine.find((p) => p.kind === 'shuriken') || {})._spin;
  try { drawProjectiles(); } catch (e) { out.drawErr = String(e).slice(0, 160); }
  const spinAfter = (mine.find((p) => p.kind === 'shuriken') || {})._spin;
  CanvasRenderingContext2D.prototype.drawImage = orig;
  const kAsp = 319 / 696;
  out.kunaiDraws = calls.filter((c) => c.w && Math.abs(c.w / c.h - 696 / 319) < 0.05 && Math.abs(c.dh / c.dw - kAsp) < 0.06).length;
  out.starDraws = calls.filter((c) => c.w && Math.abs(c.w / c.h - 1) < 0.02 && Math.abs(c.dw - c.dh) < 0.5 && c.dw >= 36).length;
  out.spinAdvanced = typeof spinBefore === 'number' && typeof spinAfter === 'number' && spinAfter > spinBefore;
  // a plain skill:'dagger' projectile (the basic Z throw has no kind) still draws the dagger sprite
  game.projectiles = [{ x: player.x + 40, y: player.y + 10, vx: 8, vy: 0, w: 18, h: 8, life: 60, damage: 1, owner: 'player', skill: 'dagger', color: '#ff88dd' }];
  const c2 = []; CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) { c2.push({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height }); return orig.call(this, img, ...rest); };
  try { drawProjectiles(); } catch (e) {}
  CanvasRenderingContext2D.prototype.drawImage = orig;
  out.plainDaggerDraw = c2.some((c) => c.w && Math.abs(c.w / c.h - 696 / 319) < 0.05);   // same geometry as p_dagger (696x319)
  out.plainDaggerSrc = (LX_PLAYER_PROJ.dagger && LX_PLAYER_PROJ.dagger.naturalWidth) || 0;
  game.projectiles = [];
  return out;
});

ok('LX_PLAYER_PROJ.kunai / .shuriken decode in-engine', g.kunaiW === 696 && g.starW === 512, { kunaiW: g.kunaiW, starW: g.starW });
ok('casting Shin-Shuriken spawns kunai + shuriken lanes and NO dagger-kind projectiles',
  !g.castErr && (g.kinds.kunai || 0) > 0 && (g.kinds.shuriken || 0) > 0 && !g.kinds.dagger && !g.kinds['(none)'], { kinds: g.kinds, castErr: g.castErr });
ok('drawProjectiles paints the kunai at its own aspect (height < width, not squashed square)', g.kunaiDraws > 0 && !g.drawErr, { kunaiDraws: g.kunaiDraws, drawErr: g.drawErr });
ok('...and the shuriken square, at least 36px, and spinning frame to frame', g.starDraws > 0 && g.spinAdvanced === true, { starDraws: g.starDraws, spin: g.spinAdvanced });
ok('a plain skill:dagger projectile (basic Z throw) still draws the dagger sprite - the swap is scoped to Shin-Shuriken',
  g.plainDaggerDraw === true && g.plainDaggerSrc === 696, { plainDaggerDraw: g.plainDaggerDraw, src: g.plainDaggerSrc });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 360)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
