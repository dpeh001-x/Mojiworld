// FIRST HOUR (final polish audit F1-F8, per user: "F8 10 hp and 10 MP potions"; "ensure tutorial working fine and if
// finished the checklist on the tutorial auto goes next"). A fresh hero skips the prologue, pages the intro cards and
// plays the whole tour with real keys: every step ticks and moves on, a step already met counts down and moves on, Y
// ticks the MojiDex step, the last step closes the tour, then Act I is unlocked and named. Also: the title name fills
// the creator, 10 + 10 potions, the dash / block and reset-price copy, Back never auto-advances, a returning save.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/first_hour_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11193';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const URL = `http://localhost:${PORT}/mojiworld_game.html`;
try {
  // ---- 1. the name typed at the title fills the creator's NAME field
  {
    const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return m && m.offsetParent !== null; }, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const ng = await page.$('#menu-newgame'); if (ng) await ng.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200);
    const inp = await page.$('#lo-menu input[type=text], #lo-menu input:not([type]), input[placeholder="Character name"]'); if (inp) await inp.fill('Tester');
    await page.getByText('ENTER MOJIWORLD', { exact: false }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const card = await page.$('#class-select-modal .cls-card'); if (card) await card.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2000);
    for (const sel of ['#cls-confirm', '#class-confirm', '.cls-confirm']) { const b = await page.$(sel); if (b && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; } }
    // the creator can take a few seconds to come up on a loaded machine: wait for its field rather than a fixed 3 s
    await page.waitForFunction(() => { const el = document.getElementById('hero-name-input'); return !!(el && el.offsetParent && el.value); }, null, { timeout: 10000 }).catch(() => {});
    const f = await page.evaluate(() => { const el = document.getElementById('hero-name-input'); return { value: el && el.value, max: el && el.maxLength }; });
    check(f.value === 'Tester', 'the name typed at the title is already in the character creator\'s NAME field', J(f));
    await page.context().close();
  }
  // ---- 2. a fresh hero: potions, the intro cards, the tour
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof applyClass === 'function' && typeof startTutorial === 'function', null, { timeout: 120000 });
  const set = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const hide = () => { for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; } };
    hide(); window._lxBootGateDone = true; window.__toasts = []; const _st = showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return _st.apply(this, arguments); };
    applyClass('warrior'); hide(); await sleep(800);
    for (let i = 0; i < 300 && (window._prologueActive || i < 10); i++) { for (const id of _LX_PLG_SKIPS) { const b = document.getElementById(id); if (b && b.offsetParent !== null) b.click(); } await sleep(200); }
    return { potions: Object.assign({}, player.consumables) };
  });
  check(set.potions.hp_s === 10 && set.potions.mp_s === 10, 'a new hero starts with 10 HP and 10 MP potions', J(set.potions));
  const modalShown = () => page.evaluate(() => { const t = document.getElementById('tutorial-modal'); return !!(t && t.style.display && t.style.display !== 'none'); });
  const beatOn = () => page.evaluate(() => document.getElementById('story-beat-overlay').classList.contains('on'));
  // v0.30.911 (audit F5) the hand-off now waits for the Void eye-zoom to clear, so its time varies: wait for the cards
  // to open, then past the 1 s re-assert, before looking (was a fixed 2.6 s, which the later start could beat).
  for (let i = 0; i < 40 && !(await beatOn()); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(1300);
  const under = { beat: await beatOn(), tour: await modalShown() };
  check(under.beat && !under.tour, 'while the intro cards are up the tour waits for them (the re-assert no longer docks it underneath)', J(under));
  for (let i = 0; i < 90 && ((await beatOn()) || !(await modalShown())); i++) { if (await beatOn()) { await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Enter'); } await page.waitForTimeout(450); }
  const st = () => page.evaluate(() => { const t = document.getElementById('tutorial-modal'); return { step: _tutStep, open: !!(t && t.style.display && t.style.display !== 'none'), next: (document.getElementById('tut-next') || {}).textContent }; });
  const esc = async () => { await page.evaluate(() => { try { closeAllModals(); } catch (e) {} if (document.activeElement) document.activeElement.blur(); }); await page.waitForTimeout(250); };
  const key = async (k, hold) => { await page.evaluate(() => document.activeElement && document.activeElement.blur()); if (hold) { await page.keyboard.down(k); await page.waitForTimeout(hold); await page.keyboard.up(k); } else await page.keyboard.press(k); };
  const tab = (t) => page.evaluate((t) => _lxOpenUPanelTab(t), t);
  const hitSnail = async () => { for (let j = 0; j < 12 && (await st()).step === 5; j++) { await page.evaluate(() => { const m = (game.monsters || []).find((m) => m && m.currentHp > 0 && !m.isBoss); if (m) { player.x = m.x - 45; player.facing = 1; } }); await key('z'); await page.waitForTimeout(250); } };
  const ACT = [['move', () => key('ArrowRight', 700)], ['attack', () => key('z')], ['panel', () => key('u')], ['tab_items', () => tab('items')],
    ['potion', async () => { await esc(); await key('PageUp'); }], ['combo', hitSnail], ['panel (already met)', null], ['tab_items (already met)', null],
    ['tab_boons', () => tab('boons')], ['worldmap', async () => { await esc(); await key('w'); }], ['quest', async () => { await esc(); await key('q'); }],
    ['tab_mojimon', async () => { await esc(); await tab('mojimon'); }], ['codex (Y)', async () => { await esc(); await key('y'); }], ['tab_skills (last)', async () => { await esc(); await tab('skills'); }]];
  const rows = [];
  for (let i = 0; i < ACT.length; i++) {
    const s0 = await st(); if (!s0.open || s0.step !== i) { rows.push({ i, tag: ACT[i][0], bad: J(s0) }); break; }
    const t0 = Date.now(); let count = null; if (ACT[i][1]) await ACT[i][1]();
    let s1 = s0; while (Date.now() - t0 < 7000) { s1 = await st(); if (!s1.open || s1.step !== i) break; if (!count && /\d$/.test(s1.next || '')) count = s1.next; await page.waitForTimeout(100); }
    rows.push({ i, tag: ACT[i][0], moved: !s1.open || s1.step !== i, ms: Date.now() - t0, count });
    await page.waitForTimeout(150);
  }
  const moved = rows.filter((r) => r.moved).length;
  check(moved === ACT.length, 'every one of the 14 tour steps ticks from the real key / tab and moves on by itself', moved + '/' + ACT.length + ' ' + J(rows.filter((r) => !r.moved)));
  const met = rows.filter((r) => /already met/.test(r.tag));
  // both must move on by themselves; the countdown label is sampled every 100 ms, which a loaded machine can miss on one
  check(met.length === 2 && met.every((r) => r.moved) && met.some((r) => /\d$/.test(r.count || '')), 'a step the player already met counts down on Next and moves on by itself', J(met));
  const y = rows.find((r) => /codex/.test(r.tag)); check(!!(y && y.moved), 'pressing Y (the MojiDex, as the step asks) ticks the "Systems to Explore" step', J(y));
  const last = rows[ACT.length - 1]; check(!!(last && last.moved && /Got it/.test(last.count || '')), 'finishing the last step counts down "Got it" and closes the tour', J(last));
  await esc(); await page.waitForTimeout(3200);
  const end = await page.evaluate(() => ({ seen: !!player._tutorialSeen, act1: !!(player.quests.unlocked || {}).q_act1_waking,
    tracker: ((document.getElementById('quest-tracker') || {}).textContent || '').replace(/\s+/g, ' '), told: window.__toasts.some((t) => /Nurse Joyce/.test(t)) }));
  check(end.seen && end.act1, 'when the tour ends, Act I is unlocked (quests used to wait for a level-up)', J({ seen: end.seen, act1: end.act1 }));
  check(/I · The Waking/.test(end.tracker) && /see Nurse Joyce/.test(end.tracker) && end.told, 'the tracker and a toast name the first step: see Nurse Joyce', end.tracker.slice(0, 90));
  // ---- 3. the card copy, Back, a returning save
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms)); const out = {};
    const txt = (i) => { _tutStep = i; _renderTutorialStep(); return (document.getElementById('tutorial-modal').textContent || '').replace(/\s+/g, ' '); };
    _showTutorialModal(); await sleep(300);
    out.fight = txt(1).includes('dashes you clear') && /blocks — raise it just as a hit lands to parry/.test(txt(1));
    const lv = TUTORIAL_STEPS.findIndex((s) => /Level Up/.test(s.title)); const lt = txt(lv);
    out.reset = /refunds every point for 20% of your Mojicoins and [\d,]+ Setshards/.test(lt) && !/Brok charges/.test(lt);
    _TUT_SEEN_TAGS.panel = true; TUTORIAL_STEPS.forEach((s) => { s._done = false; s._preDone = false; });
    _tutStep = lv + 1; _renderTutorialStep(); await sleep(200); document.getElementById('tut-prev').click(); await sleep(4000);
    out.back = { step: _tutStep, want: lv };
    _closeTutorial(true); await sleep(1500);
    player._tutorialSeen = true; player.quests.unlocked = {}; player.quests.active = {}; loadMap('town', 400); await sleep(2600);
    out.returning = !!(player.quests.unlocked || {}).q_act1_waking;
    return out;
  });
  check(r.fight, 'the Move & Fight card teaches the dash (Shift) and the block / parry (A)', J(r.fight));
  check(r.reset, 'the stat card states the real reset price (20% Mojicoins + Setshards), not "Brok charges"', J(r.reset));
  check(r.back.step === r.back.want, 'a step reached with Back stays put (no countdown)', J(r.back));
  check(r.returning, 'a returning save with nothing unlocked gets Act I on arrival', J(r.returning));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
