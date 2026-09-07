// Everdawn Central props (v0.30.401): the user's Ctrl Prop Editor hardbake is the
// signpost alone at the Bastion gate (x 2409, ground line, scale 1); the pillars
// are gone; the signpost really draws when the gate is on screen.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10125); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof MAP_PROPS === 'object' && typeof drawWorldProps === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, town: (MAP_PROPS.town || []).map((p) => ({ key: p.key, x: p.x, y: p.y, scale: p.scale })) }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('town', 2300); } catch (e) { o.loadErr = String(e && e.message); } await sleep(300); game.paused = true; o.map = game.currentMap;
    const img = (typeof LX_OBJECTS !== 'undefined') ? LX_OBJECTS.signpost_wood : null; o.hasImg = !!img;
    if (img) { const t0 = performance.now(); while (!(img.complete && img.naturalWidth > 0) && performance.now() - t0 < 15000) await sleep(50); o.decoded = img.complete && img.naturalWidth > 0; }
    // the prop path may blit the art into a scaled cache first and put the cache on screen, so every drawImage's DESTINATION rect is recorded
    const capture = () => { const c = []; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; P.drawImage = function (im, ...a) { const d = a.length >= 8 ? { x: a[4], y: a[5], w: a[6], h: a[7] } : { x: a[0], y: a[1], w: a[2], h: a[3] }; d.src = im === img ? 'art' : (im && im.tagName === 'CANVAS' ? 'cache' : 'other'); d.onScreen = this === ctx; c.push(d); return oI.apply(this, [im, ...a]); }; try { drawWorldProps(); } catch (e) { c.push({ err: String(e && e.message) }); } finally { P.drawImage = oI; } return c; };
    game.camera.x = Math.max(0, 2409 - W / 2); o.camGate = game.camera.x; o.atGate = capture();
    game.camera.x = 0; o.atPlaza = capture();
    return o;
  });
  console.log('build ' + r.ver + '  town ' + JSON.stringify(r.town) + '  atGate ' + JSON.stringify(r.atGate));
  ok('Everdawn Central carries exactly one prop: the signpost at x 2409 on the ground line, scale 1', r.town.length === 1 && r.town[0].key === 'signpost_wood' && r.town[0].x === 2409 && r.town[0].y === 480 && r.town[0].scale === 1, JSON.stringify(r.town));
  ok('the pillars are gone', !r.town.some((p) => p.key === 'column_pillar'));
  ok('the signpost art exists and decodes', r.hasImg && r.decoded === true);
  // height = 80 x scale x a per-art fit factor clamped to 0.7..1.4, so 56..112 px at scale 1
  const landed = (calls, camX) => calls.filter((d) => !d.err && d.onScreen && d.h >= 55 && d.h <= 113 && Math.abs((d.x + d.w / 2) - (2409 - camX)) < 2 && Math.abs(d.y + d.h - 480) < 3);
  ok('with the gate on screen the signpost lands once on the game canvas, bottom-centred on its anchor, 56..112 px tall', r.map === 'town' && !r.atGate.some((d) => d.err) && landed(r.atGate, r.camGate).length === 1, JSON.stringify([r.atGate, r.camGate]));
  ok('with the plaza on screen nothing lands (the plaza is bare, the gate is off screen)', !r.atPlaza.some((d) => d.onScreen), JSON.stringify(r.atPlaza));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
