// EMOJI PIN: the canvas emoji atlas (Sprites/ui/emoji_atlas.webp, 1536x1088) is decoded into a canvas copy when it loads,
// and every canvas emoji blits from that copy. Before, the first canvas to draw an emoji mid-fight - the burn icon over
// a mob, an 18x21 bake - paid the sheet's whole decode + GPU upload inside one drawImage (46-49 ms at 4-6x CPU throttle).
//  1. in a map, before anything else in this test has touched the atlas: the first draw of a fresh emoji sprite onto the
//     game canvas, under a 4x CPU throttle, is not a decode (< 15 ms)
//  2. the pin exists once the atlas has loaded: a canvas at the atlas's natural size
//  3. the pin holds the atlas's pixels (sample cells compared against the <img>, pixel for pixel)
//  4. a status icon and a fresh emoji text sprite draw from the pin: no drawImage receives the atlas <img> any more
//   node scripts/emoji_pin_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11761);
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html, so Sprites/ resolves
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let bad = 0; const check = (ok, label, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''}`); if (!ok) bad++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _txtSprite === 'function' && window._lxEmojiAtlasImg && window._lxEmojiAtlasImg.complete && window._lxEmojiAtlasImg.naturalWidth > 0, null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 3000)); game.paused = false; player.invulnerable = 9e9;
  });
  // 1. the first draw of a fresh emoji sprite, throttled - before this test draws the atlas anywhere else
  const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t = await page.evaluate(() => { const s = _txtSprite(String.fromCodePoint(0x1F4AB, 0x2744), '12.5px sans-serif', '#fff'); const t0 = performance.now(); ctx.drawImage(s.c, 40, 10); return +(performance.now() - t0).toFixed(1); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  check(t < 15, '1. the first draw of a fresh emoji sprite onto the game canvas is not a decode (under 15 ms at 4x CPU throttle)', { ms: t });
  // 2 + 3. the pin, and its pixels against the <img>
  const pin = await page.evaluate(() => {
    const IMG = window._lxEmojiAtlasImg, P = window._lxEmojiAtlasPin, A = window.LX_EMOJI_ATLAS;
    if (!P) return { pin: false };
    const out = { pin: P.tagName === 'CANVAS', w: P.width, h: P.height, nw: IMG.naturalWidth, nh: IMG.naturalHeight, diff: 0, cells: 0 };
    try {
      const c = A.cell, g1 = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), g2 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      g1.canvas.width = g2.canvas.width = c; g1.canvas.height = g2.canvas.height = c;
      for (const k of ['1f525', '2744', '1f4ab', '2728']) {
        const i = A.map[k]; if (i == null) continue; const sx = (i % A.cols) * c, sy = Math.floor(i / A.cols) * c;
        g1.clearRect(0, 0, c, c); g2.clearRect(0, 0, c, c); g1.drawImage(P, sx, sy, c, c, 0, 0, c, c); g2.drawImage(IMG, sx, sy, c, c, 0, 0, c, c);
        const a = g1.getImageData(0, 0, c, c).data, b = g2.getImageData(0, 0, c, c).data;
        for (let j = 0; j < a.length; j++) out.diff = Math.max(out.diff, Math.abs(a[j] - b[j]));
        out.cells++;
      }
    } catch (e) { out.err = String(e).slice(0, 120); }
    return out;
  });
  check(pin.pin && pin.w === pin.nw && pin.h === pin.nh, '2. once the atlas has loaded, its pin is a canvas at the atlas\'s natural size', pin);
  check(pin.cells >= 3 && pin.diff <= 1 && !pin.err, '3. the pin holds the atlas\'s pixels (fire, snow, dizzy, sparkle cells match the <img>)', { cells: pin.cells, maxDiff: pin.diff, err: pin.err });
  // 4. the status icon path and a fresh emoji sprite never hand the <img> to drawImage
  const use = await page.evaluate(async () => {
    const IMG = window._lxEmojiAtlasImg, P = CanvasRenderingContext2D.prototype, oD = P.drawImage; let rawImg = 0, pinUse = 0;
    P.drawImage = function (im) { if (im === IMG) rawImg++; if (im === window._lxEmojiAtlasPin) pinUse++; return oD.apply(this, arguments); };
    try {
      const m = game.monsters.find((x) => x && x.currentHp > 0);
      if (m) { m.burnTimer = 4000; m.freezeTimer = 4000; }
      for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
      const s = _txtSprite(String.fromCodePoint(0x1F525) + ' hot', '13.5px sans-serif', '#fff'); ctx.drawImage(s.c, 10, 10);
      if (m) { m.burnTimer = 0; m.freezeTimer = 0; }
    } finally { P.drawImage = oD; }
    return { mob: !!game.monsters.length, rawImg, pinUse };
  });
  check(use.rawImg === 0 && use.pinUse > 0, '4. status icons and emoji text sprites blit from the pin; no drawImage receives the atlas <img>', use);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
