// FIGHT LAG, per-scale-change and per-frame costs (v0.30.1208). Per user: "work on reducing the lag especially when
// fighting monsters ... or fighting bosses". A throttled fight profile (scripts/fight_live_profile.mjs) named them:
//   - STICKY: the resolution governor lowering the scale mid-map no longer re-mints the device-res caches (the backdrop
//     plate cost ~1 s at 4x CPU); a higher scale still re-bakes
//   - TELL: the parry / move ring's glyph is a baked blit - no font set per ring per frame - and it still draws
//   - LATCH: the Nunito readiness check stops calling document.fonts.check once it has passed
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=12391] node scripts/fight_lag_bake_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12391';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawTell === 'function' && typeof _lxBakeDpr === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 30; loadMap('mushroom', 600); await W8(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
    // STICKY - a plate baked at this scale, then the governor's drop
    const img = Object.values(BG_IMAGES).find((b) => b && b.naturalWidth > 1200) || null;
    out.img = img ? img.naturalWidth + 'x' + img.naturalHeight : null;
    const dpr0 = _LX_DPR, d0 = _lxBakeDpr(), p0 = img ? _lxBgScaled(img, 480, 280) : null;
    _lxApplyRenderScale(Math.max(1, dpr0 - 0.5)); const d1 = _lxBakeDpr(), p1 = img ? _lxBgScaled(img, 480, 280) : null;
    _lxApplyRenderScale(dpr0 + 0.5); const d2 = _lxBakeDpr();
    _lxApplyRenderScale(dpr0);
    out.sticky = { dpr0, d0, d1, d2, samePlate: !!p0 && p0 !== img && p0 === p1, plate: p0 ? p0.width + 'x' + p0.height : null };
    // TELL - font sets per ring, and the glyph still lands
    const D = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font'); let fontSets = 0;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get: D.get, set(v) { fontSets++; D.set.call(this, v); } });
    game.paused = true; await W8(100);
    _drawTell(-500, -500, 'parry', 1); _drawTell(-500, -500, 'move', 1); fontSets = 0;   // the first draw of each colour may bake
    for (let i = 0; i < 60; i++) _drawTell(-500, -500, i % 2 ? 'move' : 'parry', 1);
    out.tellFontSets = fontSets;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', D);
    ctx.save(); ctx.setTransform(_LX_DPR, 0, 0, _LX_DPR, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 60, 60);
    const tt = game.time; game.time = 7; _drawTell(30, 30, 'parry', 1); game.time = tt;   // pulse at its peak
    const px = ctx.getImageData(Math.round(22 * _LX_DPR), Math.round(22 * _LX_DPR), Math.round(16 * _LX_DPR), Math.round(16 * _LX_DPR)).data; ctx.restore();
    let glyph = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] > 180 && px[i + 2] > 110) glyph++;
    out.glyphPx = glyph;
    // LATCH - once Nunito is in, no more document.fonts.check
    await document.fonts.load('900 11px Nunito'); _lxPopFontReady();
    const oc = document.fonts.check.bind(document.fonts); let checks = 0; document.fonts.check = function () { checks++; return oc.apply(null, arguments); };
    for (let i = 0; i < 100; i++) _lxPopFontReady();
    document.fonts.check = oc; out.fontChecks = checks;
    game.paused = false; return out;
  });
  const S = r.sticky;
  check(!!r.img && S.d1 === S.d0 && S.samePlate, 'STICKY: a lower scale keeps the map\'s bake scale and the same backdrop plate (no re-mint)', J({ img: r.img, ...S }));
  check(S.d2 > S.d0, 'STICKY: a higher scale still re-bakes sharper', J({ d0: S.d0, d2: S.d2 }));
  check(r.tellFontSets === 0, 'TELL: 60 parry / move rings set no canvas font (the glyph is a baked blit)', 'font sets ' + r.tellFontSets);
  check(r.glyphPx >= 8, 'TELL: the ring\'s glyph still draws', 'glyph px ' + r.glyphPx);
  check(r.fontChecks === 0, 'LATCH: 100 readiness asks after Nunito loaded cost no document.fonts.check', 'checks ' + r.fontChecks);
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
