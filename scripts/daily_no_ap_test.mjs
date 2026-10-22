// Daily challenges pay Mojicoins only: no AP / SP (no-daily-ap).
//   node scripts/daily_no_ap_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Per user: "there should not be a daily pool +1 AP". Eight of the eleven challenges added skillPoints (+1 or +2) the moment their goal was met, with a toast that never named it; for the
// low-level heroes who can still swap class they were most of the pool (Lv 1-5: 2 days in 3), so a hero would find one AP more than it had earned.
// Every challenge in DAILY_CHALLENGES is completed through the real tickDaily and the hero's AP and Mojicoins are read before and after.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10600';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let R = null; const errs = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof tickDaily === 'function' && typeof DAILY_CHALLENGES !== 'undefined' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    applyClass('warrior'); player.level = 25; player.skillPoints = 9;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    loadMap('town'); await new Promise((s) => setTimeout(s, 1500));
    const out = { table: DAILY_CHALLENGES.map((c) => ({ id: c.id, reward: Object.keys(c.reward || {}), coins: c.reward && c.reward.mojicoins })), each: [] };
    for (const c of DAILY_CHALLENGES) {
      player.skillPoints = 9; const coins0 = (player.mojicoins || 0) + (player.bankBalance || 0);
      const seen = c.track === 'visit' || c.track === 'talk' ? Array.from({ length: c.goal - 1 }, (_, i) => 'x' + i) : [];
      game.dailyState = { day: dailyIndex(), streak: 1, challenge: c.id, progress: c.goal - 1, claimed: false, seenMaps: c.track === 'visit' ? seen.slice() : [], seenNpcs: c.track === 'talk' ? seen.slice() : [] };
      const arg = c.track === 'level' || c.track === 'combo' ? c.goal : c.track === 'boss' ? (c.target || 'gravitos') : c.track === 'visit' ? 'x_final' : c.track === 'talk' ? 'npc_final' : undefined;
      tickDaily(c.track, arg);
      out.each.push({ id: c.id, track: c.track, claimed: !!game.dailyState.claimed, ap: player.skillPoints, coinsUp: (player.mojicoins || 0) + (player.bankBalance || 0) - coins0, held: (game._heldCoins || game._coinHold || 0) });
    }
    // the plain way: Defeat 10 enemies, ten kills
    player.skillPoints = 9; game.dailyState = { day: dailyIndex(), streak: 1, challenge: 'kill10', progress: 0, claimed: false, seenMaps: [], seenNpcs: [] };
    for (let i = 0; i < 10; i++) tickDaily('kills');
    out.kill10 = { claimed: !!game.dailyState.claimed, ap: player.skillPoints, progress: game.dailyState.progress };
    return out;
  });
} finally { await browser.close(); srv.kill(); }
if (!R) { check(false, 'the harness produced results', errs.slice(0, 3)); process.exit(1); }
const withAp = R.table.filter((c) => c.reward.some((k) => k !== 'mojicoins'));
check(R.table.length >= 10 && withAp.length === 0, 'no daily challenge carries anything but Mojicoins in its reward (it was sp: 1 or 2 on eight of them)', { challenges: R.table.length, withAp });
check(R.table.every((c) => c.coins > 0), 'every daily still pays Mojicoins', R.table.filter((c) => !(c.coins > 0)));
const notDone = R.each.filter((e) => !e.claimed); check(notDone.length === 0, 'every challenge completes through the real tickDaily', notDone);
const paid = R.each.filter((e) => e.ap !== 9); check(paid.length === 0, 'completing any of them leaves the hero\'s AP exactly where it was', paid.map((e) => `${e.id}: 9 -> ${e.ap}`));
check(R.kill10.claimed && R.kill10.ap === 9, '"Defeat 10 enemies": ten kills complete it and AP stays 9', R.kill10);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
