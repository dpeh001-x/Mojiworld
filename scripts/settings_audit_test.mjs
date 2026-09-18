// EVERY SETTINGS OPTION WORKS (per user "ensure all the settings options work", 2026-09-18). Drives each control in the
// Settings panel the way a player does - a click on a switch, a drag (input event) on a slider, a pick (change event) on a
// dropdown, a press on a button - then checks the thing it promises actually changed in the running game, that the
// choice is saved, that a reload brings it back (panel AND game), and that Reset Defaults puts it back.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/settings_audit_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11217';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const BOOT = async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  try { audio.muted = false; } catch (e) {}
  loadMap('forest', 300); await sleep(2500); try { closeAllModals(); } catch (e) {}
};
// the controls, driven as a player would (runs in the page)
const DRIVE = async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const $ = (id) => document.getElementById(id);
  const click = (id) => $(id).click();
  const drag = (id, v) => { const e = $(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const pick = (id, v) => { const e = $(id); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  const scaleNow = () => parseFloat(getComputedStyle(document.querySelector('.game-wrapper')).getPropertyValue('--game-scale'));
  const mapEl = () => (typeof _bgmActiveMapEl !== 'undefined' && _bgmActiveMapEl) || (typeof _bgmEl !== 'undefined' && _bgmEl) || null;
  const o = {};
  openSettingsModal(); await sleep(100);
  o.opensPaused = !!game.paused && $('settings-modal-bg').classList.contains('on');
  drag('set-scale', 1.0); o.scale = { label: $('set-scale-val').textContent, applied: scaleNow() };
  drag('set-bgm', 40); await sleep(50); o.bgm = { label: $('set-bgm-val').textContent, vol: mapEl() ? +mapEl().volume.toFixed(3) : null };
  drag('set-sfx', 30); o.sfx = { label: $('set-sfx-val').textContent, master: +_SFX_MASTER_VOL.toFixed(2) };
  click('set-mute'); o.mute = { audio: !!audio.muted, el: mapEl() ? mapEl().muted : null }; click('set-mute'); o.unmute = { audio: !!audio.muted, el: mapEl() ? mapEl().muted : null };
  click('set-bgmute'); o.bgMute = _lxGetSettings().bgMute;
  pick('set-gfx', 'low'); o.gfxLow = { q: LX_GFX.quality, veryLow: !!LX_PERF.veryLowFx, weather: LX_GFX.weather, shadows: LX_ENTITY_SHADOWS, ambient: LX_AMBIENT_V2, sw: ['set-fx-weather', 'set-fx-ambient', 'set-fx-shadows'].map((i) => $(i).classList.contains('on')) };
  pick('set-gfx', 'high'); o.gfxHigh = { q: LX_GFX.quality, veryLow: !!LX_PERF.veryLowFx, weather: LX_GFX.weather, shadows: LX_ENTITY_SHADOWS, ambient: LX_AMBIENT_V2 };
  click('set-fx-weather'); o.fxWeather = { on: LX_GFX.weather, sel: $('set-gfx').value };
  click('set-fx-ambient'); o.fxAmbient = LX_AMBIENT_V2;
  click('set-fx-shadows'); o.fxShadows = LX_ENTITY_SHADOWS;
  click('set-fx-dmgnum'); o.fxDmgNum = LX_GFX.dmgnum;
  o.tierKept = { veryLow: !!LX_PERF.veryLowFx, base: _lxGetSettings().gfxBase, sel: $('set-gfx').value };
  click('set-fdesk'); o.fdesk = document.body.classList.contains('force-desktop');
  click('set-reducemotion'); game.shake = 0; addShake(10); o.reduceMotion = { flag: !!game._reduceMotion, shake: game.shake || 0 }; click('set-reducemotion');
  drag('set-uiscale', 130); o.uiScale = { label: $('set-uiscale-val').textContent, css: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim() };
  drag('set-shake', 0); game.shake = 0; addShake(10); o.shake = { label: $('set-shake-val').textContent, shake: game.shake || 0 };
  drag('set-flash', 0); game.flashOverlay = 0; flash(0.5); o.flash = { label: $('set-flash-val').textContent, overlay: game.flashOverlay };
  click('set-cbrarity'); o.cb = { body: document.body.classList.contains('cb-rarity'), epic: _lxRarityColor('epic', 'std') };
  pick('set-difficulty', 'hard'); o.diff = game._diffTier;
  o.saved = _lxGetSettings();
  return o;
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  const URL = `http://localhost:${PORT}/mojiworld_game.html?dev=1`;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openSettingsModal === 'function', null, { timeout: 120000 });
  await page.evaluate(BOOT);
  const d = await page.evaluate(DRIVE);
  check(d.opensPaused, 'opening Settings pauses the game', J(d.opensPaused));
  check(d.scale.label === '1.00×' && Math.abs(d.scale.applied - 1.0) < 0.01, 'Resolution: the slider sets the canvas zoom', J(d.scale));
  check(d.bgm.label === '40%' && d.bgm.vol === 0.24, 'Music volume: the slider sets the playing track', J(d.bgm));
  check(d.sfx.label === '30%' && d.sfx.master === 0.3, 'SFX volume: the slider sets the sound master', J(d.sfx));
  check(d.mute.audio && d.mute.el === true && !d.unmute.audio && d.unmute.el === false, 'Mute All Audio silences everything and gives it back', J({ on: d.mute, off: d.unmute }));
  check(d.bgMute === false, 'Mute in Background can be switched off', J(d.bgMute));
  check(d.gfxLow.q === 'low' && d.gfxLow.veryLow && !d.gfxLow.weather && !d.gfxLow.shadows && !d.gfxLow.ambient && d.gfxLow.sw.every((x) => !x), 'Graphics Low: engine tier down, weather / ambient / shadows off, switches follow', J(d.gfxLow));
  check(d.gfxHigh.q === 'high' && !d.gfxHigh.veryLow && d.gfxHigh.weather && d.gfxHigh.shadows && d.gfxHigh.ambient, 'Graphics High: everything back on', J(d.gfxHigh));
  check(d.fxWeather.on === false && d.fxWeather.sel === 'custom', 'Weather Effects off (the preset shows Custom)', J(d.fxWeather));
  check(d.fxAmbient === false && d.fxShadows === false && d.fxDmgNum === false, 'Ambient Life, Ground Shadows and Damage Numbers switch off', J({ a: d.fxAmbient, s: d.fxShadows, n: d.fxDmgNum }));
  check(!d.tierKept.veryLow && d.tierKept.base === 'high' && d.tierKept.sel === 'custom', '...and switching effects off on High never drops the engine to Low', J(d.tierKept));
  check(d.fdesk, 'Force Desktop Layout applies', J(d.fdesk));
  check(d.reduceMotion.flag && d.reduceMotion.shake === 0, 'Reduce Motion stops the screen shake', J(d.reduceMotion));
  check(d.uiScale.label === '130%' && d.uiScale.css === '1.3', 'HUD Size: the slider scales the HUD', J(d.uiScale));
  check(d.shake.label === '0%' && d.shake.shake === 0, 'Screen Shake 0% means no shake', J(d.shake));
  check(d.flash.label === '0%' && d.flash.overlay === 0, 'Screen Flashes 0% means no flash', J(d.flash));
  check(d.cb.body && d.cb.epic === '#cc79a7', 'Colorblind Rarity swaps the palette', J(d.cb));
  check(d.diff === 'hard', 'Difficulty applies', J(d.diff));
  const s = d.saved;
  // Resolution at the top stop fills a big window (1440p here); 2.0 leaves a border there
  await page.setViewportSize({ width: 2560, height: 1440 }); await page.waitForTimeout(300);
  const fit = await page.evaluate(async () => { const $ = (id) => document.getElementById(id); const sc = () => parseFloat(getComputedStyle(document.querySelector('.game-wrapper')).getPropertyValue('--game-scale'));
    const drag = (v) => { const e = $('set-scale'); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); };
    drag(2.0); const two = sc(); drag(4.0); const top = sc(), label = $('set-scale-val').textContent; drag(1.0); return { two, top, label }; });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(300);
  check(fit.two === 2 && fit.top > 2.5 && fit.label === 'Fit', 'Resolution at Fit fills a 2560x1440 window (2.0 leaves a border)', J(fit));
  check(s.scale === 1 && s.bgm === 40 && s.sfx === 30 && s.bgMute === false && s.fxWeather === false && s.fdesk === true && s.uiScale === 130 && s.shakePct === 0 && s.flashPct === 0 && s.cbRarity === true && s.difficulty === 'hard', 'every choice is saved', J(s));
  // part 2 (scripts/settings_audit_part2.mjs): reload, then the buttons, then Reset Defaults
  await (await import('./settings_audit_part2.mjs')).default({ page, errs, URL, check, J, BOOT });
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
