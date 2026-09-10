// v0.30.x — Two quest findings from a parallel audit.
//   1. Milo's "reset my papers" mid-chain re-paid every already-paid Ticket Rush stage at
//      full rate, forever: v0.30.407 stopped it counting as a repeat RUN but still deleted
//      the completion records the discount keyed off. Now keyed per STAGE, never wiped.
//   2. _lxRepairMirrorQuests credited any active mirror quest with a kill whenever the Lv20
//      trial was done - on boot, every level-up, and every Journal open - while
//      _lxNeedsMirrorSelf had already reopened the door so it could be fought. Auron paid
//      3200 coins for zero kills. The repair now yields to the open door.
//
//   node scripts/quest_repeat_and_mirror_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11261);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Qst');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  const STAGE = 'q_clockwork_underpass';
  out.stageIsChain = !!(typeof LX_PQ_CHAIN_IDS !== 'undefined' && LX_PQ_CHAIN_IDS[STAGE]);

  // ---- 1. Ticket Rush: the first payout is full, a re-earned stage is a repeat, restart keeps the record
  player._pqChainRuns = 0; player._pqStagePaid = {};
  out.firstRunMul = _lxPqRepeatMul(STAGE);
  player._pqStagePaid[STAGE] = 1;                    // what _completeQuest stamps when the stage pays
  out.paidAgainMul = _lxPqRepeatMul(STAGE);
  out.finaleUnpaidStillFull = _lxPqRepeatMul('q_pq_finale');   // a stage never paid stays full
  // a mid-chain restart must not wipe the record (it deletes completed[] on purpose)
  player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {}; player.quests.active = player.quests.active || {}; player.quests.unlocked = player.quests.unlocked || {};
  try { _lxPqRestartChain(); } catch (e) { out.restartErr = String(e && e.message).slice(0, 80); }
  out.recordSurvivesRestart = !!(player._pqStagePaid && player._pqStagePaid[STAGE]);
  out.runsStillZero = (player._pqChainRuns | 0) === 0;   // v0.30.407 intent preserved: not a repeat RUN
  player._pqStagePaid = {}; player._pqChainRuns = 0;
  try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}

  // ---- 2. the Mirror repair must not complete a live, fightable mirror quest
  const mid = Object.keys(QUESTS).find((id) => QUESTS[id] && QUESTS[id].target === 'mirrorSelf' && id !== 'q_inner_dim_trial') || null;
  out.mirrorQuest = mid;
  if (mid) {
    player.quests.completed.q_inner_dim_trial = player.quests.completed.q_inner_dim_trial || Date.now();
    delete player.quests.completed[mid];
    player.quests.active[mid] = { progress: 0, targetCount: 1 };
    out.doorOpen = (typeof _lxNeedsMirrorSelf === 'function') ? _lxNeedsMirrorSelf() : null;
    _lxRepairMirrorQuests();
    out.progressAfterRepair = player.quests.active[mid] ? (player.quests.active[mid].progress | 0) : -1;
    out.completedByRepair = !!player.quests.completed[mid];
    delete player.quests.active[mid]; delete player.quests.completed[mid];
  }
  return out;
});

const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const stamped = html.includes("player._pqStagePaid[id] = 1;");
const persisted = html.includes("'_pqStagePaid',") && html.includes("'_pqChainRuns','_pqStagePaid']");

console.log(JSON.stringify({ ...r, stamped, persisted }));
const checks = [
  ['harness: the stage is a Ticket Rush chain quest', r.stageIsChain === true],
  ['a never-paid stage pays in full', r.firstRunMul === 1],
  ['a stage that already paid pays repeat rates', r.paidAgainMul !== 1 && r.paidAgainMul > 0 && r.paidAgainMul < 1, 'mul=' + r.paidAgainMul],
  ['a different, never-paid stage is unaffected', r.finaleUnpaidStillFull === 1],
  ['a mid-chain restart keeps the per-stage record', r.recordSurvivesRestart === true, r.restartErr || ''],
  ['...and still does not count as a repeat RUN (v0.30.407 intent)', r.runsStillZero === true],
  ['_completeQuest stamps the record when a stage pays', stamped === true],
  ['the record is persisted alongside _pqChainRuns', persisted === true],
  ['harness: a fightable mirror quest exists and the door is open for it', r.mirrorQuest != null && r.doorOpen === true],
  ['the repair does NOT complete a live mirror quest', r.progressAfterRepair === 0 && r.completedByRepair === false, 'progress=' + r.progressAfterRepair],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
