// Gravitos's Singularity / Collapse Rain fields shed their second additive pass only while the governor says frames run long (fix-gov-shed).
//   node scripts/gov_shed_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// The fields (_lxGovBack) add ~2.2-2.4 screens of fill for the 5 s a player has to dodge in. While LX_PERF.lowFx is off every layer must be drawn exactly as before
// (same pixels as window._lxNoLowSheds, same fill); with lowFx on, the rain skips its rift glow (~0.3 screen) and the Singularity its second wave ring (~0.5 screen) and still paints the rest.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10620';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let R = null; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxGovBack === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    applyClass('warrior'); player.level = 120; player._god = true;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('gravitosArena'); game.paused = false; await sleep(6000);
    { const t0 = Date.now(); while (typeof _lxSpriteDone !== 'undefined' && _lxSpriteDone < _lxSpriteTotal && Date.now() - t0 < 30000) await sleep(500); }
    const cv = document.getElementById('game'), c2 = cv.getContext('2d'), CW = cv.width, CH = cv.height;
    const ww = (game.mapData && game.mapData.width) || 2200, zone = (x) => ({ x, y: 450, w: 100, h: 70 });
    const mk = (kind) => ({ type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: H, cx: 600, cy: 300, life: 200, maxLife: 330, atk: 99999, safeZones: kind === 'sing' ? [zone(60), zone(500), zone(1000)] : [zone(900)], [kind === 'sing' ? '_singArt' : '_rainArt']: true });
    const proto = CanvasRenderingContext2D.prototype, oDI = proto.drawImage, oFR = proto.fillRect; let fill = 0, ops = 0, on = false;
    const areaOf = (c, x, y, w, h) => { const m = c.getTransform(); const xs = [], ys = []; for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) { xs.push(m.a * px + m.c * py + m.e); ys.push(m.b * px + m.d * py + m.f); }
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), bb = (x1 - x0) * (y1 - y0); if (!(bb > 0)) return 0; const cw = Math.max(0, Math.min(x1, CW) - Math.max(x0, 0)), ch = Math.max(0, Math.min(y1, CH) - Math.max(y0, 0)); return Math.abs(m.a * m.d - m.b * m.c) * Math.abs(w * h) * (cw * ch) / bb; };
    proto.drawImage = function (img, ...a) { if (on && this === c2) { ops++; const k = a.length >= 8 ? [a[4], a[5], a[6], a[7]] : a.length >= 4 ? a.slice(0, 4) : [a[0], a[1], img.width, img.height]; fill += areaOf(this, k[0], k[1], k[2], k[3]); } return oDI.call(this, img, ...a); };
    proto.fillRect = function (x, y, w, h) { if (on && this === c2) { ops++; fill += areaOf(this, x, y, w, h); } return oFR.call(this, x, y, w, h); };
    _lxDrawFrame(); const BASE = c2.getTransform(); const T0 = game.time, STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];   // the wave rings are a 60-step cycle: average the whole cycle, not one phase
    const measure = (kind, lowFx, noShed) => { const had = LX_PERF.lowFx; LX_PERF.lowFx = lowFx; window._lxNoLowSheds = noShed; let fl = 0, o = 0, sum = 0;
      try { for (const st of STEPS) { game.time = T0 + st; const h = mk(kind); fill = 0; ops = 0; c2.setTransform(BASE); c2.clearRect(0, 0, CW, CH); on = true; try { c2.save(); _lxGovBack(h, 1 - h.life / h.maxLife, 0, 0); c2.restore(); } finally { on = false; } fl += fill; o += ops;
          const px = c2.getImageData(0, 0, CW, CH).data; for (let i = 0; i < px.length; i += 97) sum = (sum * 31 + px[i]) >>> 0; } } finally { game.time = T0; LX_PERF.lowFx = had; window._lxNoLowSheds = false; }
      return { screens: +(fl / STEPS.length / (CW * CH)).toFixed(3), ops: o / STEPS.length, sum }; };
    for (let i = 0; i < 4; i++) { measure('sing', false, true); measure('rain', false, true); }   // every bake once
    const out = {};
    for (const kind of ['sing', 'rain']) {
      out[kind] = { old: measure(kind, false, true), healthy: measure(kind, false, false), struggling: measure(kind, true, false), struggleAB: measure(kind, true, true) };
      // the same call twice with the same state is deterministic (so the pixel comparison below means something)
      out[kind].again = measure(kind, false, true);
    }
    proto.drawImage = oDI; proto.fillRect = oFR; return out;
  });
} catch (e) { errs.push('harness: ' + String(e.message).slice(0, 220)); }
check(!!R, 'the page ran the checks', errs);
if (R) {
  for (const [kind, name, want] of [['sing', 'Singularity', 0.2], ['rain', 'Collapse Rain', 0.12]]) {
    const r = R[kind];
    check(r.old.sum === r.again.sum && r.old.screens === r.again.screens, name + ': the probe is deterministic (same call twice = same pixels and fill)', r);
    check(r.healthy.sum === r.old.sum && r.healthy.screens === r.old.screens && r.healthy.ops === r.old.ops, name + ': while frames keep up every layer is drawn exactly as before (same pixels, fill, ops)', r);
    check(r.struggling.screens <= r.old.screens - want, name + ': with the governor flag on the field costs at least ' + want + ' screen less', { old: r.old.screens, struggling: r.struggling.screens });
    check(r.struggling.ops < r.old.ops && r.struggling.ops >= r.old.ops - 1.01, name + ': it sheds only that one pass (draw ops ' + r.old.ops + ' -> ' + r.struggling.ops + ')', r);
    check(r.struggling.screens > 0.7 * r.old.screens, name + ': the field is still painted (no blank frame)', r);
    check(r.struggleAB.sum === r.old.sum && r.struggleAB.screens === r.old.screens, name + ': window._lxNoLowSheds restores the old field under the governor flag', r);
  }
}
if (R) console.log('INFO  screens of fill, averaged over the 60-step ring cycle: Singularity ' + R.sing.old.screens + ' -> ' + R.sing.struggling.screens + ', Collapse Rain ' + R.rain.old.screens + ' -> ' + R.rain.struggling.screens + ' (governor flag on)');
check(errs.length === 0, 'no page errors', errs);
await browser.close(); try { srv.kill(); } catch (e) {}
console.log(`${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
