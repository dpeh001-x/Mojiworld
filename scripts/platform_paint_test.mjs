// The floors and platforms are painted as terrain, deterministic, and they sit where you stand.
//
// v0.30.597 replaced the translucent slab with a biome painter; v0.30.606 took the colour from the
// map; terrain v3 gave floating platforms mass below their one-way collision box; terrain v4 rolls
// the top (crests on the collision line, dips below it), wraps the cap over a platform's ends, adds
// a sunlit layer, boulders and paint grain, and joins adjacent ground pieces without a seam.
// This bakes platforms and grounds through the real _cutePlatformSprite and reads the pixels back:
// the bake is the size the art needs, the surface is at the collision line (solid within 2px at
// every sampled column, on the line itself at the crests), the cap is lighter than the face, the
// box is opaque, the keyline is dark, islands hang below and grounds do not, decor stands on the
// surface, variants differ, a joined ground side has no keyline, bakes are cached, colour is the map's.
// v0.30.635 - bakes are made at device resolution (cv._lxLW/_lxLH carry the logical box); every
// check reads the bake back at that logical size, the way the game draws it.
//   node scripts/platform_paint_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11581); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const THEMES = ['grass', 'ice', 'lava', 'candy', 'stone', 'cosmic'];
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _cutePlatformSprite === 'function' && typeof _cuteGeom === 'function' && typeof _PLATFORM_THEME_TINT === 'object', null, { timeout: 180000 });
  const r = await page.evaluate((THEMES) => {
    const out = {}; const tint = { top: '#c9a3ff', body: '#2a1e3c' }, P = _CUTE_PAD_TOP;
    const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // a device-resolution bake, read back at its logical box (a pre-v0.30.635 bake is returned as it is)
    const logical = (cv) => {
      if (!cv || !(cv._lxLW > 0) || (cv.width === cv._lxLW && cv.height === cv._lxLH)) return cv;
      const c = document.createElement('canvas'); c.width = cv._lxLW; c.height = cv._lxLH;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(cv, 0, 0, c.width, c.height); return c;
    };
    const stats = (cv0, w, h, ground) => {
      const cv = logical(cv0);
      const G = _cuteGeom(w, h, ground), W = cv.width, Hc = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, Hc).data, at = (x, yy) => (yy * W + x) * 4;
      let capL = 0, capN = 0, bodyL = 0, bodyN = 0, opaque = 0, inside = 0, decor = 0, under = 0;
      for (let yy = 0; yy < Hc; yy++) for (let x = 0; x < W; x++) {
        const i = at(x, yy), A = d[i + 3];
        if (yy < P) { if (A > 60) decor++; continue; }
        const ry = yy - P, rx = x - 2;
        if (rx >= w * 0.2 && rx < w * 0.8 && ry > h + 3 && A > 100) under++;
        if (rx < 4 || rx >= w - 4) continue;
        if (ry >= 3 && ry < 5 && A > 200) { capL += lum(d, i); capN++; }
        if (ry >= G.cap + 2 && ry < G.faceH - 1 && A > 200) { bodyL += lum(d, i); bodyN++; }
        if (ry < h) { inside++; if (A > 230) opaque++; }
      }
      // the surface: at five columns the slab is solid 2px below the collision line, solid ON the
      // line at the crests (v4 rolls the top, dips <= 1.5px), and 3px above it is (mostly) air
      let solid = 0, solid1 = 0, air = 0;
      for (const f of [0.25, 0.4, 0.5, 0.6, 0.75]) { const x = Math.round(2 + w * f); if (d[at(x, P + 2) + 3] > 200) solid++; if (d[at(x, P + 1) + 3] > 200) solid1++; if (d[at(x, P - 3) + 3] < 40) air++; }
      // the keyline down the face's left edge, below the cap's hanging edge
      const ky = P + Math.round(G.cap + 6); let kmin = 255; for (let x = 1; x <= 8; x++) { const i = at(x, Math.min(Hc - 1, ky)); if (d[i + 3] > 150) kmin = Math.min(kmin, lum(d, i)); }
      const edgeLum = (() => { const i = at(2, Math.min(Hc - 1, ky)); return d[i + 3] > 150 ? lum(d, i) : -1; })();
      return { size: W + 'x' + Hc, dev: cv0.width + 'x' + cv0.height, wantH: P + Math.max(Math.ceil(h), G.depth) + 3, capLum: capN ? capL / capN : 0, bodyLum: bodyN ? bodyL / bodyN : 0, opaque: inside ? opaque / inside : 0, decor, under, solid, solid1, air, keyLum: kmin, edgeLum };
    };
    for (const th of THEMES) {
      const p = _cutePlatformSprite(120, 12, tint, false, th, 0), g = _cutePlatformSprite(400, 60, tint, true, th, 0);
      out[th] = { plat: p ? stats(p, 120, 12, false) : null, ground: g ? stats(g, 400, 60, true) : null, cached: _cutePlatformSprite(120, 12, tint, false, th, 0) === p };
    }
    const va = logical(_cutePlatformSprite(200, 12, tint, false, 'grass', 0)), vb = logical(_cutePlatformSprite(200, 12, tint, false, 'grass', 1));
    const da = va.getContext('2d').getImageData(0, 0, va.width, va.height).data, db = vb.getContext('2d').getImageData(0, 0, vb.width, vb.height).data;
    let diff = 0; for (let i = 0; i < Math.min(da.length, db.length); i += 4) if (Math.abs(da[i + 3] - db[i + 3]) > 60) diff++;
    out.variantDiff = diff;
    out.wideGround = !!_cutePlatformSprite(2400, 60, tint, true, 'grass', 0);
    // v4: a ground piece joined on its left (variant bit 1) draws no keyline down that side
    const gj = stats(_cutePlatformSprite(400, 60, tint, true, 'grass', 1), 400, 60, true);
    out.joinEdge = { plain: out.grass.ground.edgeLum, joined: gj.edgeLum };
    const capRGB = (cv0) => { const cv = logical(cv0); const d = cv.getContext('2d').getImageData(10, P + 3, cv.width - 20, 2).data; let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return n ? [r / n | 0, g / n | 0, b / n | 0] : null; };
    out.redGrass = capRGB(_cutePlatformSprite(200, 40, { top: '#874244', body: '#301221' }, true, 'grass', 0));
    out.blueLava = capRGB(_cutePlatformSprite(200, 40, { top: '#4477b2', body: '#1a2345' }, true, 'lava', 0));
    out.darkMap = capRGB(_cutePlatformSprite(200, 40, { top: '#161c24', body: '#0a0c10' }, true, 'stone', 0));
    out.bake = (typeof _lxBakeDpr === 'function') ? _lxBakeDpr() : 1;
    return out;
  }, THEMES);
  console.log('bake scale', r.bake);
  for (const th of THEMES) {
    const t = r[th]; console.log(th.padEnd(7), 'plat', JSON.stringify(t.plat), '\n        ground', JSON.stringify(t.ground));
    ok(`${th}: both bakes exist, as deep as the art (platform ${t.plat && t.plat.size}, ground ${t.ground && t.ground.size})`, t.plat && t.ground && t.plat.size === '124x' + t.plat.wantH && t.ground.size === '404x' + t.ground.wantH, { want: [t.plat && t.plat.wantH, t.ground && t.ground.wantH], device: [t.plat && t.plat.dev, t.ground && t.ground.dev] });
    ok(`${th}: the surface is at the collision line (solid within 2px everywhere, on the line at the crests, air above)`, t.plat.solid === 5 && t.plat.solid1 >= 2 && t.plat.air >= 3 && t.ground.solid === 5 && t.ground.solid1 >= 2 && t.ground.air >= 3, { plat: [t.plat.solid, t.plat.solid1, t.plat.air], ground: [t.ground.solid, t.ground.solid1, t.ground.air] });
    ok(`${th}: the cap is lighter than the face (platform and ground)`, t.plat.capLum > t.plat.bodyLum + 12 && t.ground.capLum > t.ground.bodyLum + 12, { plat: [t.plat.capLum | 0, t.plat.bodyLum | 0], ground: [t.ground.capLum | 0, t.ground.bodyLum | 0] });
    ok(`${th}: the collision box is opaque (>= 90%)`, t.plat.opaque >= 0.9 && t.ground.opaque >= 0.9, { plat: +t.plat.opaque.toFixed(2), ground: +t.ground.opaque.toFixed(2) });
    ok(`${th}: the keyline is dark down the face's edge`, t.plat.keyLum < 70 && t.ground.keyLum < 70, { plat: t.plat.keyLum | 0, ground: t.ground.keyLum | 0 });
    ok(`${th}: a floating platform hangs below its box; the ground does not`, t.plat.under > 30 && t.ground.under === 0, { plat: t.plat.under, ground: t.ground.under });
    ok(`${th}: decor stands on the ground's surface`, t.ground.decor > 20, t.ground.decor);
    ok(`${th}: a second call returns the cached bake`, t.cached === true);
  }
  ok('two variants of the same platform differ (no repeated stamp)', r.variantDiff > 60, r.variantDiff);
  ok('a full-width 2400px ground still bakes', r.wideGround === true);
  ok('a ground piece joined on its left has no keyline down that side (v4)', r.joinEdge.plain >= 0 && r.joinEdge.plain < 75 && r.joinEdge.joined > r.joinEdge.plain + 15, r.joinEdge);
  ok("a grass-themed slab on a red map takes the map's red, not grass green", r.redGrass && r.redGrass[0] > r.redGrass[1] + 30, r.redGrass);
  ok("a lava-themed slab on a blue map takes the map's blue, not lava orange", r.blueLava && r.blueLava[2] > r.blueLava[0] + 30, r.blueLava);
  ok('a near-black map still gets a readable cap (luminance >= 110)', r.darkMap && (0.299 * r.darkMap[0] + 0.587 * r.darkMap[1] + 0.114 * r.darkMap[2]) >= 110, r.darkMap);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
