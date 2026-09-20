// EVERY SETTINGS CONTROL SURVIVES A RELOAD (v0.30.952).
//
// Twenty controls write into one LX_SETTINGS blob. A setting that silently fails to persist is the
// kind of thing nobody files a bug for - they just conclude the game is fiddly. This sets every
// control to a non-default, reloads the page, and reads each one back off the reopened panel.
//
// Two things it has to get right, or it measures the wrong thing:
//   - apply the graphics PRESET before the four fx toggles. The preset rewrites them, so doing it the
//     other way round reads the preset back and calls it a persistence failure (it is not).
//   - after that, gfx is expected to read 'custom', not 'medium': fine-tuning a preset IS custom, with
//     the tier kept in gfxBase. Asserting 'medium' would be asserting a bug.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/settings_roundtrip_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11343';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const TOGGLES = ['set-mute', 'set-bgmute', 'set-lowfx', 'set-debug', 'set-reducemotion', 'set-cbrarity',
  'set-fx-weather', 'set-fx-ambient', 'set-fx-shadows', 'set-fx-dmgnum', 'set-fdesk'];
const SLIDERS = { 'set-scale': '1.5', 'set-bgm': '35', 'set-sfx': '25', 'set-shake': '40', 'set-flash': '30', 'set-uiscale': '120' };
const SELECTS = { 'set-gfx': 'medium', 'set-difficulty': 'hard' };
const EXPECT_SELECT = { 'set-gfx': 'custom', 'set-difficulty': 'hard' };   // see the header note on 'custom'
const boot = async () => {
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openSettingsModal === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); loadMap('town', 300); await new Promise((r) => setTimeout(r, 1800)); game.paused = false;
  });
};
const read = async () => page.evaluate(({ TOGGLES, SLIDERS, SELECTS }) => {
  openSettingsModal();
  const o = { toggles: {}, vals: {}, missing: [] };
  for (const id of TOGGLES) { const e = document.getElementById(id); if (!e) { o.missing.push(id); continue; } o.toggles[id] = e.classList.contains('on'); }
  for (const id of Object.keys(SLIDERS).concat(Object.keys(SELECTS))) { const e = document.getElementById(id); if (!e) { o.missing.push(id); continue; } o.vals[id] = e.value; }
  o.fx = { cbBody: document.body.classList.contains('cb-rarity'),
    uiScale: getComputedStyle(document.documentElement).getPropertyValue('--lx-ui-scale').trim() || null };
  try { closeSettingsModal(); } catch (e) {}
  return o;
}, { TOGGLES, SLIDERS, SELECTS });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot();
  await read();
  const set = await page.evaluate(async ({ TOGGLES, SLIDERS, SELECTS }) => {
    openSettingsModal(); await new Promise((r) => setTimeout(r, 250));
    const want = {};
    for (const [id, v] of Object.entries(SELECTS)) { const e = document.getElementById(id); if (!e) continue; e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 200)); }
    await new Promise((r) => setTimeout(r, 300));
    for (const id of TOGGLES) { const e = document.getElementById(id); if (!e) continue; e.click(); await new Promise((r) => setTimeout(r, 90)); want[id] = e.classList.contains('on'); }
    for (const [id, v] of Object.entries(SLIDERS)) { const e = document.getElementById(id); if (!e) continue; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 60)); }
    await new Promise((r) => setTimeout(r, 400));
    try { closeSettingsModal(); } catch (e) {}
    return want;
  }, { TOGGLES, SLIDERS, SELECTS });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await boot();
  const after = await read();
  check(after.missing.length === 0, 'every control is present in the panel', after.missing.length ? J(after.missing) : (TOGGLES.length + Object.keys(SLIDERS).length + Object.keys(SELECTS).length) + ' controls');
  const lostT = TOGGLES.filter((id) => id in set && after.toggles[id] !== set[id]);
  check(lostT.length === 0, 'every toggle came back as it was left', lostT.length ? J(lostT.map((id) => id + ': set ' + set[id] + ', got ' + after.toggles[id])) : TOGGLES.length + ' toggles');
  const lostS = Object.entries(SLIDERS).filter(([id, v]) => Number(after.vals[id]) !== Number(v));
  check(lostS.length === 0, 'every slider came back at its value', lostS.length ? J(lostS.map(([id, v]) => id + ': set ' + v + ', got ' + after.vals[id])) : Object.keys(SLIDERS).length + ' sliders');
  const lostSel = Object.entries(EXPECT_SELECT).filter(([id, v]) => String(after.vals[id]) !== v);
  check(lostSel.length === 0, 'the dropdowns came back', lostSel.length ? J(lostSel.map(([id, v]) => id + ': expected ' + v + ', got ' + after.vals[id])) : J(EXPECT_SELECT));
  check(after.fx.cbBody === true, 'and a setting that dresses the page is applied on boot (colourblind rarity)', 'body.cb-rarity ' + after.fx.cbBody);
  check(after.fx.uiScale === '1.2', 'HUD scale reaches the page as --lx-ui-scale', String(after.fx.uiScale));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
