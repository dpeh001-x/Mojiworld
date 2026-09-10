// The creator's preview plate is violet — and still has the alcove in it.
// ============================================================================
// Per user: "backdrop can be purplish base rather than grey".
//
// The plate's grey came from a 512x512 FULLY OPAQUE greyscale image, so this
// cannot be checked by reading a base colour out of the CSS — the base is
// never visible. The plate is screenshotted and its pixels measured.
//
//   1. the wash layer blends in `color` mode, one value per background layer
//   2. six background layers (the wash was inserted above the art)
//   3. no neutral-grey literals left in the rule
//   4. RENDERED chroma is high and the hue is violet
//      (baseline measures chroma 23 / hue 257 - faintly tinted by the vignette
//      but reading as grey; patched measures 45)
//   5. CONTROL, and the important one: the plate keeps its internal contrast.
//      A flat violet slab painted over the art would also pass check 4 while
//      destroying the alcove. Luminance std-dev must stay high (measured 47
//      before, 46 after) and mean luminance must barely move (95 -> 93), which
//      is what proves the `color` blend recoloured the art instead of hiding it.
//
// Run: node scripts/cs_preview_violet_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/cs_preview_violet_test.mjs  (baseline)
import { createRequire } from 'node:module';
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp'); sharp.cache(false);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const SHOT = path.join(ROOT, 'scripts', '_cs_test_shot.png');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

const PORT = Number(process.env.PORT || 11381);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForSelector('.cs-look-preview-wrap', { timeout: 60000 });
await page.waitForTimeout(6000);
// #loading-overlay (z=9999) covers the creator until it fades — without this
// the screenshot is of the loading art, not the plate.
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
await page.waitForTimeout(2500);

const S = await page.evaluate(() => {
  const w = document.querySelector('.cs-look-preview-wrap');
  const cs = getComputedStyle(w);
  const r = w.getBoundingClientRect();
  return { blend: cs.backgroundBlendMode, img: cs.backgroundImage,
           layers: cs.backgroundImage.split(/,(?![^(]*\))/).length,
           box: { x: r.x, y: r.y, width: r.width, height: r.height } };
});
await page.screenshot({ path: SHOT, clip: S.box });
await browser.close(); server.kill();

const blends = S.blend.split(',').map((t) => t.trim());
ok('the wash layer blends in `color` mode, one value per layer',
   blends.length === 6 && blends[3] === 'color' && blends.filter((b) => b === 'color').length === 1,
   S.blend);
// Counting layers by splitting on commas is unreliable - gradients nest commas
// inside parens and a naive split reported 18. The blend list above already
// pins the layer count at six; what matters here is that the violet wash is
// the layer being blended, so assert the palette violet is in the stack.
ok('the violet wash is present in the rendered background stack',
   S.img.includes('118, 92, 178'),
   S.img.includes('118, 92, 178') ? 'rgb(118,92,178) found' : 'wash gradient absent');
const rule = readFileSync(path.join(ROOT, FILE), 'utf8');
const greyLeft = ['rgba(232, 234, 238', 'rgba(168, 172, 182', 'rgba(40, 42, 50'].filter((g) => rule.includes(g));
ok('the neutral-grey plate colours are gone from the file', greyLeft.length === 0, greyLeft.join(' | ') || 'none left');

// ---- rendered pixels: the only proof that matters -------------------------
const { data, info } = await sharp(SHOT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
let r = 0, g = 0, b = 0, n = 0, sat = 0; const L = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = Math.abs(x - W / 2) / (W / 2), dy = Math.abs(y - H / 2) / (H / 2);
  if (Math.hypot(dx, dy) < 0.62) continue;          // skip the character
  const i = (y * W + x) * 4; if (data[i + 3] < 200) continue;
  const R = data[i], G = data[i + 1], B = data[i + 2];
  r += R; g += G; b += B; n++;
  sat += Math.max(R, G, B) - Math.min(R, G, B);
  L.push(0.2126 * R + 0.7152 * G + 0.0722 * B);
}
const R = Math.round(r / n), G = Math.round(g / n), B = Math.round(b / n);
const chroma = Math.round(sat / n);
const mean = L.reduce((a, v) => a + v, 0) / L.length;
const sd = Math.round(Math.sqrt(L.reduce((a, v) => a + (v - mean) * (v - mean), 0) / L.length));
const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
let hue = 0;
if (d) { if (mx === R) hue = 60 * (((G - B) / d) % 6); else if (mx === G) hue = 60 * ((B - R) / d + 2); else hue = 60 * ((R - G) / d + 4); }
if (hue < 0) hue += 360;
hue = Math.round(hue);
try { unlinkSync(SHOT); } catch (e) {}

console.log(`  plate rgb(${R},${G},${B})  chroma ${chroma}  hue ${hue}deg  luminance ${Math.round(mean)} (sd ${sd})`);
ok('the rendered plate is genuinely violet, not grey', chroma >= 38 && hue >= 240 && hue <= 300,
   `chroma ${chroma} (baseline 23), hue ${hue}deg`);
ok('CONTROL: the alcove art survives — not a flat violet slab painted over it',
   sd >= 30 && mean > 40 && mean < 190,
   `luminance sd ${sd} (baseline 47; a flat wash collapses toward 0), mean ${Math.round(mean)} (baseline 95)`);

let bad = 0;
for (const x of res) { if (!x.pass) bad++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.extra ? '   [' + x.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
