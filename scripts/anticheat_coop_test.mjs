// ANTI-CHEAT LAYER 6 - a co-op guest's damage budget against a boss (_coopHostApplyDamage). In one page acting as the host,
// guest hits are fed to the host's own handler for a test boss, a mini-boss and an ordinary monster:
//   [1] a guest sending 60 half-bar hits in under a second removes no more than the budget (a quarter of the bar + the refill)
//   [2] the budget refills: at an honest pace (2% of the bar every 0.2 s for 4 s) every hit lands in full
//   [3] each guest has its own budget; [4] mini-bosses and ordinary monsters keep the old caps (no budget)
//   [5] no page errors
//   node scripts/anticheat_coop_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11891), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _coopHostApplyDamage === 'function' && typeof applyClass === 'function' && game.mapData, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); game.paused = true;   // the sim stays out of it: only the handler touches these monsters
    net.isHost = true; net.peers = { pA: { id: 'pA', level: 40, x: 300, map: game.currentMap }, pB: { id: 'pB', level: 40, x: 300, map: game.currentMap } };
    const mk = (uid, flags) => Object.assign({ uid, type: 'acTest', name: 'Test', level: 40, maxHp: 100000, currentHp: 100000, x: 400, y: 300, w: 60, h: 60, facing: 1, invulnerable: 0 }, flags);
    // boss: true is the budget's flag without isBoss's ward / break-meter mechanics, which change damage on their own
    const boss = mk('acBoss', { boss: true }), boss2 = mk('acBoss2', { boss: true }), mini = mk('acMini', { isMiniBoss: true }), mob = mk('acMob', {});
    game.monsters = [boss, boss2, mini, mob];
    // [1] a burst: 60 half-bar hits as fast as packets can come
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) _coopHostApplyDamage('acBoss', 50000, false, null, null, 'pA');
    const burstTook = 100000 - boss.currentHp, burstMs = performance.now() - t0;
    // [3] another guest on the same boss starts with its own full budget
    const before3 = boss.currentHp; _coopHostApplyDamage('acBoss', 50000, false, null, null, 'pB'); const pBTook = before3 - boss.currentHp;
    // [2] an honest pace on a fresh boss: 2% of the bar every 0.2 s for 4 s
    let applied = 0, sent = 0;
    for (let i = 0; i < 20; i++) { const h = boss2.currentHp; _coopHostApplyDamage('acBoss2', 2000, false, null, null, 'pA'); applied += h - boss2.currentHp; sent += 2000; await sleep(200); }
    // [4] mini-boss and ordinary monster: no budget, the old caps
    for (let i = 0; i < 3; i++) _coopHostApplyDamage('acMini', 30000, false, null, null, 'pA');
    for (let i = 0; i < 1; i++) _coopHostApplyDamage('acMob', 999999, false, null, null, 'pA');
    net.isHost = false; net.peers = {}; game.monsters = [];
    return { burstTook, burstMs, pBTook, applied, sent, miniHp: mini.currentHp, mobHp: mob.currentHp };
  });
  const allow = 25000 + 20000 * (R.burstMs / 1000) + 2;
  ok('[1] 60 half-bar hits in a burst remove no more than the budget', R.burstTook <= allow && R.burstTook >= 24000, R);
  ok('[2] at an honest pace every hit lands in full', R.applied === R.sent, { applied: R.applied, sent: R.sent });
  ok('[3] each guest has its own budget', R.pBTook >= 24000 && R.pBTook <= 25001, { pBTook: R.pBTook });
  ok('[4] mini-bosses and ordinary monsters keep the old caps (no budget)', R.miniHp <= 10000 && R.mobHp <= 0, { miniHp: R.miniHp, mobHp: R.mobHp });
  ok('[5] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
