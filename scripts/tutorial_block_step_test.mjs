// The tour's "Block & Parry" card (2026-10-04). Per user: "For tutorial, try to add in a small section of combat mechanics by using
// the A button to block (mention key points only)". One card right after the practice-snail step; it waits on a real block
// (startBlock pings 'block') and is `fresh`: an A pressed earlier in the tour does not tick it on arrival, so the lesson is read.
//   node scripts/tutorial_block_step_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11697), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof startTutorial === 'function' && typeof startBlock === 'function' && typeof TUTORIAL_STEPS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = player.cls || 'warrior'; player.level = 5; player._tutorialSeen = false;
  });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    const words = (t) => String(t).replace(/<[^>]+>/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;   // text_tightness_test's rule
    const B = TUTORIAL_STEPS.findIndex((s) => /Block & Parry/.test(s.title)), C = TUTORIAL_STEPS.findIndex((s) => s.detect === 'combo'), step = TUTORIAL_STEPS[B];
    const body = step ? (typeof step.body === 'function' ? step.body() : step.body) : '';
    out.def = { B, C, n: TUTORIAL_STEPS.length, detect: step && step.detect, fresh: !!(step && step.fresh), tryIt: step && step.tryIt, line: step && step.gugumaLine, body,
      bodyWords: words(body), lineWords: words(step && step.gugumaLine), next: TUTORIAL_STEPS[B + 1] && TUTORIAL_STEPS[B + 1].title };
    // what the card claims, read from the game: 70% less (x0.3) while guarding, the parry refunds 15 MP and stuns, the press catches shots, a cooldown
    out.truth = { mp15: /player\.mp \+ 15/.test(String(triggerParry)), stun: /stunTimer/.test(String(triggerParry)), shots: /_lxParryCatch\(\)/.test(String(startBlock)),
      cds: ['warrior', 'rogue', 'mage', 'archer'].map((c) => { const k = player.cls; player.cls = c; const P = getBlockProfile(); player.cls = k; return P.cd; }) };
    if (!step) return out;
    const pill = () => { const p = document.getElementById('tut-try'); return !!(p && p.classList.contains('done')); };
    const clearAll = () => { TUTORIAL_STEPS.forEach((s) => { s._done = false; s._preDone = false; }); for (const k in _TUT_SEEN_TAGS) delete _TUT_SEEN_TAGS[k]; };
    startTutorial(); await wait(600); _showTutorialModal(); await wait(400); clearAll();   // the card must be DOCKED: _tutPing ignores a hidden tour
    // 1. A pressed earlier in the tour records the tag ...
    _tutStep = 1; _renderTutorialStep(); await wait(200); player.blockCD = 0; player.blockTimer = 0; startBlock(); await wait(100);
    out.recorded = !!_TUT_SEEN_TAGS.block;
    // ... but the card still arrives waiting, with its ask on screen
    _tutStep = B; _renderTutorialStep(); await wait(300);
    const card = (document.getElementById('tutorial-modal').textContent || '').replace(/\s+/g, ' ');
    out.arrive = { done: !!step._done, pre: !!step._preDone, pill: pill(), already: /Already done/.test(card), ask: /Raise your guard/.test(card), title: /Block & Parry/.test(card) };
    player.blockCD = 0; player.blockTimer = 0; player.hitStun = 0; game.paused = false;
    return out;
  });
  // 2. the real key: A, pressed while the card shows
  await page.keyboard.press('a'); await page.waitForTimeout(500);
  const after = await page.evaluate(() => { const B = TUTORIAL_STEPS.findIndex((s) => /Block & Parry/.test(s.title)); const p = document.getElementById('tut-try');
    return { done: !!TUTORIAL_STEPS[B]._done, pill: !!(p && p.classList.contains('done')), blocked: (player.blockCD || 0) > 0 }; });
  console.log(JSON.stringify({ ...r, after }));
  ok('a "Block & Parry" card sits right after the practice-snail step (Defeat Monsters), before Level Up', r.def.B > 0 && r.def.B === r.def.C + 1 && /Level Up/.test(r.def.next || ''), r.def);
  ok('it waits on a real block (detect "block") and is fresh', r.def.detect === 'block' && r.def.fresh === true, { detect: r.def.detect, fresh: r.def.fresh });
  ok('the ask and Guguma name the A key', /<kbd>A<\/kbd>/.test(r.def.tryIt || '') && /\bA\b/.test(r.def.line || ''), { tryIt: r.def.tryIt, line: r.def.line });
  ok('key points only: body within the tour\'s 60 words, Guguma within 25', r.def.bodyWords <= 60 && r.def.lineWords <= 25, { body: r.def.bodyWords, line: r.def.lineWords });
  ok('it says: 70% less damage, parry before a hit lands, shots too, a cooldown', /70% less/.test(r.def.body) && /before a hit lands/.test(r.def.body) && /Parry/.test(r.def.body) && /shots/.test(r.def.body) && /cooldown/.test(r.def.body), r.def.body);
  ok('and the game agrees: the parry refunds 15 MP and stuns the attacker, the press catches shots, every class has a cooldown', r.truth.mp15 && r.truth.stun && r.truth.shots && r.truth.cds.every((c) => c > 0), r.truth);
  ok('a block pressed earlier records the tag (the trap: a plain gate would arrive ticked)', r.recorded === true, r.recorded);
  ok('so the card arrives NOT ticked: no check, no "Already done", the ask on screen', r.arrive && r.arrive.done === false && r.arrive.pre === false && r.arrive.pill === false && r.arrive.already === false && r.arrive.ask && r.arrive.title, r.arrive);
  ok('pressing A while the card shows blocks and ticks it', after.blocked && after.done && after.pill, after);
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
