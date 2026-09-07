// Void tear (v0.30.392): the rift art loops (nine ludo.ai frames the loader
// already knew how to play), and three tapered additive arcs orbit inside the
// tear in place of the three straight sticks that used to spin over it.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10047); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawHazards === 'function' && typeof _lxVfxFrame === 'function' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION, hasArcs: typeof _drawVoidTearArcs === 'function' }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true;
    // 1. the index and the files
    o.index = ((window.LX_SPRITE_FRAME_INDEX && LX_SPRITE_FRAME_INDEX.frames['vfx/anim']) || {}).void_tear;
    o.files = []; for (let i = 0; i < 9; i++) { try { const rs = await fetch('Sprites/vfx/anim/void_tear_' + i + '.webp'); o.files.push({ s: rs.status, b: (await rs.arrayBuffer()).byteLength }); } catch (e) { o.files.push({ s: 'err' }); } }
    // 2. the loader primes nine frames and they decode at the still's size
    _lxVfxFrame('voidTear'); const arr = VFX_ANIM_FRAMES.voidTear; o.arrLen = arr ? arr.length : 0;
    const t0 = performance.now(); while (arr && performance.now() - t0 < 20000 && !arr.every((f) => f && f.complete && f.naturalWidth > 0)) await sleep(50);
    o.decoded = arr ? arr.filter((f) => f && f.complete && f.naturalWidth > 0).length : 0;
    o.dims = arr && arr[0] ? [arr[0].naturalWidth, arr[0].naturalHeight] : null; o.stillDims = [LX_VFX.voidTear.naturalWidth, LX_VFX.voidTear.naturalHeight];
    // 3. the loop cycles distinct frames and never returns the still once decoded
    const seen = new Set(); let stillHits = 0; const t1 = performance.now();
    while (performance.now() - t1 < 9 * 70 + 60) { const f = _lxVfxFrame('voidTear'); seen.add(f); if (f === LX_VFX.voidTear) stillHits++; await sleep(10); }
    o.distinct = seen.size; o.stillHits = stillHits;
    // 4. draw one tear and capture what it paints
    game.hazards.length = 0;
    const mk = (x) => ({ type: 'void_tear', x: x - 40, y: 460, w: 80, h: 30, cx: x, life: 3000, maxLife: 3000, atk: 1 });
    const hz = mk(player.x + 120); game.hazards.push(hz); game.camera.x = Math.max(0, hz.cx - W / 2);
    const capture = () => {
      const c = { imgs: [], strokes: [], arcs: [], err: null }; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage, oS = P.stroke, oA = P.arc;
      P.drawImage = function (im, ...a) { c.imgs.push({ loop: !!(arr && arr.includes(im)), still: im === LX_VFX.voidTear, x: a[0], y: a[1], w: a[2], h: a[3], alpha: +this.globalAlpha.toFixed(3) }); return oI.apply(this, [im, ...a]); };
      P.stroke = function (...a) { c.strokes.push({ st: String(this.strokeStyle), lw: +(+this.lineWidth).toFixed(2), comp: this.globalCompositeOperation, cap: this.lineCap }); return oS.apply(this, a); };
      P.arc = function (x, y, rr, ...a) { c.arcs.push({ x, y, r: rr, comp: this.globalCompositeOperation }); return oA.apply(this, [x, y, rr, ...a]); };
      try { drawHazards(); } catch (e) { c.err = String(e && e.message); } finally { P.drawImage = oI; P.stroke = oS; P.arc = oA; } return c;
    };
    const c1 = capture();
    o.draw = { img: c1.imgs.find((i) => i.loop || i.still) || null, nStrokes: c1.strokes.length, lighter: c1.strokes.filter((s) => s.comp === 'lighter').length, round: c1.strokes.filter((s) => s.cap === 'round').length,
      sticks: c1.strokes.filter((s) => /255, ?130, ?255/.test(s.st)).length, beads: c1.arcs.filter((a) => a.comp === 'lighter').length, err: c1.err, widths: c1.strokes.map((s) => s.lw) };
    // 5. the arcs lap at the slower rate: the first bead's ellipse angle, now and 35 steps on
    const beadAngle = (c) => { const b = c.arcs.filter((a) => a.comp === 'lighter')[0]; if (!b) return null; const cx = hz.cx - game.camera.x, cy = hz.y + 12; return Math.atan2((b.y - cy) / (hz.w * 0.11), (b.x - cx) / (hz.w * 0.42)); };
    const a1 = beadAngle(c1); game.time += 35; const c2 = capture(); const a2 = beadAngle(c2); game.time -= 35;
    if (a1 != null && a2 != null) { let da = a2 - a1; while (da < 0) da += Math.PI * 2; while (da >= Math.PI * 2) da -= Math.PI * 2; o.lapRad = +da.toFixed(3); } o.expectRad = +(35 * 0.045).toFixed(3); o.oldRad = +(35 * 0.08).toFixed(3);
    // 6. budget: eight tears (the Spire's standing set), 200 draws
    game.hazards.length = 0; for (let k = 0; k < 8; k++) game.hazards.push(mk(player.x + 60 + k * 30));
    const tb = performance.now(); for (let k = 0; k < 200; k++) drawHazards(); o.msPerDraw = +((performance.now() - tb) / 200).toFixed(3); game.hazards.length = 0;
    // 7. the shipped source: no stick left, the arcs are called with the animated flag
    const src = await (await fetch(location.pathname)).text();
    o.src = { sticks: src.indexOf('ctx.moveTo(sx + Math.cos(a) * h.w/2 * 0.6') >= 0, arcs: src.indexOf('_drawVoidTearArcs(sx, h.y + 12, h.w, fade, _vtAnimated)') >= 0 };
    return o;
  });
  console.log('build ' + r.ver + '  draw ' + JSON.stringify(r.draw));
  ok('the frame index lists nine void_tear frames', r.index === 9, String(r.index));
  ok('the nine frames ship (200, over 40 KB each)', r.files.length === 9 && r.files.every((f) => f.s === 200 && f.b > 40000), JSON.stringify(r.files.map((f) => f.s + ':' + f.b)));
  ok('the loader primes nine frames and all decode at the still\'s 1024x512', r.arrLen === 9 && r.decoded === 9 && r.dims && r.dims[0] === 1024 && r.dims[1] === 512 && r.stillDims[0] === 1024 && r.stillDims[1] === 512, JSON.stringify([r.arrLen, r.decoded, r.dims, r.stillDims]));
  ok('the loop cycles through at least seven distinct frames in one 690 ms pass and never returns the still', r.distinct >= 7 && r.stillHits === 0, JSON.stringify([r.distinct, r.stillHits]));
  ok('a drawn tear blits a loop frame, 2:1 at 1.5x its width (120x60 for w 80)', !!r.draw.img && r.draw.img.loop && !r.draw.err && Math.abs(r.draw.img.w - 120) < 1 && Math.abs(r.draw.img.h - 60) < 1, JSON.stringify(r.draw.img));
  ok('the arcs: twelve additive round-capped strokes and three beads, and no stick stroke', r.draw.lighter === 12 && r.draw.round === 12 && r.draw.beads === 3 && r.draw.sticks === 0, JSON.stringify([r.draw.lighter, r.draw.round, r.draw.beads, r.draw.sticks]));
  ok('the arcs lap at 0.045 rad a step (35 steps -> 1.575 rad), not the old 0.08 (2.8 rad)', r.lapRad != null && Math.abs(r.lapRad - r.expectRad) < 0.05, JSON.stringify([r.lapRad, r.expectRad, r.oldRad]));
  ok('eight tears draw in under 2 ms a frame', r.msPerDraw < 2, r.msPerDraw + ' ms');
  ok('the shipped source: the sticks are gone and the arcs are called with the animated flag', r.hasArcs && r.src.sticks === false && r.src.arcs === true, JSON.stringify(r.src));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
