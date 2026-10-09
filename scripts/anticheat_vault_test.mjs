// ANTI-CHEAT LAYER 1 - THE VALUE VAULT (_lxAc). A signed save is made on localhost (where the vault is off, as for every
// harness), then loaded on a PUBLIC host (play.mojiworld.test mapped to this server) by a real click on Continue, the way a
// player loads. There the vault is on, and:
//   [1] it is off on localhost and on on the public host
//   [2] the real load writes every guarded value without one refusal (no false positive on boot, load, login bonus)
//   [3] console writes to money, level and ATK are refused - the values stay - and logged
//   [4] a game function called FROM the console (_grantMojicoins) is refused too
//   [5] the save is marked Steam-ineligible ('ac' in the signed _devTouched) and the console cannot clear the mark
//   [6] the mark survives into the written save, which still verifies; [7] no page errors
//   node scripts/anticheat_vault_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11873), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: ['ignore', 'ignore', 'pipe'], cwd: ROOT }); server.stderr.on('data', (d) => process.stderr.write('[serve] ' + d)); 
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const boot = async (host, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { ctx, page };
};
try {
  // a signed save, made where the vault is off
  const L = await boot('localhost');
  const made = await L.page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 12; player.mojicoins = 4321; player.setshards = 7; player._tutorialSeen = true;
    player.mojicoins = 4322;   // the vault is off here: a plain write sticks
    _flushSaveStateNow();
    return { on: _lxAc.on, coins: player.mojicoins, save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
  });
  ok('[1a] the vault is off on localhost (a plain write sticks there)', made.on === false && made.coins === 4322, { on: made.on, coins: made.coins });
  const P = await boot('play.mojiworld.test', `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } catch (e) {} })();`);
  const page = P.page;
  ok('[1b] the vault is on on a public host', await page.evaluate(() => _lxAc.on) === true);
  await page.click('#menu-continue', { timeout: 150000 });
  await page.waitForFunction(() => player.level === 12 && game.mapData, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  const loaded = await page.evaluate(() => ({ level: player.level, coins: player.mojicoins, shards: player.setshards, verdict: game._saveVerdict, log: _lxAcReport(), dev: game._devTouched }));
  ok('[2] the real load writes every guarded value without one refusal', loaded.level === 12 && loaded.coins >= 4322 && loaded.shards === 7 && loaded.log.length === 0 && !loaded.dev, loaded);
  const cheat = await page.evaluate(() => {
    const before = { coins: player.mojicoins, level: player.level, atk: player.baseAtk };
    player.mojicoins = 9999999; player.level = 99; player.baseAtk = 99999;
    return { before, after: { coins: player.mojicoins, level: player.level, atk: player.baseAtk }, log: _lxAcReport().length };
  });
  ok('[3] console writes to money, level and ATK are refused and logged', JSON.stringify(cheat.before) === JSON.stringify(cheat.after) && cheat.log === 3, cheat);
  const fn = await page.evaluate(() => { const b = player.mojicoins; try { _grantMojicoins(50000); } catch (e) {} return { b, a: player.mojicoins, log: _lxAcReport().length }; });
  ok('[4] a game function called from the console is refused too', fn.a === fn.b && fn.log > 3, fn);
  const mark = await page.evaluate(() => { const a = game._devTouched; game._devTouched = false; return { a, b: game._devTouched, trusted: _lxSteamTrusted() }; });
  ok('[5] the save is Steam-ineligible and the console cannot clear the mark', mark.a === 'ac' && mark.b === 'ac' && mark.trusted === false, mark);
  const saved = await page.evaluate(() => { _flushSaveStateNow(); const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { dev: s.game && s.game._devTouched, verdict: _lxLocalSaveVerdict(s), coins: s.player.mojicoins }; });
  ok('[6] the mark is written into the save, which still verifies', saved.dev === 'ac' && saved.verdict === 'ok' && saved.coins < 9999999, saved);
  ok('[7] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }   // server first: closing a page mid-stream crashes serve.js
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
