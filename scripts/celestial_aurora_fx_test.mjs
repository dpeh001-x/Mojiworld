#!/usr/bin/env node
// v0.30.1537 - CELESTIAL AURORA, REDRAWN (per user: "both should have a holy theme, mainly whitish and gold like priesthood"; the field:
// "the light beams gradiently ascent from the ground in a holy field manner", "let sparkles fly").
//   SETS    the frame index lists the cast burst's 16 frames and the field's 24; every frame decodes at its canvas size (burst
//           768 x 768, field 1100 x 320 - the field's own 550 x 160 shape at 2x) and the stills match
//   SCALE   the burst left the size table: its frames sit at the still's own scale, and its last frame IS the still
//   LOOP    the field cycles through its frames on the vfx clock
//   CAST    a cast draws burst frames and field frames; the field rises out of the ground (its drawn height grows from the
//           floor line over its first ~0.6 s), stands at full height, and sinks back in its last frames
//   TOAST   the cast toast quotes the Prism Charge bonus as +1% a charge (v0.30.1527 made it +1%; the toast still said +5%)
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/celestial_aurora_fx_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11797);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('mage'); player.job = 'priest'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._tutorialSeen = true; player.dawnAuraOff = true;
    loadMap('forest', 420); await sleep(1500); game.paused = false;
    const ix = (window.LX_SPRITE_FRAME_INDEX && window.LX_SPRITE_FRAME_INDEX.frames) || {};
    out.index = { burst: (ix['fx/anim'] || {}).celestial_aurora, field: (ix['vfx/anim'] || {}).aurora_field };
    const burst = _fxAnimFrames('celestial_aurora'); _lxVfxFrame('auroraField'); const field = VFX_ANIM_FRAMES.auroraField;
    const ready = (a) => a && a.length && a.every((f) => f && f.complete && f.naturalWidth > 0);
    for (let i = 0; i < 120 && !(ready(burst) && ready(field) && _lxFxReady(LX_FX.celestial_aurora) && _lxVfxReady(LX_VFX.auroraField)); i++) await sleep(250);
    // sizes from the files themselves (the live sets swap in pinned / baked canvases)
    const load = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
    const bImgs = await Promise.all(burst.map((_, i) => load('Sprites/fx/anim/celestial_aurora_' + i + '.webp')));
    const fImgs = await Promise.all(field.map((_, i) => load('Sprites/vfx/anim/aurora_field_' + i + '.webp')));
    const bStill = await load('Sprites/fx/celestial_aurora.webp'), fStill = await load('Sprites/vfx/aurora_field.webp');
    const dim = (im) => (im ? im.naturalWidth + 'x' + im.naturalHeight : 'missing'), dims = (a) => [...new Set(a.map(dim))];
    out.sets = { burstN: burst.length, burstDims: dims(bImgs), fieldN: field.length, fieldDims: dims(fImgs), burstStill: dim(bStill), fieldStill: dim(fStill),
      mul: _LX_FX_SIZE_MUL.celestial_aurora === undefined ? 'none' : _LX_FX_SIZE_MUL.celestial_aurora };
    // the last burst frame against the still: both drawn to 96 x 96, mean |difference| per channel
    { const px = (im) => { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 96, 96); return g.getImageData(0, 0, 96, 96).data; };
      const a = px(bImgs[15]), b = px(bStill); let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); out.lastVsStill = +(s / a.length).toFixed(2); }
    // the field loop cycles on the vfx clock
    { const seen = new Set(); for (let i = 0; i < 30; i++) { const k = field.indexOf(_lxVfxFrame('auroraField')); if (k >= 0) seen.add(k); await sleep(60); } out.loopSeen = seen.size; }
    // the cast: log every field / burst draw with the field's age and drawn height
    const isField = (im) => { const s = (im && ((im._lxSrc && im._lxSrc.src) || im.src)) || ''; return /aurora_field/.test(s) || field.includes(im); };
    const isBurst = (im) => { const s = (im && ((im._lxSrc && im._lxSrc.src) || im.src)) || ''; return /celestial_aurora/.test(s) || burst.includes(im); };
    const log = [], cv = document.getElementById('game'), oD = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) {
      try { if (this.canvas === cv) { const h = game.hazards.find((z) => z && z.type === 'aurora_field');
        if (isField(im) || (h && a.length === 8 && Math.abs(a[6] - h.w) < 1)) log.push({ k: 'field', age: h ? (h.maxLife - h.life) : -1, life: h ? h.life : -1, dh: a.length === 8 ? a[7] : a[3], full: h ? h.h * 1.6 : 0 });
        else if (isBurst(im)) log.push({ k: 'burst' }); } } catch (e) {}
      return oD.call(this, im, ...a); };
    const toasts = []; const oT = window.showToast; window.showToast = function (t) { toasts.push(String(t)); return oT.apply(this, arguments); };
    game.monsters.length = 0; player.mp = player.maxMp = 9999; player._prismCharges = 3; SKILL_FNS.celestialAurora();
    for (let i = 0; i < 40; i++) { game.paused = false; await sleep(50); }
    const h = game.hazards.find((z) => z && z.type === 'aurora_field'); if (h) h.life = 24;   // jump to the field's last frames
    for (let i = 0; i < 12; i++) { game.paused = false; await sleep(50); }
    CanvasRenderingContext2D.prototype.drawImage = oD; window.showToast = oT;
    const F = log.filter((e) => e.k === 'field' && e.age >= 0);
    out.cast = { burstDraws: log.filter((e) => e.k === 'burst').length, fieldDraws: F.length,
      early: F.filter((e) => e.age > 0 && e.age < 18).map((e) => +(e.dh / e.full).toFixed(2)).slice(0, 6),
      mid: F.filter((e) => e.age > 40 && e.life > 40).map((e) => +(e.dh / e.full).toFixed(2)).slice(0, 4),
      late: F.filter((e) => e.life > 0 && e.life < 24).map((e) => +(e.dh / e.full).toFixed(2)).slice(0, 6) };
    out.toast = toasts.find((t) => /CELESTIAL AURORA/.test(t)) || null;
    return out;
  });
  ok('SETS: the frame index lists 16 burst frames and 24 field frames', R.index.burst === 16 && R.index.field === 24, JSON.stringify(R.index));
  const S = R.sets;
  ok('SETS: every frame decodes - burst 768x768 (16), field 1100x320 (24) - and the stills match', S.burstN === 16 && S.burstDims.join() === '768x768' && S.fieldN === 24 && S.fieldDims.join() === '1100x320' && S.burstStill === '768x768' && S.fieldStill === '1100x320', JSON.stringify(S));
  ok('SCALE: the burst draws at the still\'s own scale (no size-table entry)', S.mul === 'none', S.mul);
  ok('SCALE: the burst\'s last frame is the still', R.lastVsStill < 1.5, R.lastVsStill);
  ok('LOOP: the field cycles through its frames (distinct frames in 30 reads 60 ms apart)', R.loopSeen >= 12, R.loopSeen);
  const C = R.cast;
  ok('CAST: a cast draws burst frames and field frames', C.burstDraws > 0 && C.fieldDraws > 0, JSON.stringify({ burst: C.burstDraws, field: C.fieldDraws }));
  ok('CAST: the field rises out of the ground (drawn short of full height in its first ~0.3 s)', C.early.length > 0 && Math.min(...C.early) < 0.9, JSON.stringify(C.early));
  ok('CAST: the field stands at full height once risen', C.mid.length > 0 && C.mid.every((v) => v > 0.99), JSON.stringify(C.mid));
  ok('CAST: the field sinks back in its last frames', C.late.length > 0 && Math.min(...C.late) < 0.9, JSON.stringify(C.late));
  ok('TOAST: three Prism Charges read +3% heal', /\+3% heal/.test(R.toast || ''), R.toast);
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
