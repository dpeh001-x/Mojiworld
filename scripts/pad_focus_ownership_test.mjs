// While the tour is docked the pad ALWAYS drives the game, in every step
// state — and the card is always reachable on the triggers, including when it
// has been minimised.
// Per user: "sometimes the controller focuses on the tutorial UI, sometimes the
// game ... need a good foolproof method to make sure players can fall back to".
// Run: node scripts/pad_focus_ownership_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9201;
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
// through the REAL boot menu, so #lo-auth is gone and the pad reaches the game
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

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  player._tutorialSeen = false;
  player._storyBeatsSeen = { tutorial_intro: true, tutorial_outro: true };
  if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
  startTutorial(); await wait(700);
  const r = {};
  const rootNow = () => { _lxPadRootAt = -1; const e = _lxPadModalRoot(); return e ? (e.id || '(anon)') : null; };

  // ── the invariant, across EVERY step and both tick states ──
  const owned = [];
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    _tutStep = i;
    for (const done of [false, true]) {
      TUTORIAL_STEPS[i]._done = done;
      _renderTutorialStep(); await wait(30);
      if (rootNow() === 'tutorial-modal') owned.push(`${i}:${done ? 'done' : 'open'}`);
    }
  }
  r.padOwnedByCard = owned;
  r.stepsChecked = TUTORIAL_STEPS.length * 2;

  // ── the stick still moves the hero with the card up ──
  _tutStep = 3; TUTORIAL_STEPS[3]._done = true; _renderTutorialStep(); await wait(200);
  const x0 = player.x;
  window.__setBtn(15, 1); await wait(700); window.__setBtn(15, 0);
  r.movedWithCardUp = +(player.x - x0).toFixed(1);

  // ── minimise: the pad must STILL play, and RT must bring the card back ──
  document.getElementById('tut-collapse').click(); await wait(250);
  r.collapsed = document.querySelector('#tutorial-modal').classList.contains('tut-collapsed');
  r.rootWhileCollapsed = rootNow();
  const x1 = player.x;
  window.__setBtn(15, 1); await wait(700); window.__setBtn(15, 0); await wait(200);
  r.movedWhileCollapsed = +(player.x - x1).toFixed(1);
  window.__setBtn(7, 1); await wait(300); window.__setBtn(7, 0); await wait(500);
  r.reopenedByRT = !document.querySelector('#tutorial-modal').classList.contains('tut-collapsed');

  // ── the legend is on screen in both states ──
  r.legendExpanded = (document.getElementById('tut-pad-legend') || {}).textContent || '';
  r.legendVisibleExpanded = (() => { const e=document.getElementById('tut-pad-legend'); return !!e && getComputedStyle(e).display !== 'none'; })();
  document.getElementById('tut-collapse').click(); await wait(300);
  r.legendCollapsed = (document.getElementById('tut-pad-legend') || {}).textContent || '';
  r.legendVisibleCollapsed = (() => { const e=document.getElementById('tut-pad-legend'); return !!e && getComputedStyle(e).display !== 'none'; })();
  window.__setBtn(7, 1); await wait(250); window.__setBtn(7, 0); await wait(400);
  return r;
});

ok('the card NEVER owns the pad, in any step state',
   out.padOwnedByCard.length === 0,
   out.padOwnedByCard.length ? 'owned at ' + out.padOwnedByCard.join(', ')
                             : `checked ${out.stepsChecked} step/tick combinations`);
ok('the stick still moves the hero with the card up', out.movedWithCardUp > 1, out.movedWithCardUp + 'px');
ok('minimising does not take the pad either', out.rootWhileCollapsed !== 'tutorial-modal' && out.collapsed === true,
   `collapsed=${out.collapsed} root=${out.rootWhileCollapsed}`);
ok('the hero still moves while the card is minimised', out.movedWhileCollapsed > 1, out.movedWhileCollapsed + 'px');
ok('RT brings a MINIMISED tour back — no mouse needed', out.reopenedByRT === true, String(out.reopenedByRT));
ok('a legend states the rule while expanded',
   out.legendVisibleExpanded && /RT next/.test(out.legendExpanded) && /LT skip/.test(out.legendExpanded),
   out.legendExpanded);
ok('and states the way back while minimised',
   out.legendVisibleCollapsed && /reopen/i.test(out.legendCollapsed),
   out.legendCollapsed);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
