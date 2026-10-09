// CLASS SWAP KEEPS THE CLASS LADDER (v0.30.1696). Reported 2026-10-09 with two videos: a Rogue turned Mage kept three Rogue
// ladder rows in the tracker ("Shallows Watch 0/360", ninja icons) and no kill could move them. The ladder (_CLASS_QUESTLINE)
// is q_<cls>_lv<N>, and tickQuestKill skips a row of another class; the pre-advancement swap left the old rows behind.
//   [1] a Rogue's ladder row counts its kills (the control)
//   [2] the real swap dialog (Rogue -> Mage): the rows become the Mage's with the same progress and targets, the done row stays done
//   [3] the tracker shows the Mage's icon, not the Rogue's, and Mage kills now count
//   [4] a save an older build stranded (a Mage holding Rogue rows), loaded on a PUBLIC host (anti-cheat on) by a real Continue
//       click: the rows are the Mage's, kills count, and the anti-cheat logs nothing
//   [5] no page errors
//   node scripts/class_swap_quests_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11935), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
// _lxBootMenuSeen: the title gate is really up (#lo-menu's own style is not hidden before it)
const menu = (page) => page.waitForFunction(() => typeof _lxAc === 'object' && window._lxBootMenuSeen, null, { timeout: 180000 });
const fresh = async (host, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  return page;
};
const LADDER = /^q_(warrior|rogue|mage|archer)_lv\d+$/;
const ladder = (page) => page.evaluate((src) => {
  const RX = new RegExp(src), A = player.quests.active, act = {};
  for (const k of Object.keys(A)) if (RX.test(k)) act[k] = (A[k].progress | 0) + '/' + A[k].targetCount;
  const done = Object.keys(player.quests.completed || {}).filter((k) => RX.test(k)).sort();
  try { renderQuestTracker(); } catch (e) {}
  return { cls: player.cls, act, done, tracker: ((document.getElementById('quest-tracker') || {}).innerText || '').replace(/\s+/g, ' ') };
}, LADDER.source);
// a kill through the game's own call (setTimeout -> killMonster): no harness frame on the stack, so the anti-cheat sees game code
const kill = (page, n) => page.evaluate(async (n) => {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const m = (game.monsters || []).find((x) => x && x.type === 'tidefish' && x.hp > 0 && !x._dying && !x._lxTestKill);
    if (!m) break; m._lxTestKill = true; setTimeout(killMonster, 0, m); k++;
  }
  await new Promise((r) => setTimeout(r, 600));
  return k;
}, n);
const rename = (act, from, to) => Object.fromEntries(Object.entries(act).map(([k, v]) => [k.replace('q_' + from + '_', 'q_' + to + '_'), v]));
const NINJA = String.fromCodePoint(0x1F977), ORB = String.fromCodePoint(0x1F52E);
try {
  const L = await fresh('localhost');
  // [1] a Lv 14 Rogue on the ladder at Sunset Coast: Long Meadow 12 in, Lv 12 done, Shallows Watch (Tidefish) and Lagoon taken
  await L.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('rogue'); player.level = 14; player._tutorialSeen = true;
    acceptQuest('q_rogue_lv10', true); player.quests.active.q_rogue_lv10.progress = 12;
    player.quests.completed.q_rogue_lv12 = Date.now();
    acceptQuest('q_rogue_lv13', true); acceptQuest('q_rogue_lv14', true);
    loadMap('sunsetBeach'); await new Promise((r) => setTimeout(r, 2500));
  });
  const r0 = await ladder(L), k1 = await kill(L, 2), r1 = await ladder(L);
  const p13 = (r) => parseInt(String(r.act.q_rogue_lv13 || r.act.q_mage_lv13 || '-1'), 10);
  ok('[1] a Rogue ladder row counts its kills (Shallows Watch, Tidefish)', k1 === 2 && p13(r1) === p13(r0) + 2 && r1.cls === 'rogue', { k1, before: r0.act, after: r1.act });
  // [2] the real swap dialog: others = [warrior, mage, archer] -> "See another path", then "Become Mage"
  await L.evaluate(() => _openPreAdvanceClassSwap());
  await L.waitForSelector('#confirm-no', { state: 'visible', timeout: 10000 }); await L.click('#confirm-no');
  await L.waitForFunction(() => /Mage/.test(document.getElementById('confirm-title').textContent) && getComputedStyle(document.getElementById('confirm-modal')).display !== 'none', null, { timeout: 10000 });
  await L.click('#confirm-yes'); await L.waitForTimeout(800);
  const r2 = await ladder(L);
  ok('[2] after the swap the rows are the Mage\'s, same progress and targets, and the done row stays done',
    r2.cls === 'mage' && JSON.stringify(r2.act) === JSON.stringify(rename(r1.act, 'rogue', 'mage')) && JSON.stringify(r2.done) === '["q_mage_lv12"]', { r1: r1.act, r2: r2.act, done: r2.done });
  const k3 = await kill(L, 2), r3 = await ladder(L);
  ok('[3] the tracker shows the Mage icon (not the Rogue\'s) and Mage kills count', r2.tracker.includes(ORB) && !r2.tracker.includes(NINJA) && k3 === 2 && p13(r3) === p13(r2) + 2,
    { k3, before: r2.act.q_mage_lv13, after: r3.act.q_mage_lv13, tracker: r2.tracker.slice(0, 160) });
  // [4] what an older build left behind: a Mage still holding the Rogue rows (written in one synchronous step, so no repair runs first)
  const made = await L.evaluate(() => {
    const A = player.quests.active, C = player.quests.completed;
    for (const n of [10, 13, 14]) { A['q_rogue_lv' + n] = A['q_mage_lv' + n]; delete A['q_mage_lv' + n]; }
    C.q_rogue_lv12 = C.q_mage_lv12; delete C.q_mage_lv12;
    _flushSaveStateNow();
    const s = localStorage.getItem(SAVE_KEY);
    return { save: s, mark: localStorage.getItem(SAVE_KEY + '_verified'), stranded: (() => { const p = JSON.parse(s).player, q = p.quests; return p.cls === 'mage' && !!q.active.q_rogue_lv13 && !q.active.q_mage_lv13 && !!q.completed.q_rogue_lv12 && !q.completed.q_mage_lv12; })() };
  });
  const P = await fresh('play.mojiworld.test', `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } catch (e) {} })();`);
  await P.click('#menu-continue', { timeout: 150000 });
  try { await P.waitForFunction(() => player.cls === 'mage' && player.level >= 14 && game.mapData, null, { timeout: 120000 }); }   // the kills above level the hero past 14
  catch (e) { throw new Error('the stranded save did not load: ' + JSON.stringify(await P.evaluate(() => ({ lvl: player.level, cls: player.cls, map: game.currentMap, hasMap: !!game.mapData, verdict: game._saveVerdict, log: _lxAcReport(), overlay: !!document.getElementById('loading-overlay'), recover: !!localStorage.getItem(SAVE_KEY + '_recover') })).catch((x) => String(x.message).slice(0, 80)))); }
  await P.waitForTimeout(1500);
  if (await P.evaluate(() => game.currentMap !== 'sunsetBeach')) { await P.evaluate(() => { setTimeout(loadMap, 0, 'sunsetBeach'); }); await P.waitForTimeout(2500); }
  const r4 = await ladder(P), k4 = await kill(P, 2), r4b = await ladder(P);
  const ac = await P.evaluate(() => ({ on: _lxAc.on, log: _lxAcReport(), dev: game._devTouched || null }));
  ok('[4] a save stranded by an older build is repaired on a public-host load: Mage rows, kills count, anti-cheat silent',
    made.stranded && ac.on && r4.cls === 'mage' && JSON.stringify(r4.act) === JSON.stringify(r3.act) && JSON.stringify(r4.done) === '["q_mage_lv12"]'
      && k4 === 2 && p13(r4b) === p13(r4) + 2 && !ac.log.length && ac.dev !== 'ac',
    { stranded: made.stranded, act: r4.act, done: r4.done, k4, after: r4b.act.q_mage_lv13, ac });
  ok('[5] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
