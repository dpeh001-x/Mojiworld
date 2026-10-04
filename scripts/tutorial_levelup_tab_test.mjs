// The tour's Level Up step asks for the Level Up TAB, and only a visit made while the card shows ticks it.
//
// Per user (screenshot of step 8/14 arriving already ticked): "This step should be open U and click on the level up tab, ensure that the
// gate is to open the level up tab as well. Also instruct the player that stats can be added there". The step waited on 'panel' (any U press)
// and said "eye your stat cards". U opens on the Level Up tab, so the first U press (step 3) records 'tab_lp' as well, and a plain tab gate
// would arrive pre-ticked ("Already done - ahead of me!"): the step is marked `fresh`, which skips the on-arrival tick.
//   node scripts/tutorial_levelup_tab_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11695), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof startTutorial === 'function' && typeof openLevelUpPanel === 'function' && typeof TUTORIAL_STEPS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = player.cls || 'warrior'; player.level = 5; player._tutorialSeen = false;
  });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    const closeU = () => { const am = document.getElementById('attributes-modal'); if (am && am.style.display === 'flex') { am.style.display = 'none'; game.paused = false; } };
    const words = (t) => String(t).replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;   // text_tightness_test's rule for a tour body
    const idx = (re) => TUTORIAL_STEPS.findIndex((s) => re.test(s.title)), L = idx(/Level Up/), M = idx(/Your Menus/), I = idx(/Inventory/);
    const step = TUTORIAL_STEPS[L], card = () => (document.getElementById('tutorial-modal').textContent || '').replace(/\s+/g, ' ');
    const pill = () => { const p = document.getElementById('tut-try'); return !!(p && p.classList.contains('done')); };
    const clearAll = () => { TUTORIAL_STEPS.forEach((s) => { s._done = false; s._preDone = false; }); for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k]; };
    const tabBtn = (t) => [...document.querySelectorAll('#u-tabs .inv-tab')].find((b) => b.dataset.utab === t);
    out.def = { L, title: step.title, detect: step.detect, fresh: step.fresh === true, tryIt: step.tryIt, line: step.gugumaLine, body: String(step.body), bodyWords: words(typeof step.body === 'function' ? step.body() : step.body), invDetect: TUTORIAL_STEPS[I].detect, menusDetect: TUTORIAL_STEPS[M].detect, n: TUTORIAL_STEPS.length };
    startTutorial(); await wait(600); _showTutorialModal(); await wait(400); clearAll(); closeU();   // the card must be DOCKED: _tutPing ignores a hidden tour
    // 1. the player opened U earlier in the tour (step 3): the Level Up tab was shown, its tag recorded - the step must still be waiting on arrival
    game._uTab = 'lp'; openLevelUpPanel(); await wait(500); closeU(); out.recorded = !!_TUT_SEEN_TAGS.tab_lp;
    _tutStep = L; _renderTutorialStep(); await wait(300);
    out.arrive = { done: !!step._done, pre: !!step._preDone, pill: pill(), already: /Already done/.test(card()), ask: /Open U and click the Level Up tab/.test(card()) };
    // 2. U reopens on the tab they last used (Items): opening it does not tick, clicking Level Up does
    game._uTab = 'items'; openLevelUpPanel(); await wait(500); out.openItems = { done: !!step._done };
    const b = tabBtn('lp'); out.found = !!b; if (b) b.click(); await wait(500);
    out.clicked = { done: !!step._done, pill: pill(), title: /\u2705/.test(document.getElementById('tut-step-title').textContent) };
    // 3. the panel is already ON Level Up when the card arrives: clicking the active tab again counts
    step._done = false; _tutStep = L; _renderTutorialStep(); await wait(300); out.already = { arrive: !!step._done };
    const b2 = tabBtn('lp'); if (b2) b2.click(); await wait(400); out.again = { done: !!step._done };
    closeU();
    // 4. the other steps keep the on-arrival tick: panel (Your Menus) and tab_items (Inventory) are still satisfied by an earlier visit
    clearAll(); _TUT_SEEN_TAGS.panel = true; _tutStep = M; _renderTutorialStep(); await wait(300); out.menusPre = !!TUTORIAL_STEPS[M]._done;
    _TUT_SEEN_TAGS.tab_items = true; _tutStep = I; _renderTutorialStep(); await wait(300); out.invPre = !!TUTORIAL_STEPS[I]._done;
    return out;
  });
  console.log(JSON.stringify(r));
  ok('the step is "Level Up & Allocate Points" and waits on the Level Up tab (tab_lp), marked fresh', /Level Up & Allocate/.test(r.def.title) && r.def.detect === 'tab_lp' && r.def.fresh === true, r.def);
  ok('the ask names the tab: "Open U and click the Level Up tab"', /Open <kbd>U<\/kbd> and click the <b>Level Up<\/b> tab/.test(r.def.tryIt), r.def.tryIt);
  ok('the Guguma line, visible without opening Details, says stat points go there too', /stat points/.test(r.def.line) && /here/.test(r.def.line), r.def.line);
  ok('the body stays inside the tour limit of 60 words (it was 69 in v0.30.1567, which text_tightness_test caught on main): ' + r.def.bodyWords, r.def.bodyWords <= 60, r.def.bodyWords);
  ok('the card tells the player stat points are added on that tab', /Level Up<\/b> tab is where you <b>add stat points<\/b>/.test(r.def.body) && /spend a Skill Point/.test(r.def.body), r.def.body.slice(0, 160));
  ok('the other steps keep their gates (Menus: panel, Inventory: tab_items), 15 steps in all (v0.30.1630: Block & Parry)', r.def.menusDetect === 'panel' && r.def.invDetect === 'tab_items' && r.def.n === 15, { menus: r.def.menusDetect, inv: r.def.invDetect, n: r.def.n });
  ok('the first U press recorded the Level Up tag (the trap: a plain gate would arrive ticked)', r.recorded === true, r.recorded);
  ok('so the step arrives NOT ticked: no check, no "Already done", the ask is on screen', r.arrive.done === false && r.arrive.pre === false && r.arrive.pill === false && r.arrive.already === false && r.arrive.ask === true, r.arrive);
  ok('opening U on another tab does not tick it', r.openItems.done === false, r.openItems);
  ok('clicking the Level Up tab ticks it (pill done, title checked)', r.found && r.clicked.done === true && r.clicked.pill === true && r.clicked.title === true, r.clicked);
  ok('with U already on Level Up when the card arrives, it waits - and clicking the tab again ticks it', r.already.arrive === false && r.again.done === true, { arrive: r.already.arrive, again: r.again.done });
  ok('Your Menus and Inventory still tick on arrival when their tag was seen earlier (the pre-seen path is untouched)', r.menusPre === true && r.invPre === true, { menus: r.menusPre, inv: r.invPre });
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
