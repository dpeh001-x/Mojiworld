// The cobble street is pop setts, not bubbles.
//
// Per user (of the town floor): "regenerate this circular bubbly design of the floor and those floors with this kind of
// design, it does not look good, give it a more pop feel". The cobble face (town, tower B5) drew every stone as three
// soft ellipses - a shadow, a body, a highlight - which read as a sheet of bubbles. It now lays flat, cel-shaded setts
// over an ink grout, under a kerb of flat kerb stones with inked joints, with no grain or mottle smudging the flat
// colour. This bakes the real platforms through _cutePlatformSprite and watches the painters draw them:
//   1. the material: cobble wears the kerb cap and the pop flag;
//   2. the face draws no ellipse - it fills the grout in the floor's ink, then lays rounded slabs over it;
//   3. the cap is the kerb, with ink joints;
//   4. a pop floor stays flat: no mottle and no grain overlay on the cobble street, while a paving floor keeps both;
//   5. in the pixels: the upper face of a cobble ground is at least 12% ink (the grout), where the bubbles had almost none.
// The build before fails 1-5.   node scripts/cobble_pop_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11723), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _cutePlatformSprite === 'function' && typeof _CUTE_MAT === 'object' && typeof _MAP_FLOOR_PAL === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const out = {}, pal = Object.assign({}, _MAP_FLOOR_PAL.town, { exact: true }), W = 380, H = 56;
    out.mat = Object.assign({}, _CUTE_MAT.cobble);
    // watch one bake: the face painter, the cap painter, the mottle, and every fill made in 'overlay' (the grain)
    const watch = (theme) => {
      const rec = { ellipses: 0, slabs: 0, groutFill: null, capStyle: null, capInk: 0, mottle: 0, grain: 0 };
      const P = CanvasRenderingContext2D.prototype, oE = P.ellipse, oR = P.roundRect, oF = P.fillRect;
      const oFace = window._cuteBuiltFace2, oCap = window._cuteBuiltCap, oMot = window._cuteMottle;
      let inFace = false, inCap = false, C0 = null;
      P.ellipse = function () { if (inFace) rec.ellipses++; return oE.apply(this, arguments); };
      if (oR) P.roundRect = function () { if (inFace) rec.slabs++; return oR.apply(this, arguments); };
      P.fillRect = function (x, y, w, h) {
        if (this.globalCompositeOperation === 'overlay') rec.grain++;
        if (inFace && !rec.groutFill) rec.groutFill = { style: String(this.fillStyle), w: Math.round(w), ink: C0 && String(C0.OUT).toLowerCase() };
        if (inCap && C0 && String(this.fillStyle).toLowerCase() === String(C0.OUT).toLowerCase()) rec.capInk++;
        return oF.apply(this, arguments);
      };
      window._cuteBuiltFace2 = function (ctx, sx, fy, w, fh, style, rng, C) { C0 = C; inFace = style === 'cobble'; try { return oFace.apply(this, arguments); } finally { inFace = false; } };
      window._cuteBuiltCap = function (ctx, sx, y, w, cap, style, rng, C) { C0 = C; rec.capStyle = style; inCap = true; try { return oCap.apply(this, arguments); } finally { inCap = false; } };
      window._cuteMottle = function () { rec.mottle++; return oMot.apply(this, arguments); };
      let cv = null;
      try { _CUTE_PLAT_CACHE.clear(); cv = _cutePlatformSprite(W, H, pal, true, theme, 0); }
      finally { P.ellipse = oE; if (oR) P.roundRect = oR; P.fillRect = oF; window._cuteBuiltFace2 = oFace; window._cuteBuiltCap = oCap; window._cuteMottle = oMot; }
      rec.cv = cv; return rec;
    };
    const cob = watch('cobble'), pav = watch('paving');
    // the pixels: the upper 40% of the face under the cap, how much of it is ink
    const cv = cob.cv; let ink = null;
    if (cv) {
      const s = cv.width / (cv._lxLW || cv.width), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const G = _cuteBuiltGeomOf(_cuteGeom(W, H, true), W, H, true, 'cobble'), y0 = _CUTE_PAD_TOP + G.cap + 3, y1 = y0 + (H - G.cap) * 0.4;
      const OUT = _mixHex(pal.body, '#05030a', 0.62), n = parseInt(OUT.slice(1), 16), lo = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      let tot = 0, dark = 0;
      for (let y = Math.round(y0 * s); y < Math.round(y1 * s); y++) for (let x = Math.round(12 * s); x < Math.round((W - 10) * s); x++) {
        const i = (y * cv.width + x) * 4; tot++; if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] <= lo + 14) dark++;
      }
      ink = { frac: +(dark / Math.max(1, tot)).toFixed(3), px: tot };
    }
    for (const k of ['cv']) { delete cob[k]; delete pav[k]; }
    Object.assign(out, { cob, pav, ink });
    return out;
  });
  const c = r.cob, p = r.pav, g = c.groutFill || {};
  ok('the material: cobble wears the kerb cap and the pop flag', r.mat.cap === 'kerb' && !!r.mat.pop, r.mat);
  ok('the face draws no ellipse (no bubbles): the grout goes down in the floor ink, then rounded slabs over it', c.ellipses === 0 && c.slabs >= 20 && g.ink && g.style.toLowerCase() === g.ink && g.w >= 370, { ellipses: c.ellipses, slabs: c.slabs, grout: g });
  ok('the cap is the kerb, with inked joints', c.capStyle === 'kerb' && c.capInk >= 3, { cap: c.capStyle, inkJoints: c.capInk });
  ok('a pop floor stays flat: no mottle, no grain on the cobble street (a paving floor keeps both)', c.mottle === 0 && c.grain === 0 && p.mottle >= 1 && p.grain >= 1, { cobble: { mottle: c.mottle, grain: c.grain }, paving: { mottle: p.mottle, grain: p.grain } });
  ok('in the pixels, the upper face is at least 12% ink grout', !!r.ink && r.ink.frac >= 0.12, r.ink);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
