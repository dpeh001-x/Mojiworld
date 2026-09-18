// CONTROLLER / STEAM DECK (v0.30.897 launch audit). A virtual gamepad (navigator.getGamepads stub) drives the real poller:
// no pad prompts before a pad is touched; landed hits rumble; a pad's B needs a second press to skip a story scene (the
// keyboard's Esc still skips at once); LT needs a second pull to skip the tour; a <select> changes under the ring; the
// pause card reaches Multiplayer and (when it applies) Ascend; the Boss Rush card is routed; a Steam Deck gets the
// desktop layout.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pad_deck_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11215';
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
const boot = async (ctx) => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxPadActive === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { page, errs }; };
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(PAD);
  const { page, errs } = await boot(ctx);
  const early = await page.evaluate(() => ({ t: Math.round(performance.now()), active: _lxPadActive(30000) }));
  check(early.t < 30000 && early.active === false, 'no pad is assumed before one is touched (the first 30 s of every session said "pad")', J(early));
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
    applyClass('warrior'); player.level = 100; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await wait(1500); try { closeAllModals(); } catch (e) {} game.paused = false;
    window.__padOn = true; window.dispatchEvent(new Event('gamepadconnected')); window.__btn(0, 1); await wait(120); window.__btn(0, 0); await wait(200);
    // 2. rumble on a landed hit through the class clip path
    let rumbles = 0; const _r = window._lxPadRumble; window._lxPadRumble = (k) => { rumbles++; };
    const _el = window._uiSfxEl, _pl = window._playUiSfx; window._uiSfxEl = () => ({ readyState: 4 }); window._playUiSfx = () => {};
    _lxImpactSfx(false); _lxImpactSfx(true); out.rumbles = rumbles;
    const hid = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    rumbles = 0; _lxImpactSfx(false); out.hiddenRumbles = rumbles; delete document.hidden;
    window._lxPadRumble = _r; window._uiSfxEl = _el; window._playUiSfx = _pl;
    // 3. story scene: pad B twice, keyboard Esc once
    const sb = () => document.getElementById('story-beat-overlay').classList.contains('on');
    const padEsc = () => { const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); e._lxPad = true; document.body.dispatchEvent(e); };
    _playStoryBeat({ stanzas: [{ text: 'one' }, { text: 'two' }] }, () => {}); await wait(600);
    padEsc(); await wait(250); out.afterOneB = { open: sb(), hint: document.getElementById('story-beat-hint').textContent };
    padEsc(); await wait(500); out.afterTwoB = { open: sb() };
    _playStoryBeat({ stanzas: [{ text: 'one' }, { text: 'two' }] }, () => {}); await wait(600);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(500); out.keyboardEsc = { open: sb() };
    try { closeAllModals(); } catch (e) {} game.paused = false; await wait(300);
    // 4. the tour: LT twice
    try { _showTutorialModal(); } catch (e) {} await wait(600);
    const tut = () => { const t = document.getElementById('tutorial-modal'); return !!(t && t.style.display !== 'none' && getComputedStyle(t).display !== 'none'); };
    out.tourOpen = tut();
    window.__btn(6, 1); await wait(150); window.__btn(6, 0); await wait(300); out.afterOneLT = tut();
    window.__btn(6, 1); await wait(150); window.__btn(6, 0); await wait(400); out.afterTwoLT = tut();
    try { closeAllModals(); } catch (e) {} game.paused = false; await wait(300);
    // 5. a <select> under the ring
    openSettingsModal(); await wait(500);
    const sel = document.getElementById('set-difficulty'); const before = sel.value; let changes = 0; sel.addEventListener('change', () => changes++);
    for (let i = 0; i < 60 && !(document.querySelector('.pad-focus') === sel); i++) { window.__btn(13, 1); await wait(90); window.__btn(13, 0); await wait(90); }
    out.ringOnSelect = document.querySelector('.pad-focus') === sel;
    window.__btn(0, 1); await wait(120); window.__btn(0, 0); await wait(200); const afterA1 = sel.value;
    window.__btn(0, 1); await wait(120); window.__btn(0, 0); await wait(200);
    out.select = { before, afterA1, afterA2: sel.value, changes };
    try { closeAllModals(); } catch (e) {} game.paused = false; await wait(300);
    // 6. the pause card
    _lxPauseOpen(); await wait(200);
    out.pauseRows = [...document.querySelectorAll('#lx-pause .lxp-btn')].map((b) => b.dataset.a);
    _lxPauseAct('mp'); await wait(400); const mp = document.getElementById('multiplayer-modal'); out.mpOpen = !!(mp && getComputedStyle(mp).display !== 'none');
    try { closeAllModals(); } catch (e) {}
    out.bossRushRouted = _LX_PAD_MODAL_IDS.includes('boss-rush-results');
    out.deckClass = document.body.classList.contains('force-desktop');
    return out;
  });
  check(r.rumbles === 2 && r.hiddenRumbles === 0, 'landed hits and crits rumble the pad again on the class clip path, and a hidden tab stays still', J({ rumbles: r.rumbles, hidden: r.hiddenRumbles }));
  check(r.afterOneB.open && /again to skip/.test(r.afterOneB.hint) && !r.afterTwoB.open && !r.keyboardEsc.open, 'a story scene: the pad\u2019s B asks once and skips on the second press; the keyboard\u2019s Esc still skips at once', J({ one: r.afterOneB, two: r.afterTwoB, kb: r.keyboardEsc }));
  check(r.tourOpen && r.afterOneLT && !r.afterTwoLT, 'the tour: one LT pull asks, the second skips (one pull closed it for good)', J({ open: r.tourOpen, one: r.afterOneLT, two: r.afterTwoLT }));
  check(r.ringOnSelect && r.select.afterA1 !== r.select.before && r.select.afterA2 !== r.select.afterA1 && r.select.changes >= 2, 'the Difficulty dropdown changes under the pad (A steps its options, change fires)', J(r.select));
  check(r.pauseRows.includes('mp') && r.pauseRows.includes('ascend') && r.mpOpen, 'the pause card reaches Multiplayer and, at Lv 100, Ascend', J({ rows: r.pauseRows, mp: r.mpOpen }));
  check(r.bossRushRouted, 'the Boss Rush results card is routed for the pad');
  check(!r.deckClass, 'a desktop browser keeps its own layout choice', J(r.deckClass));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
  await ctx.close();
  // 8. a Steam Deck
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  await ctx2.addInitScript(PAD); await ctx2.addInitScript(() => { window.SteamAPI = { available: false, deck: true }; });
  const b2 = await boot(ctx2); await b2.page.waitForTimeout(1500);
  const deck = await b2.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, forceDesktop: document.body.classList.contains('force-desktop'), deckShown: (() => { const d = document.querySelector('.mobile-deck'); return !!(d && getComputedStyle(d).display !== 'none'); })() }));
  check(deck.forceDesktop && !deck.deckShown, 'a Steam Deck with a touch screen gets the desktop layout, not the phone controls', J(deck));
  await ctx2.close();
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
