// v0.30.x — The Sage's meteor animates: anim/meteor_0..8 exist, hold still, and the hazard drawer uses them.
//   node scripts/meteor_anim_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11319);

// ---- on disk: nine frames, one canvas size, alpha content that holds still and actually changes
const disk = { n: 0, sizes: new Set(), drift: 0, identical: 0 };
const boxes = [];
for (let i = 0; i < 9; i++) {
  const f = path.join(ROOT, 'Sprites', 'projectiles', 'anim', `meteor_${i}.webp`);
  if (!fs.existsSync(f)) break;
  disk.n++;
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  disk.sizes.add(info.width + 'x' + info.height);
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, sum = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const a = data[(y * info.width + x) * 4 + 3];
    if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; sum += a; }
  }
  boxes.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1, sum, W: info.width });
}
for (let i = 1; i < boxes.length; i++) {
  disk.drift = Math.max(disk.drift, Math.hypot(boxes[i].cx - boxes[0].cx, boxes[i].cy - boxes[0].cy) / boxes[0].W);
  if (boxes[i].sum === boxes[0].sum && boxes[i].w === boxes[0].w && boxes[i].h === boxes[0].h) disk.identical++;
}

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Mtr');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  game.paused = false;
  out.keyed = (typeof _PROJ_ANIM_KEYS !== 'undefined') && _PROJ_ANIM_KEYS.has('meteor');
  out.indexed = (typeof _lxFrameCount === 'function') ? _lxFrameCount('projectiles/anim', 'meteor', 9) : null;
  // a real telegraph on screen, then let the frames decode
  try { performMeteor(); } catch (e) { out.perfErr = String(e.message); }
  out.hazard = (game.hazards || []).some((h) => h.type === 'meteor_warn');
  let frame = null;
  for (let i = 0; i < 40 && !frame; i++) { await wait(100); try { frame = (typeof _projAnimFrame === 'function') ? _projAnimFrame('meteor') : null; } catch (e) { out.frameErr = String(e.message); } }
  out.frameReady = !!(frame && (frame.naturalWidth > 0 || frame.width > 0));
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const wired = html.includes("_projAnimFrame('meteor') : null;") && html.includes('const _msDraw = _meteorAnim || _lxProjScaled(_meteorSprite, Math.round(sz));');
console.log(JSON.stringify({ disk: { ...disk, sizes: [...disk.sizes] }, ...r, wired }));
const checks = [
  ['nine meteor frames are on disk', disk.n === 9, `n ${disk.n}`],
  ['all frames share one canvas', disk.sizes.size === 1, [...disk.sizes].join(',')],
  ['the rock holds still across the loop (drift <= 6%)', disk.n === 9 && disk.drift <= 0.06, `drift ${(disk.drift * 100).toFixed(1)}%`],
  ['the frames actually differ (not one image nine times)', disk.n === 9 && disk.identical === 0, `identical ${disk.identical}`],
  ["'meteor' is an animation key", r.keyed === true],
  ['the frame index knows all nine', r.indexed === 9, `indexed ${r.indexed}`],
  ['a meteor telegraph exists and its frame decodes', r.hazard === true && r.frameReady === true, `hazard ${r.hazard} ready ${r.frameReady}`],
  ['the hazard drawer uses the loop frame', wired],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
