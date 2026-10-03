// Set pieces survive low FX (v0.30.1586, per user "When i was walking the objects suddenly disappeared"): the frame watchdog turns
// low FX on after 4 frames over 22 ms, and the set-piece pass used to RETURN under it - every Zodiac Sanctum gate, statue and the
// astrolabe vanished mid-walk for 6 s and more. Pins: with low FX on, the Sanctum draws the same gates, statues and astrolabe as
// with it off, minus the light (glows, light shafts, constellations, motes); the Frozen Peak icicles and both towers' floor
// markers stay; the pass-wide flag resets; and walking with low FX held on keeps the gates on screen every 100 ms.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10353); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof _lxSetPieces === 'function' && typeof loadMap === 'function' && typeof LX_PERF === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms)); const o = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.level = 90; player.invulnerable = 1e9;
    // one pass of _lxSetPieces with low FX forced on or off: every drawImage / fillText / fillRect on the game canvas, sorted
    const pass1 = (low) => {
      LX_PERF.lowFx = low; LX_PERF.lowFxUntil = low ? 1e15 : 0; game._lowFxCache = null;
      const gateCv = new Set(Object.values(_LX_SP.gate).map((q) => q.cv)), consCv = new Set(Object.values(_LX_SP.gate).map((q) => q.cons).filter(Boolean));
      const iceCv = new Set(Object.values(_LX_SP.ice).map((q) => q.cv)), glowCv = new Set(Object.values(_LX_GLOW)), beamCv = new Set(Object.values(_LX_BEAM));
      const n = { gate: 0, statue: 0, orn: 0, cons: 0, glow: 0, beam: 0, ice: 0, rect: 0, text: [] };
      const P = CanvasRenderingContext2D.prototype, oI = P.drawImage, oT = P.fillText, oR = P.fillRect;
      P.drawImage = function (im, ...a) { if (this === ctx) { if (gateCv.has(im) || (Object.values(_LX_SP.gate).some((q) => q.cv === im))) n.gate++; else if (consCv.has(im) || Object.values(_LX_SP.gate).some((q) => q.cons === im)) n.cons++; else if (Object.values(_LX_GLOW).includes(im)) n.glow++; else if (Object.values(_LX_BEAM).includes(im)) n.beam++; else if (Object.values(_LX_SP.ice).some((q) => q.cv === im)) n.ice++; else if (im === LX_OBJECTS.zod_hanging_astrolabe) n.orn++; else if (Object.keys(LX_OBJECTS).some((k) => /^zod_(statue|crest)_/.test(k) && LX_OBJECTS[k] === im)) n.statue++; } return oI.apply(this, [im, ...a]); };
      P.fillText = function (s, ...a) { if (this === ctx) n.text.push(String(s)); return oT.apply(this, [s, ...a]); };
      P.fillRect = function (...a) { if (this === ctx) n.rect++; return oR.apply(this, a); };
      try { _lxSetPieces(); } finally { P.drawImage = oI; P.fillText = oT; P.fillRect = oR; }
      n.err = _LX_SP.err ? String(_LX_SP.err.message || _LX_SP.err) : null; n.loAfter = _LX_SP.lo;
      LX_PERF.lowFx = false; LX_PERF.lowFxUntil = 0; game._lowFxCache = null;
      return n;
    };
    // the Sanctum: wait for the statues and the astrolabe, then compare the two passes at two camera spots
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.zodiacHall = true; loadMap('zodiacHall', 200); await sleep(1500); game.paused = true;
    try { _lxArt2WantMap('zodiacHall', true); } catch (e) {}
    { const t0 = performance.now(); while (performance.now() - t0 < 40000) { const ks = Object.keys(LX_OBJECTS).filter((k) => /^zod_(statue|crest)_|^zod_hanging_astrolabe$/.test(k)); if (ks.length >= 13 && ks.every((k) => LX_OBJECTS[k].complete && LX_OBJECTS[k].naturalWidth)) break; await sleep(250); } }
    o.hall = [];
    for (const cx of [0, 900]) { game.camera.x = cx; game.camera.y = 0; pass1(false); o.hall.push({ cx, full: pass1(false), low: pass1(true) }); }
    // the towers: a milestone floor (25) in view
    for (const id of ['frozenPeak', 'interdimensionalAscension']) {
      game.visitedMaps[id] = true; loadMap(id); await sleep(1200); game.paused = true;
      const plats = game.mapData.platforms.filter((q) => q.type !== 'ground'), p25 = plats.find((q) => _lxFloorOf(q) === 25);
      if (!p25) { o[id] = { noFloor25: true }; continue; }
      game.camera.x = Math.max(0, p25.x - 300); game.camera.y = p25.y - 300; pass1(false);
      o[id] = { full: pass1(false), low: pass1(true) };
    }
    return o;
  });
  // the walk the user reported: low FX held on while the real loop runs and the hero walks the Sanctum (real key presses)
  await page.evaluate(async () => {
    loadMap('zodiacHall', 200); await new Promise((s) => setTimeout(s, 1500)); document.querySelectorAll('.toast').forEach((t) => t.remove()); game.paused = false;
    LX_PERF.lowFx = true; LX_PERF.lowFxUntil = 1e15;
    const P = CanvasRenderingContext2D.prototype, oI = P.drawImage, oW = window.drawWorldProps; window._spw = { gates: 0, frames: 0, log: [], oI, oW };
    window.drawWorldProps = function () { window._spw.frames++; return oW.apply(this, arguments); };
    P.drawImage = function (im, ...a) { if (this === ctx && Object.values(_LX_SP.gate).some((q) => q.cv === im)) window._spw.gates++; return oI.apply(this, [im, ...a]); };
    let g0 = 0, f0 = 0; window._spw.timer = setInterval(() => { const w = window._spw; w.log.push({ x: Math.round(player.x), gates: w.gates - g0, frames: w.frames - f0, low: !!(LX_PERF.lowFx && _perfLowFx()) }); g0 = w.gates; f0 = w.frames; }, 100);
  });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2600); await page.keyboard.up('ArrowRight');
  r.walk = (await page.evaluate(() => { const w = window._spw; clearInterval(w.timer); CanvasRenderingContext2D.prototype.drawImage = w.oI; window.drawWorldProps = w.oW; LX_PERF.lowFx = false; LX_PERF.lowFxUntil = 0; return w.log; })).slice(0, 25);
  console.log('build ' + r.ver);
  for (const h of r.hall) {
    const f = h.full, l = h.low, j = (q) => JSON.stringify({ gate: q.gate, statue: q.statue, orn: q.orn, cons: q.cons, glow: q.glow, beam: q.beam, rect: q.rect, err: q.err });
    ok(`Sanctum at camera ${h.cx}: low FX draws the same gates (${l.gate}), statues and astrolabe as full FX`, f.gate > 0 && f.statue > 0 && l.gate === f.gate && l.statue === f.statue && l.orn === f.orn, 'full ' + j(f) + ' low ' + j(l));
    ok(`Sanctum at camera ${h.cx}: low FX skips the light - no glows, light shafts or constellations, fewer fills (motes), and full FX still has them`, f.glow > 0 && f.beam > 0 && l.glow === 0 && l.beam === 0 && l.cons === 0 && l.rect < f.rect, 'full ' + j(f) + ' low ' + j(l));
    ok(`Sanctum at camera ${h.cx}: the flag resets after the pass, no swallowed error`, l.loAfter === false && f.loAfter === false && !l.err && !f.err);
  }
  ok('the astrolabe is drawn under low FX where it hangs (camera 900)', r.hall[1].low.orn === 1, JSON.stringify(r.hall.map((h) => [h.cx, h.full.orn, h.low.orn])));
  const fp = r.frozenPeak, ia = r.interdimensionalAscension;
  ok('Frozen Peak under low FX keeps its icicles and the floor-25 flag', fp && !fp.noFloor25 && fp.low.ice > 0 && fp.low.ice === fp.full.ice && fp.low.text.includes('25'), JSON.stringify(fp && { full: { ice: fp.full.ice, text: fp.full.text }, low: { ice: fp.low.ice, text: fp.low.text } }));
  ok('the Ascension under low FX keeps its floor-25 ring and number, without the glows', ia && !ia.noFloor25 && ia.low.text.includes('25') && ia.low.glow === 0 && ia.full.glow > 0, JSON.stringify(ia && { full: { glow: ia.full.glow, text: ia.full.text }, low: { glow: ia.low.glow, text: ia.low.text } }));
  const moved = r.walk.length ? r.walk[r.walk.length - 1].x - r.walk[0].x : 0;
  ok('walking the Sanctum with low FX held on, the gates are drawn in every 100 ms sample that drew the world (and nearly all did)', r.walk.length >= 20 && r.walk.every((w) => w.low && (w.frames === 0 || w.gates > 0)) && r.walk.filter((w) => w.frames > 0).length >= r.walk.length - 3 && moved > 40, JSON.stringify(r.walk.map((w) => [w.x, w.frames, w.gates])) + ' moved ' + moved);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
