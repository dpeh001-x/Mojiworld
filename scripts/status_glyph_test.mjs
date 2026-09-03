// STATUS GLYPHS: hand-drawn icons replace the emoji in the status row + banner.
// ============================================================================
// Per user: "for the indicators (stun etc.) make small customised icons to
// show the status affliction".
//
// Every affliction the row and the control banner show is a small vector icon
// in one style (dark disc, tinted rim, tinted glyph), drawn on the canvas at
// any size/DPR. Static kinds bake once; the stun's stars spin live. Also
// writes a strip of every glyph at 3x to STATUS_GLYPH_STRIP (default
// scratch) so the set can be looked at.
// Run: node scripts/status_glyph_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9883);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const STRIP = process.env.STATUS_GLYPH_STRIP || path.join(ROOT, '_playtest_status_glyphs.png');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof _drawPlayerStatusIcons === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
// a running world, so the overlay can be photographed on the real character
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Glyphs').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(async () => { loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500)); game.paused = false; });
const OVERLAY = process.env.STATUS_OVERLAY_SHOT || '';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };

const KINDS = ['burn', 'frozen', 'chill', 'poison', 'slow', 'ice', 'shock', 'shield', 'stun', 'stagger', 'bubble', 'silence', 'bastion'];
const r = await ev((KINDS) => {
  const has = typeof _lxStatusGlyph === 'function';
  if (!has) return { has };
  // every kind draws without throwing and with real path work, and no two look alike
  const px = {}; const ops = {};
  for (const k of KINDS) {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24; const g = c.getContext('2d');
    let n = 0; const wrap = (name) => { const f = g[name]; g[name] = function () { n++; return f.apply(this, arguments); }; };
    ['arc', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'fillRect', 'strokeRect'].forEach(wrap);
    try { _lxStatusGlyph(g, k, 12, 12, 10, '#ffcc66', 0); } catch (e) { return { has, err: k + ': ' + e }; }
    ops[k] = n; px[k] = Array.from(g.getImageData(0, 0, 24, 24).data).join(',');
  }
  const dupes = []; const ks = Object.keys(px);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (px[ks[i]] === px[ks[j]]) dupes.push(ks[i] + '=' + ks[j]);
  // the stun's stars move: two frames differ
  const c1 = document.createElement('canvas'); c1.width = c1.height = 24; const g1 = c1.getContext('2d'); _lxStatusGlyph(g1, 'stun', 12, 12, 10, '#ffd166', 0);
  const c2 = document.createElement('canvas'); c2.width = c2.height = 24; const g2 = c2.getContext('2d'); _lxStatusGlyph(g2, 'stun', 12, 12, 10, '#ffd166', 30);
  const spins = Array.from(g1.getImageData(0, 0, 24, 24).data).join(',') !== Array.from(g2.getImageData(0, 0, 24, 24).data).join(',');
  // the live row and banner: no emoji text any more, banner label still drawn, bakes keyed by kind
  player.hp = Math.max(1, player.hp | 0); player.burnTimer = 900; player.stunTimer = 1200; player._cancerBubble = 0; player.frozenTimer = 0; player._skillLockTimer = 700;
  const texts = []; const _ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) { texts.push(String(t)); return _ft.call(this, t, x, y, mw); };
  window._lxStatusIconBakes = new Map();
  try { _drawPlayerStatusIcons(200, 200); } catch (e) { CanvasRenderingContext2D.prototype.fillText = _ft; return { has, err: 'row: ' + e }; }
  CanvasRenderingContext2D.prototype.fillText = _ft;
  player.burnTimer = 0; player.stunTimer = 0; player._skillLockTimer = 0; player._ctrlKind = null;
  const emojiText = texts.filter((t) => /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(t));
  const bakeKeys = [...window._lxStatusIconBakes.keys()];
  // the overlay ON the character: a sphere around the sprite in a Bubble Prison, the glyph big over the chest; nothing when calm
  const arcs = []; const glyphs = []; const _arc = CanvasRenderingContext2D.prototype.arc; const _gl = window._lxStatusGlyph;
  CanvasRenderingContext2D.prototype.arc = function (x, y, r, a0, a1, ccw) { arcs.push(r); return _arc.call(this, x, y, r, a0, a1, ccw); };
  window._lxStatusGlyph = function (g, kind, x, y, r, tint, t) { glyphs.push({ kind, r }); return _gl(g, kind, x, y, r, tint, t); };
  let ovErr = null;
  try {
    player._cancerBubble = 1500; player._cancerBubbleHits = 0; player._ctrlKind = null;
    if (typeof _drawPlayerControlOverlay === 'function') _drawPlayerControlOverlay();
  } catch (e) { ovErr = String(e); }
  const bubbleArcMax = arcs.length ? Math.max(...arcs) : 0; const bubbleGlyph = glyphs.find((x) => x.kind === 'bubble') || null;
  arcs.length = 0; glyphs.length = 0; player._cancerBubble = 0;
  try { if (typeof _drawPlayerControlOverlay === 'function') _drawPlayerControlOverlay(); } catch (e) { ovErr = ovErr || String(e); }
  const calmArcs = arcs.length, calmGlyphs = glyphs.length;
  CanvasRenderingContext2D.prototype.arc = _arc; window._lxStatusGlyph = _gl;
  // the strip for the eye: every glyph at 3x on a dark plate
  const strip = document.createElement('canvas'); strip.id = '_glyph_strip'; strip.width = KINDS.length * 64 + 16; strip.height = 92;
  strip.style.cssText = 'position:fixed; left:8px; top:8px; z-index:99999; background:#1a1d25;';
  const sg = strip.getContext('2d'); sg.fillStyle = '#1a1d25'; sg.fillRect(0, 0, strip.width, strip.height);
  const tints = { burn: '#ff8844', frozen: '#88ddff', chill: '#aaeeff', poison: '#aa66ee', slow: '#88aacc', ice: '#aaddff', shock: '#ffdd44', shield: '#ffe9a0', stun: '#ffd166', stagger: '#ffd166', bubble: '#66ccff', silence: '#ff99cc', bastion: '#ffe08a' };
  KINDS.forEach((k, i) => { _lxStatusGlyph(sg, k, 40 + i * 64, 38, 26, tints[k], 12); sg.fillStyle = '#cfd4dc'; sg.font = '11px sans-serif'; sg.textAlign = 'center'; sg.fillText(k, 40 + i * 64, 82); });
  document.body.appendChild(strip);
  return { has, ops, dupes, spins, texts: texts.slice(0, 8), emojiText, bakeKeys, ovErr, bubbleArcMax, bubbleGlyph, calmArcs, calmGlyphs, ph: player.h || 40 };
}, KINDS);
ok('in a Bubble Prison the overlay draws a sphere around the whole sprite and the bubble glyph at 32px over the chest', !r.err && !r.ovErr && r.bubbleArcMax >= (r.ph || 40) * 0.7 && r.bubbleGlyph && r.bubbleGlyph.r >= 14,
  r.err || r.ovErr || `sphere r ${r.bubbleArcMax} (sprite h ${r.ph}); glyph ${JSON.stringify(r.bubbleGlyph)}`);
