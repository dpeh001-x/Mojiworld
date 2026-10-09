// Importing a save keeps working with anti-cheat layer 3 on (public host). A save written on one public-host browser
// (it carries sq + sig5) is exported as a file and imported on another through the real file input + the real confirm:
//   [1] the import reloads into the imported hero (level, coins)
//   [2] a SECOND load before any autosave (the replacement token already used up) still loads the hero - before this fix the
//       stale whole-save signature made that load fail ("could not be loaded")
//   [3] no page errors
//   node scripts/import_sig5_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11895), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const menu = (page) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
const fresh = async (host, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  return page;
};
try {
  const L = await fresh('localhost');
  const made = await L.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 14; player.mojicoins = 6100; player._tutorialSeen = true; _flushSaveStateNow();
    return { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
  });
  // A: a public-host browser that flushes it (so the file carries sq + sig5), then hands the save over as a file
  const A = await fresh('play.mojiworld.test', `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } catch (e) {} })();`);
  await A.click('#menu-continue', { timeout: 30000 }); await A.waitForFunction(() => player.level === 14 && game.mapData, null, { timeout: 120000 });
  const file = await A.evaluate(async () => { _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 300)); return localStorage.getItem(SAVE_KEY); });
  // B: another public-host browser imports it through the real file input and the real confirm
  const B = await fresh('play.mojiworld.test');
  await B.evaluate(() => { const el = document.getElementById('save-import-file'); el.style.display = 'block'; });
  await B.setInputFiles('#save-import-file', { name: 'mojiworld_save.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await B.click('#confirm-yes', { timeout: 15000 });
  await B.waitForTimeout(2500); await menu(B); await B.waitForTimeout(1500);
  // the boot load already ran: the imported hero is loaded behind the title menu
  const r1 = await B.evaluate(() => ({ level: player.level, coins: player.mojicoins, verdict: game._saveVerdict }));
  ok('[1] the import reloads into the imported hero', r1.level === 14 && r1.coins >= 6100, r1);
  // a second load straight away - no Continue, so no autosave has re-signed anything since the import
  await B.evaluate(() => { game._resetting = true; });
  await B.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(B); await B.waitForTimeout(3000); await menu(B);
  const r2 = await B.evaluate(() => ({ level: player.level, verdict: game._saveVerdict, log: (typeof _lxAcReport === 'function') ? _lxAcReport() : null }));
  ok('[2] a second load before any autosave still loads the imported hero, cleanly', r2.level === 14 && r2.verdict === 'ok' && r2.log && r2.log.length === 0, r2);
  ok('[3] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
