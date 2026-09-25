// PQ / ENDLESS EXPRESS GATE — the Endless Express RUN is removed, the Ticket Rush is not.
// ============================================================================
// Per user: "Please remove the endless express entirely". The optional, repeatable
// q_clockwork_express (kill a random 45-99 Ticket Mechs on the carriage) and Milo's
// "Continue the Endless Express run (N left)" buttons are gone. The carriage map
// itself stays: it is the Rush's STAGE 4, where the Master Conductor is fought.
//
// This suite used to prove the run could never trap the PQ (the v0.30.266 tester
// save: Milo's router warped you into an open run, the dialog had no exit, and a
// hunt-curve retarget asked for 500 kills). With the run removed those traps have
// nothing left to catch, so it now proves the removal is clean on the same save
// shapes: a save that still carries the run is purged, Milo in town and inside the
// PQ maps offers no Express button, "Run again" and the ride home remain, and
// Stage 4 still takes you to the Conductor.
// Drives the REAL dialog (openNPC) and the real boot/level-up repair pass.
// Run: node scripts/pq_express_gate_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9911);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'PqGate');
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
await page.evaluate(() => { player.level = 37; loadMap('town', 400); });
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  const out = {};
  const X = 'q_clockwork_express';
  const Q = () => player.quests;
  const CHAIN = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const doneChain = () => { CHAIN.forEach((id) => { Q().completed[id] = Date.now(); delete Q().active[id]; }); };
  const clearAll = () => { CHAIN.concat([X]).forEach((id) => { delete Q().completed[id]; delete Q().active[id]; delete Q().unlocked[id]; }); };
  const dialogOpts = () => Array.from(document.querySelectorAll('#dialog button')).map((b) => (b.textContent || '').trim());
  // a save written before the removal, carrying the run everywhere it could live
  const carryRun = () => {
    Q().active[X] = { progress: 54, targetCount: 87 };
    Q().completed[X] = Date.now(); Q().unlocked[X] = true;
    Q().fresh = Q().fresh || {}; Q().fresh[X] = 1;
    player._qBank = player._qBank || {}; player._qBank[X] = { progress: 10, targetCount: 60 };
    player._pqStagePaid = player._pqStagePaid || {}; player._pqStagePaid[X] = 1;
    game.qnav = X; game.qnavPins = [X, 'q_pq_finale'];
  };

  out.defined = !!(typeof QUESTS !== 'undefined' && QUESTS[X]);
  out.chainIds = (typeof LX_PQ_CHAIN_IDS !== 'undefined') ? Object.keys(LX_PQ_CHAIN_IDS) : null;

  // ---- A. the boot / level-up pass purges a save that still carries it ----
  clearAll(); doneChain(); carryRun();
  const coins0 = player.mojicoins || 0;
  tickQuestUnlocks();
  out.purge = {
    active: !!Q().active[X], completed: !!Q().completed[X], unlocked: !!Q().unlocked[X],
    fresh: !!(Q().fresh && Q().fresh[X]), bank: !!(player._qBank && player._qBank[X]),
    paid: !!(player._pqStagePaid && player._pqStagePaid[X]),
    qnav: game.qnav, pins: (game.qnavPins || []).slice(), coinsGained: (player.mojicoins || 0) - coins0,
  };

  // ---- B. town Milo, Rush finished, on a save that carried a run ---------
  clearAll(); doneChain(); carryRun(); tickQuestUnlocks();
  openNPC({ name: 'Milo', role: 'usher' });
  out.town = { map: game.currentMap, opts: dialogOpts() };
  closeDialog();

  // ---- C. the four chain stages keep their way back ----------------------
  clearAll();
  Q().active.q_clockwork_underpass = { progress: 0 };
  openNPC({ name: 'Milo', role: 'usher' });
  out.chainWarp = game.currentMap; out.chainOpts = dialogOpts();
  try { closeDialog(); } catch (e) {}
  if (game.currentMap !== 'town' && typeof loadMap === 'function') { loadMap('town', 400); await new Promise((r) => setTimeout(r, 1500)); }

  // ---- D. Stage 4 still goes to the carriage and the Conductor ----------
  clearAll();
  ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'].forEach((id) => { Q().completed[id] = Date.now(); });
  Q().unlocked.q_pq_finale = true;
  openNPC({ name: 'Milo', role: 'usher' });
  out.stage4Opts = dialogOpts();
  const s4 = Array.from(document.querySelectorAll('#dialog button')).find((b) => /Begin Stage 4/.test(b.textContent || ''));
  if (s4) {
    s4.click();
    for (let i = 0; i < 30 && !(game.currentMap === 'clockworkExpress' && (game.monsters || []).some((m) => m && m.type === 'pqConductor')); i++) await new Promise((r) => setTimeout(r, 200));
    try { if (typeof closeAllModals === 'function') closeAllModals(); } catch (e) {}
  }
  out.stage4 = { map: game.currentMap, conductor: (game.monsters || []).some((m) => m && m.type === 'pqConductor'), finaleActive: !!Q().active.q_pq_finale };

  // ---- E. in-PQ-map Milo: forward options, no Express --------------------
  if (typeof loadMap === 'function') loadMap('clockworkUnderpassLobby', 300);
  await new Promise((r) => setTimeout(r, 1800));
  clearAll(); doneChain(); carryRun(); tickQuestUnlocks();
  openNPC({ name: 'Milo', role: 'usher' });
  out.inMap = { map: game.currentMap, opts: dialogOpts() };
  closeDialog();

  clearAll();
  if (typeof loadMap === 'function') loadMap('town', 400);
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const has = (opts, frag) => (opts || []).some((t) => t.includes(frag));
const express = (opts) => (opts || []).some((t) => /Endless Express/i.test(t));

