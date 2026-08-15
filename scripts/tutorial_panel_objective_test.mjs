// "Open your character panel" ticks from the key the card names — on keyboard
// AND on a controller.
// Per user: "this objective was not met despite me pressing on the correct
// button, also a problem using my controller".
// Run: node scripts/tutorial_panel_objective_test.mjs  (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9196;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
const URL = `http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`;
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
// Seed a save and go through the REAL boot menu, so #lo-auth is gone. Left up,
// it is the surface the pad legitimately owns and no pad press reaches the game.
await page.evaluate(() => {
  player.cls = 'archer'; player.hp = getMaxHp();
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

const run = async (how) => page.evaluate(async (how) => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  // fresh tutorial on the 'panel' step
  player._tutorialSeen = false;
  player._storyBeatsSeen = { tutorial_intro: true, tutorial_outro: true };
  if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
  startTutorial();
  await wait(500);
  const target = TUTORIAL_STEPS.findIndex(s => s.detect === 'panel');
  TUTORIAL_STEPS.forEach(s => { s._done = false; });
  try { for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k]; } catch (e) {}
  _tutStep = target; _renderTutorialStep();
  await wait(300);
  // close any panel left open by a previous pass
  const am = document.getElementById('attributes-modal');
  if (am && am.style.display === 'flex') { am.style.display = 'none'; game.paused = false; }
  const before = !!TUTORIAL_STEPS[target]._done;
  const pings = [];
  const orig = _tutPing;
  // eslint-disable-next-line no-global-assign
  _tutPing = function (t) { pings.push(t); return orig.apply(this, arguments); };
  window.__setBtn(8, 0); await wait(120);
  if (how === 'pad') { window.__setBtn(8, 1); await wait(200); window.__setBtn(8, 0); }
  else { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true })); }
  await wait(1000);
  // eslint-disable-next-line no-global-assign
  _tutPing = orig;
  return {
    step: TUTORIAL_STEPS[target].title,
    before,
    panelOpen: ((document.getElementById('attributes-modal') || {}).style || {}).display === 'flex',
    pings,
    done: !!TUTORIAL_STEPS[target]._done,
  };
}, how);

const kbd = await run('kbd');
ok('keyboard U opens the character panel', kbd.panelOpen === true, JSON.stringify(kbd.pings));
ok('keyboard U TICKS the panel objective', kbd.before === false && kbd.done === true,
   `pings=[${kbd.pings}] done=${kbd.done}`);
ok('the panel emits the objective tag the step waits on', kbd.pings.includes('panel'),
   '[' + kbd.pings + ']');

const pad = await run('pad');
ok('controller Back opens the character panel', pad.panelOpen === true, JSON.stringify(pad.pings));
ok('controller Back TICKS the panel objective', pad.before === false && pad.done === true,
   `pings=[${pad.pings}] done=${pad.done}`);

// ── the Items objective: the step names the Items TAB, so clicking it must tick
const items = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  player._tutorialSeen = false;
  startTutorial(); await wait(500);
  const t = TUTORIAL_STEPS.findIndex(s => /Your First Weapon/i.test(s.title));
  TUTORIAL_STEPS.forEach(s => { s._done = false; });
  try { for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k]; } catch (e) {}
  const am = document.getElementById('attributes-modal');
  if (am && am.style.display === 'flex') { am.style.display = 'none'; game.paused = false; }
  _tutStep = t; _renderTutorialStep(); await wait(250);
  const r = { title: TUTORIAL_STEPS[t].title, detect: TUTORIAL_STEPS[t].detect, before: !!TUTORIAL_STEPS[t]._done };
  openLevelUpPanel(); await wait(500);          // player is now INSIDE the panel
  r.afterOpen = !!TUTORIAL_STEPS[t]._done;
  const tab = [...document.querySelectorAll('#u-tabs .inv-tab')].find(b => b.dataset.utab === 'items');
  r.tabFound = !!tab;
  if (tab) tab.click();
  await wait(700);
  r.afterItems = !!TUTORIAL_STEPS[t]._done;
  return r;
});
ok('the weapon step waits on the Items tab it names', items.detect === 'tab_items', items.detect);
ok('clicking Items TICKS the weapon objective',
   items.before === false && items.afterItems === true,
   `open=${items.afterOpen} items=${items.afterItems} tabFound=${items.tabFound}`);

// ── RT = Next, LT = Skip while the card is up
const trig = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const am = document.getElementById('attributes-modal');
  if (am && am.style.display === 'flex') { am.style.display = 'none'; game.paused = false; }
  player._tutorialSeen = false;
  startTutorial(); await wait(600);
  _tutStep = 4; _renderTutorialStep(); await wait(250);
  const r = { start: _tutStep };
  // ONE press, HELD — must advance exactly one step for the whole hold.
  window.__setBtn(7, 1);
  await wait(300); r.afterRT = _tutStep;
  await wait(1000); r.afterHold = _tutStep;
  window.__setBtn(7, 0); await wait(300);
  r.hintText = (document.getElementById('tut-live-hint') || {}).textContent || '';
  // LT skips
  r.skipBtn = !!document.getElementById('tut-skip');
  r.dockBefore = !!document.querySelector('#tutorial-modal.tut-dock');
  window.__setBtn(6, 1); await wait(300); window.__setBtn(6, 0); await wait(700);
  r.dockGone = !document.querySelector('#tutorial-modal.tut-dock');
  return r;
});
ok('RT advances the tour one step', trig.afterRT === trig.start + 1, `${trig.start} -> ${trig.afterRT}`);
ok('a HELD RT does not run away with it', trig.afterHold === trig.afterRT, `held -> ${trig.afterHold}`);
ok('LT skips the tour', trig.dockGone === true, JSON.stringify({skipBtn:trig.skipBtn,dockBefore:trig.dockBefore,dockGone:trig.dockGone}));
ok('the card tells pad players RT/LT', /RT next/.test(trig.hintText) && /LT skip/.test(trig.hintText), trig.hintText);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
