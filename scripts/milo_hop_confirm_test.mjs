// Live test: TOWN MILO ASKS BEFORE PUTTING YOU BACK ON THE TRAIN.
//
// Per user: "When talking to milo in everdawn central, milo should have a
// dialogue to confirm if player wants to hop back on the train quest again."
//
// v0.26.087 warped the player on the SAME FRAME the dialog opened - the load
// fired before a human could read anything, so a mis-click on the NPC yanked
// them out of town. The confirm replaces that: the thing under test is the
// ORDER of effects - no map load, no boss-flag arming, until the yes.
//   node scripts/milo_hop_confirm_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8851; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openNPC === 'function' && typeof QUESTS !== 'undefined', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const out = {};
  const MILO = { name: 'Milo', role: 'usher', x: 820, y: 279 };
  const dlgText = () => (document.getElementById('dialog-text') || {}).textContent || '';
  const dlgOpts = () => [...document.querySelectorAll('#dialog-options button')].map((b2) => b2.textContent);
  const loads = [];
  const realLoad = window.loadMap;
  window.loadMap = (m2, x2) => { loads.push({ map: m2, x: x2 }); };   // observe, never navigate
  try {
    player.quests = player.quests || {};
    player.quests.active = {}; player.quests.completed = {}; player.quests.unlocked = {};
    game.currentMap = 'town';
    delete player._pqFinaleBossPending;

    // --- an active mid-chain stage: the question, not the warp ---
    player.quests.active.q_pq_spire = { progress: 0 };
    openNPC(MILO);
    // the dialog text is a TYPEWRITER reveal - poll until it stops growing,
    // or a fixed wait races it and reads a half-typed line
    let _prev = -1;
    for (let w = 0; w < 30; w++) {
      await new Promise((z) => setTimeout(z, 150));
      const L2 = dlgText().length;
      if (L2 > 20 && L2 === _prev) break;
      _prev = L2;
    }
    out.spire = { warpedOnOpen: loads.length > 0, text: dlgText().slice(0, 160), opts: dlgOpts() };
    // decline
    const notNow = [...document.querySelectorAll('#dialog-options button')].find((b2) => /Not right now/.test(b2.textContent));
    if (notNow) notNow.click();
    out.spire.warpedAfterDecline = loads.length > 0;

    // --- yes on the finale: warp fires AND the boss flag arms only now ---
    player.quests.active = { q_pq_finale: { progress: 0 } };
    delete player._pqFinaleBossPending;
    openNPC(MILO);
    await new Promise((z) => setTimeout(z, 300));
    out.finale = { flagBeforeYes: !!player._pqFinaleBossPending, opts: dlgOpts() };
    const yes = [...document.querySelectorAll('#dialog-options button')].find((b2) => /Hop back on/.test(b2.textContent));
    if (yes) yes.click();
    await new Promise((z) => setTimeout(z, 200));
    out.finale.loads = loads.slice();
    out.finale.flagAfterYes = !!player._pqFinaleBossPending;

    // --- no PQ active: Milo's ordinary dialog is untouched ---
    player.quests.active = {};
    loads.length = 0;
    openNPC(MILO);
    await new Promise((z) => setTimeout(z, 300));
    out.normal = { text: dlgText().slice(0, 80), optCount: dlgOpts().length, warped: loads.length > 0 };
    if (typeof closeDialog === 'function') closeDialog();
  } finally {
    window.loadMap = realLoad;
    player.quests.active = {}; delete player._pqFinaleBossPending;
  }
  return out;
});
await b.close(); srv.kill();

ok('with a stage open, talking to Milo asks instead of warping',
  r.spire && !r.spire.warpedOnOpen && /Back on the rails|hop/i.test(r.spire.text || ''),
  { warpedOnOpen: r.spire.warpedOnOpen, text: r.spire.text });
ok('the question offers the hop and a way out',
  r.spire.opts.some((t) => /Hop back on/.test(t)) && r.spire.opts.some((t) => /Not right now/.test(t)),
  { opts: r.spire.opts });
ok('declining leaves the player exactly where they were',
  !r.spire.warpedAfterDecline, { warped: r.spire.warpedAfterDecline });
ok('saying yes warps to the right stage - and only then',
  r.finale.loads.length === 1 && r.finale.loads[0].map === 'clockworkExpress',
  { loads: r.finale.loads });
ok('the finale boss flag arms on YES, not on merely opening the dialog',
  !r.finale.flagBeforeYes && r.finale.flagAfterYes,
  { before: r.finale.flagBeforeYes, after: r.finale.flagAfterYes,
    note: 'v0.26.087 armed it at routing time - a decline would have left it set' });
ok('with no stage open, Milo talks normally',
  r.normal && !r.normal.warped && r.normal.optCount > 0,
  r.normal);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