ok('the Endless Express run is no longer a quest', !R.defined, `QUESTS.q_clockwork_express defined: ${R.defined}`);
ok('...and is not in the Ticket Rush chain', R.chainIds && R.chainIds.indexOf('q_clockwork_express') < 0 && R.chainIds.length === 4, JSON.stringify(R.chainIds));
ok('a save carrying it is purged from active / completed / unlocked / unseen',
  !R.purge.active && !R.purge.completed && !R.purge.unlocked && !R.purge.fresh, JSON.stringify(R.purge));
ok('...and from the quest bank and the PQ stage-paid ledger', !R.purge.bank && !R.purge.paid, JSON.stringify(R.purge));
ok('...and from the HUD pins, keeping the other pin', R.purge.qnav !== 'q_clockwork_express'
  && R.purge.pins.indexOf('q_clockwork_express') < 0 && R.purge.pins.indexOf('q_pq_finale') >= 0, JSON.stringify({ qnav: R.purge.qnav, pins: R.purge.pins }));
ok('...without paying anything for it', R.purge.coinsGained === 0, `+${R.purge.coinsGained} mojicoins`);
ok('town Milo opens his dialog in town (no warp)', R.town.map === 'town', `map after openNPC: ${R.town.map}`);
ok('...offers no Endless Express option', !express(R.town.opts), JSON.stringify(R.town.opts));
ok('...and still offers "Run the Ticket Rush again"', has(R.town.opts, 'Run the Ticket Rush again'), JSON.stringify(R.town.opts));
ok('the four chain stages keep their way back (Stage 1 active -> lobby, or the "Hop back on" offer)',
  R.chainWarp === 'clockworkUnderpassLobby' || has(R.chainOpts, 'Hop back on'), `map after openNPC: ${R.chainWarp}; opts ${JSON.stringify(R.chainOpts)}`);
ok('Stage 4 is still offered', has(R.stage4Opts, 'Begin Stage 4'), JSON.stringify(R.stage4Opts));
ok('...and still takes you to the carriage, where the Master Conductor spawns',
  R.stage4.map === 'clockworkExpress' && R.stage4.conductor && R.stage4.finaleActive, JSON.stringify(R.stage4));
ok('in-PQ-map Milo offers no Endless Express option', !express(R.inMap.opts), JSON.stringify(R.inMap.opts));
ok('in-PQ-map Milo offers "Run again" when all four stages are done', has(R.inMap.opts, 'Run the Ticket Rush again'), JSON.stringify(R.inMap.opts));
ok('the ride home is still there', has(R.inMap.opts, 'Ride back to Everdawn Central'), JSON.stringify(R.inMap.opts));

let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
