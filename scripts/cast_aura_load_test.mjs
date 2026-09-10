// Every monster cast-flash aura loads, decodes, and READS under the blend it is drawn with.
//
// LX_MOB_CAST maps each mob shoot key to an Image under Sprites/projectiles/cast/. drawMonster
// blits the matching one at the firing monster's centre with globalCompositeOperation 'lighter',
// so a dark sprite decodes fine and shows nothing. This test boots the game, waits for the pack,
// and for every key asserts (1) the image decoded with real dimensions, (2) no request for a cast
// file failed, and (3) drawn additively over the game's own night-sky tone at the in-game size
// (m.w x 1.6 for a 48px mob = ~77px) it lifts the plate by a visible margin.
//
//   node scripts/cast_aura_load_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11461); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [], failedReq = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { if (/projectiles\/cast\//.test(r.url()) && r.status() >= 400) failedReq.push(r.status() + ' ' + r.url().split('/').pop()); });
page.on('requestfailed', (r) => { if (/projectiles\/cast\//.test(r.url())) failedReq.push('failed ' + r.url().split('/').pop()); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof LX_MOB_CAST === 'object' && Object.keys(LX_MOB_CAST).length > 0, null, { timeout: 180000 });
  // the pack decodes in the background; give every entry a fair chance to settle
  await page.waitForFunction(() => Object.values(LX_MOB_CAST).every((im) => im.complete), null, { timeout: 120000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const out = {}; const W = 77, H = 77;       // m.w 48 x 1.6
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d', { willReadFrequently: true });
    const plate = () => { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#0e0a22'; c.fillRect(0, 0, W, H); };
    const mean = () => { const d = c.getImageData(0, 0, W, H).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; return s / (d.length / 4); };
    for (const [k, im] of Object.entries(LX_MOB_CAST)) {
      const e = { src: (im.src || '').split('/').slice(-2).join('/'), complete: !!im.complete, w: im.naturalWidth || 0, h: im.naturalHeight || 0, lift: 0 };
      if (e.w && e.h) { plate(); const base = mean(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85; try { c.drawImage(im, 0, 0, W, H); e.lift = +(mean() - base).toFixed(1); } catch (x) { e.err = String(x.message).slice(0, 60); } }
      out[k] = e;
    }
    return out;
  });
  const keys = Object.keys(r); console.log(`${keys.length} cast keys`);
  for (const k of keys) { const e = r[k]; console.log(`  ${k.padEnd(12)} ${e.w}x${e.h}  lift ${String(e.lift).padStart(5)}  ${e.src}${e.err ? '  ERR ' + e.err : ''}`); }
  ok('every cast key has a decoded image with real dimensions', keys.every((k) => r[k].complete && r[k].w > 0 && r[k].h > 0), keys.filter((k) => !(r[k].w > 0)).join(' '));
  ok('no cast file request failed', failedReq.length === 0, failedReq.join(' | '));
  const dim = keys.filter((k) => r[k].w > 0 && r[k].lift < 6);
  ok('every aura lifts the night plate by >= 6 luminance drawn additively at mob size', dim.length === 0, dim.map((k) => k + ' ' + r[k].lift).join(' '));
  ok('the pack covers the 25 shoot keys the registry declares', keys.length >= 25, String(keys.length));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
