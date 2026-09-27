// The character-creation preview stage, pop punk (final polish, cs-stage). Per user: "Remake the background behind the
// character, it can be more pop and punk style, do not use polkadots". Reads the computed layers of the stage box and its
// pseudos: the painted violet alcove is gone, a soft plum sunburst, a lit stage floor with boards and inked stickers are in,
// a shadow rim closes the bottom, the old ring / prism / twinkles are off, the figure wears a sticker edge - and no layer
// anywhere in the box is a tiled dot (a radial gradient on a small repeating tile). Second pass (cs-stage2, per user: "less
// intense background, add a shadow rim at the bottom, remove the yellow black strips, the floor and background can be
// better"): no caution tape, and the rays are two close plums rather than berry against plum.
//   node scripts/cs_stage_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9941);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openClassSelect === 'function' && typeof player !== 'undefined', null, { timeout: 180000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; openClassSelect(); });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const w = document.querySelector('#class-select-modal .cs-look-preview-wrap');
  const cs = getComputedStyle(w), be = getComputedStyle(w, '::before'), af = getComputedStyle(w, '::after');
  // a "dot" layer: a radial gradient drawn on a tile smaller than the box, so it repeats
  const dotty = (st) => { const imgs = st.backgroundImage.split(/,(?![^(]*\))(?=\s*(?:url|linear|radial|repeating|conic|none))/); const sizes = st.backgroundSize.split(','); const reps = st.backgroundRepeat.split(',');
    return imgs.some((im, i) => /radial-gradient/.test(im) && /repeat(?!-)/.test(reps[i % reps.length] || '') && !/no-repeat/.test(reps[i % reps.length] || '') && /\d+px/.test(sizes[i % sizes.length] || '')); };
  const vis = (q) => { const e = w.querySelector(q); return !!e && getComputedStyle(e).display !== 'none'; };
  return { bg: cs.backgroundImage, before: be.backgroundImage, beforeTf: be.transform, after: af.backgroundImage,
    dots: [dotty(cs), dotty(be), dotty(af)], ring: vis('.cs-stage-ring'), twinkle: vis('.cs-twinkle'), canvasFilter: getComputedStyle(document.getElementById('cs-look-canvas')).filter };
});
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${JSON.stringify(x).slice(0, 220)}`); };
ok('the painted violet alcove is gone', !/cs_preview_bg/.test(r.bg), r.bg.slice(0, 120));
ok('a soft plum sunburst sits behind the figure (two close plums, not berry against plum)', /repeating-conic-gradient/.test(r.bg) && /107, 52, 116/.test(r.bg) && /81, 42, 110/.test(r.bg) && !/178, 58, 110/.test(r.bg), null);
ok('a shadow rim closes the bottom of the box', /linear-gradient\(0deg, rgba\(10, 6, 16, 0\.78\) 0%/.test(r.bg), null);
ok('a spotlight pool where the figure stands', /radial-gradient\(38% 9% at 50% 86%, rgba\(255, 210, 236, 0\.62\)/.test(r.bg), null);
ok('a lit stage floor: a pale horizon line, then plum falling off to ink', /rgba\(255, 214, 236, 0\.62\) 78%/.test(r.bg) && /rgb\(74, 38, 96\) 78\.9%/.test(r.bg), null);
ok('inked stickers: a bolt, a star and sparks', (r.bg.match(/data:image\/svg\+xml/g) || []).length >= 4, (r.bg.match(/data:image\/svg\+xml/g) || []).length);
ok('no caution tape - the pseudo carries the stage boards instead', !/repeating-linear-gradient/.test(r.before) && /repeating-conic-gradient/.test(r.before) && r.beforeTf === 'none', { before: r.before.slice(0, 80), tf: r.beforeTf });
ok('no polka dots in the box or its pseudos', r.dots.every((d) => !d), r.dots);
ok('the old ring and twinkles are off', !r.ring && !r.twinkle, { ring: r.ring, twinkle: r.twinkle });
ok('the figure wears a white sticker edge', /drop-shadow\(rgb\(255, 255, 255\)/.test(r.canvasFilter), r.canvasFilter);
ok('no page errors', errs.length === 0, errs.slice(0, 2));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
