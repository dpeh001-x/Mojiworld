// The mage's Magic Bolt (Z), pop punk with an electric loop (final polish, mage-orb). Per user: "regenerate mage Z attack
// projectile sprite to make it pop", then "make the animation nice pop electric feels without cut offs".
// Held: the still and all nine frames keep their orb at 66% of the canvas (the size the old loop drew, so the bolt looks as big
// as it always did, and still -> loop no longer jumps size); no pixel reaches a border in any of them (no cut-offs); the frames
// really change (the lightning crackles) without moving the orb; and a Magic Bolt fired in the game draws the new loop.
//   node scripts/mage_orb_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp'); sharp.cache(false);
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9946);
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 240)}`); };
const probe = async (p) => { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, edge = 0, sx = 0, sy = 0, n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[(y * info.width + x) * 4 + 3] <= 40) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sy += y; n++;
    if (x < 2 || y < 2 || x >= info.width - 2 || y >= info.height - 2) edge++; }
  const small = await sharp(p).resize(48, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  return { frac: (x1 - x0 + 1) / info.width, edge, cx: sx / n / info.width, cy: sy / n / info.height, small }; };
const still = await probe(path.join(ROOT, 'Sprites/projectiles/p_mage_orb.webp'));
const frames = []; for (let i = 0; i < 9; i++) frames.push(await probe(path.join(ROOT, `Sprites/projectiles/anim/bolt_${i}.webp`)));
const all = [still, ...frames];
ok('the orb fills ~66% of its canvas in the still and every frame (the size players knew)', all.every((f) => f.frac > 0.6 && f.frac < 0.72), all.map((f) => +f.frac.toFixed(3)));
ok('no cut-offs: nothing reaches a border in the still or any frame', all.every((f) => f.edge === 0), all.map((f) => f.edge));
ok('the orb holds still in the frame (the engine does the spinning)', frames.every((f) => Math.abs(f.cx - 0.5) < 0.02 && Math.abs(f.cy - 0.5) < 0.02), frames.map((f) => [+f.cx.toFixed(3), +f.cy.toFixed(3)]));
const mae = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };
const steps = []; for (let i = 0; i < 9; i++) steps.push(mae(frames[i].small, frames[(i + 1) % 9].small));
ok('the lightning crackles: every frame differs from the next, the loop included', steps.every((d) => d > 0.4), steps.map((d) => +d.toFixed(2)));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _projAnimFrame === 'function' && typeof drawProjectiles === 'function', null, { timeout: 180000 });
await page.waitForTimeout(4000);
const r = await page.evaluate(async () => {
  _projAnimFrame('bolt');
  const t0 = performance.now();
  while (performance.now() - t0 < 20000 && (PROJ_ANIM_FRAMES.bolt || []).filter((im) => im && im.naturalWidth > 0).length < 9) { _projAnimFrame('bolt'); if (typeof _lxPlayerProjReady === 'function') _lxPlayerProjReady(LX_PLAYER_PROJ.mage_orb); await new Promise((res) => setTimeout(res, 250)); }
  const t1 = performance.now();
  while (performance.now() - t1 < 10000 && !(typeof _lxPlayerProjReady === 'function' && _lxPlayerProjReady(LX_PLAYER_PROJ.mage_orb))) await new Promise((res) => setTimeout(res, 200));
  const frames = PROJ_ANIM_FRAMES.bolt || [];
  const seen = new Set();
  const hook = (orig) => function (img) { seen.add(img); return orig.apply(this, arguments); };
  const _di = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = hook(_di);
  const _ps = window._lxProjScaled; if (typeof _ps === 'function') window._lxProjScaled = hook(_ps);
  try {
    if (!game.mapData) loadMap('town');
    game.projectiles.length = 0;
    game.projectiles.push({ x: player.x + 60, y: player.y + 10, vx: 8, vy: 0, w: 30, h: 30, life: 60, maxLife: 60, damage: 1, owner: 'player', skill: 'bolt' });
    drawProjectiles();
  } finally { CanvasRenderingContext2D.prototype.drawImage = _di; if (typeof _ps === 'function') window._lxProjScaled = _ps; }
  return { decoded: frames.filter((im) => im && im.naturalWidth > 0).length, drewLoop: frames.some((im) => seen.has(im)) };
});
await browser.close(); server.kill();
ok('all nine frames decode in the game', r.decoded === 9, r);
ok('a Magic Bolt in flight draws the new electric loop', r.drewLoop === true, r);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
