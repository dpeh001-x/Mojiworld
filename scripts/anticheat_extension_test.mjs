// ANTI-CHEAT: AN EXTENSION THAT ONLY CALLS THE GAME IS NOT A CHEAT (bughunt round 3, H3-2). On a PUBLIC host (the anti-cheat is
// off on localhost), with a signed save loaded by a real click on Continue, and a fake browser extension in the page's own world
// (an init script whose frames read chrome-extension://..., via its sourceURL) that wraps requestAnimationFrame and setTimeout -
// what FPS counters, background-tab keepers and userscript managers do:
//   [1] honest play still counts: a kill through a wrapped timer pays EXP, coins and the kill counter, nothing is refused, the
//       save is not flagged (before the fix every one of those writes was refused: an extension frame sat under every callback)
//   [2] a write the extension makes by itself (no game code between it and the field) is still refused and flagged
//   [3] no page errors
//   node scripts/anticheat_extension_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11957), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const menu = (page) => page.waitForFunction(() => typeof _lxAc === 'object' && window._lxBootMenuSeen, null, { timeout: 180000 });
// the fake extension: MAIN world, document_start, its own script URL
const EXT = `(() => {
  const r = window.requestAnimationFrame.bind(window), st = window.setTimeout.bind(window);
  window.requestAnimationFrame = function (cb) { return r(function extRaf(t) { return cb(t); }); };
  window.setTimeout = function (cb, ms, ...a) { return typeof cb === 'function' ? st(function extTimer() { return cb(...a); }, ms) : st(cb, ms, ...a); };
  window.__extCheat = function () { st(function extWrite() { try { player.mojicoins = 987654321; } catch (e) {} }, 0); };
})();
//# sourceURL=chrome-extension://abcdefghijklmnopabcdefghijklmnop/content/wrap.js`;
try {
  const lctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await lctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const L = await lctx.newPage();
  await L.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(L);
  const made = await L.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 12; player.mojicoins = 5000; player._tutorialSeen = true; _flushSaveStateNow();
    return { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(`(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } catch (e) {} })();`);
  await ctx.addInitScript(EXT);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://play.mojiworld.test:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  await page.click('#menu-continue', { timeout: 150000 });
  await page.waitForFunction(() => player.level === 12 && game.mapData, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const r1 = await page.evaluate(async () => {
    const wrapped = /chrome-extension:\/\//.test(String(new Error().stack)) || String(window.requestAnimationFrame).includes('extRaf');
    if (game.currentMap !== 'forest') { setTimeout(loadMap, 0, 'forest'); await new Promise((r) => setTimeout(r, 2500)); }
    const before = { exp: player.exp, lvl: player.level, coins: player.mojicoins, kills: game.kills | 0 };
    let m = (game.monsters || []).find((x) => x && x.currentHp > 0 && !x.isBoss);
    if (!m) return { err: 'no monster', wrapped };
    m.currentHp = 1; setTimeout(killMonster, 0, m);   // through the wrapped timer: the extension frame sits under the game's kill
    await new Promise((r) => setTimeout(r, 1200));
    return { wrapped, before, after: { exp: player.exp, lvl: player.level, coins: player.mojicoins, kills: game.kills | 0 }, log: _lxAcReport().map((e) => e.kind + ' ' + e.field), dev: game._devTouched || null };
  });
  const gained = !r1.err && (r1.after.exp > r1.before.exp || r1.after.lvl > r1.before.lvl) && r1.after.kills > r1.before.kills;
  ok('[1] with an extension wrapping the timers, a kill still pays EXP and counts, nothing is refused, the save is not flagged',
    r1.wrapped && gained && !r1.log.length && r1.dev !== 'ac', r1);
  const r2 = await page.evaluate(async () => {
    const before = player.mojicoins; __extCheat(); await new Promise((r) => setTimeout(r, 400));
    return { before, after: player.mojicoins, log: _lxAcReport().map((e) => e.kind + ' ' + e.field).slice(-3), dev: game._devTouched || null };
  });
  ok('[2] a write the extension makes by itself is still refused and flagged', r2.after === r2.before && r2.log.some((x) => /mojicoins/.test(x)) && r2.dev === 'ac', r2);
  ok('[3] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
