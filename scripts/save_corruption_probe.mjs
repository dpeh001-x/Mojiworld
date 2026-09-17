// A damaged save must never brick the boot or destroy the player's data. Makes a real save, then boots six times
// with the stored save replaced by garbage / a truncated copy / null / a number / an empty string / an old
// version, and checks each boot reaches the menu with no runtime error and keeps a recovery copy.
//
//   [SERVE_ROOT=<dir>] node scripts/save_corruption_probe.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11100';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
const page = await ctx.newPage();
let errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
const URL = `http://localhost:${PORT}/mojiworld_game.html`;
// A live game page flushes its state to localStorage when it is left, which would overwrite anything injected
// before the next boot. So every boot first parks on a blank same-origin page, writes the stored save there,
// then loads the game. The title menu lives inside the loading overlay, so "booted" = the menu is showing.
const park = async (stored) => {
  await page.goto(`http://localhost:${PORT}/__probe_blank`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.evaluate(({ stored }) => { const K = 'levelx_save_v1'; if (stored === null) localStorage.removeItem(K); else localStorage.setItem(K, stored); localStorage.removeItem(K + '_recover'); }, { stored });
};
const boot = async () => {
  errs = [];
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SAVE_KEY === 'string', null, { timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return page.evaluate(() => ({ key: SAVE_KEY, stored: localStorage.getItem(SAVE_KEY), recover: localStorage.getItem(SAVE_KEY + '_recover'), menu: !!document.getElementById('lo-menu') && getComputedStyle(document.getElementById('lo-menu')).display !== 'none', title: document.title, ver: GAME_VERSION }));
};
try {
  const first = await boot();
  console.log('build ' + first.ver);
  // a real save
  const good = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(1200); player.cls = 'warrior'; player.level = 7; player.mojicoins = 1234;
    if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow();
    return localStorage.getItem(SAVE_KEY);
  });
  check(!!good && good.length > 200 && !errs.length, 'a real save was written', `${good ? good.length : 0} bytes under ${first.key}`);
  const cases = { garbage: 'xx{not json', truncated: good.slice(0, Math.floor(good.length / 2)), null: 'null', number: '42', empty: '', oldVersion: '{"v":0,"player":{"cls":"warrior","level":3,"mojicoins":77}}' };   // SAVE_VERSION is 1: v:0 is the schema-mismatch path
  for (const [name, raw] of Object.entries(cases)) {
    await park(raw);
    const r = await boot();
    // tiny non-saves ('', 'null', '42') carry nothing worth keeping; anything longer must survive somewhere
    const kept = r.stored === raw || (r.recover != null && r.recover === raw) || raw.length <= 4;
    check(!errs.length && r.menu !== false, `${name}: boots to the menu with no runtime error`, errs.slice(0, 2).join(' | ') || `menu ${r.menu}`);
    check(kept, `${name}: the damaged data is kept (untouched or copied to ${first.key}_recover), never silently discarded`, `stored ${r.stored == null ? 'null' : r.stored.length + 'b'}, recover ${r.recover == null ? 'none' : r.recover.length + 'b'}`);
  }
  // restore the good save and confirm it still loads
  await park(good);
  const back = await boot();
  const loaded = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.player && s.player.cls === 'warrior' && s.player.level === 7; } catch (e) { return false; } });
  check(loaded && !errs.length, 'the good save is intact afterwards and boots clean', errs.slice(0, 2).join(' | ') || 'ok');
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
