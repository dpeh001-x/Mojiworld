// ACT I FLOW (final polish audit F9; per user "Work on all the above"). Accepting a quest from an NPC says so once
// (it said "Quest accepted" and "Quest started"); turning an Act I chapter in starts the next one when the level allows
// and names who it goes back to; a chapter the player is not yet levelled for says when it opens and whom to see.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/act1_flow_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11211';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _completeQuest === 'function' && typeof _injectGiverQuests === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 1; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('town', 400); await sleep(2000); try { closeAllModals(); } catch (e) {}
    const toasts = []; const _st = showToast; window.showToast = function (m) { toasts.push(String(m)); return _st.apply(this, arguments); };
    tickQuestUnlocks();
    // accept chapter I the way a player does: Nurse Joyce's dialog option
    const opts = []; _injectGiverQuests({ name: 'Nurse Joyce' }, opts);
    const acc = opts.find((o) => /Accept: .*Waking/.test(o.t)); toasts.length = 0;
    if (acc) acc.cb();
    await sleep(200); out.acceptToasts = toasts.filter((t) => /Quest (accepted|started)/.test(t));
    // turn it in: chapter II starts on its own
    player.level = 3; toasts.length = 0;
    player.quests.active.q_act1_waking.readyToHandIn = true;
    _completeQuest('q_act1_waking'); await sleep(2800);
    out.sleepers = !!player.quests.active.q_act1_sleepers; out.chainToasts = toasts.filter((t) => /hand it in to|opens at Lv/.test(t));
    // chapter V needs Lv 8: turning chapter IV in at Lv 5 says when it opens (chapter II's own reward can level a Lv 3
    // player into chapter III, so the gate is measured where the gap is wider than any one reward)
    for (const q of ['q_act1_sleepers', 'q_act1_quiet']) { delete player.quests.active[q]; player.quests.completed[q] = true; }
    player.level = 5; player.exp = 0; tickQuestUnlocks();
    acceptQuest('q_act1_recipe'); toasts.length = 0;
    if (player.quests.active.q_act1_recipe) player.quests.active.q_act1_recipe.readyToHandIn = true;
    _completeQuest('q_act1_recipe'); await sleep(2800);
    out.levelAfter = player.level;
    out.nameActive = !!player.quests.active.q_act1_name; out.gateToast = toasts.find((t) => /opens at Lv 8/.test(t)) || null;
    return out;
  });
  check(r.acceptToasts.length === 1, 'accepting a quest from an NPC shows one toast (was "Quest accepted" + "Quest started")', J(r.acceptToasts));
  check(r.sleepers && r.chainToasts.some((t) => /hand it in to Nurse Joyce/.test(t)), 'turning chapter I in starts chapter II, and says who it goes back to', J(r.chainToasts));
  check(r.levelAfter < 8 && !r.nameActive && /Master Shen/.test(r.gateToast || ''), 'a chapter the player is not levelled for says when it opens and whom to see', J({ lv: r.levelAfter, active: r.nameActive, toast: r.gateToast }));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
