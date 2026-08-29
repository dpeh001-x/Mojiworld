// PQ / ENDLESS EXPRESS GATE — the optional side-run must never block the PQ.
// ============================================================================
// Tester video (v0.30.266 save): "PQ bug weird bug cos I need to finish a
// quest first before the PQ can continue." Three compounding failures:
//   1. Milo's town auto-warp router ranked q_clockwork_express (the OPTIONAL
//      repeatable side-run) as a PQ stage — with a run open, talking to town
//      Milo warped you into the Express before any dialog. Stage offers,
//      "Run again", the Stage-1 reset: all unreachable.
//   2. The Express-side dialog offered nothing but the ride home, and the
//      in-PQ-map branch had no Express option and no "Run again" — so the
//      trap had no exit on either side.
//   3. The tester's run asked for 500 kills. The roll ceiling is 99; the 500
//      is a hunt-curve retarget from before the exemptions, restored forever
//      by the abandon-bank.
// This suite drives the REAL dialog (openNPC) and the real repair pass.
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

const R = await page.evaluate(() => {
  const out = {};
  const Q = () => player.quests;
  const CHAIN = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const doneChain = () => { CHAIN.forEach((id) => { Q().completed[id] = Date.now(); delete Q().active[id]; }); };
  const clearAll = () => {
    CHAIN.concat(['q_clockwork_express']).forEach((id) => {
      delete Q().completed[id]; delete Q().active[id];
    });
    if (player._qBank) delete player._qBank.q_clockwork_express;
  };
  const dialogOpts = () => Array.from(document.querySelectorAll('#dialog button')).map((b) => (b.textContent || '').trim());

  // ---- A. the repair pass, on the tester's exact save shape ---------------
  clearAll(); doneChain();
  Q().active.q_clockwork_express = { progress: 450, targetCount: 500 };
  const coins0 = player.mojicoins || 0;
  tickQuestUnlocks();
  out.repair = {
    completed: !!Q().completed.q_clockwork_express,
    activeGone: !Q().active.q_clockwork_express,
    coinsGained: (player.mojicoins || 0) - coins0,
  };

  // A2. a banked inflated target is clamped too.
  clearAll(); doneChain();
  player._qBank = player._qBank || {};
  player._qBank.q_clockwork_express = { progress: 10, targetCount: 500 };
  tickQuestUnlocks();
  out.bankClamped = player._qBank.q_clockwork_express.targetCount;

  // A3. a legitimate old roll (60, inside 45-99) is NOT touched — the clamp
  // only ever pulls DOWN to the ceiling, never up to the raised floor.
  clearAll(); doneChain();
  delete player._qBank.q_clockwork_express;
  Q().active.q_clockwork_express = { progress: 5, targetCount: 60 };
  tickQuestUnlocks();
  out.legitRoll = {
    target: Q().active.q_clockwork_express && Q().active.q_clockwork_express.targetCount,
    stillActive: !!Q().active.q_clockwork_express,
  };

  // ---- B. town Milo with an Express run open: dialog, not hijack ----------
  // (state from A3: chain done, express active 5/60, standing in town)
  openNPC({ name: 'Milo', role: 'usher' });
  out.town = {
    map: game.currentMap,                      // pre-fix: 'clockworkExpress'
    opts: dialogOpts(),
  };
  closeDialog();

  // ---- C. the four chain stages KEEP their auto-warp ----------------------
  clearAll();
  Q().active.q_clockwork_underpass = { progress: 0 };
  openNPC({ name: 'Milo', role: 'usher' });
  out.chainWarp = game.currentMap;             // must be the Stage-1 lobby
  try { closeDialog(); } catch (e) {}

  // ---- D. in-PQ-map Milo: forward options instead of only the ride home ---
  // (we are now standing in the lobby, a PQ map)
  clearAll(); doneChain();
  Q().active.q_clockwork_express = { progress: 5, targetCount: 60 };
  openNPC({ name: 'Milo', role: 'usher' });
  out.inMap = { map: game.currentMap, opts: dialogOpts() };
  closeDialog();

  clearAll();
  if (typeof loadMap === 'function') loadMap('town', 400);
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
const has = (opts, frag) => (opts || []).some((t) => t.includes(frag));

ok('a curve-inflated 500-target run at 450 kills completes on the repair tick',
  R.repair.completed && R.repair.activeGone,
  `completed=${R.repair.completed}, active cleared=${R.repair.activeGone}`);
ok('...and pays its rewards (the player did the ceiling 4.5x over)',
  R.repair.coinsGained > 0, `+${R.repair.coinsGained} mojicoins`);
ok('a banked inflated target is clamped to the 99 ceiling',
  R.bankClamped === 99, `bank targetCount -> ${R.bankClamped}`);
ok('a legitimate old roll (60) is left alone — clamp down, never up',
  R.legitRoll.target === 60 && R.legitRoll.stillActive, JSON.stringify(R.legitRoll));
ok('town Milo with an Express run open OPENS THE DIALOG instead of warping (the hijack)',
  R.town.map === 'town', `map after openNPC: ${R.town.map} (pre-fix: clockworkExpress)`);
ok('...and that dialog offers the Express as an explicit option, with the remaining count',
  has(R.town.opts, 'Endless Express run (55 left)'), JSON.stringify(R.town.opts));
ok('...alongside the "Run again" option the hijack used to bury',
  has(R.town.opts, 'Run the Ticket Rush again'), JSON.stringify(R.town.opts));
ok('the four chain stages keep their auto-warp (Stage 1 active -> lobby)',
  R.chainWarp === 'clockworkUnderpassLobby', `map after openNPC: ${R.chainWarp}`);
ok('in-PQ-map Milo offers the Express run from a non-Express PQ map',
  has(R.inMap.opts, 'Continue the Endless Express run'), JSON.stringify(R.inMap.opts));
ok('in-PQ-map Milo offers "Run again" when all four stages are done (was: only the ride home)',
  has(R.inMap.opts, 'Run the Ticket Rush again'), JSON.stringify(R.inMap.opts));
ok('the ride home is still there',
  has(R.inMap.opts, 'Ride back to Everdawn Central'), '');

let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
