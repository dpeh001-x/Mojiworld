// Live test: INTERACTIVE TUTORIAL — each step shows a "TRY IT" objective pill and
// the real gameplay action ticks it ✅ + auto-advances (move → walk keys, attack →
// _tutPing('attack'), panel → U, etc.). Also checks the polished chrome exists.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const PORT = process.env.PORT || '8080';
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = `http://localhost:${PORT}/${FILE}`;
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof _showTutorialModal === 'function' && typeof _tutPing === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { player.cls = 'warrior'; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} });

  // Open the tutorial dock directly (skips the intro story beat).
  await page.evaluate(() => _showTutorialModal());
  await sleep(300);
  const open = await page.evaluate(() => {
    const m = document.getElementById('tutorial-modal');
    const pill = document.getElementById('tut-try');
    return {
      docked: !!m && m.classList.contains('tut-dock') && m.style.display !== 'none',
      pillShown: !!pill && pill.style.display !== 'none',
      pillText: pill ? pill.textContent.trim().slice(0, 60) : null,
      pillDone: pill ? pill.classList.contains('done') : null,
      unpaused: game.paused === false,
    };
  });
  ok('tutorial docks (game stays live)', open.docked && open.unpaused, open);
  ok('step 1 shows a TRY IT pill (walk objective)', open.pillShown && /TRY IT/i.test(open.pillText) && open.pillDone === false, open);

  // STEP 1 — the move gate is armed; simulate holding → through the REAL input path.
  const armed = await page.evaluate(() => window._tutWantsMove === true);
  ok('movement ping gate armed on the move step', armed);
  await page.keyboard.down('ArrowRight');
  await sleep(150);
  // Headless chromium throttles rAF, so updatePlayer (which reads the held key
  // and fires the move ping) never runs on its own — pump it like the co-op
  // tests pump _mpTick. The REAL path is still exercised: real keydown event →
  // game.keys → updatePlayer's input read → _tutPing('move').
  await page.evaluate(() => { for (let i = 0; i < 6; i++) { try { updatePlayer(16); } catch (e) {} } });
  await sleep(200);
  await page.keyboard.up('ArrowRight');
  const afterMove = await page.evaluate(() => {
    const pill = document.getElementById('tut-try');
    return { done: pill && pill.classList.contains('done'), tag: pill && pill.querySelector('.tt-tag') && pill.querySelector('.tt-tag').textContent, wantsMove: window._tutWantsMove, step: _tutStep };
  });
  ok('WALKING ticks step 1 ✅ (real key press through the input path)', afterMove.done === true && afterMove.tag === 'DONE', afterMove);
  ok('movement gate disarmed after the tick', afterMove.wantsMove === false, afterMove);

  // v0.30.1186 — the tick no longer jumps after 1.1 s: it holds the step for
  // a countdown shown on Next. Check it holds, counts, then auto-advances.
  // 2f3e2c646 v0.30.1475 (per user): the tour moves on after 3 s (was 15 s).
  await sleep(1400);
  const hold = await page.evaluate(() => ({ step: _tutStep, next: document.getElementById('tut-next').textContent }));
  ok('ticked step HOLDS past 1.4 s (no instant jump)', hold.step === 0, hold);
  ok('Next shows the countdown', /\b[1-3]s\b/.test(hold.next), hold);
  await page.waitForFunction(() => _tutStep === 1, null, { timeout: 6000 }).catch(() => {});   // ~3 s hold + slack
  const s2 = await page.evaluate(() => ({ step: _tutStep, next: document.getElementById('tut-next').textContent, pill: (document.getElementById('tut-try') || {}).textContent || '' }));
  ok('auto-advanced to step 2 (Move & Fight) after 3 s', s2.step === 1, s2);
  ok('Next label reset on the new step', !/\ds$/.test(s2.next.trim()), s2);
  // Fire the attack ping like the combat code does.
  await page.evaluate(() => _tutPing('attack'));
  const s2done = await page.evaluate(() => (document.getElementById('tut-try') || {}).classList.contains('done'));
  ok('attack action ticks step 2 ✅', s2done === true);

  // Step 3 (panels): the real U-panel opener pings 'panel'. Next skips the wait.
  await sleep(600);
  await page.evaluate(() => document.getElementById('tut-next').click());   // the .ready pulse never reads as 'stable' to page.click
  await sleep(300);
  const s3 = await page.evaluate(() => ({ step: _tutStep }));
  ok('auto-advanced to step 3 (Menus & Panels)', s3.step === 2, s3);
  await page.evaluate(() => _tutPing('panel'));
  const s3done = await page.evaluate(() => (document.getElementById('tut-try') || {}).classList.contains('done'));
  ok('opening the U panel ticks step 3 ✅', s3done === true);

  // AAA presentation: hero objective, keycaps, prose behind Details, glass card.
  const aaa = await page.evaluate(() => {
    _tutStep = 1; _renderTutorialStep();   // objective step (attack)
    const m = document.getElementById('tutorial-modal');
    const pill = document.getElementById('tut-try');
    const body = document.getElementById('tut-body');
    const db = document.getElementById('tut-details-btn');
    const kbd = pill.querySelector('kbd');
    const out = {
      heroSize: getComputedStyle(pill).fontSize,
      kbdCap: kbd ? getComputedStyle(kbd).borderBottomWidth : null,
      hasTry: m.classList.contains('has-try'),
      bodyHiddenByDefault: getComputedStyle(body).display === 'none',
      detailsBtnShown: db && getComputedStyle(db).display !== 'none',
    };
    db.click();
    out.bodyShownAfterDetails = getComputedStyle(body).display !== 'none';
    db.click();
    out.bodyReHidden = getComputedStyle(body).display === 'none';
    return out;
  });
  // v0.30.1018 (858cd60e, per user: "make it take less space, make the fonts rounder and cuter") set the dock's
  // objective to Nunito 800 12.5px, the same size as Guguma's line - it is no longer a 15px hero. Pin that size
  // (and that it is not SMALLER than her line) plus the 3D keycaps, which survived the restyle.
  const guguSize = await page.evaluate(() => { const g = document.getElementById('tut-guguma-line'); return g ? parseFloat(getComputedStyle(g).fontSize) : 0; });
  ok('objective is 12.5px (v0.30.1018), not smaller than the Guguma line, with 3D keycaps',
    aaa.heroSize === '12.5px' && parseFloat(aaa.heroSize) >= guguSize && aaa.kbdCap === '3px', { ...aaa, guguSize });
  ok('prose hidden behind Details on objective steps', aaa.hasTry && aaa.bodyHiddenByDefault && aaa.detailsBtnShown, aaa);
  ok('Details toggle reveals + re-hides the prose', aaa.bodyShownAfterDetails && aaa.bodyReHidden, aaa);
  // completion sweep fires on tick
  const flash = await page.evaluate(() => { _tutPing('attack'); return document.querySelector('#tutorial-modal .modal').classList.contains('tut-flash-done'); });
  ok('completion sweep animates the card', flash === true);

  // v0.29.576 (70cf8c69, per user: "ensure each step of the tutorial is completable") gave EVERY step a TRY IT
  // objective, so the informational (pill-less) steps these two checks used to render no longer exist. What they
  // protected - no step without a real objective, and the pill/Details chrome on each - is checked on every step.
  const style = await page.evaluate(() => {
    const bad = [];
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      _tutStep = i; _renderTutorialStep();
      const m = document.getElementById('tutorial-modal'), pill = document.getElementById('tut-try');
      const hasObj = typeof TUTORIAL_STEPS[i].tryIt === 'string' && TUTORIAL_STEPS[i].tryIt.trim().length > 0;
      const pillShown = pill.style.display !== 'none' && (/TRY IT/i.test(pill.textContent) || pill.classList.contains('done'));   // steps ticked earlier in this run show DONE
      const gated = m.classList.contains('has-try') && getComputedStyle(document.getElementById('tut-body')).display === 'none';
      if (!hasObj || !pillShown || !gated) bad.push({ i, t: TUTORIAL_STEPS[i].title, hasObj, pillShown, gated });
    }
    return { steps: TUTORIAL_STEPS.length, bad };
  });
  ok('every tour step carries a real TRY IT objective (v0.29.576)', style.steps >= 14 && style.bad.every(b => b.hasObj), style);
  ok('every step shows its pill with the prose behind Details', style.bad.length === 0, style);

  // Screenshot for a visual check: full page + log the card's box.
  await page.evaluate(() => {
    const lo = document.getElementById('loading-overlay'); if (lo && lo.parentNode) lo.parentNode.removeChild(lo);
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    _showTutorialModal(); _tutStep = 1; TUTORIAL_STEPS[1]._done = false; _renderTutorialStep();
  });
  await page.waitForTimeout(400);
  const box = await page.evaluate(() => { const r = document.querySelector('#tutorial-modal .modal').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  console.log('CARD BOX:', JSON.stringify(box));
  await page.screenshot({ path: process.env.SHOT || '/tmp/tutorial_aaa.png', fullPage: false });

  // Cleanup + safety: closing clears the movement gate.
  await page.evaluate(() => { window._tutWantsMove = true; _closeTutorial(false); });
  ok('close clears the per-frame movement gate', await page.evaluate(() => window._tutWantsMove === false));

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== INTERACTIVE TUTORIAL ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
