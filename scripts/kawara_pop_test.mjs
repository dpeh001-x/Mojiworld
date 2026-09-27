// The pagoda roof-tile floor is pop too.
//
// Per user: "do the pagoda roof-tile floor in pop too" (after the cobble street, v0.30.1264). The kawara face (Hidden
// Pagoda) drew small 9px scales with 1px outlines and soft highlights under paper grain; the ridge had a soft sheen. It
// now lays bold inked tiles - the face goes down in the floor ink, then arched tiles in flat tones with a lit crescent,
// a shaded foot and a glint tick - under a pop ridge with inked joints, gold studs and a gold lip, with no grain or mottle.
// This bakes a Hidden Pagoda ground through _cutePlatformSprite with the painters watched:
//   1. the material: kawara carries the pop flag;
//   2. the face fills in the floor ink first, then arched tiles bigger than the old scales (radius >= 6.5, was 4.5);
//   3. the ridge has inked joints and gold studs;
//   4. a pop floor stays flat: no mottle, no grain on the kawara (a paving floor keeps both);
// The build before fails 1-4.   node scripts/kawara_pop_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11733), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    const out = {}, pal = Object.assign({}, _MAP_FLOOR_PAL.hiddenPagoda, { exact: true }), W = 380, H = 56;
    out.mat = Object.assign({}, _CUTE_MAT.kawara);
    // watch one bake: the face painter, the cap painter, the mottle, and every fill made in 'overlay' (the grain)
    const watch = (theme) => {
      const rec = { arcs: 0, bigArcs: 0, groutFill: null, capStyle: null, capInk: 0, capGold: 0, mottle: 0, grain: 0 };
      const P = CanvasRenderingContext2D.prototype, oA = P.arc, oF = P.fillRect, oFill = P.fill;
      const oFace = window._cuteBuiltFace4, oCap = window._cuteBuiltCap, oMot = window._cuteMottle;
      let inFace = false, inCap = false, C0 = null;
      P.arc = function (x, y, r) { if (inFace) { rec.arcs++; if (r >= 6.5) rec.bigArcs++; } return oA.apply(this, arguments); };
      P.fill = function () { if (inCap && String(this.fillStyle).toLowerCase() === '#e0b24e') rec.capGold++; return oFill.apply(this, arguments); };
      P.fillRect = function (x, y, w, h) {
        if (this.globalCompositeOperation === 'overlay') rec.grain++;
        if (inFace && !rec.groutFill) rec.groutFill = { style: String(this.fillStyle), w: Math.round(w), ink: C0 && String(C0.OUT).toLowerCase() };
        if (inCap && C0 && String(this.fillStyle).toLowerCase() === String(C0.OUT).toLowerCase()) rec.capInk++;
        return oF.apply(this, arguments);
      };
      window._cuteBuiltFace4 = function (ctx, sx, fy, w, fh, style, rng, C) { C0 = C; inFace = style === 'kawara'; try { return oFace.apply(this, arguments); } finally { inFace = false; } };
      window._cuteBuiltCap = function (ctx, sx, y, w, cap, style, rng, C) { C0 = C; rec.capStyle = style; inCap = true; try { return oCap.apply(this, arguments); } finally { inCap = false; } };
      window._cuteMottle = function () { rec.mottle++; return oMot.apply(this, arguments); };
      let cv = null;
      try { _CUTE_PLAT_CACHE.clear(); cv = _cutePlatformSprite(W, H, pal, true, theme, 0); }
      finally { P.arc = oA; P.fill = oFill; P.fillRect = oF; window._cuteBuiltFace4 = oFace; window._cuteBuiltCap = oCap; window._cuteMottle = oMot; }
      rec.cv = cv; return rec;
    };
    const cob = watch('kawara'), pav = watch('paving');
    // the pixels: the upper 40% of the face under the cap, how much of it is ink
    const cv = cob.cv; let ink = null;
    if (cv) {
      const s = cv.width / (cv._lxLW || cv.width), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const G = _cuteBuiltGeomOf(_cuteGeom(W, H, true), W, H, true, 'kawara'), y0 = _CUTE_PAD_TOP + G.cap + 3, y1 = y0 + (H - G.cap) * 0.4;
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
  ok('the material: kawara carries the pop flag', !!r.mat.pop, r.mat);
  ok('the face goes down in the floor ink, then bold arched tiles (radius >= 6.5, the old scales were 4.5)', c.bigArcs >= 20 && g.ink && g.style.toLowerCase() === g.ink && g.w >= 370, { arcs: c.arcs, bigArcs: c.bigArcs, grout: g });
  ok('the ridge has inked joints and gold studs', c.capStyle === 'kawara' && c.capInk >= 3 && c.capGold >= 3, { cap: c.capStyle, inkJoints: c.capInk, goldStuds: c.capGold });
  ok('a pop floor stays flat: no mottle, no grain on the kawara (a paving floor keeps both)', c.mottle === 0 && c.grain === 0 && p.mottle >= 1 && p.grain >= 1, { kawara: { mottle: c.mottle, grain: c.grain }, paving: { mottle: p.mottle, grain: p.grain } });
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
