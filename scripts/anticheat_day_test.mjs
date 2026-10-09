// ANTI-CHEAT LAYER 5 - daily rewards follow the server's date (_lxServerTime). Two signed saves are made on localhost: one
// whose daily state is YESTERDAY, one whose daily state is TODAY. Then, each in a fresh browser:
//   [1] public host, honest clock, yesterday's save: a new day opens as always
//   [2] public host, PC clock two days ahead, today's save: no new day opens - the day comes from the server
//   [3] localhost (a developer's machine), clock two days ahead: the PC clock still rules there, as before
//   [4] public host, clock ahead, the server's time unreachable: after the 4 s wait it falls back to the PC clock (never stuck)
//   [5] no page errors
//   node scripts/anticheat_day_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11887), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [], DAY = 86400000;
const menu = (page) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
const open = async (host, save, shiftDays, block) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(`(() => { try { const real = Date.now.bind(Date), sh = ${shiftDays * DAY}; if (sh) Date.now = () => real() + sh;
    localStorage.setItem('mojiworld_prologue_seen', '1');
    if (${JSON.stringify(!!save)} && !sessionStorage.getItem('lx_seeded')) { sessionStorage.setItem('lx_seeded', '1');
      localStorage.setItem('levelx_save_v1', ${JSON.stringify(save ? save.save : '')}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(save ? save.mark : '')}); } } catch (e) {} })();`);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  if (block) await page.route(/[?&]lxt=/, (r) => r.abort());
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  return { ctx, page };
};
const enterAndRead = async (page) => {
  await page.click('#menu-continue', { timeout: 150000 });
  await page.waitForFunction(() => player.level === 12 && game.mapData, null, { timeout: 120000 });
  await page.waitForTimeout(6500);
  return page.evaluate(() => ({ day: game.dailyState && game.dailyState.day, sv: (typeof _lxServerTime === 'object' && _lxServerTime.now()) || null, pc: Date.now() }));
};
try {
  const L = await open('localhost', null, 0);
  const made = await L.page.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 12; player._tutorialSeen = true; checkDaily();
    const today = dailyIndex(); game.dailyState.day = today; _flushSaveStateNow();
    const B = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
    game.dailyState.day = today - 1; _flushSaveStateNow();
    const A = { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') };
    return { today, A, B };
  });
  const T = made.today;
  const p1 = await open('play.mojiworld.test', made.A, 0); const r1 = await enterAndRead(p1.page);
  ok('[1] honest clock: a new day opens as always', r1.day === T, { today: T, r1 });
  const p2 = await open('play.mojiworld.test', made.B, 2); const r2 = await enterAndRead(p2.page);
  ok('[2] PC clock two days ahead: no new day - the day comes from the server', r2.day === T && r2.sv != null && Math.floor(r2.sv / DAY) === T, { today: T, r2 });
  const l2 = await open('localhost', made.B, 2); const r3 = await enterAndRead(l2.page);
  ok('[3] on a developer machine the PC clock still rules, as before', r3.day === T + 2, { today: T, r3 });
  const p4 = await open('play.mojiworld.test', made.B, 2, true); const r4 = await enterAndRead(p4.page);
  ok('[4] server time unreachable: it falls back to the PC clock after the wait, never stuck', r4.day === T + 2 && r4.sv == null, { today: T, r4 });
  ok('[5] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
