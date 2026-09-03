// STEAM REVIEW CAUTIONS: a real, visible auto-pause, and prompts that follow the device.
// ============================================================================
// Steam's review: "when opening the Steam Overlay the game does not pause";
// "when the controller is unplugged during gameplay, the game does not
// automatically pause"; "the in-game prompt displays keyboard prompts when a
// controller is used". Here: the overlay callback, a lost window focus (Steam
// shell) and a controller unplug all enter ONE auto-pause that freezes the
// sim and shows a PAUSED veil naming the reason; Escape / click leave it; the
// overlay's close and a returning focus resume on their own; a shared co-op
// session is never frozen. And while the last input came from a pad, key
// prompts name the bound pad button (the quest hint, the HUD strip, the
// hotkey hint, the tutorial's "try it").
// Run: node scripts/steam_autopause_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9895);
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
// the Steam shell's bridge, present before the game scripts run
await page.addInitScript(() => { window.SteamAPI = { onOverlay(cb) { window._ovCb = cb; }, cloud: {}, achievement: {}, presence: {}, overlay: {} }; });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.waitForTimeout(7000);
await page.evaluate(() => { window._lxBootGateDone = true; window._prologueActive = false; });
await page.fill('#hero-name-input', 'Steam').catch(() => {});
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
  loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1500));
  // mirror a booted game: the harness drives the sim under the boot menu and with the
  // (unplayable, headless) prologue flagged active — a real session has neither
  if (typeof closeAllModals === 'function') closeAllModals();
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  window._prologueActive = false; window._prologuePending = false;
  game.paused = false; player.hp = getMaxHp();
  const veil = () => { const v = document.getElementById('lx-autopause'); return v && v.style.display !== 'none' ? (document.getElementById('lx-autopause-why') || {}).textContent : null; };
  const out = { has: typeof _lxAutoPause === 'function' && typeof _promptKey === 'function', subscribed: typeof window._ovCb === 'function',
    dbg: { net: !!(typeof net !== 'undefined' && net && net.connected), plgA: !!window._prologueActive, plgP: !!window._prologuePending, hp: player.hp, map: !!game.mapData, modalRoot: (typeof _lxPadModalRoot === 'function' && _lxPadModalRoot()) ? (_lxPadModalRoot().id || 'yes') : null } };
  // 1. the Steam overlay opens: paused, veil says so; closes: resumed
  if (window._ovCb) window._ovCb(true); out.ovPaused = !!game.paused; out.ovVeil = veil();
  if (window._ovCb) window._ovCb(false); out.ovResumed = !game.paused && veil() === null;
  // 2. the controller is unplugged: paused, veil names it; reconnecting keeps the pause but says it is safe; Escape leaves
  window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: { index: 0, id: 'test pad' } }));
  out.unplugPaused = !!game.paused; out.unplugVeil = veil();
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: { index: 0, id: 'test pad', connected: true } }));
  out.reconStill = !!game.paused; out.reconHow = (document.getElementById('lx-autopause-how') || {}).textContent || '';
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  out.escResumed = !game.paused && veil() === null;
  // 3. the Steam shell loses the window: paused; gets it back: resumed
  window.dispatchEvent(new Event('blur')); out.blurPaused = !!game.paused && /focus/i.test(veil() || '');
  window.dispatchEvent(new Event('focus')); out.focusResumed = !game.paused && veil() === null;
  // 4. a shared session is never frozen
  if (typeof _lxAutoResume === 'function') _lxAutoResume(true); game.paused = false;
  const hadNet = typeof net !== 'undefined' ? net.connected : undefined; if (typeof net !== 'undefined') net.connected = true;
  if (window._ovCb) window._ovCb(true); out.coopNotPaused = !game.paused; if (window._ovCb) window._ovCb(false);
  if (typeof net !== 'undefined') net.connected = hadNet;
  // 5. prompts: the pad becomes the device on a pad press; the keyboard on a real key
  _lxNoteInput('pad');
  out.padZ = _promptKey('z'); out.padSpace = _promptKey(' '); out.padEsc = _promptKey('escape'); out.padQ = _promptKey('q'); out.padM = _promptKey('m');
  out.padQuest = (typeof _questKeyLabel === 'function') ? _questKeyLabel() : null;
  out.padStrip = (document.getElementById('controls') || {}).innerHTML || ''; out.padHint = (document.getElementById('hotkey-hint') || {}).innerHTML || '';
  out.padTut = (typeof _lxKbdHtml === 'function') ? _lxKbdHtml('Swing your weapon — press <kbd>Z</kbd>') : '';
  _lxNoteInput('kb');
  out.kbZ = _promptKey('z'); out.kbEsc = _promptKey('escape'); out.kbStrip = (document.getElementById('controls') || {}).innerHTML || '';
  return out;
});
ok('the shared auto-pause and the prompt helpers exist; the game subscribed to the Steam overlay', !r.err && r.has && r.subscribed, r.err || JSON.stringify({ has: r.has, sub: r.subscribed, dbg: r.dbg }));
ok('Steam overlay opens → paused with a visible veil naming it; closes → resumed', !r.err && r.ovPaused && /overlay/i.test(r.ovVeil || '') && r.ovResumed, r.err || JSON.stringify({ p: r.ovPaused, veil: r.ovVeil, resumed: r.ovResumed }));
ok('controller unplugged → paused with a visible veil naming it (it used to dispatch an Escape that pauses nothing)', !r.err && r.unplugPaused && /controller/i.test(r.unplugVeil || ''), r.err || JSON.stringify({ p: r.unplugPaused, veil: r.unplugVeil }));
ok('reconnecting keeps the pause and says it is safe; Escape leaves it', !r.err && r.reconStill && /reconnected/i.test(r.reconHow) && r.escResumed, r.err || JSON.stringify({ still: r.reconStill, how: r.reconHow, esc: r.escResumed }));
ok('Steam shell: losing the window pauses, getting it back resumes', !r.err && r.blurPaused && r.focusResumed, r.err || JSON.stringify({ blur: r.blurPaused, focus: r.focusResumed }));
ok('a shared co-op session is never frozen by the overlay', !r.err && r.coopNotPaused, r.err || `paused ${!r.coopNotPaused}`);
ok("with a pad in use, prompts name the pad button: attack Ⓧ, jump Ⓐ, pause Start", !r.err && r.padZ === 'Ⓧ' && r.padSpace === 'Ⓐ' && r.padEsc === 'Start', r.err || JSON.stringify({ z: r.padZ, space: r.padSpace, esc: r.padEsc }));
ok('the journal is Back+✚▼ on a pad and the quest hint says so; a key with no pad binding (M mute) keeps its keyboard label', !r.err && r.padQ === 'Back+✚▼' && r.padQuest === 'Back+✚▼' && r.padM === 'M', r.err || JSON.stringify({ q: r.padQ, quest: r.padQuest, m: r.padM }));
ok('the HUD strip, the hotkey hint and the tutorial "try it" swap their keycaps for pad glyphs (Ⓨ Talk, Back for the U panel, Ⓧ swing)', !r.err && /lx-pad-glyph/.test(r.padStrip) && /Ⓨ/.test(r.padStrip) && /Ⓧ/.test(r.padTut), r.err || `strip has glyph ${/lx-pad-glyph/.test(r.padStrip)}; tut ${r.padTut}`);
ok('back on the keyboard: labels return (Z, Esc) and the strip shows keys again', !r.err && r.kbZ === 'Z' && r.kbEsc === 'Esc' && !/lx-pad-glyph/.test(r.kbStrip) && /<kbd>N<\/kbd>/.test(r.kbStrip), r.err || JSON.stringify({ z: r.kbZ, esc: r.kbEsc, glyphLeft: /lx-pad-glyph/.test(r.kbStrip) }));
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
