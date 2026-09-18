// PAD HINTS + ONE CHAPTER TOAST (v0.30.902). While a controller is the prompt device, toasts, NPC lines, the tour, the
// story-scene hint, the shackle QTE, the pause card, the compass chip and the "to close" footers name pad buttons, not
// keyboard keys - and a keyboard player still sees the keys. E (quest guide) and H (MojiMon) get Back-chord routes, so
// the hints naming them point somewhere real. Turning an Act I chapter in shows ONE toast (was four in 2.5 s).
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pad_hints_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11241';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const PAD = () => {
  try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {}
  window.__pad = { id: 'probe-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__padOn = false; navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
  window.__btn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 }; window.__pad.timestamp = performance.now(); };
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(PAD);
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPadActive === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    applyClass('warrior'); player.level = 100; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await wait(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
    const toasts = []; const _st = showToast;
    window.showToast = function (m) { toasts.push(String(m)); return _st.apply(this, arguments); };
    const shown = () => [...document.querySelectorAll('#toast-container .toast')].map((t) => t.textContent);
    const T = { bag: 'Boon bag full (3/3) — discard one first (press U)', dash: 'Tip: DASH (Shift) right through the boss attack', keys: 'Tutorial complete! Press K for the keybind panel anytime.',
      mon: '⛓ Slime assigned to H', sigil: 'METEOR SIGIL - tap B (x10) within 8s', dev: 'Pop-up blocked — allow pop-ups for this site, then press 7 again.' };
    // keyboard: the keys stay
    _lxNoteInput('kb'); out.kb = [];
    for (const k in T) { try { document.getElementById('toast-container').innerHTML = ''; } catch (e) {} showToast(T[k], 'rare'); out.kb.push(shown().slice(-1)[0]); }
    try { document.getElementById('toast-container').innerHTML = ''; } catch (e) {}
    // a real pad press makes the pad the prompt device
    window.__padOn = true; window.dispatchEvent(new Event('gamepadconnected')); window.__btn(0, 1); await wait(150); window.__btn(0, 0); await wait(200);
    out.device = _lxInputDevice;
    showToast(T.bag, 'rare'); const bag = shown().slice(-1)[0];
    showToast(T.dash, 'rare'); const dash = shown().slice(-1)[0];
    showToast(T.keys, 'rare'); const keys = shown().slice(-1)[0];
    showToast(T.mon, 'epic'); const mon = shown().slice(-1)[0];
    showToast(T.sigil, 'legendary'); const sigil = shown().slice(-1)[0];
    try { document.getElementById('toast-container').innerHTML = ''; } catch (e) {}
    showToast(T.dev, 'rare'); const dev = shown().slice(-1)[0];
    out.pad = { bag, dash, keys, mon, sigil, dev };
    // NPC speech and an option
    const dlg = document.getElementById('dialog'); if (dlg) dlg.style.display = 'block';
    _runDialogTypewriter('Spend them in the character sheet (U). Walk up and press N to see me.'); await wait(3500);
    out.dialog = (document.getElementById('dialog-text') || {}).textContent || '';
    if (dlg) dlg.style.display = 'none';
    // the story-scene hint, the QTE line, the pause card, the compass chip, the footers
    _playStoryBeat({ stanzas: [{ text: 'one' }, { text: 'two' }] }, () => {}); await wait(500);
    out.beatHint = (document.getElementById('story-beat-hint') || {}).textContent || '';
    try { const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); document.body.dispatchEvent(e); } catch (e) {}
    await wait(400); try { closeAllModals(); } catch (e) {} game.paused = false;
    player.stunTimer = 0; _qteShackleStart({ type: 'slime', x: player.x, y: player.y }); await wait(100);
    out.qte = ((document.querySelector('#lx-qte .lxq-sub') || {}).textContent) || '';
    try { _qteEnd(true); } catch (e) {} try { _qteHide(0); } catch (e) {} player.stunTimer = 0; await wait(300);
    _lxPauseOpen(); out.pauseKbd = [...document.querySelectorAll('#lx-pause kbd')].map((k) => k.textContent); try { _lxPauseClose(); } catch (e) {}
    try { _qnavKeyEnsure(); } catch (e) {} out.chip = ((document.querySelector('#qnav-key .qk-k') || {}).textContent) || '';
    out.wmFoot = ((document.querySelector('.wm-hd-key') || {}).textContent) || '';
    try { openLevelUpPanel(); await wait(300); } catch (e) {}
    out.uFoot = ((document.querySelector('.u-close-hint') || {}).textContent) || ''; try { closeAllModals(); } catch (e) {}
    // the tour: its pad table and Guguma's lines
    out.tour = _tutTouchify('<kbd>C</kbd>|<kbd>D</kbd>|<kbd>B</kbd>|<kbd>E</kbd>|<kbd>K</kbd>').replace(/<[^>]+>/g, '');
    const iDoors = TUTORIAL_STEPS.findIndex((s) => /Three doors/.test(s.gugumaLine || ''));
    const iQ = TUTORIAL_STEPS.findIndex((s) => /Press Q and see/.test(s.gugumaLine || ''));
    const gl = (i) => { try { _tutStep = i; _renderTutorialStep(); } catch (e) {} return ((document.getElementById('tut-guguma-line') || {}).textContent) || ''; };
    out.gDoors = gl(iDoors); out.gQ = gl(iQ); try { _closeTutorial(true); } catch (e) {} try { closeAllModals(); } catch (e) {}
    // the Back-chord routes for H and E, through the real poller
    let summons = 0, guides = 0; const _ms = window._mojimonQuickSummon, _qc = window._qnavCycle;
    window._mojimonQuickSummon = () => { summons++; }; window._qnavCycle = () => { guides++; };
    game.paused = false; await wait(200);
    window.__btn(8, 1); await wait(150); window.__btn(5, 1); await wait(150); window.__btn(5, 0); await wait(150);
    window.__btn(7, 1); await wait(150); window.__btn(7, 0); await wait(150); window.__btn(8, 0); await wait(300);
    window._mojimonQuickSummon = _ms; window._qnavCycle = _qc;
    out.chord = { summons, guides, h: _lxPadGlyphForKey('h'), e: _lxPadGlyphForKey('e') };
    // back to the keyboard: the footers come back
    _lxNoteInput('kb'); out.wmFootKb = ((document.querySelector('.wm-hd-key') || {}).textContent) || '';
    out.chipKb = ((document.querySelector('#qnav-key .qk-k') || {}).textContent) || '';
    window.__padOn = false; try { closeAllModals(); } catch (e) {}
    // ONE toast per chapter turn-in
    player.level = 1; player.exp = 0;
    for (const q of Object.keys(player.quests.active || {})) delete player.quests.active[q];
    for (const q of ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword']) { delete player.quests.completed[q]; delete player.quests.unlocked[q]; }
    tickQuestUnlocks(); acceptQuest('q_act1_waking');
    player.level = 3; await wait(2500); toasts.length = 0;   // the tour's close queues its own Act I pointer 1.4 s out
    player.quests.active.q_act1_waking.readyToHandIn = true;
    _completeQuest('q_act1_waking'); await wait(3200);
    const chap = (list) => list.filter((t) => /Quest complete|Quest started|STORY|hand it in|Next|opens at Lv|new story quests/.test(t));
    out.turnIn = chap(toasts); out.sleepers = !!player.quests.active.q_act1_sleepers; out.fresh = !!((player.quests.fresh || {}).q_act1_sleepers);
    // a chapter the player is not levelled for: still one toast, and the level-up that opens it later still announces it
    for (const q of ['q_act1_sleepers', 'q_act1_quiet']) { delete player.quests.active[q]; player.quests.completed[q] = Date.now(); }
    player.level = 5; player.exp = 0; tickQuestUnlocks(); acceptQuest('q_act1_recipe'); await wait(300); toasts.length = 0;
    if (player.quests.active.q_act1_recipe) player.quests.active.q_act1_recipe.readyToHandIn = true;
    _completeQuest('q_act1_recipe'); await wait(3200);
    out.gated = chap(toasts); out.lvAfter = player.level;
    if (window._lxChapterTurnIn) window._lxChapterTurnIn.t -= 6000;
    toasts.length = 0; player.level = 8; tickQuestUnlocks(); await wait(200);
    out.later = chap(toasts);
    return out;
  });
  const kbAll = r.kb.join(' | ');
  check(/press U\)/.test(kbAll) && /\(Shift\)/.test(kbAll) && /Press K/.test(kbAll) && /assigned to H/.test(kbAll), 'a keyboard player still sees the keys', kbAll.slice(0, 200));
  check(r.device === 'pad' && /press Back\)/.test(r.pad.bag) && /\(Back\+LB\)/.test(r.pad.dash) && /Start ▸ Hotkeys/.test(r.pad.keys) && /tap Back\+Ⓨ/.test(r.pad.sigil),
    'toasts name the pad buttons (U, Shift, K, B)', J(r.pad));
  check(/assigned to Back\+RB/.test(r.pad.mon) && /press 7/.test(r.pad.dev), 'H names its new pad route; a keyboard-only key keeps its name', J([r.pad.mon, r.pad.dev]));
  check(/sheet \(Back\)/.test(r.dialog) && /press Ⓨ/.test(r.dialog), 'NPC speech names pad buttons', r.dialog);
  check(/Ⓐ/.test(r.beatHint) && !/Enter|Esc/.test(r.beatHint), 'the story-scene hint names A and B, not Enter and Esc', r.beatHint);
  check(/D-pad/.test(r.qte) && !/arrow keys/.test(r.qte), 'the shackle QTE says D-pad', r.qte);
  check(J(r.pauseKbd) === J(['Start']), 'the pause card shows Start for Resume and no K', J(r.pauseKbd));
  check(r.chip === 'Back+RT' && r.chipKb === 'E', 'the compass chip names its button for the device in use', J([r.chip, r.chipKb]));
  check(/Ⓑ to close/.test(r.wmFoot) && /Ⓑ to close/.test(r.uFoot) && /Press W to close/.test(r.wmFootKb), '"to close" footers say B on a pad, W again on the keyboard', J([r.wmFoot, r.uFoot, r.wmFootKb]));
  check(J(r.tour.split('|')) === J(['Back+Ⓐ', 'Back+Ⓑ', 'Back+Ⓨ', 'Back+RT', 'Start → Hotkeys']), "the tour's pad table: C, D, B, E and K name the right buttons", r.tour);
  check(/all behind Back/.test(r.gDoors) && !/U is your build/.test(r.gDoors) && /Press Back\+✚▼/.test(r.gQ), "Guguma's tour lines name pad routes", J([r.gDoors.slice(0, 60), r.gQ.slice(0, 60)]));
  check(r.chord.summons === 1 && r.chord.guides === 1 && r.chord.h === 'Back+RB' && r.chord.e === 'Back+RT', 'Back+RB summons the MojiMon, Back+RT steps the quest guide', J(r.chord));
  check(r.turnIn.length === 1 && /Quest complete/.test(r.turnIn[0]) && /hand it in to Nurse Joyce/.test(r.turnIn[0]) && r.sleepers && r.fresh,
    'a chapter turn-in shows ONE toast: the reward and the next chapter (was four)', J({ toasts: r.turnIn, active: r.sleepers, fresh: r.fresh }));
  check(r.gated.length === 1 && /opens at Lv 8/.test(r.gated[0]) && /Master Shen/.test(r.gated[0]) && r.lvAfter < 8, 'a chapter not yet open: one toast saying when and whom to see', J(r.gated));
  check(r.later.some((t) => /STORY/.test(t)), 'the level-up that later opens it still announces it', J(r.later));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
