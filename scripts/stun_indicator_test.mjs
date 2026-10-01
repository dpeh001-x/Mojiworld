// PLAYER STUN: real, finite, and VISIBLE.
// ============================================================================
// Per user: "for bossing especially cancer boss, give a visual indication when
// player is stunned to ensure the player are aware about it".
//
// Found on the way: player.stunTimer was never counted down and never locked
// movement — a Krook stomp's "3s stun" set 3000 and left it there for the rest
// of the map, silently blocking the stun gates. Now it ticks, it locks like the
// freeze does (never during a QTE, which owns the field), and every control
// state — bubbled / frozen / stunned / staggered / silenced, plus Bastion's
// armed window — shows a banner with the time left above the player, an icon
// in the status row, a screen-edge vignette, and a one-shot toast at onset.
// Run: node scripts/stun_indicator_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9875);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof updatePlayer === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'StunTest').catch(() => {});
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };

const r = await ev(async () => {
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = true;                       // drive updatePlayer by hand so the loop can't interleave
  player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; player.hitStun = 0;
  player.frozenTimer = 0; player._cancerBubble = 0; player._skillLockTimer = 0; player._bastionArmedUntil = 0;
  const step = (n) => { for (let i = 0; i < n; i++) { game.time++; try { updatePlayer(16); } catch (e) {} } };
  const clearKeys = () => { for (const k in game.keys) game.keys[k] = false; };
  // 1. the stun counts down
  player.stunTimer = 1500; step(120); const afterTick = player.stunTimer;
  // 2. it locks movement while it lasts, and movement returns after
  player.stunTimer = 1500; clearKeys(); game.keys.arrowright = true; const x0 = player.x; step(30); const movedStunned = Math.abs(player.x - x0);
  player.stunTimer = 0; const x1 = player.x; step(30); const movedAfter = Math.abs(player.x - x1); clearKeys();
  // 3. the control reader
  const has = typeof _playerControlState === 'function';
  const st = (f) => { f(); const c = has ? _playerControlState() : null; return c ? { kind: c.kind, hard: !!c.hard, label: c.label, detail: c.detail || '', remain: c.remain | 0 } : null; };
  const cStun = st(() => { player.stunTimer = 1000; });
  const cBubble = st(() => { player._cancerBubble = 1500; player._cancerBubbleHits = 1; });
  const cFrozen = st(() => { player._cancerBubble = 0; player.stunTimer = 0; player.frozenTimer = 800; });
  const cBastion = st(() => { player.frozenTimer = 0; player._bastionArmedUntil = game.time + 600; });
  player._bastionArmedUntil = 0;
  // 4. the banner text above the head (the sticker draws the label, then the seconds on its ink chip: read both)
  const texts = []; const _ft = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) { texts.push(String(t)); return _ft.call(this, t, x, y, mw); };
  player.stunTimer = 1200;
  try { _drawPlayerStatusIcons(100, 100); } catch (e) {}
  CanvasRenderingContext2D.prototype.fillText = _ft;
  // 5. the vignette: a full-screen fill while hard-controlled, none otherwise - at the high FX tier, pinned (v0.30.1476: very-low
  //    drops it, see 5b; a slow run could have tripped the governor into it)
  const _tier = { lo: LX_PERF.lowFx, vlo: LX_PERF.veryLowFx }; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; game._lowFxCache = null;
  const autoVlo = _perfVeryLowFx();
  let rects = 0; const _fr = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) { if (w >= (typeof W === 'number' ? W : 9999) - 1) rects++; return _fr.call(this, x, y, w, h); };
  try { if (typeof _drawControlVignette === 'function') _drawControlVignette(); } catch (e) {}
  const rectsStunned = rects; rects = 0; player.stunTimer = 0;
  try { if (typeof _drawControlVignette === 'function') _drawControlVignette(); } catch (e) {}
  const rectsCalm = rects; CanvasRenderingContext2D.prototype.fillRect = _fr;
  // 5b. v0.30.1476 boss-lag (per user: Barnaby's fight lags) - the FX tiers: the governor's low tier keeps the vignette; very-low
  //     drops the full-screen fill while the STUNNED sticker over the head stays; window._lxNoLowSheds brings the fill back
  const vig = () => { let n = 0; const f = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) { if (w >= (typeof W === 'number' ? W : 9999) - 1) n++; return f.call(this, x, y, w, h); };
    try { _drawControlVignette(); } catch (e) {} CanvasRenderingContext2D.prototype.fillRect = f; return n; };
  player.stunTimer = 1200;
  LX_PERF.lowFx = true; LX_PERF.veryLowFx = false; game._lowFxCache = null; const vigLow = vig();
  LX_PERF.veryLowFx = true; game._lowFxCache = null; const vigVeryLow = vig();
  const texts2 = []; CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) { texts2.push(String(t)); return _ft.call(this, t, x, y, mw); };
  try { _drawPlayerStatusIcons(100, 100); } catch (e) {}
  CanvasRenderingContext2D.prototype.fillText = _ft;
  const bannerVeryLow = texts2.find((t) => /STUNNED/.test(t)) || null;
  window._lxNoLowSheds = true; const vigOptOut = vig(); window._lxNoLowSheds = false;
  LX_PERF.lowFx = _tier.lo; LX_PERF.veryLowFx = _tier.vlo; game._lowFxCache = null; player.stunTimer = 0;
  // 6. one toast at onset, not one per frame
  const toasts = []; const _st = window.showToast; window.showToast = (t) => { toasts.push(String(t)); };
  player._ctrlKind = null; player.stunTimer = 1000;
  try { _playerControlWatch(); _playerControlWatch(); _playerControlWatch(); } catch (e) {}
  window.showToast = _st; player.stunTimer = 0; player._ctrlKind = null;
  return { afterTick, movedStunned, movedAfter, has, cStun, cBubble, cFrozen, cBastion, banner: (() => { const i = texts.findIndex((t) => /STUNNED/.test(t)); return i < 0 ? null : texts.slice(i, i + 2).join(' '); })(), rectsStunned, rectsCalm, autoVlo, vigLow, vigVeryLow, bannerVeryLow, vigOptOut, toasts: toasts.filter((t) => /STUNNED/.test(t)).length };
});
ok('the stun counts down (1.5s stun is gone after 2s of ticks) — it used to be permanent', !r.err && r.afterTick <= 0, r.err || `stunTimer after 120 ticks: ${r.afterTick}`);
ok('a stunned player cannot move; movement returns when it ends', !r.err && r.movedStunned < 2 && r.movedAfter > 8, r.err || `moved while stunned ${r.movedStunned}px, after ${r.movedAfter}px`);
ok('the control reader names a stun with its time left', !r.err && r.cStun && r.cStun.kind === 'stun' && r.cStun.hard && r.cStun.remain === 1000, r.err || JSON.stringify(r.cStun));
ok("a Bubble Prison reads as BUBBLED with the strikes still needed (Cancer's trap)", !r.err && r.cBubble && r.cBubble.kind === 'bubble' && /×3/.test(r.cBubble.detail), r.err || JSON.stringify(r.cBubble));
ok('a freeze reads as FROZEN; an armed Bastion reads as a soft, informational state', !r.err && r.cFrozen && r.cFrozen.kind === 'frozen' && r.cFrozen.hard && r.cBastion && r.cBastion.kind === 'bastion' && !r.cBastion.hard, r.err || JSON.stringify({ f: r.cFrozen, b: r.cBastion }));
ok('the banner above the head says STUNNED with the seconds left', !r.err && /STUNNED/.test(r.banner || '') && /1\.2s/.test(r.banner || ''), r.err || String(r.banner));
ok('the screen-edge vignette paints while stunned and not otherwise', !r.err && r.rectsStunned >= 1 && r.rectsCalm === 0, r.err || `fills stunned ${r.rectsStunned}, calm ${r.rectsCalm}`);
ok('the FX tiers (v0.30.1476 boss-lag): the low tier keeps the vignette, very-low drops the fill while the STUNNED sticker stays, window._lxNoLowSheds brings it back', !r.err && r.autoVlo === false && r.vigLow >= 1 && r.vigVeryLow === 0 && /STUNNED/.test(r.bannerVeryLow || '') && r.vigOptOut >= 1, r.err || JSON.stringify({ autoVlo: r.autoVlo, low: r.vigLow, veryLow: r.vigVeryLow, banner: r.bannerVeryLow, optOut: r.vigOptOut }));
ok('onset is announced once (one toast for three watch ticks)', !r.err && r.toasts === 1, r.err || `toasts ${r.toasts}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