ok('the overlay draws nothing when nothing afflicts the player', !r.err && !r.ovErr && r.calmArcs === 0 && r.calmGlyphs === 0, r.err || r.ovErr || `calm arcs ${r.calmArcs} glyphs ${r.calmGlyphs}`);
ok('the glyph library exists', !r.err && r.has, r.err || '');
ok('every affliction kind draws with real path work (' + KINDS.length + ' kinds)', !r.err && r.ops && KINDS.every((k) => r.ops[k] >= 2), r.err || JSON.stringify(r.ops));
ok('no two kinds render identically', !r.err && r.dupes && r.dupes.length === 0, r.err || (r.dupes && r.dupes.join(' ')));
ok("the stun's stars spin (two frames differ)", !r.err && r.spins, r.err || `spins ${r.spins}`);
ok('the status row draws no emoji text any more', !r.err && r.emojiText && r.emojiText.length === 0, r.err || `emoji drawn: ${r.emojiText && r.emojiText.join(' | ')}`);
ok('the banner label still says STUNNED', !r.err && r.texts && r.texts.some((t) => /STUNNED/.test(t)), r.err || JSON.stringify(r.texts));
ok('static icons bake once per kind (burn + silence baked, stun drawn live)', !r.err && r.bakeKeys && r.bakeKeys.some((k) => /^burn\|/.test(k)) && r.bakeKeys.some((k) => /^silence\|/.test(k)) && !r.bakeKeys.some((k) => /^stun\|/.test(k)), r.err || JSON.stringify(r.bakeKeys));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));
try { const el = await page.$('#_glyph_strip'); if (el) { await el.screenshot({ path: STRIP }); console.log('strip -> ' + STRIP); } } catch (e) { console.log('strip failed: ' + e); }
// the overlay on the real character, rendered by the live frame: bubbled for a moment
if (OVERLAY) {
  try {
    await page.evaluate(() => { const s = document.getElementById('_glyph_strip'); if (s) s.remove(); player._cancerBubble = 99999; player._cancerBubbleHits = 1; player._ctrlKind = null; });
    await page.waitForTimeout(450);
    const clip = await page.evaluate(() => {
      const cv = document.querySelector('canvas'); const rc = cv.getBoundingClientRect();
      const kx = rc.width / (typeof W === 'number' ? W : cv.width), ky = rc.height / (typeof H === 'number' ? H : cv.height);
      const sx = player.x - game.camera.x, sy = player.y;
      return { x: Math.max(0, rc.left + (sx - 110) * kx), y: Math.max(0, rc.top + (sy - 70) * ky), width: 260 * kx, height: 190 * ky };
    });
    await page.screenshot({ path: OVERLAY, clip });
    await page.evaluate(() => { player._cancerBubble = 0; });
    console.log('overlay -> ' + OVERLAY);
  } catch (e) { console.log('overlay shot failed: ' + e); }
}

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
