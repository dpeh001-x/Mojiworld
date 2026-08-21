// A player who left the Ticket Rush mid-chain can start over from Stage 1,
// per tester: "if u finished 2/4 of the pq, and leave, the train pq will
// automatically teleport u to the 3rd stage as opposed to starting the train
// pq from stage 1".
//
// The gap: with Stages 1-2 done, town Milo's dialog offered exactly one
// forward button — "Begin Stage 3" — because the reset-papers path lived only
// in the ALL-FOUR-DONE branch. Mid-chain there was no way back to Stage 1; the
// single button read as an automatic teleport into Stage 3.
//
// The design intent stays: resume IS the default (the linear flow was itself a
// user request, v0.26.298). This grades that BOTH doors now exist at every
// mid-chain stop, that the restart actually resets (through the real dialog
// click, the real quest state, the real map load), and that resume still works
// exactly as before.
// Run: node scripts/pq_restart_option_test.mjs [file.html]
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof acceptQuest === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.hp = player.maxHp = 9e8;
  const IDS = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const goTo = async (id) => { loadMap(id);
    for (let i = 0; i < 240; i++) { if (game.currentMap === id && Array.isArray(game.npcs)) return true;
      await new Promise((res) => requestAnimationFrame(res)); } return false; };
  const settle = async (n) => { for (let i = 0; i < (n || 25); i++) await new Promise((res) => requestAnimationFrame(res)); };
  // Seed "finished K stages and left": completions set, next stage unlocked
  // via the real unlock pass, nothing active, player standing in town.
  const seed = async (doneCount) => {
    for (const k of IDS) {
      delete player.quests.active[k]; delete player.quests.completed[k];
      if (player.quests.unlocked) delete player.quests.unlocked[k];
    }
    for (let i = 0; i < doneCount; i++) player.quests.completed[IDS[i]] = true;
    if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
    await goTo('town'); await settle();
  };
  const milo = () => (game.npcs || []).find((n) => n && n.name === 'Milo');
  const openMilo = async () => {
    const m = milo(); if (!m) return null;
    try { openNPC(m); } catch (e) { return null; }
    await settle(10);
    return [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
  };
  const clickOpt = (needle) => {
    const btn = [...document.querySelectorAll('#dialog-options button')].find((b) => (b.textContent || '').includes(needle));
    if (!btn) return false;
    btn.click(); return true;
  };
  const out = {};

  // ---- the tester's exact state: 2/4 done, back in town ----
  await seed(2);
  out.opts2of4 = await openMilo();
  out.hasResume2 = !!(out.opts2of4 || []).some((t) => t.includes('Begin Stage 3'));
  out.hasRestart2 = !!(out.opts2of4 || []).some((t) => t.includes('Restart from Stage 1'));
  // take the restart door
  out.clickedRestart = clickOpt('Restart from Stage 1');
  for (let i = 0; i < 240; i++) { if (game.currentMap === 'clockworkUnderpassLobby') break; await new Promise((res) => requestAnimationFrame(res)); }
  await settle();
  out.afterRestart = {
    map: game.currentMap,
    s1Active: !!player.quests.active.q_clockwork_underpass,
    s1Progress: (player.quests.active.q_clockwork_underpass || {}).progress | 0,
    anyCompleted: IDS.some((k) => player.quests.completed[k]),
    spireUnlockGone: !(player.quests.unlocked && player.quests.unlocked.q_pq_spire),
  };

  // ---- the other mid-chain stops offer it too ----
  await seed(1);
  out.opts1of4 = await openMilo();
  out.hasRestart1 = !!(out.opts1of4 || []).some((t) => t.includes('Restart from Stage 1'));
  try { closeDialog(); } catch (e) {}
  await seed(3);
  out.opts3of4 = await openMilo();
  out.hasRestart3 = !!(out.opts3of4 || []).some((t) => t.includes('Restart from Stage 1'));
  try { closeDialog(); } catch (e) {}

  // ---- resume is still the default and still works ----
  await seed(2);
  await openMilo();
  out.clickedResume = clickOpt('Begin Stage 3');
  for (let i = 0; i < 240; i++) { if (game.currentMap === 'tower') break; await new Promise((res) => requestAnimationFrame(res)); }
  await settle();
  out.afterResume = {
    map: game.currentMap,
    s3Active: !!player.quests.active.q_pq_carriage,
    s1StillDone: !!player.quests.completed.q_clockwork_underpass,
    s2StillDone: !!player.quests.completed.q_pq_spire,
  };

  // ---- the completed-state "Run again" still works after the refactor ----
  await seed(4);
  out.opts4of4 = await openMilo();
  out.clickedRunAgain = clickOpt('Run the Ticket Rush again');
  for (let i = 0; i < 240; i++) { if (game.currentMap === 'clockworkUnderpassLobby') break; await new Promise((res) => requestAnimationFrame(res)); }
  await settle();
  out.afterRunAgain = {
    map: game.currentMap,
    s1Active: !!player.quests.active.q_clockwork_underpass,
    anyCompleted: IDS.some((k) => player.quests.completed[k]),
  };
  return out;
});
await browser.close();

console.log(`  2/4 options:  ${JSON.stringify(r.opts2of4)}`);
console.log(`  restart ->    ${JSON.stringify(r.afterRestart)}`);
console.log(`  resume  ->    ${JSON.stringify(r.afterResume)}`);
console.log(`  run-again ->  ${JSON.stringify(r.afterRunAgain)}`);

check(r.hasResume2, '2/4 done: Milo still offers "Begin Stage 3" (resume stays the default)', r.opts2of4);
check(r.hasRestart2, '2/4 done: Milo ALSO offers "Restart from Stage 1" (the missing door)', r.opts2of4);
check(r.clickedRestart && r.afterRestart.map === 'clockworkUnderpassLobby',
      'taking the restart lands in the Stage 1 lobby, not the carriage', r.afterRestart);
check(r.afterRestart.s1Active && r.afterRestart.s1Progress === 0,
      'with Stage 1 freshly active at 0 kills', r.afterRestart);
check(!r.afterRestart.anyCompleted && r.afterRestart.spireUnlockGone,
      'and the whole chain genuinely reset (no completions, no stale unlocks)', r.afterRestart);
check(r.hasRestart1, '1/4 done (Stage 2 offer): restart is available there too', r.opts1of4);
check(r.hasRestart3, '3/4 done (Stage 4 offer): and there', r.opts3of4);
check(r.clickedResume && r.afterResume.map === 'tower' && r.afterResume.s3Active,
      'choosing resume still warps to Stage 3 with the quest armed', r.afterResume);
check(r.afterResume.s1StillDone && r.afterResume.s2StillDone,
      'and resume does NOT wipe the finished stages', r.afterResume);
check(r.clickedRunAgain && r.afterRunAgain.map === 'clockworkUnderpassLobby'
      && r.afterRunAgain.s1Active && !r.afterRunAgain.anyCompleted,
      'the post-completion "Run again" still fully resets (refactor regression)', r.afterRunAgain);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
