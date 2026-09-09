// Damage-number outline consistency (v0.30.460). Per user, on two screenshots of overlapping hits:
// "the same bug where the damage outlines seems to vary".
//
// "The same bug" is exact: v0.29.408 fixed this for the live draw path (canvas stroke width lives in
// USER space, so a 5 px outline inside ctx.scale(scale, scale) renders as 5 x scale), and the
// v0.30.340 bitmap bake reintroduced it for SETTLED numbers by blitting a bitmap with a 5 px outline
// baked in under that same transform.
//
// Measured, not inferred: both draw paths are instrumented on the real canvas and the RENDERED
// outline width in device pixels is computed for every number drawn over many frames.
//   live  : lineWidth * transformScale
//   baked : 5 * (blitWidth / bakedCssWidth) * transformScale
// One formula per path, both reducing to device pixels, so the two are directly comparable.
//   node scripts/damage_number_outline_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT override
// Negative control v0.30.459: baked numbers run 5.69-6.71 device px against the live path's flat
// 6.43 — a 1.0 px spread between numbers visible at the same moment.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10341); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawDamageNumbers === 'function' && typeof _dnBake === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(700);
    const c = ctx; if (!c) return { err: 'no ctx' };
    const dpr = Math.max(1, Math.min(3, (typeof _LX_DPR === 'number' && _LX_DPR > 0) ? _LX_DPR : (window.devicePixelRatio || 1)));
    const live = [], baked = [];
    const oST = c.strokeText.bind(c), oDI = c.drawImage.bind(c);
    // the black readability stroke only — the coloured halo and the gold foil are decoration and are
    // meant to scale with the glyph
    c.strokeText = function (t, x, y) {
      try { const m = c.getTransform(); if (String(c.strokeStyle) === '#000000') live.push(c.lineWidth * Math.abs(m.a)); } catch (e) {}
      return oST(t, x, y);
    };
    c.drawImage = function (img) {
      try {
        const m = c.getTransform();
        if (arguments.length === 5 && img && img.tagName === 'CANVAS') {
          const bakedCssW = img.width / dpr;               // the bake is at device resolution
          baked.push(5 * (arguments[3] / bakedCssW) * Math.abs(m.a));
        }
      } catch (e) {}
      return oDI.apply(c, arguments);
    };
    // A spread of ages and phases so pop-in, settle, bob and fade are all on screen together —
    // exactly the situation in the report, where several hits overlap at once.
    const camX = (game.camera && game.camera.x) || 0, camY = (game.camera && game.camera.y) || 0;
    game.damageNumbers.length = 0;
    for (let i = 0; i < 14; i++) {
      game.damageNumbers.push({ x: camX + 140 + (i % 5) * 150, y: camY + 180 + Math.floor(i / 5) * 80, vy: 0,
        text: String(90000 + i * 137), maxLife: 60, life: 40 - (i % 12), crit: i % 3 === 0, big: i % 4 === 0,
        color: i % 3 === 0 ? '#ffd84a' : '#ffffff', size: 14 });
    }
    for (let f = 0; f < 26; f++) { try { drawDamageNumbers(); } catch (e) { return { err: String(e.message).slice(0, 100) }; } await sleep(16); }
    c.strokeText = oST; c.drawImage = oDI;
    const st = (a) => a.length ? { n: a.length, min: +Math.min(...a).toFixed(3), max: +Math.max(...a).toFixed(3), spread: +(Math.max(...a) - Math.min(...a)).toFixed(3) } : { n: 0 };
    const all = live.concat(baked);
    return { dpr: +dpr.toFixed(4), live: st(live), baked: st(baked), all: st(all), expect: +(5 * dpr).toFixed(3) };
  });
  if (r.err) throw new Error(r.err);
  console.log(`dpr ${r.dpr}  target ${r.expect} device px  ·  live ${r.live.min}-${r.live.max}  baked ${r.baked.min}-${r.baked.max}`);
  ok('both draw paths actually ran — settled numbers blit, unsettled ones stroke live', r.live.n > 0 && r.baked.n > 0,
    `live ${r.live.n}, baked ${r.baked.n}`);
  ok('the live path holds the outline at a true constant (the v0.29.408 guarantee)', r.live.spread <= 0.01, `spread ${r.live.spread}px`);
  ok('the BAKED path holds it too — the bob no longer rides the outline', r.baked.spread <= 0.15,
    `${r.baked.min} to ${r.baked.max} device px, spread ${r.baked.spread}px (was 1.015 on v0.30.459)`);
  ok('every number on screen agrees within a fifth of a pixel, whichever path drew it', r.all.spread <= 0.2,
    `overall ${r.all.min} to ${r.all.max}, spread ${r.all.spread}px`);
  ok('and they all sit on the intended 5 CSS px anchor', Math.abs(r.all.min - r.expect) <= 0.2 && Math.abs(r.all.max - r.expect) <= 0.2,
    `target ${r.expect}, observed ${r.all.min}-${r.all.max}`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
