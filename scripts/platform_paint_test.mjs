// The floors and platforms are painted as terrain, and the paint is deterministic.
//
// v0.30.594 replaced the translucent backdrop-tinted slab with a biome painter: a lit surface cap
// with the biome's edge, body texture, decor standing on the surface, a 2px keyline, at full
// strength. This bakes a floating platform and a ground slab for six themes through the real
// _cutePlatformSprite and reads the pixels back: the cap is lighter than the body, the keyline is
// dark, the slab is opaque, decor exists above the surface where the theme has any, the bake
// carries its top pad, a second call returns the cached bake, and a full-width ground still bakes.
//   node scripts/platform_paint_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11581); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _cutePlatformSprite === 'function' && typeof _PLATFORM_THEME_TINT === 'object', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const out = {}; const tint = { top: '#c9a3ff', body: '#2a1e3c' };
    const stats = (cv, w, h, padTop) => {
      const c = cv.getContext('2d'); const d = c.getImageData(0, 0, cv.width, cv.height).data; const W = cv.width;
      const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
      const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
      let capL = 0, capN = 0, bodyL = 0, bodyN = 0, opaque = 0, inside = 0, decor = 0;
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < W; x++) { const p = px(x, y);
        if (y < padTop) { if (p[3] > 60) decor++; continue; }
        const yy = y - padTop, xx = x - 2; if (xx < 4 || xx >= w - 4 || yy < 0 || yy >= h) continue; inside++; if (p[3] > 230) opaque++;
        if (yy >= 3 && yy < 5) { capL += lum(p); capN++; } else if (yy >= h * 0.55 && yy < h - 3) { bodyL += lum(p); bodyN++; } }
      // the 2px keyline is stroked ON the slab's edge, so half of it lands in the bake's pad: read
      // the last row inside and the first row outside and take the darker (a light body such as
      // ice or candy blends the inner half to ~90 luminance)
      const e1 = px(2 + Math.floor(w / 2), padTop + h - 1), e2 = px(2 + Math.floor(w / 2), padTop + h);
      const edge = (e2[3] > 100 && lum(e2) < lum(e1)) ? e2 : e1;
      return { capLum: capN ? capL / capN : 0, bodyLum: bodyN ? bodyL / bodyN : 0, opaque: inside ? opaque / inside : 0, decor, edgeLum: lum(edge), edgeA: edge[3], size: cv.width + 'x' + cv.height };
    };
    for (const th of ['grass', 'ice', 'lava', 'candy', 'stone', 'cosmic']) {
      const p = _cutePlatformSprite(120, 12, tint, false, th), g = _cutePlatformSprite(400, 60, tint, true, th);
      out[th] = { plat: p ? stats(p, 120, 12, _CUTE_PAD_TOP) : null, ground: g ? stats(g, 400, 60, _CUTE_PAD_TOP) : null, cached: _cutePlatformSprite(120, 12, tint, false, th) === p };
    }
    out.wideGround = !!_cutePlatformSprite(2400, 60, tint, true, 'grass');
    out.padTop = _CUTE_PAD_TOP;
    return out;
  });
  for (const th of ['grass', 'ice', 'lava', 'candy', 'stone', 'cosmic']) {
    const t = r[th]; console.log(th.padEnd(7), 'plat', JSON.stringify(t.plat), 'ground', JSON.stringify(t.ground));
    ok(`${th}: both bakes exist and carry the top pad`, t.plat && t.ground && t.plat.size === '124x26' && t.ground.size === '404x74', { plat: t.plat && t.plat.size, ground: t.ground && t.ground.size });
    ok(`${th}: the surface cap is lighter than the body (platform and ground)`, t.plat.capLum > t.plat.bodyLum + 12 && t.ground.capLum > t.ground.bodyLum + 12, { plat: [t.plat.capLum | 0, t.plat.bodyLum | 0], ground: [t.ground.capLum | 0, t.ground.bodyLum | 0] });
    ok(`${th}: the slab is opaque (>= 90% of its interior)`, t.plat.opaque >= 0.9 && t.ground.opaque >= 0.9, { plat: +t.plat.opaque.toFixed(2), ground: +t.ground.opaque.toFixed(2) });
    ok(`${th}: the keyline is dark at the bottom edge`, t.plat.edgeA > 200 && t.plat.edgeLum < 60, { lum: t.plat.edgeLum | 0, a: t.plat.edgeA });
    ok(`${th}: decor stands on the ground's surface`, t.ground.decor > 20, t.ground.decor);
    ok(`${th}: a second call returns the cached bake`, t.cached === true);
  }
  ok('a full-width 2400px ground still bakes', r.wideGround === true);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
