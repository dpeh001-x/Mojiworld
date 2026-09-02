// SPEECH BUBBLES: baked once per (text, style), blitted every frame.
// ============================================================================
// Per user: "reduce lag of the game, especially when battling large hordes".
// A steady-state, warm, 4x-throttled line profile of the draw path put ONE
// line sixteen times hotter than any other: `ctx.font = ...` at the top of
// _drawBubble. Every mob, NPC, player and co-op chat bubble re-set the main
// context's font, measured its text, built a rounded rect and a tail, filled
// and stroked both, and drew the text - every frame it was visible, ~166us a
// bubble at 1x, ~665us on the throttled machine, for text that comes from a
// fixed pool of chat lines. Name tags and damage numbers already bake once
// and blit; bubbles now do the same, keyed by text and style, with fade
// applied as alpha at blit time so it never re-bakes.
// Run: node scripts/bubble_bake_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9879);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined,
  headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`,
  { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof _drawBubble === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6500);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Bubble').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 140) }; } };

// ---- the bake exists, is keyed, is reused, and fade never re-bakes ---------
const cache = await ev(() => {
  if (typeof _lxBubbleBake !== 'function') return { err: 'no _lxBubbleBake' };
  const a = _lxBubbleBake('Grr!', {});
  const b = _lxBubbleBake('Grr!', {});
  const c = _lxBubbleBake('Grr!', { color: '#f00' });
  const d = _lxBubbleBake('Grr?', {});
  // fade is an alpha at blit time: the bake must be the same object at any fade
  let canv = 0; const oCE = document.createElement.bind(document);
  document.createElement = function (t) { if (t === 'canvas') canv++; return oCE.apply(this, arguments); };
  _drawBubble(200, 200, 'Grr!', { fade: 1 });
  _drawBubble(200, 200, 'Grr!', { fade: 0.5 });
  _drawBubble(200, 200, 'Grr!', { fade: 0.1 });
  document.createElement = oCE;
  return { same: a === b, styled: a !== c, otherText: a !== d, w: a && a.width, h: a && a.height, mintsDuringFades: canv };
});
ok('a bubble is baked once and reused for the same text + style', !cache.err && cache.same, cache.err || `${cache.w}x${cache.h}`);
ok('a different colour or text is a different bake', !cache.err && cache.styled && cache.otherText);
ok('fading a visible bubble is alpha at blit time — three fades, zero new canvases', !cache.err && cache.mintsDuringFades === 0, cache.err || `${cache.mintsDuringFades} canvases minted`);

// ---- the bounded cache: many distinct lines never grow it past its cap -----
const cap = await ev(() => {
  for (let i = 0; i < 400; i++) _lxBubbleBake('line ' + i, {});
  const n = (typeof _LX_BUBBLE_BAKES !== 'undefined' && _LX_BUBBLE_BAKES && _LX_BUBBLE_BAKES.size) || -1;
  return { n };
});
ok('the bake cache is bounded (400 distinct lines, size stays at its cap)', cap.n > 0 && cap.n <= 160, `size ${cap.n}`);

// ---- what lands on screen matches the direct draw ----------------------------
// The pre-change renderer is replicated here verbatim into an offscreen canvas
// and compared against the baked blit at DPR 1. Text anti-aliasing can differ
// by a few levels between a bake and a direct draw; the bubble shape, tail,
// fill and stroke must land on the same pixels.
// The game's `ctx` is a lexical binding, so the bake cannot be captured by
// swapping window.ctx. Instead the BAKE CANVAS itself is compared against the
// pre-change renderer drawn onto a canvas of the same device size, scaled by
// the same DPR, with the bubble placed where the bake places it (its exposed
// layout: margin M, bubble at (M, M), tail below). Same pixel grid both ways.
const pix = await ev(() => {
  const text = 'Hello there';
  const cv = _lxBubbleBake(text, {});
  if (!cv) return { err: 'no bake' };
  const d = cv._lxDpr, M = cv._lxM, bw = cv._lxBw, bh = cv._lxBh;
  const cx = M + bw / 2, topY = M + bh;
  const direct = document.createElement('canvas'); direct.width = cv.width; direct.height = cv.height;
  const g = direct.getContext('2d');
  g.scale(d, d);
  g.save(); g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const bx = cx - bw / 2, by = topY - bh;
  g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = 'rgba(60,40,80,0.8)'; g.lineWidth = 1.2;
  g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, 5); else g.rect(bx, by, bw, bh); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(cx - 3, by + bh); g.lineTo(cx, by + bh + 4); g.lineTo(cx + 3, by + bh); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#1a0820'; g.fillText(text, cx, by + bh / 2 + 1); g.restore();
  const A = g.getImageData(0, 0, cv.width, cv.height).data, B = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let painted = 0, agree = 0, big = 0, maxD = 0;
  for (let i = 0; i < A.length; i += 4) {
    const pa = A[i + 3] > 8, pb = B[i + 3] > 8;
    if (pa || pb) painted++;
    if (pa === pb) agree++;
    const dd = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    if (pa && pb && dd > 40) big++;
    if (dd > maxD) maxD = dd;
  }
  return { painted, coverageAgree: +(agree / (cv.width * cv.height)).toFixed(4), bigDiffFrac: +(big / Math.max(1, painted)).toFixed(4), maxD, dpr: d, size: cv.width + 'x' + cv.height };
});
ok('the baked bubble covers the same pixels as the direct draw (shape, tail, text footprint)',
  !pix.err && pix.painted > 300 && pix.coverageAgree >= 0.985, pix.err || `${pix.painted} painted px, coverage agreement ${(pix.coverageAgree * 100).toFixed(2)}%`);
ok('and where both paint, colours agree except for text anti-aliasing edges',
  !pix.err && pix.bigDiffFrac <= 0.08, pix.err || `${(pix.bigDiffFrac * 100).toFixed(1)}% of painted pixels differ by >40 (bake DPR ${pix.dpr})`);

// ---- the point: bubbles cost a blit, not a font set + text render ----------
const cost = await ev(async () => {
  loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500));
  game.paused = true;
  let fontSets = 0, fillTexts = 0, drawImages = 0;
  const proto = CanvasRenderingContext2D.prototype;
  const fd = Object.getOwnPropertyDescriptor(proto, 'font');
  Object.defineProperty(proto, 'font', { configurable: true, get: fd.get, set(v) { if (this === ctx) fontSets++; return fd.set.call(this, v); } });
  const oFT = proto.fillText, oDI = proto.drawImage;
  proto.fillText = function () { if (this === ctx) fillTexts++; return oFT.apply(this, arguments); };
  proto.drawImage = function () { if (this === ctx) drawImages++; return oDI.apply(this, arguments); };
  _drawBubble(100, 100, 'warm', {});           // first sight bakes
  fontSets = 0; fillTexts = 0; drawImages = 0;
  for (let i = 0; i < 50; i++) _drawBubble(100, 100, 'warm', { fade: 1 - i / 100 });
  Object.defineProperty(proto, 'font', fd); proto.fillText = oFT; proto.drawImage = oDI;
  game.paused = false;
  return { fontSets, fillTexts, drawImages };
});
ok('fifty frames of a visible bubble set the main context font ZERO times and draw ZERO text — one blit each',
  !cost.err && cost.fontSets === 0 && cost.fillTexts === 0 && cost.drawImages === 50,
  cost.err || `font sets ${cost.fontSets}, fillText ${cost.fillTexts}, drawImage ${cost.drawImages} (pre-change: 50 font sets, 50 fillText, 0 drawImage)`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
