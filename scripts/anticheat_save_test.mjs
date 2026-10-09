// ANTI-CHEAT LAYER 3 - the save itself (_lxAc: sq + the IndexedDB copy, sig5). On a PUBLIC host (the anti-cheat is off on
// localhost), with a signed save loaded by a real click on Continue:
//   [1] a flush writes sq + sig5, the verified copy notes s5, and the newest save is kept in IndexedDB
//   [2] an OLD save put back (with its own verified copy) loads the newest instead, and marks the save
//   [3] the save EDITED in storage (coins changed, same timestamp) loads the untouched copy instead
//   [4] with the IndexedDB copy gone, an edit outside the ls3 fields is caught by sig5 ('bad' -> restored, marked)
//   [5] a save written by an OLDER build (no sq, no sig5, newer timestamp) is kept as it is, nothing logged
//   [6] a backup restored through Save Backups (real clicks) loads the backup - an older save, on purpose - and is not undone
//   [7] no page errors
//   node scripts/anticheat_save_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11883), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 500) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const menu = (page) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
const enter = async (page) => { await page.click('#menu-continue', { timeout: 30000 }); await page.waitForFunction(() => player.level === 12 && game.mapData, null, { timeout: 120000 }); await page.waitForTimeout(800); };
// a reload can be followed by the anti-cheat's own (the newest save put back): settle until the title menu stays up
const reload = async (page) => { await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  for (let i = 0; i < 4; i++) { try { await menu(page); await page.waitForTimeout(2500); await menu(page); return; } catch (e) { await page.waitForTimeout(1500); } } };
const clean = (page) => page.evaluate(async () => { _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 500)); });
const stored = (page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { sq: s.sq, t: s.t, coins: s.player.mojicoins, sig5: !!s.sig5 }; });
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
  await ctx.addInitScript(`(() => { try { if (!sessionStorage.getItem('lx_t_seeded')) { sessionStorage.setItem('lx_t_seeded', '1'); localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } } catch (e) {} })();`);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://play.mojiworld.test:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  await enter(page);
  // [1]
  const f1 = await page.evaluate(async () => { _lxCreateBackup('before'); _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 400));
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)), m = JSON.parse(localStorage.getItem(SAVE_KEY + '_verified'));
    const copy = await new Promise((res) => { const r = indexedDB.open('lx_ac', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('save'); q.onsuccess = () => { res(q.result || null); r.result.close(); }; }; r.onerror = () => res(null); });
    return { sq: s.sq, sig5: !!s.sig5, s5: m.s5, copySame: !!copy && copy.json === localStorage.getItem(SAVE_KEY), raw: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
  });
  ok('[1] a flush writes sq + sig5, the verified copy notes s5, and the newest save is kept in IndexedDB', f1.sq >= 1 && f1.sig5 && f1.s5 === 1 && f1.copySame, { sq: f1.sq, sig5: f1.sig5, s5: f1.s5, copySame: f1.copySame });
  // a newer save, then the old one put back with its own verified copy
  const sqNew = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 20)); _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 400)); return JSON.parse(localStorage.getItem(SAVE_KEY)).sq; });
  await page.evaluate(([raw, mark]) => { game._resetting = true; localStorage.setItem(SAVE_KEY, raw); localStorage.setItem(SAVE_KEY + '_verified', mark); }, [f1.raw, f1.mark]);
  await reload(page); await enter(page);
  const r2 = await page.evaluate(() => ({ sq: JSON.parse(localStorage.getItem(SAVE_KEY)).sq, log: _lxAcReport(), dev: game._devTouched }));
  ok('[2] an old save put back loads the newest instead, and marks the save', r2.sq === sqNew && r2.log.some((e) => e.kind === 'save' && e.field === 'rolled back') && r2.dev === 'ac', { sqNew, r2 });
  // [3] edited in storage, same timestamp
  await clean(page);
  const before = await stored(page);
  await page.evaluate(() => { game._resetting = true; const s = JSON.parse(localStorage.getItem(SAVE_KEY)); s.player.mojicoins = 9999999; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); });
  await reload(page); await enter(page);
  const r3 = await page.evaluate(() => ({ coins: player.mojicoins, log: _lxAcReport() }));
  ok('[3] the save edited in storage loads the untouched copy instead', r3.coins < 9999999 && r3.coins >= before.coins && r3.log.some((e) => e.kind === 'save' && e.field === 'edited'), { before, r3 });
  // [4] no IndexedDB copy: sig5 alone
  await clean(page);
  await page.evaluate(async () => { game._resetting = true; const s = JSON.parse(localStorage.getItem(SAVE_KEY)); s.player.mastery = { snail: 99999 }; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); indexedDB.deleteDatabase('lx_ac'); });
  await reload(page); await enter(page);
  const r4 = await page.evaluate(() => ({ verdict: game._saveVerdict, log: _lxAcReport(), dev: game._devTouched }));
  ok('[4] with the copy gone, an edit outside the ls3 fields is caught by sig5', r4.log.some((e) => e.kind === 'save' && /whole-save/.test(e.field)) && r4.verdict === 'restored' && r4.dev === 'ac', r4);
  // [5] an older build's save: no sq, no sig5, newer timestamp, signed the ls3 way, with that build's verified copy
  await page.evaluate(async () => { _flushSaveStateNow(); await new Promise((r) => setTimeout(r, 400));
    game._resetting = true; const s = JSON.parse(localStorage.getItem(SAVE_KEY)); delete s.sq; delete s.sig5; s.t = Date.now() + 5000; s.player.mojicoins = 777; s.sig = _lxLocalSaveSig(s);
    localStorage.setItem(SAVE_KEY, JSON.stringify(s)); _lxSaveMarkWrite(s); });
  await reload(page); await enter(page);
  const r5 = await page.evaluate(() => ({ coins: player.mojicoins, log: _lxAcReport() }));
  ok('[5] a save written by an older build (newer timestamp) is kept as it is, nothing logged', r5.coins >= 777 && r5.coins < 900 && r5.log.length === 0, r5);
  // [6] Save Backups, by real clicks: the backup made at [1] (an older save) comes back and stays
  await clean(page);
  await page.evaluate(() => { openBackupModal(); });
  await page.waitForTimeout(400);
  const bk = page.locator('#backup-slots .bk-restore').first();
  await bk.click({ timeout: 10000 }); await page.waitForTimeout(300); await bk.click({ timeout: 10000 });
  await page.waitForTimeout(2500); for (let i = 0; i < 4; i++) { try { await menu(page); break; } catch (e) { await page.waitForTimeout(1500); } } await page.waitForTimeout(2500); await menu(page); await enter(page);
  const r6 = await page.evaluate(() => ({ coins: player.mojicoins, log: _lxAcReport() }));
  ok('[6] a backup restored through Save Backups loads and is not undone', r6.coins >= 5000 && r6.coins < 6000 && !r6.log.some((e) => e.kind === 'save'), r6);
  ok('[7] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
