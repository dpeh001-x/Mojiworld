// EVERY PANEL CLOSES ON ESCAPE, AND THE GAME COMES BACK (v0.30.952).
//
// Seventeen panels, each opened through its own opener (not by forcing display, which would test
// nothing about the opener). For each: it opens, the sim pauses under it, Escape closes it, the sim
// unpauses, and game.time actually advances again - a panel that unpauses the flag but leaves the
// loop stopped looks identical in a screenshot. Then two at once, closed by closeAllModals.
//
// Three panels are NOT bugs and are handled as the code intends:
//   - openHelp() deliberately re-routes to the K keybind panel (help-modal was retired), so the
//     keybind modal is what this opens and checks;
//   - the wardrobe needs the Fashionista's one-shot ticket (_csAccessGranted), granted here;
//   - #inventory-modal is dormant legacy markup - the U-tab Items pane replaced it - so it is absent.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/panel_escape_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11344';
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
const PANELS = [
  { id: 'shop-modal', open: "openShop('potion')" },
  { id: 'keybind-modal', open: 'openHelp()' },
  { id: 'codex-modal', open: 'openCodex()' },
  { id: 'mojidex-modal', open: 'openMojidex()' },
  { id: 'taxi-modal', open: 'openTaxi()' },
  { id: 'craft-modal', open: 'openCraftingModal()' },
  { id: 'enhance-modal', open: 'openEnhancementModal()' },
  { id: 'reforge-modal', open: 'openReforgeModal()' },
  { id: 'attributes-modal', open: 'openAttributes()' },
  { id: 'lore-modal', open: 'openLoreMap()' },
  { id: 'multiplayer-modal', open: 'openMultiplayer()' },
  { id: 'backup-modal-bg', open: 'openBackupModal()', cls: 'on' },
  { id: 'jukebox-modal-bg', open: 'openJukebox()', cls: 'on' },
  { id: 'settings-modal-bg', open: 'openSettingsModal()', cls: 'on' },
  { id: 'char-studio-overlay', open: '_csAccessGranted = true; openCharStudio()', cls: 'open' },
  { id: 'quest-modal', key: 'q' },
  { id: 'worldmap-modal', key: 'w' },
];
const vis = (id, cls) => `(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) return 'MISSING';
  if (${JSON.stringify(cls || null)}) return e.classList.contains(${JSON.stringify(cls || 'on')});
  return !!(e.getClientRects().length && getComputedStyle(e).display !== 'none'); })()`;
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof closeAllModals === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 30; player.mojicoins = 99999;
    loadMap('town', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false;
  });
  // the map-entry cinematic swallows input while body.cinematic is set; a player taps past it
  for (let i = 0; i < 14; i++) { const c = await page.evaluate(() => (document.body.className.match(/cinematic|sb-active/g) || []).join('+')); if (!c) break; await page.keyboard.press('Space'); await page.waitForTimeout(400); }
  const never = [], stuck = [], frozen = [];
  for (const p of PANELS) {
    await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
    await page.waitForTimeout(300);
    if (p.key) { await page.keyboard.press(p.key); await page.waitForTimeout(600); }
    else { await page.evaluate(async (src) => { try { eval(src); } catch (e) {} await new Promise((r) => setTimeout(r, 400)); }, p.open); await page.waitForTimeout(300); }
    if (await page.evaluate((s) => eval(s), vis(p.id, p.cls)) !== true) { never.push(p.id); continue; }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    if (await page.evaluate((s) => eval(s), vis(p.id, p.cls)) === true) stuck.push(p.id);
    const ticks = await page.evaluate(async () => { const t0 = game.time; await new Promise((r) => setTimeout(r, 400)); return { t: game.time - t0, paused: !!game.paused }; });
    if (ticks.paused || ticks.t <= 0) frozen.push(p.id + ' (' + ticks.t + ' ticks, paused ' + ticks.paused + ')');
  }
  check(never.length === 0, `all ${PANELS.length} panels open through their own opener`, never.length ? J(never) : PANELS.length + ' opened');
  check(stuck.length === 0, 'Escape closes every one of them', stuck.length ? J(stuck) : 'all closed');
  check(frozen.length === 0, 'and the game is running again after each', frozen.length ? J(frozen) : 'sim ticking after all ' + PANELS.length);
  const stack = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game.paused = false;
    openCraftingModal(); await new Promise((r) => setTimeout(r, 250));
    openCodex(); await new Promise((r) => setTimeout(r, 250));
    const shown = (id) => { const e = document.getElementById(id); return !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); };
    closeAllModals(); await new Promise((r) => setTimeout(r, 300));
    return { left: ['craft-modal', 'codex-modal'].filter(shown), paused: !!game.paused };
  });
  check(stack.left.length === 0, 'closeAllModals leaves nothing behind when two are open', stack.left.length ? J(stack.left) : 'clean');
  check(stack.paused === false, 'and it does not leave the game paused', 'paused ' + stack.paused);
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
