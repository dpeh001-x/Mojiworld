// The Ticket Rush PQ: numbers, objectives and stage ORDER, per user "Ensure
// that the PQ numbers and objectives are bugless".
//
// The numbers were already sound and this pins them so they stay that way:
// targets honour noScale (accepting a stage never moves its authored count),
// the pin and tracker quote the live
// target, the remainder never goes negative, kill credit is map-gated (a
// Carriage kill must NOT feed Stage 1, an Express kill must NOT feed Stage 3),
// and each stage completes on exactly its target kill.
//
// The defect it guards against: stage order was enforced only where quests are
// UNLOCKED, not where they are offered or accepted. A stale `unlocked` entry —
// an old save, or any future bug that sets one — let the journal offer Stage 3
// and acceptQuest take it with Stage 2 unfinished, stranding the player
// mid-chain. Both gates now re-check the prerequisite.
//
// The walk-the-whole-chain case is the load-bearing half: a gate that blocks
// skipping is worthless if it also blocks the legitimate route.
// Run: node scripts/pq_chain_integrity_test.mjs [file.html]
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
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof acceptQuest === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60;
  const IDS = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const clear = () => {
    for (const k of IDS) {
      delete player.quests.active[k]; delete player.quests.completed[k];
      if (player.quests.unlocked) delete player.quests.unlocked[k];
    }
  };
  const out = {};
  // One spawn is not one death. The elite affix pool includes `undying`
  // (traits.revivesOnce): such a mob absorbs a killMonster() call and comes
  // back at 35% HP, so a one-call-per-mob loop drops that kill's credit about
  // once every 240 mech kills — which reads as a random off-by-one in the
  // counts this test grades. killMonster() no-ops once the mob has left
  // game.monsters, so that is the liveness test to swing against.
  const killOne = () => {
    let m = null; try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) { return false; }
    if (!m) return false;
    for (let s = 0; s < 5 && game.monsters.indexOf(m) >= 0; s++) {
      m.currentHp = 0; try { killMonster(m); } catch (e) { return false; }
    }
    const ok = game.monsters.indexOf(m) < 0;
    game.monsters = [];
    return ok;
  };

  // --- targets honour noScale ---
  out.targets = {};
  out.authored = {};
  for (const id of IDS) out.authored[id] = QUESTS[id].count;
  for (const id of IDS) {
    clear(); player.quests.completed.q_clockwork_underpass = (id !== 'q_clockwork_underpass');
    player.quests.completed.q_pq_spire = (id === 'q_pq_carriage' || id === 'q_pq_finale');
    player.quests.completed.q_pq_carriage = (id === 'q_pq_finale');
    acceptQuest(id);
    const a = player.quests.active[id];
    out.targets[id] = a ? (a.targetCount != null ? a.targetCount : QUESTS[id].count) : null;
  }

  // --- the pin quotes the live target and never goes negative ---
  clear(); acceptQuest('q_clockwork_underpass');
  loadMap('clockworkUnderpassLobby');
  await new Promise((res) => setTimeout(res, 700));
  const pin = () => {
    if (typeof _renderPqObjectivePin === 'function') _renderPqObjectivePin();
    const el = document.getElementById('pq-objective-pin');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  };
  const t1 = player.quests.active.q_clockwork_underpass.targetCount ?? QUESTS.q_clockwork_underpass.count;
  player.quests.active.q_clockwork_underpass.progress = t1 + 50;
  const over = pin();
  out.pin = { target: t1, quotesTarget: over.includes('/' + t1), negative: /-\d+ left/.test(over) };

  // --- kill credit is map-gated, no cross-feeding ---
  const killOn = (mapId, actives, pre) => {
    clear();
    for (const k in (pre || {})) player.quests.completed[k] = pre[k];
    for (const id of actives) acceptQuest(id);
    loadMap(mapId); game.monsters = [];
    const before = {}; for (const id of actives) before[id] = (player.quests.active[id] || {}).progress | 0;
    for (let i = 0; i < 3; i++) { if (!killOne()) break; }
    const d = {};
    for (const id of actives) d[id] = ((player.quests.active[id] || {}).progress | 0) - before[id];
    return d;
  };
  out.creditCarriage = killOn('tower', ['q_clockwork_underpass', 'q_pq_carriage'],
                              { q_clockwork_underpass: false, q_pq_spire: true });
  out.creditForest = killOn('forest', ['q_pq_carriage'], { q_pq_spire: true });

  // --- completes on exactly the target kill ---
  clear(); player.quests.completed.q_pq_spire = true;
  acceptQuest('q_pq_carriage');
  loadMap('tower'); game.monsters = [];
  const t3 = player.quests.active.q_pq_carriage.targetCount ?? QUESTS.q_pq_carriage.count;
  let doneAt = null, maxProg = 0;
  for (let i = 1; i <= t3 + 3; i++) {
    if (!killOne()) break;
    const a = player.quests.active.q_pq_carriage;
    if (a) maxProg = Math.max(maxProg, a.progress | 0);
    if (doneAt == null && !a) doneAt = i;
  }
  out.completion = { target: t3, doneAtKill: doneAt, maxProgress: maxProg };

  // --- stage ORDER: a stale unlock must not open a later stage ---
  clear();
  player.quests.unlocked = player.quests.unlocked || {};
  player.quests.unlocked.q_pq_carriage = true;          // stale: Stage 2 not done
  if (typeof renderQuestJournal === 'function') { try { renderQuestJournal(); } catch (e) {} }
  out.skip = {
    offered: [...document.querySelectorAll('[data-qaccept]')].map((b) => b.dataset.qaccept).includes('q_pq_carriage'),
    accepted: (acceptQuest('q_pq_carriage'), !!player.quests.active.q_pq_carriage),
  };

  // --- and the LEGITIMATE chain still runs end to end ---
  clear();
  const walk = [];
  acceptQuest('q_clockwork_underpass');
  walk.push(!!player.quests.active.q_clockwork_underpass);
  player.quests.completed.q_clockwork_underpass = true; delete player.quests.active.q_clockwork_underpass;
  acceptQuest('q_pq_spire');       walk.push(!!player.quests.active.q_pq_spire);
  player.quests.completed.q_pq_spire = true; delete player.quests.active.q_pq_spire;
  acceptQuest('q_pq_carriage');    walk.push(!!player.quests.active.q_pq_carriage);
  player.quests.completed.q_pq_carriage = true; delete player.quests.active.q_pq_carriage;
  acceptQuest('q_pq_finale');      walk.push(!!player.quests.active.q_pq_finale);
  out.walk = walk;
  return out;
});
await browser.close();

