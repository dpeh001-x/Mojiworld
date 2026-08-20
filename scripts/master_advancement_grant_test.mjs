// Completing The Distorted Portal actually OFFERS the master advancement, per
// tester report: "advancement quest is done but no advancement was granted".
//
// The defect: openMasterAdvancement auto-fired in exactly two places — the
// single level-up frame where level === 40, and 400ms after the Lv-20 job pick.
// The common order (hit 40 first, get told to finish the quest, finish it) hit
// NEITHER: quest completion triggered nothing, later level-ups failed the
// strict ===, and — worse — gainXp deliberately freezes the level chain at 40
// until a master is picked (_blockedByMaster), so the stranded player also
// could not level. Quest checked off, no advancement, stuck. Three layers fix
// it, and each is graded here separately:
//   1. q_distorted_portal completion opens the pick (the primary moment),
//   2. any level-up while the pick is pending re-offers it,
//   3. loadState recovers saves ALREADY stranded by the old wiring.
// Plus the original gate must still hold: no quest, no pick.
// Run: node scripts/master_advancement_grant_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof MASTERS === 'object', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  const out = {};
  const modal = () => document.getElementById('advancement-modal');
  const modalOpen = () => { const m = modal(); return !!(m && m.style.display !== 'none' && m.style.display !== ''); };
  const closeModal = () => { const m = modal(); if (m) m.style.display = 'none'; game.paused = false; };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(120); } return fn(); };
  const setup = (questDone) => {
    player.cls = 'mage'; player.job = 'warlock'; player.master = null;
    player.level = 40;
    // Story beats already seen, so the advancement_2 cutscene doesn't swallow
    // the modal-open in a headless run.
    player._storyBeatsSeen = player._storyBeatsSeen || {};
    player._storyBeatsSeen.advancement_2 = true;
    player.quests = player.quests || { active: {}, completed: {}, unlocked: {} };
    delete player.quests.active.q_distorted_portal;
    if (questDone) player.quests.completed.q_distorted_portal = true;
    else delete player.quests.completed.q_distorted_portal;
    closeModal();
  };

  // ---- the original gate still holds: quest NOT done -> redirect, no modal ----
  setup(false);
  const toasts = [];
  const origToast = window.showToast;
  window.showToast = function (t) { toasts.push(String(t)); return origToast.apply(this, arguments); };
  openMasterAdvancement();
  await wait(400);
  out.gate = { modal: modalOpen(), redirect: toasts.some((t) => /Distorted Portal/.test(t)) };
  toasts.length = 0;

  // ---- LAYER 1: completing the quest offers the pick ----
  setup(false);
  player.quests.completed.q_distorted_portal = true;   // what _questGoalMet records
  _completeQuest && (delete player.quests.completed.q_distorted_portal);
  // drive the REAL completion path: active quest -> _completeQuest(id)
  player.quests.active.q_distorted_portal = { progress: 1 };
  _completeQuest('q_distorted_portal');
  out.layer1 = {
    completed: !!player.quests.completed.q_distorted_portal,
    modalOpened: await until(modalOpen, 4000),
    toast: toasts.some((t) => /MASTER Advancement/i.test(t)),
  };
  // ---- and the pick actually GRANTS: click a master card ----
  let granted = null;
  if (modalOpen()) {
    const card = document.querySelector('#advancement-options .class-card');
    if (card) { card.click(); await wait(300); granted = player.master; }
  }
  out.layer1.granted = granted;
  out.layer1.grantedValid = !!(granted && MASTERS[granted] && MASTERS[granted].from === 'warlock');
  closeModal();

  // ---- LAYER 2: a level-up while the pick is pending re-offers it ----
  setup(true);
  // the level-up trigger lives in the levelUp path; drive it via the real
  // XP pipeline (gainXp -> _maybeLevelUp -> levelUp)
  player.level = 41;   // past the strict ===40 frame the old code required
  player.master = null;
  if (typeof _masterAdvancePending === 'function') {
    out.layer2 = { pending: _masterAdvancePending() };
    // call the level-up trigger the way levelUp does — re-run the block by
    // simulating one more level
    player.exp = player.expToNext || 1000;
    try { if (typeof _maybeLevelUp === 'function') _maybeLevelUp(); } catch (e) {}
    out.layer2.modalOpened = await until(modalOpen, 3000);
  } else {
    out.layer2 = { pending: false, modalOpened: false, noPredicate: true };
  }
  closeModal();

  // ---- LAYER 3: a save ALREADY stranded recovers on load ----
  setup(true);
  player.master = null;
  try { saveState(); } catch (e) { out.saveErr = String(e).slice(0, 80); }
  for (let i = 0; i < 600 && game._saveTimer; i++) await wait(20);
  out.saveLanded = !game._saveTimer;
  closeModal();
  try { loadState(); } catch (e) { out.loadErr = String(e).slice(0, 80); }
  out.layer3 = {
    master: player.master,
    questDone: !!(player.quests.completed && player.quests.completed.q_distorted_portal),
    modalOpened: await until(modalOpen, 7000),   // recovery is delayed ~3.7s past load
  };
  closeModal();
  window.showToast = origToast;
  return out;
});
await browser.close();

console.log(`  gate:   ${JSON.stringify(r.gate)}`);
console.log(`  layer1: ${JSON.stringify(r.layer1)}`);
console.log(`  layer2: ${JSON.stringify(r.layer2)}`);
console.log(`  layer3: ${JSON.stringify(r.layer3)}  (save landed: ${r.saveLanded})`);

check(!r.gate.modal && r.gate.redirect, 'quest NOT done: still redirected to the portal, no pick offered', r.gate);
check(r.layer1.completed, 'completing the quest records it', r.layer1);
check(r.layer1.modalOpened, 'LAYER 1: quest completion OPENS the master pick (the reported bug)', r.layer1);
check(r.layer1.toast, 'with a toast naming the moment', r.layer1);
check(r.layer1.grantedValid, 'and clicking a card actually grants a master of the right job', r.layer1);
check(r.layer2.pending === true, 'LAYER 2: the pending predicate sees the stranded state at Lv 41', r.layer2);
check(r.layer2.modalOpened, 'and a level-up past 40 re-offers the pick (old code required exactly 40)', r.layer2);
check(r.saveLanded, 'the stranded save actually landed before reload', r.saveLanded);
check(r.layer3.questDone && r.layer3.master == null, 'LAYER 3: the loaded save is genuinely stranded (quest done, no master)', r.layer3);
check(r.layer3.modalOpened, 'and loadState recovery re-offers the pick for saves stuck under the old wiring', r.layer3);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
