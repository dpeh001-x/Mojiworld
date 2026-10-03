// The Fractured Reflection's cracked mirror stands ON the floor: its feet touch the slab, not just the loose shards in front of them.
//
// Per user (a crop of the mirror): "the mirror appears to be floating". World props plant the art's LOWEST opaque pixel on the floor
// (data/sprite_bbox.js), and this piece's two loose glass shards lie lower than its frame, so the shards touched the slab and the frame's feet
// hung 2-4 px above it. A per-prop `sink` (3 px here) shifts the drawing; the placement y stays on the floor, which map_decor_test checks.
// Measured, not assumed: the scene is rendered with and without the mirror (glow off, paused, same frame) at 3x, and the lowest row each FOOT
// changed is compared with the floor line.
// v0.30.1621 (per user: the mirror should "sink further in"): the floor-line plant (2 px, as NPC feet, plus its base gap) adds to the sink,
// so both feet now sit IN the slab's keyline - the far one at least 1 px in, the near one above the slab's lower face (~8 px).
//   node scripts/mirror_floor_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11697), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof MAP_PROPS === 'object' && typeof LX_OBJECTS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  const g = await page.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true; player._god = true; player.invulnerable = 9e9; player._gravitosCineSeen = true;
    loadMap('fracturedReflection', 840); game.paused = false; await w(6000); game.monsters.length = 0; player.x = 840; await w(800); game.monsters.length = 0;
    const mp = MAP_PROPS.fracturedReflection.find((p) => p.key === 'rift_cracked_mirror'); out.prop = { y: mp.y, x: mp.x, sink: mp.sink || 0, scale: mp.scale };
    out.floor = game.mapData.platforms.filter((q) => q.type === 'ground' && mp.x >= q.x + 72 && mp.x <= q.x + q.w - 72).map((q) => q.y);
    // where the art is drawn: the mirror is the only 87 px square blit on this view
    const o = CanvasRenderingContext2D.prototype.drawImage; let bottom = null;
    CanvasRenderingContext2D.prototype.drawImage = function () { if (this === ctx && arguments.length === 5 && arguments[3] > 86 && arguments[3] < 89 && arguments[4] > 86 && arguments[4] < 89) bottom = arguments[2] + arguments[4]; return o.apply(this, arguments); };
    const sink = mp.sink || 0; await w(300); out.bottomWith = bottom; mp.sink = 0; bottom = null; await w(300); out.bottomWithout = bottom; mp.sink = sink; await w(200);
    CanvasRenderingContext2D.prototype.drawImage = o;
    window.__mp = MAP_PROPS.fracturedReflection.slice(); mp.glow = { c: '0,0,0', r: 1, a: 0, y: 0.5 };   // no pulsing light under the diff
    game.paused = true; await w(300); const c = document.getElementById('game').getBoundingClientRect(), sc = c.width / W;
    out.clip = { x: c.left + (960 - game.camera.x - 55) * sc, y: c.top + (448 - 60) * sc, width: 110 * sc, height: 90 * sc }; out.sc = sc; return out;
  });
  const A = await page.screenshot({ clip: g.clip });
  await page.evaluate(() => { MAP_PROPS.fracturedReflection = window.__mp.filter((p) => p.key !== 'rift_cracked_mirror'); game.paused = false; });
  await page.waitForTimeout(300); await page.evaluate(() => { game.paused = true; }); await page.waitForTimeout(300);
  const B = await page.screenshot({ clip: g.clip });
  const m = await page.evaluate(async ({ a, b, sc }) => {
    const load = async (s) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height); };
    const [IA, IB] = [await load(a), await load(b)], W2 = IA.width, H2 = IA.height, ppg = 3 * sc, d = (x, y) => { const i = (y * W2 + x) * 4; return Math.abs(IA.data[i] - IB.data[i]) + Math.abs(IA.data[i + 1] - IB.data[i + 1]) + Math.abs(IA.data[i + 2] - IB.data[i + 2]); };
    // the frame's feet in art space (768 canvas, 87.4 px drawn at x 916.3): left foot 165-250, right foot 480-520 - columns the shards (320-475, 545-615, each with a 1.3 px outline pass) do not reach
    const col = (ax) => Math.round(((960 - 87.4 / 2 + ax * 87.4 / 768) - (960 - 55)) * ppg), ground = Math.round(60 * ppg);
    const low = (a0, a1) => { let r = -1; for (let y = 0; y < H2; y++) for (let x = col(a0); x <= col(a1); x++) if (d(x, y) > 40) { r = y; break; } return r; };
    const lf = low(165, 250), rf = low(480, 520); return { W2, H2, ppg, ground, lf, rf, leftGap: +((ground - lf) / ppg).toFixed(2), rightGap: +((ground - rf) / ppg).toFixed(2) };
  }, { a: A.toString('base64'), b: B.toString('base64'), sc: g.sc });
  console.log(JSON.stringify({ prop: g.prop, floor: g.floor, bottomWith: g.bottomWith, bottomWithout: g.bottomWithout, m }));
  ok('the mirror is placed on the floor (placement y 448 = the ground under it), so map_decor_test still holds', g.prop.y === 448 && g.floor.length === 1 && g.floor[0] === 448, { prop: g.prop, floor: g.floor });
  ok('it carries a sink of 3 px', g.prop.sink === 3, g.prop.sink);
  ok('the sink moves the drawing by exactly that much and nothing else (bottom ' + g.bottomWithout + ' -> ' + g.bottomWith + ')', g.bottomWith != null && g.bottomWithout != null && Math.abs((g.bottomWith - g.bottomWithout) - g.prop.sink) < 0.05, { with: g.bottomWith, without: g.bottomWithout });
  // the art is angled: the near (left) foot is drawn lower than the far (right) one, so on a flat floor line the high foot is the one that floats; a 3 px sink plants it and the near foot sits a little into the slab's face (which is ~8 px thick)
  ok('RIGHT (far) foot sits in the floor line - 1 to 5 px into it (v0.30.1621 plant; before the sink it hung 3.1 above): gap ' + m.rightGap + ' px', m.rf > 0 && m.rightGap <= -1 && m.rightGap >= -5, m);
  ok('LEFT (near) foot sits in the slab but not through it: 1 to 7.5 px in (the slab is ~8 px thick): gap ' + m.leftGap + ' px', m.lf > 0 && m.leftGap <= -1 && m.leftGap >= -7.5, m);
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