console.log(`  targets:    ${JSON.stringify(r.targets)}   authored: ${JSON.stringify(r.authored)}`);
console.log(`  pin:        ${JSON.stringify(r.pin)}`);
console.log(`  credit:     carriage ${JSON.stringify(r.creditCarriage)}  forest ${JSON.stringify(r.creditForest)}`);
console.log(`  completion: ${JSON.stringify(r.completion)}`);
console.log(`  skip:       ${JSON.stringify(r.skip)}   legit chain: ${JSON.stringify(r.walk)}`);

// Graded against the AUTHORED counts, not against literals. The stages get
// retuned (Stage 3 went 8 -> 20 after this test first shipped) and hardcoding
// the numbers here only means the guard fails the next time someone rebalances
// — which is the opposite of what it is for. What must hold is that accepting a
// stage does not move its number: that is exactly what noScale buys, and the
// hunt curve silently retargeting these beats is the bug it was added for.
check(r.targets.q_clockwork_underpass === r.authored.q_clockwork_underpass,
      'Stage 1 asks for its authored count, unscaled (noScale honoured)', r);
check(r.targets.q_pq_spire === r.authored.q_pq_spire, 'Stage 2 asks for its authored piece count', r);
check(r.targets.q_pq_carriage === r.authored.q_pq_carriage,
      'Stage 3 asks for its authored count, unscaled (noScale honoured)', r);
check(r.targets.q_pq_finale === r.authored.q_pq_finale, 'Stage 4 asks for 1 boss', r);
check(r.pin.quotesTarget && !r.pin.negative, 'the pin quotes the live target and never shows a negative', r.pin);
check(r.creditCarriage.q_pq_carriage === 3 && r.creditCarriage.q_clockwork_underpass === 0,
      'a Carriage kill credits Stage 3 only — never Stage 1', r.creditCarriage);
check(r.creditForest.q_pq_carriage === 0, 'a kill outside the PQ maps credits nothing', r.creditForest);
check(r.completion.doneAtKill === r.completion.target, 'Stage 3 completes on exactly its target kill', r.completion);
check(r.completion.maxProgress <= r.completion.target, 'and progress never overshoots the target', r.completion);
// The order gate.
check(r.skip.offered === false, 'a stale unlock is NOT offered while its prerequisite is unfinished', r.skip);
check(r.skip.accepted === false, 'and cannot be accepted even if something asks directly', r.skip);
// The half that matters just as much.
check(r.walk.every(Boolean), 'the legitimate chain still accepts stage by stage, 1 to 4', r.walk);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
