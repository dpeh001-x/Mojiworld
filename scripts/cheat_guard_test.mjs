// CHEAT GUARD (v0.30.917 bug audit). A hand-edited save imported through Settings used to unlock every Steam achievement
// ~1.5 s after the reload (boot pushes every stored achievement; achievements were not signed; the verdict was never read).
// Driven through the real Import path with a stubbed Steam: an edited signed save, an unsigned save with "_god": true,
// and the player's own honest save; plus the dev gate on the Steam app's loopback port and the main-process allowlist.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/cheat_guard_test.mjs [page.html] [path/to/steam/main.js]
import { createRequire } from 'node:module'; import path from 'node:path'; import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11311';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// v0.30.x — the main.js path is the argument that IS a .js file: run_all_tests hands page-taking suites
// ['mojiworld_game.html', <port>], and the port in this slot read as a file path ("...\8080", ENOENT).
const cand = args[0], MAIN = path.resolve(args.slice(1).find((a) => /\.js$/i.test(a)) || path.join(ROOT, 'steam', 'main.js'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
const server2 = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), '47821'], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const STEAM = () => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  const rec = (k, v) => { try { const a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(v); localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} };
  window.SteamAPI = { available: true, achievement: { unlock: async (n) => { rec('stub_unlocks', n); return true; } }, stats: { set: async (o) => { rec('stub_stats', o); return true; } },
    cloud: { read: async () => null, write: async () => true, writeSync: () => true }, presence: { set: async () => true, clear: async () => true } };
};
const boot = async (page) => { await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 }); };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(STEAM);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
  // an honest hero with two real achievements, saved and signed by the game
  const own = await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 12; player._tutorialSeen = true; player.mojicoins = 5000;
    game.achievements = { firstBlood: 1, slayer100: 1 };
    _flushSaveStateNow(); return localStorage.getItem(SAVE_KEY);
  });
  const doImport = async (text) => {
    await page.evaluate(() => { localStorage.removeItem('stub_unlocks'); localStorage.removeItem('stub_stats'); });
    const nav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.evaluate((text) => { window.uiConfirm = () => Promise.resolve(true); importSave({ files: [new File([text], 'save.json')], value: '' }); }, text);
    await nav; await boot(page); await page.waitForTimeout(3500);
    return page.evaluate(() => ({ unlocks: JSON.parse(localStorage.getItem('stub_unlocks') || '[]'), stats: JSON.parse(localStorage.getItem('stub_stats') || '[]'),
      god: !!player._god, coins: player.mojicoins | 0, verdict: game._saveVerdict || null, imp: game._importVerdict || null, base: game._steamAchBaseline || null }));
  };
  const ALL = ['lv100', 'prestige1', 'zodiacSlayer', 'gravitosDown'];
  // 1. the exploit: the player's own signed save with achievements typed in
  const edited = JSON.parse(own); edited.game.achievements = Object.assign({}, edited.game.achievements); for (const a of ALL) edited.game.achievements[a] = 1;
  const r1 = await doImport(JSON.stringify(edited));
  check(!r1.unlocks.some((u) => ALL.includes(u)), 'achievements typed into a signed save never reach Steam', J(r1));
  // 1b. the laundering path: an older (ls2) signature never covered achievements. Typed into the stored save, they load
  // as 'legacy', the next save re-signs them, and the boot after that used to push them all.
  const ls2 = await page.evaluate((own) => { if (typeof _lxLocalSaveSigBody2 !== 'function') return null;
    const s = JSON.parse(own); s.game.achievements = Object.assign({}, s.game.achievements, { lv100: 1, prestige1: 1 });
    s.sig = _lxHmacSaveHex(_lxLocalSaveSigBody2(s)); window._flushSaveStateNow = () => {}; window.saveState = () => {};
    localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; }, own);
  let r1b = { skipped: 'no ls2 body on this build' };
  if (ls2) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page);
    const v1 = await page.evaluate(() => { const v = game._saveVerdict; _flushSaveStateNow(); return v; });
    await page.evaluate(() => { localStorage.removeItem('stub_unlocks'); });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(page); await page.waitForTimeout(3500);
    r1b = await page.evaluate((v1) => ({ v1, v2: game._saveVerdict, unlocks: JSON.parse(localStorage.getItem('stub_unlocks') || '[]') }), v1);
  }
  check(ls2 && r1b.v1 === 'legacy' && r1b.v2 === 'ok' && !r1b.unlocks.includes('lv100') && !r1b.unlocks.includes('prestige1'),
    'achievements typed into an ls2-signed save are not pushed once it re-signs', J(r1b));
  // 2. an unsigned save with god mode and a fortune
  const plain = JSON.parse(own); delete plain.sig; plain.player._god = true; plain.player.mojicoins = 99999999; plain.game.achievements = { lv100: 1 };
  const r2 = await doImport(JSON.stringify(plain));
  check(!r2.god, 'a save cannot switch god mode on ("_god" is not a saved field)', J({ god: r2.god }));
  check(r2.coins < 1000 && r2.imp === 'unverified' && r2.unlocks.length === 0 && r2.stats.length === 0, 'an unsigned import loses its currencies (the login bonus aside) and never talks to Steam', J(r2));
  // 3. the honest save: loads clean, its own achievements are not re-pushed, a newly earned one is
  const r3 = await doImport(own);
  const live = await page.evaluate(async () => { localStorage.removeItem('stub_unlocks'); _lxSteamUnlock('exterminator'); await new Promise((r) => setTimeout(r, 200)); return JSON.parse(localStorage.getItem('stub_unlocks') || '[]'); });
  check(r3.verdict === 'ok' && r3.imp === 'ok' && r3.coins >= 5000 && J(r3.base) === J(['firstBlood', 'slayer100']) && !r3.unlocks.includes('firstBlood') && !r3.unlocks.includes('slayer100') && live.includes('exterminator'),
    'the honest save imports whole; its own achievements are not re-pushed, and ones earned after it still unlock', J({ r3, live }));
  // 4. the dev gate: the Steam app's loopback port is not a developer surface, the password is not in the page
  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:47821/mojiworld_game.html?dev=1', { waitUntil: 'domcontentloaded', timeout: 180000 }); await boot(p2);
  const dv = await p2.evaluate(() => ({ surface: _lxDevSurface(), digest: typeof _lxDevPwOk === 'function', plain: /if \(pw === '/.test(document.documentElement.outerHTML) }));
  check(!dv.surface && dv.digest && !dv.plain, 'the Steam loopback port is no dev surface; the dev password is compared as a digest', J(dv));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
// 5. the Steam main process only unlocks shipped achievement names and sets the four stats
try { const m = readFileSync(MAIN, 'utf8'); check(/_lxAchIds && !_lxAchIds\.has\(String\(name\)\)/.test(m) && /_LX_STAT_KEYS\.has\(k\)/.test(m), 'steam/main.js allowlists achievement names and stat keys', MAIN); }
catch (e) { check(false, 'steam/main.js readable', e.message); }
await browser.close(); server.kill(); server2.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
