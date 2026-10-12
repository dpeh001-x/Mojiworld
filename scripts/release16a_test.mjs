// RELEASE 16a (round ten anti-cheat false positives) stays fixed, run the way a web player sees it (public host, vault on):
//   [1] an Iron Muscles roll from before its v0.30.427 cut (20, when today's top is 10) is clamped to 10 WITHOUT marking the
//       save: _devTouched stays clear and the save stays Steam-trusted, after a reload too
//   [2] a roll no range ever produced (999) is still clamped AND marks the save
//   [3] Safari extension frames (safari-extension://, webkit-masked-url://) count as browser extensions
//   node scripts/release16a_test.mjs        PORT / MOJI_GAME_FILE / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15171), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
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
const carry = (save, mark) => `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', ${JSON.stringify(save)});
  ${mark ? `localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(mark)});` : ''} } catch (e) {} })();`;
const enter = async (page, lv) => {
  await page.click('#menu-continue', { timeout: 150000 }).catch(() => {});
  await page.waitForFunction((lv) => player.level === lv && game.mapData, lv, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(4500);   // the vault's sweeps run every few seconds
};
const read = (page) => page.evaluate(() => ({ rolls: (player.boons || []).map((b) => b.id + ':' + b.roll), mark: game._devTouched || null,
  trusted: typeof _lxSteamTrusted === 'function' ? _lxSteamTrusted() : null, log: (typeof _lxAcReport === 'function' ? _lxAcReport() : []).map((x) => (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 120)) }));
try {
  const L = await boot('localhost');
  const made = await L.page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 30; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    try { for (const k in LX_KILL_FILMS) { const f = LX_KILL_FILMS[k]; if (f && f.key) player._storyBeatsSeen[f.key] = true; } } catch (e) {}
    const def = POWERUPS.find((p) => p.id === 'atk_p');
    player.boons = [{ id: 'atk_p', roll: 20, rerolls: 0 }, { id: 'atk_p', roll: 9, rerolls: 0 }]; _flushSaveStateNow();
    const A = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
    player.boons = [{ id: 'atk_p', roll: 999, rerolls: 0 }]; _flushSaveStateNow();
    const B = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
    return { A, B, top: def ? Math.max(def.min || 0, def.max) : null };
  });
  await L.ctx.close();

  // [1] an old honest roll
  const P = await boot('play.mojiworld.test', carry(made.A.save, made.A.mark));
  await enter(P.page, 30);
  const r1 = await read(P.page);
  await P.page.evaluate(() => { try { _flushSaveStateNow(); } catch (e) {} });
  const saved = await P.page.evaluate(() => localStorage.getItem(SAVE_KEY));
  const mark1 = await P.page.evaluate(() => localStorage.getItem(SAVE_KEY + '_verified'));
  await P.ctx.close();
  const P2 = await boot('play.mojiworld.test', carry(saved, mark1));
  await enter(P2.page, 30);
  const r1b = await read(P2.page);
  await P2.ctx.close();
  ok('[1] an Iron Muscles roll of 20 (pre-v0.30.427) is clamped to today\'s top and the save stays unmarked and trusted', made.top === 10 && r1.rolls[0] === 'atk_p:10' && r1.mark == null && r1.trusted !== false, { top: made.top, r1 });
  ok('[1] ...and after a reload it is still unmarked and trusted', r1b.mark == null && r1b.trusted !== false && r1b.rolls[0] === 'atk_p:10', r1b);

  // [2] a roll no range ever produced
  const Q = await boot('play.mojiworld.test', carry(made.B.save, made.B.mark));
  await enter(Q.page, 30);
  const r2 = await read(Q.page);
  ok('[2] a roll of 999 is clamped and marks the save', r2.rolls[0] === 'atk_p:10' && r2.mark === 'ac', r2);

  // [3] the extension pattern
  const src = await Q.page.evaluate(async () => (await (await fetch(location.href.split('?')[0])).text()));
  const m = src.match(/const EXT_URL = (\/.*?\/i);/);
  let ext = null; try { const re = eval(m[1]); ext = ['safari-extension://abc/x.js', 'webkit-masked-url://hidden/', 'chrome-extension://abc/x.js'].map((u) => re.test(u)).concat(re.test('http://play.mojiworld.test/mojiworld_game.html')); } catch (e) { ext = String(e).slice(0, 80); }
  ok('[3] Safari extension frames count as browser extensions (and the page itself does not)', Array.isArray(ext) && ext[0] && ext[1] && ext[2] && !ext[3], ext);
  await Q.ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
