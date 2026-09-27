// The pop-punk projectile pass (final polish, proj-pop): twelve stills redrawn, eleven nine-frame loops. Per user: "Regenerate
// these sprites ... pop punk style ... no cut offs or shadows" and then animations for them.
// Held: every still loads at the canvas size the renderer was tuned for; every loop is keyed (so it is requested), indexed
// (so all nine frames are asked for), decodes, and is what the projectile draws; the Conductor's ticket - its own draw
// branch - draws its loop too; no still or frame has opaque pixels on its border (the cut-off rule).
//   node scripts/proj_pop_art_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp'); sharp.cache(false);
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9944);
const STILLS = { mdark: [768, 768], p_tentacle: [768, 768], mhornshot: [432, 231], mpinespike: [512, 512], mcookie: [768, 768], p_splash: [768, 768],
  p_forgehammer: [512, 512], mtidemark: [768, 768], mticket: [712, 593], mthorn: [512, 512], mseed: [512, 512], mquery: [512, 512] };
const LOOPS = ['mdark', 'splash', 'mtidemark', 'mhornshot', 'mpinespike', 'mcookie', 'forgeHammer', 'mticket', 'mthorn', 'mseed', 'mquery'];
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 240)}`); };
// on disk: sizes and the cut-off rule
const edgeOpaque = async (p) => { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let n = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (x > 1 && y > 1 && x < info.width - 2 && y < info.height - 2) continue; if (data[(y * info.width + x) * 4 + 3] > 40) n++; } return n; };
const bad = [];
for (const [k, [w, h]] of Object.entries(STILLS)) { const p = path.join(ROOT, 'Sprites/projectiles', k + '.webp'); const m = await sharp(p).metadata(); if (m.width !== w || m.height !== h) bad.push(`${k} ${m.width}x${m.height}`); const e = await edgeOpaque(p); if (e > 4) bad.push(`${k} edge ${e}`); }
ok('twelve stills keep their canvas size and touch no border', bad.length === 0, bad);
const badF = [];
for (const k of LOOPS) for (let i = 0; i < 9; i++) { const e = await edgeOpaque(path.join(ROOT, 'Sprites/projectiles/anim', `${k}_${i}.webp`)); if (e > 4) badF.push(`${k}_${i} edge ${e}`); }
ok('99 loop frames touch no border', badF.length === 0, badF.slice(0, 6));
// in the game
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
const missing = []; page.on('response', (r) => { if (r.status() >= 400 && /projectiles\//.test(r.url())) missing.push(r.url().split('/').slice(-2).join('/')); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _projAnimFrame === 'function' && typeof LX_MOB_PROJ === 'object', null, { timeout: 180000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(async (LOOPS) => {
  const out = { keyed: [], counts: {}, drawn: {} };
  for (const k of LOOPS) { out.keyed.push(_PROJ_ANIM_KEYS.has(k)); out.counts[k] = (typeof _lxFrameCount === 'function') ? _lxFrameCount('projectiles/anim', k, 9) : null; _projAnimFrame(k); }
  const t0 = performance.now();
  while (performance.now() - t0 < 20000) {
    const done = LOOPS.every((k) => (PROJ_ANIM_FRAMES[k] || []).filter((im) => im && im.complete && im.naturalWidth > 0).length === 9);
    if (done) break; for (const k of LOOPS) _projAnimFrame(k); await new Promise((res) => setTimeout(res, 250));
  }
  for (const k of LOOPS) out.drawn[k] = (PROJ_ANIM_FRAMES[k] || []).filter((im) => im && im.complete && im.naturalWidth > 0).length;
  // the ticket's own branch: draw one and see which image reaches the scaler
  const seen = []; const _orig = window._lxProjScaled;
  window._lxProjScaled = function (img, sz) { seen.push(img); return _orig.apply(this, arguments); };
  try {
    if (typeof loadMap === 'function' && !game.mapData) loadMap('town');
    // the still is lazy (v0.30.1234): asked for by the first draw, then the branch draws; wait for it as a live fight would
    const t1 = performance.now();
    while (!_lxMobProjReady(LX_MOB_PROJ.mticket) && performance.now() - t1 < 15000) await new Promise((res) => setTimeout(res, 200));
    game.projectiles.length = 0;
    game.projectiles.push({ x: player.x + 60, y: player.y, vx: 3, vy: 0, w: 40, h: 40, life: 200, owner: 'enemy', skill: 'mticket', damage: 1 });
    if (typeof drawProjectiles === 'function') drawProjectiles();
  } catch (e) { out.drawErr = String(e).slice(0, 120); }
  window._lxProjScaled = _orig;
  const tk = PROJ_ANIM_FRAMES.mticket || [];
  out.ticketDrawsLoop = seen.some((im) => tk.includes(im));
  out.stillsLoaded = Object.entries(LX_MOB_PROJ).filter(([k]) => ['mdark', 'mhornshot', 'mpinespike', 'mcookie', 'splash', 'forgeHammer', 'mtidemark', 'mticket', 'mthorn', 'mseed', 'mquery'].includes(k)).map(([k, im]) => [k, !!(im && im.naturalWidth)]);
  return out;
}, LOOPS);
await browser.close(); server.kill();
ok('all eleven loops are keyed, so the renderer asks for them', r.keyed.every(Boolean), r.keyed);
ok('the frame index lists nine frames for each loop', LOOPS.every((k) => r.counts[k] === 9), r.counts);
ok('all 99 frames decode in the game', LOOPS.every((k) => r.drawn[k] === 9), r.drawn);
ok("the Conductor's ticket draws its loop through its own branch", r.ticketDrawsLoop === true, { drawErr: r.drawErr });
ok('no projectile art 404s', missing.length === 0, missing.slice(0, 6));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
