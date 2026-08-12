// Quest-navigator UI: the location row renders on real cards, Track toggles,
// and the pre-existing Locate toast now names a map. Drives the real panel —
// no assertions against source text.
// Run: node scripts/quest_navigator_ui_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof renderQuestJournal === 'function' && typeof _qnavDest === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal');
  if (gate) gate.style.display = 'none';
  game.paused = false;
  player.level = 40;
  // Use the game's own unlock path rather than writing player.quests directly —
  // a hand-populated journal would not prove the real one renders rows.
  window._lxBootGateDone = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
});

// Open the panel the way a PLAYER does. Calling renderQuestJournal() directly
// tests the function, not the feature: an earlier version of this suite did
// exactly that and stayed green against a build where the helper had been
// clobbered out of the file entirely, because the direct call was the only
// thing that ever ran.
await page.evaluate(() => { window._lxBootGateDone = true; });   // the loop bails until the overlay fades
await page.waitForTimeout(600);
await page.keyboard.press('q');
await page.waitForTimeout(700);

const r1 = await page.evaluate(() => {
  const list = document.getElementById('quest-list');
  const rows = [...list.querySelectorAll('[data-qtrack]')];
  const cards = [...list.querySelectorAll('.qj-card')];
  const done = [...list.querySelectorAll('.qj-card.done')];
  const texts = rows.map((b) => (b.closest('div').textContent || '').replace(/\s+/g, ' ').trim());
  return {
    cards: cards.length, done: done.length, rows: rows.length,
    sample: texts.slice(0, 4),
    // every row must name a real map from MAPS
    namesMap: texts.filter((t) => Object.values(MAPS).some((m) => m.name && t.includes(m.name))).length,
    hasPin: texts.filter((t) => t.includes('📍')).length,
    // Presence in the DOM is not the same as being on screen. Measure real
    // geometry: a row with zero height is a row the player never sees.
    visible: rows.filter((b) => {
      const el = b.closest('div');
      if (!el) return false;
      const rc = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return rc.width > 100 && rc.height > 10 && cs.visibility === 'visible' && cs.display !== 'none' && Number(cs.opacity) > 0.1;
    }).length,
  };
});
console.log(`\ncards ${r1.cards} (done ${r1.done}) | location rows ${r1.rows}`);
console.log('sample rows:\n  ' + r1.sample.join('\n  '));
// Guard the sample size FIRST. Every check below is an equality against
// r1.rows, so at rows==0 they all pass vacuously — which is exactly what the
// first run of this test did while the panel was rendering its empty state.
check(r1.cards >= 10, 'the panel actually rendered a meaningful set of cards', r1.cards);
check(r1.rows > 0, 'location rows render at all', r1.rows);
check(r1.rows === r1.cards - r1.done, 'a row on every non-completed card', { rows: r1.rows, expected: r1.cards - r1.done });
check(r1.namesMap === r1.rows, 'every row names a real map', { named: r1.namesMap, of: r1.rows });
check(r1.hasPin === r1.rows, 'every row carries the pin glyph', r1.hasPin);
check(r1.visible === r1.rows, 'every row is actually ON SCREEN (real geometry)', { visible: r1.visible, of: r1.rows });
if (!r1.rows) { console.log('\nno rows — aborting before the interaction checks'); await browser.close(); process.exit(1); }

// Track toggles on, repaints, and flips the label.
const r2 = await page.evaluate(() => {
  const btn = document.querySelector('#quest-list [data-qtrack]');
  const qid = btn.dataset.qtrack;
  btn.click();
  const after = document.querySelector(`#quest-list [data-qtrack="${qid}"]`);
  return { qid, qnav: game.qnav, label: (after && after.textContent || '').trim() };
});
check(r2.qnav === r2.qid, 'Track sets game.qnav to the quest id', r2);
check(/Tracking/.test(r2.label), 'the tracked button repaints as Tracking', r2.label);

const r3 = await page.evaluate(() => {
  const btn = document.querySelector(`#quest-list [data-qtrack="${game.qnav}"]`);
  btn.click();
  return { qnav: game.qnav };
});
check(r3.qnav === null, 'a second Track click clears tracking', r3);

// The old Locate toast must now lead with a place.
const r4 = await page.evaluate(() => {
  // force one quest active so a Locate button exists
  const qid = Object.keys(QUESTS).find((k) => !player.quests.completed[k]);
  player.quests.active[qid] = player.quests.active[qid] || { progress: 0 };
  // The panel renders ONE bucket at a time, so an active quest is absent from
  // the DOM while the Available tab is showing — which is why the first run
  // found no Locate button. Switch tabs, don't conclude the button is gone.
  if (typeof _questTab !== 'undefined') _questTab = 'active';
  renderQuestJournal();
  const btn = document.querySelector('#quest-list [data-qlocate]');
  if (!btn) return { skipped: true };
  let captured = '';
  const orig = window.showToast;
  window.showToast = (msg) => { captured = String(msg); };
  btn.click();
  window.showToast = orig;
  const d = _qnavDest(btn.dataset.qlocate);
  const mapName = d ? ((MAPS[d.map] && MAPS[d.map].name) || d.map) : null;
  return { captured, mapName };
});
if (r4.skipped) check(false, 'a Locate button exists to test', r4);
else {
  console.log(`locate toast: ${r4.captured}`);
  check(r4.captured.includes(r4.mapName), 'Locate toast names the destination map', r4);
}

// Destination must follow quest STATE. Same quest, three states, and the
// answer has to move — a check that would pass on a resolver ignoring state
// is not worth running, so this asserts the transition, not just the shape.
const r5 = await page.evaluate(() => {
  // a kill quest that names an NPC and whose target actually spawns somewhere
  const qid = Object.keys(QUESTS).find((k) => {
    const q = QUESTS[k];
    return q.kind === 'kill' && (q.npc || q.giver) && q.target && _LX_QNAV.mob[q.target];
  });
  if (!qid) return { skipped: true };
  delete player.quests.active[qid];
  delete player.quests.completed[qid];
  const offered = _qnavDest(qid);
  player.quests.active[qid] = { progress: 0 };
  const hunting = _qnavDest(qid);
  player.quests.active[qid].readyToHandIn = true;
  const ready = _qnavDest(qid);
  delete player.quests.active[qid];
  return {
    qid,
    offered: offered && offered.kind, offeredWho: offered && offered.who,
    hunting: hunting && hunting.kind, huntingWho: hunting && hunting.who,
    ready: ready && ready.kind, readyWho: ready && ready.who,
    target: QUESTS[qid].target,
  };
});
if (r5.skipped) check(false, 'a state-transition quest exists to test', r5);
else {
  console.log(`state: ${r5.qid} — offered=${r5.offered}(${r5.offeredWho}) hunting=${r5.hunting}(${r5.huntingWho}) ready=${r5.ready}(${r5.readyWho})`);
  check(r5.offered === 'npc', 'an un-accepted quest points at the giver', r5.offered);
  check(r5.hunting === 'hunt' && r5.huntingWho === r5.target, 'an accepted quest points at the objective', r5);
  check(r5.ready === 'npc', 'a ready-to-hand-in quest points back at the giver', r5.ready);
  check(r5.hunting !== r5.offered, 'state actually changes the destination', r5);
}

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
