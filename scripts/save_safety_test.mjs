// SAVE SAFETY (v0.30.890 launch audit). A fake Steam Cloud (window.SteamAPI.cloud over a localStorage key, so it survives
// reloads) replays a backup restore, a second restore in the same window, and New Game: none may be undone by the cloud
// copy, and saving must keep working. Then, without Steam: four fields that were written but never saved round-trip; a
// backup under a full storage fails honestly and keeps the slots already stored; a save that will not load is filed in
// Save Backups; ascension is not offered inside an Expedition.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/save_safety_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11197';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const URL0 = `http://localhost:${PORT}/mojiworld_game.html`;
const booted = (page) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none' && m.getBoundingClientRect().height > 0; }, null, { timeout: 180000 });
const settle = async (page) => { for (let i = 0; i < 3; i++) { await page.waitForLoadState('domcontentloaded').catch(() => {}); await booted(page).catch(() => {}); await page.waitForTimeout(3500); } };
const lvOf = (page, key) => page.evaluate((key) => { try { const s = JSON.parse(localStorage.getItem(key === 'cloud' ? '__fakecloud_' + SAVE_KEY : SAVE_KEY) || 'null'); return s && s.player ? s.player.level : (s && s._lxWiped ? 'wiped' : null); } catch (e) { return 'bad'; } }, key);
const hero = (page, lv) => page.evaluate((lv) => { for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) { try { applyClass('warrior'); } catch (e) {} } player.name = player.name || 'Probe'; player.level = lv; _flushSaveStateNow(); _lxSteamCloudPush(localStorage.getItem(SAVE_KEY), true); }, lv);
try {
  // ---------- Steam Cloud ----------
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { const K = (n) => '__fakecloud_' + n;
    window.SteamAPI = { available: true, cloud: { read: async (n) => localStorage.getItem(K(n)), write: async (n, c) => { localStorage.setItem(K(n), String(c)); return true; }, writeSync: (n, c) => { localStorage.setItem(K(n), String(c)); return true; } } }; });
  const page = await ctx.newPage();
  await page.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 180000 }); await booted(page); await page.waitForTimeout(1500);
  await hero(page, 30); await page.waitForTimeout(4300);
  await page.reload({ waitUntil: 'domcontentloaded' }); await settle(page);
  const bid = await page.evaluate(() => { _lxCreateBackup('probe Lv30'); const b = _lxGetBackups().find((x) => x && x.label === 'probe Lv30'); return b && b.id; });
  await page.waitForTimeout(4300); await hero(page, 35); await page.waitForTimeout(800);
  const before = { local: await lvOf(page, 'local'), cloud: await lvOf(page, 'cloud') };
  await page.evaluate((id) => _lxRestoreBackup(id), bid); await page.waitForTimeout(1200); await settle(page);
  const r1 = { local: await lvOf(page, 'local'), cloud: await lvOf(page, 'cloud'), live: await page.evaluate(() => player.level) };
  check(before.local === 35 && r1.local === 30 && r1.live === 30 && r1.cloud === 30, 'Steam: a restored backup stays restored (the cloud copy used to win the next boot)', J({ before, after: r1 }));
  await page.evaluate((id) => _lxRestoreBackup(id), bid); await page.waitForTimeout(1200); await settle(page);
  await page.evaluate(() => { player.level = 44; saveState(); }); await page.waitForTimeout(2600);
  const r2 = { resetting: await page.evaluate(() => !!game._resetting), local: await lvOf(page, 'local') };
  check(!r2.resetting && r2.local === 44, 'Steam: after a second restore in one window, saving still works', J(r2));
  await page.evaluate(() => { game._resetting = true; clearSave(); location.reload(); }); await page.waitForTimeout(1200); await settle(page);
  const r3 = { local: await lvOf(page, 'local'), cloud: await lvOf(page, 'cloud') };
  check(r3.local === null && r3.cloud === 'wiped', 'Steam: New Game / Erase is not undone - the wiped hero does not come back from the cloud', J(r3));
  await ctx.close();
  // ---------- no Steam ----------
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const p2 = await ctx2.newPage();
  await p2.goto(URL0, { waitUntil: 'domcontentloaded', timeout: 180000 }); await booted(p2); await p2.waitForTimeout(1500);
  await hero(p2, 50);
  await p2.evaluate(() => { player._qBank = { q_probe: { progress: 3 } }; player._zodiacEchoKills = { zodiac_leo: 2 }; player._coopReviveMapAt = { town: 123 }; player._iceFloorBest = 7; _flushSaveStateNow(); });
  await p2.reload({ waitUntil: 'domcontentloaded' }); await settle(p2);
  const f = await p2.evaluate(() => ({ q: player._qBank, z: player._zodiacEchoKills, c: player._coopReviveMapAt, i: player._iceFloorBest }));
  check(f.q && f.q.q_probe && f.z && f.z.zodiac_leo === 2 && f.c && f.c.town === 123 && f.i === 7, 'abandoned-quest progress, the zodiac-echo ladder, the co-op revive clock and the ice-tower best survive a reload', J(f));
  const bk = await p2.evaluate(() => {
    for (let i = 0; i < 3; i++) _lxCreateBackup('slot ' + i);
    const before = _lxGetBackups().length; const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === BACKUP_KEY && String(v).length > 2) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return orig.call(this, k, v); };
    let ret; try { ret = _lxCreateBackup('under a full storage'); } finally { Storage.prototype.setItem = orig; }
    return { before, after: _lxGetBackups().length, ret, toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).slice(-1)[0] };
  });
  check(bk.before >= 3 && bk.after === bk.before && bk.ret === false && /FAILED/.test(bk.toast || ''), 'a backup under a full storage says it failed and keeps the slots already stored (it deleted them all)', J(bk));
  const ul = await p2.evaluate(() => {
    const raw = localStorage.getItem(SAVE_KEY); const k = window.applyKeybinds; window.applyKeybinds = () => { throw new Error('probe'); };
    let ok; try { ok = loadState(); } catch (e) { ok = 'threw'; } window.applyKeybinds = k;
    return { ok, slot: _lxGetBackups().some((b) => b && b.label === 'auto · could not load' && b.data === raw) };
  });
  check(ul.ok === false && ul.slot, 'a save that will not load is filed in Save Backups ("could not load")', J(ul));
  const asc = await p2.evaluate(() => {
    player.level = 100; game._prestigeOffered = false; game.expedition = { active: true };
    try { offerPrestige(true); } catch (e) {}
    const offered = !!game._prestigeOffered; game.expedition = null; try { closeAllModals(); } catch (e) {}
    return { offered };
  });
  check(!asc.offered, 'ascension is not offered inside an Expedition (the run-end restore undid its reset)', J(asc));
  await ctx2.close();
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
