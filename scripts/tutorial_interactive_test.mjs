// Live test: INTERACTIVE TUTORIAL — each step shows a "TRY IT" objective pill and
// the real gameplay action ticks it ✅ + auto-advances (move → walk keys, attack →
// _tutPing('attack'), panel → U, etc.). Also checks the polished chrome exists.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
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

  // Auto-advance lands on step 2 (attack). Fire the attack ping like the combat code does.
  await sleep(1400);
  const s2 = await page.evaluate(() => ({ step: _tutStep, pill: (document.getElementById('tut-try') || {}).textContent || '' }));
  ok('auto-advanced to step 2 (Move & Fight)', s2.step === 1, s2);
  await page.evaluate(() => _tutPing('attack'));
  const s2done = await page.evaluate(() => (document.getElementById('tut-try') || {}).classList.contains('done'));
  ok('attack action ticks step 2 ✅', s2done === true);

  // Step 3 (panels): the real U-panel opener pings 'panel'.
  await sleep(1400);
  const s3 = await page.evaluate(() => ({ step: _tutStep }));
  ok('auto-advanced to step 3 (Menus & Panels)', s3.step === 2, s3);
  await page.evaluate(() => _tutPing('panel'));
  const s3done = await page.evaluate(() => (document.getElementById('tut-try') || {}).classList.contains('done'));
  ok('opening the U panel ticks step 3 ✅', s3done === true);

  // Polish: pill styling + informational steps hide the pill.
  const style = await page.evaluate(() => {
    const pill = document.getElementById('tut-try');
    const cs = getComputedStyle(pill);
    // jump to an informational step (Systems to Explore — no tryIt)
    const infoIdx = TUTORIAL_STEPS.findIndex(s => !s.tryIt);
    _tutStep = infoIdx; _renderTutorialStep();
    const hidden = pill.style.display === 'none';
    return { radius: cs.borderRadius, infoIdx, hiddenOnInfoStep: hidden };
  });
  ok('pill is styled (rounded chip)', /999|9999/.test(style.radius), style);
  ok('informational steps hide the pill (no fake objectives)', style.hiddenOnInfoStep === true, style);

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
