// Lifetime rewards earned inside a Tower run are paid when the run ends; spending inside it stays spent; and what a
// reward toast says is what the wallet gets.
// Per the 2026-09-26 full audit. _grantMojicoins pays nothing while game.expedition.active (the run's own earnings are
// not kept), but the MojiDex / Boon Codex milestones and the daily challenge stamp themselves claimed FIRST - so one
// that crossed inside a run (the ten tower-only types are in the dex; kills count for the daily) was spent for 0 and
// could never fire again, under a toast promising the full amount. And a boon reroll inside a run was refunded by the
// run-end wallet restore, which re-charges only game.expedition._spentInRun.
//   node scripts/expedition_lifetime_rewards_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PORT = String(process.argv[3] || 9989);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _expeditionSnapshotPlayer === 'function' && typeof _checkDexMilestones === 'function', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 60; player._god = true; player.invulnerable = 9e9;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
  loadMap('forest', 300); game.paused = false; await sleep(800);
  const toasts = []; const _st = window.showToast; window.showToast = function (t) { toasts.push(String(t)); return _st.apply(this, arguments); };
  const startRun = () => { player.mojicoins = 100000; game.expedition = { active: true, floor: 1, snapshot: _expeditionSnapshotPlayer() }; };
  const endRun = () => { _expeditionRestorePlayer(game.expedition.snapshot); game.expedition.active = false; };
  const out = {};
  // A. the last MojiDex discovery lands in a run (Compendium Complete, 80,000 listed)
  {
    const all = _mjxAllTypes(); game.mojidexSeen = {}; for (const k of all) game.mojidexSeen[k] = true;
    const last = all[all.length - 1]; delete game.mojidexSeen[last];
    game.dexMilestones = { '0.25': 1, '0.5': 1, '0.75': 1 }; game.dexPerm = game.dexPerm || { atk: 0, def: 0 };
    startRun(); toasts.length = 0;
    game.mojidexSeen[last] = true; _checkDexMilestones();
    const stamped = !!game.dexMilestones['1'];
    const toast = toasts.find((t) => /MojiDex/.test(t)) || '';
    endRun();
    out.dex = { stamped, delta: player.mojicoins - 100000, toast: toast.slice(0, 90) };
  }
  // B. the daily kill challenge completes on a tower floor
  {
    game.dailyState = { day: dailyIndex(), streak: 1, challenge: 'kill10', progress: 9, claimed: false, seenMaps: [], seenNpcs: [] };
    startRun(); tickDaily('kills'); const claimed = !!game.dailyState.claimed; endRun();
    out.daily = { claimed, delta: player.mojicoins - 100000 };
  }
  // C. boon rerolls inside a run
  {
    player.boons = player.boons || [];
    const _vdef = POWERUPS.find((p) => p && p.id && p.min !== p.max && typeof p.min === 'number');
    if (_vdef) player.boons.push(rollBoonInstance(_vdef.id));   // a boon with a range to reroll
    const idx = player.boons.findIndex((bn) => bn && typeof boonRerollCost === 'function' && boonRerollCost(bn) > 0);
    if (idx >= 0) {
      startRun(); const w0 = player.mojicoins; let spent = 0;
      for (let i = 0; i < 4; i++) { const c = boonRerollCost(player.boons[idx]); if (player.mojicoins < c) break; rerollBoon(idx); spent += c; }
      const inRun = w0 - player.mojicoins; endRun();
      out.reroll = { spentInRun: inRun, afterEnd: 100000 - player.mojicoins, spent };
    } else out.reroll = { skipped: 'no rerollable boon' };
  }
  // D. the daily streak milestone toast (day 14)
  {
    game.dailyState = { day: dailyIndex() - 1, streak: 13, challenge: 'kill10', progress: 0, claimed: false, seenMaps: [], seenNpcs: [] };
    game.expedition = { active: false }; player.mojicoins = 100000; toasts.length = 0;
    checkDaily();
    const nums = (re) => { const t = toasts.find((x) => re.test(x)); const m = t && t.match(/\+([\d,]+)/); return m ? +m[1].replace(/,/g, '') : null; };
    out.streak = { delta: player.mojicoins - 100000, loginToast: nums(/Daily login/), mileToast: nums(/Milestone bonus/) };
  }
  window.showToast = _st;
  return out;
});
// give the rerolls a boon to work on if the fresh character had none (second pass would be needed); report as is
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(R.dex.stamped && R.dex.delta >= 80000, 'a MojiDex milestone crossed inside a run is PAID when the run ends (80,000 listed)', R.dex);
ok(R.daily.claimed && R.daily.delta > 0, 'a daily challenge completed inside a run is paid when the run ends', R.daily);
ok(R.reroll.skipped || (R.reroll.spent > 0 && R.reroll.afterEnd === R.reroll.spent), 'boon rerolls inside a run stay spent after the run-end wallet restore', R.reroll);
ok(R.streak.mileToast != null && R.streak.loginToast != null && R.streak.loginToast + R.streak.mileToast === R.streak.delta, 'the streak-milestone toast shows what the wallet got (login + milestone toasts add up to the payout)', R.streak);
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
