// Redraw Sprites/ui/cs/ico_male.webp as a real Mars symbol: the arrow LEAVES the ring at 45 degrees.
// The old art trapped the arrow inside the circle, which is not the glyph. Drawn rather than prompted,
// because the whole complaint is that the geometry was wrong.
// Style is matched to ico_female.webp: one thick dark outline around the whole glyph, a bright-to-deep
// body gradient, a soft gloss on the upper-left of the ring, a small sparkle, transparent background.
//   node scripts/gen_cs_gender_ico.mjs [out.webp]      (default: Sprites/ui/cs/ico_male.webp)
//
// Deterministic: same geometry in, byte-identical glyph out. If the icon ever needs to change, change
// the numbers here rather than hand-editing the webp, and re-run - then bump sw.js CACHE, because this
// writes over an existing filename and the service worker serves those stale-while-revalidate.
import { createRequire } from 'node:module'; import path from 'node:path'; import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'Sprites/ui/cs/ico_male.webp');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const dataUrl = await page.evaluate(() => {
  const S = 128, R = 4;                       // render at 4x and let the encoder downsample: clean edges
  const c = document.createElement('canvas'); c.width = S * R; c.height = S * R;
  const x = c.getContext('2d'); x.scale(R, R);
  // --- geometry: ring bottom-left, shaft + head leaving it at 45 degrees up-right
  const cx = 45, cy = 85, r = 27;             // ring centre + centreline radius
  const BODY = 15, OUTLINE = 5;               // body stroke, dark outline either side  (matched to the female icon, which is chunkier than the old male art)
  const a = -Math.PI / 4;                     // 45 degrees, up and to the right
  const sx = cx + Math.cos(a) * (r - 1), sy = cy + Math.sin(a) * (r - 1);   // leave from ON the ring
  const hx = 94, hy = 37;                     // where the shaft ends and the head begins
  const tx = 112, ty = 19;                    // the tip
  const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);     // across the shaft
  const HW = 15;                              // half-width of the arrowhead
  const head = () => { x.beginPath(); x.moveTo(tx, ty);
    x.lineTo(hx + nx * HW, hy + ny * HW); x.lineTo(hx - nx * HW, hy - ny * HW); x.closePath(); };
  const glyph = (lw) => {
    x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();      // ring
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(hx, hy); x.stroke();    // shaft
    head(); x.stroke(); x.fill();                                     // head
  };
  // --- 1. the dark outline: the same glyph, fatter
  x.strokeStyle = '#0a1636'; x.fillStyle = '#0a1636';
  glyph(BODY + OUTLINE * 2);
  // --- 2. the body, in a top-left-to-bottom-right gradient like the female icon's
  const g = x.createLinearGradient(14, 8, 116, 120);
  g.addColorStop(0.00, '#8fd0ff');
  g.addColorStop(0.28, '#4a9bf0');
  g.addColorStop(0.62, '#1f56cf');
  g.addColorStop(1.00, '#12308f');
  x.strokeStyle = g; x.fillStyle = g;
  glyph(BODY);
  // --- 3. gloss: a bright arc riding the ring's upper-left, and one along the shaft
  x.save(); x.globalAlpha = 0.5; x.strokeStyle = '#ffffff'; x.lineCap = 'round'; x.lineWidth = 3.4;
  x.beginPath(); x.arc(cx, cy, r + 3.1, Math.PI * 0.86, Math.PI * 1.42); x.stroke();
  x.globalAlpha = 0.34; x.lineWidth = 2.6;
  x.beginPath();
  x.moveTo(sx + nx * 4.1, sy + ny * 4.1);
  x.lineTo(hx - 3 + nx * 4.1, hy + 3 + ny * 4.1);
  x.stroke();
  x.restore();
  // --- 4. one small sparkle, the same idea as the female icon's
  x.save(); x.globalAlpha = 0.95; x.fillStyle = '#ffffff';
  x.beginPath(); x.ellipse(31, 69, 5.6, 3.4, -Math.PI / 4, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.7;
  x.beginPath(); x.ellipse(25, 80, 2.7, 1.8, -Math.PI / 4, 0, Math.PI * 2); x.fill();
  x.restore();
  // --- downsample 4x -> 128 and encode
  const o = document.createElement('canvas'); o.width = S; o.height = S;
  const ox = o.getContext('2d'); ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
  ox.drawImage(c, 0, 0, S, S);
  return o.toDataURL('image/webp', 0.96);
});
await browser.close();
if (!/^data:image\/webp;base64,/.test(dataUrl)) throw new Error('canvas did not encode webp: ' + dataUrl.slice(0, 40));
const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
writeFileSync(OUT, buf);
console.log('wrote ' + OUT + '  ' + buf.length + ' bytes');
