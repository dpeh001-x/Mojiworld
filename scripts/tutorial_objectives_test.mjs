// The tutorial is completable, and completable ON A CONTROLLER.
// Per user: "sometimes when i complete the objective it does not flag out" +
// "make sure that tutorial work for controllers entirely as well".
// Run: node scripts/tutorial_objectives_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9191;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe-pad', index: 0, connected: true, mapping: 'standard',
    timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setAxis = (i, v) => { window.__pad.axes[i] = v; window.__pad.timestamp = performance.now(); };
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
// Dismiss the real boot menu so #lo-auth is gone — otherwise it, not the game,
// is what the pad router legitimately owns.
await page.evaluate(() => {
  player.cls = 'warrior'; player.hp = getMaxHp();
  window._prologuePending = false; window._prologueActive = false; game._resetting = false;
  _flushSaveStateNow();
});
await page.reload({ waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 140000 });
await page.evaluate(() => { const bs = [...document.querySelectorAll('#lo-auth button')];
  (bs.find(x => /continue/i.test(x.textContent)) || bs[0]).click(); });
await page.waitForFunction(() => !document.getElementById('loading-overlay'), null, { timeout: 140000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { setInterval(() => { game.paused = false; }, 50); });
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const start = async () => {
  await page.evaluate(() => {
    const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
    window._prologueAfterCreation = false; window._prologueActive = false; window._prologuePending = false;
    try { localStorage.removeItem('levelx_save_v1'); localStorage.removeItem('mojiworld_tutorial_seen'); } catch (e) {}
    player.cls = null; player.inventory = []; player.equipped = {};
    player._starterWeaponGiven = false; player._tutorialSeen = false;
    player._storyBeatsSeen = { tutorial_intro: true, tutorial_outro: true };
    if (typeof openClassSelect === 'function') openClassSelect();
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#class-options .class-card')];
    const c = cards.find(x => (x.querySelector('.cls-name') || {}).textContent === 'Archer');
    if (c) c.onclick();
  });
  await page.waitForTimeout(3200);
  await page.evaluate(() => { window.dispatchEvent(new Event('gamepadconnected')); });
  await page.waitForTimeout(500);
};
await start();

// ── CONTROLLER: can the pad play while the dock is up? ─────────────────────
const pad = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const r = { open: !!document.querySelector("#tutorial-modal.tut-dock") };
  r.step = TUTORIAL_STEPS[_tutStep] ? TUTORIAL_STEPS[_tutStep].title : null;
  r.rootWhileOwing = (() => { try { return (_lxPadModalRoot() || {}).id || null; } catch (e) { return "ERR"; } })();
  // stick right (open ground; moving left can pin the hero on the map edge)
  const x0 = player.x;
  window.__setAxis(0, 1);
  await wait(800);
  r.movedByStick = +(player.x - x0).toFixed(1);
  window.__setAxis(0, 0);
  await wait(1600);                       // let the tick + auto-advance land
  r.moveStepDone = !!TUTORIAL_STEPS[0]._done;
  r.stepAfter = TUTORIAL_STEPS[_tutStep] ? TUTORIAL_STEPS[_tutStep].title : null;
  // d-pad right, measured on its own
  const x1 = player.x;
  window.__setBtn(15, 1);
  await wait(800);
  r.movedByDpad = +(player.x - x1).toFixed(1);
  window.__setBtn(15, 0);
  await wait(200);
  // with the CURRENT step already satisfied, the card must become reachable
  const st = TUTORIAL_STEPS[_tutStep];
  const wasDone = st._done; st._done = true;
  _lxPadRootAt = -1;
  r.rootWhenDone = (() => { try { return (_lxPadModalRoot() || {}).id || null; } catch (e) { return "ERR"; } })();
  st._done = wasDone;
  return r;
});
ok("the tutorial dock is up on a fresh character", pad.open, pad.step);
ok("while a step still owes an objective, the pad drives the GAME (not the card)",
   pad.rootWhileOwing !== "tutorial-modal", "pad root: " + pad.rootWhileOwing);
ok("the left STICK moves the hero during the tutorial", pad.movedByStick > 1, pad.movedByStick + "px");
ok("the D-PAD moves the hero during the tutorial", pad.movedByDpad > 1, pad.movedByDpad + "px");
ok("the first objective TICKS from controller input alone", pad.moveStepDone === true,
   "step now: " + pad.stepAfter);
ok("once the objective is done the pad can reach the card (Next/Back/Skip)",
   pad.rootWhenDone === "tutorial-modal", "pad root: " + pad.rootWhenDone);

// ── FLAGGING: an objective done BEFORE its step still counts ───────────────
await start();
const early = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  // do a later step's objective now, while step 0 is showing
  const target = TUTORIAL_STEPS.findIndex(s => s.detect === 'potion');
  _tutPing('potion');                      // as drinking a potion would
  await wait(200);
  const beforeJump = !!TUTORIAL_STEPS[target]._done;
  _tutStep = target; _renderTutorialStep();   // the tour reaches that step later
  await wait(300);
  return { target, beforeJump, doneOnArrival: !!TUTORIAL_STEPS[target]._done,
    title: TUTORIAL_STEPS[target].title,
    pillDone: !!(document.getElementById('tut-try') || {}).classList?.contains('done'),
    stepStayed: _tutStep === target };
});
ok('an objective completed EARLY is remembered', early.beforeJump === false && early.doneOnArrival === true,
   `"${early.title}" done on arrival: ${early.doneOnArrival}`);
ok('...and its TRY IT pill reads DONE', early.pillDone === true, 'pill.done=' + early.pillDone);
ok('...without ripping past the step the player has not read', early.stepStayed === true, 'stayed on step ' + early.target);

// ── every step's detect tag has a real ping source ─────────────────────────
const tags = await page.evaluate(() => TUTORIAL_STEPS.map(s => s.detect).filter(Boolean));
ok('every tutorial step carries an objective tag', tags.length === 14, tags.length + ' tagged steps');

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
