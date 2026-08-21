// A full Ticket Rush playthrough, driven the way a player drives it, per user:
// "Further ensure that this is seamless without errors."
//
// The earlier guard (pq_chain_integrity_test) proves the NUMBERS and the stage
// order by calling the quest API directly. That cannot prove the run is
// seamless, because it never touches the things a player actually uses: Milo's
// dialog buttons, the map warps they trigger, the chest pieces, the auto-accept
// hook on entering the Carriage, or the completion toasts.
//
// This walks the whole chain end to end and clicks Milo's real buttons:
//   Stage 1  clear the lobby  ->  Milo: "Begin Stage 2"
//   Stage 2  four chests      ->  the Spire hands off to the Carriage
//   Stage 3  clear the carriage -> Milo: "Begin Stage 4"
//   Stage 4  the Express arena opens with the finale active
// Every page error and console error across the entire run is collected, and
// any of them fails the test — "seamless" means nothing throws on the way.
//
// It matters that Milo's own gating is exercised rather than assumed: v0.29.900
// added a prerequisite gate to acceptQuest, and Milo's "Begin Stage 2"/"Begin
// Stage 4" buttons call acceptQuest directly. If those buttons were ever shown
// on a condition looser than the prerequisite, the gate would refuse and the
// chain would dead-end on a button that does nothing.
// Run: node scripts/pq_playthrough_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
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
  player.hp = player.maxHp = 9e8;
  const log = [];
  const step = (k, v) => { log.push(k + '=' + JSON.stringify(v)); return v; };

  // Fresh chain.
  for (const k of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']) {
    delete player.quests.active[k]; delete player.quests.completed[k];
    if (player.quests.unlocked) delete player.quests.unlocked[k];
  }
  player._pqSpirePieces = {};
  const out = {};

  // Wait for the map to ACTUALLY be current rather than sleeping a fixed
  // interval. loadMap finishes behind a transition whose length varies with
  // machine load, and a fixed 700ms sleep raced it: roughly one run in four
  // opened Milo while still standing on the previous map, which reads exactly
  // like the chain refusing to advance. The bug was in this harness, not the
  // game — the same transition passes 8/8 when driven in isolation.
  const goTo = async (id, entryX) => {
    loadMap(id, entryX);
    for (let i = 0; i < 240; i++) {
      if (game.currentMap === id && Array.isArray(game.npcs)) return true;
      await new Promise((res) => requestAnimationFrame(res));
    }
    return game.currentMap === id;
  };
  const settle = async (n) => { for (let i = 0; i < (n || 30); i++) await new Promise((res) => requestAnimationFrame(res)); };

  // Milo: find him on whatever map we are on, open his dialog, click a button.
  const milo = () => (game.npcs || []).find((n) => n && n.name === 'Milo');
  const miloOptions = () => {
    const m = milo(); if (!m) return null;
    try { openNPC(m); } catch (e) { return 'THREW ' + String(e).slice(0, 80); }
    return [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent);
  };
  const clickMilo = (needle) => {
    const m = milo(); if (!m) return 'no Milo';
    try { openNPC(m); } catch (e) { return 'openNPC threw ' + String(e).slice(0, 80); }
    const btn = [...document.querySelectorAll('#dialog-options button')].find((b) => (b.textContent || '').includes(needle));
    if (!btn) return 'no button: ' + needle;
    btn.click();
    return 'clicked';
  };
  // One spawn is not necessarily one death. The elite affix pool includes
  // `undying` (traits.revivesOnce), so such a mob absorbs a killMonster() call
  // and comes back at 35% HP — a naive one-call-per-mob loop silently loses
  // that kill's quest credit. Measured on this build: 1 lost credit per ~240
  // mech kills, which is exactly the intermittent Stage-3 completion failure
  // this harness kept showing. killMonster() no-ops once the mob has left
  // game.monsters, so that is the death test the game itself uses — swing
  // again until it holds.
  const killHere = (n) => {
    for (let i = 0; i < n; i++) {
      let m = null;
      try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) { return 'spawn threw ' + String(e).slice(0, 80); }
      if (!m) return 'no spawn';
      let swings = 0;
      while (game.monsters.indexOf(m) >= 0 && swings < 5) {
        m.currentHp = 0;
        try { killMonster(m); } catch (e) { return 'kill threw ' + String(e).slice(0, 80); }
        swings++;
      }
      if (game.monsters.indexOf(m) >= 0) return 'mob survived ' + swings + ' swings';
      game.monsters = [];
    }
    return 'ok';
  };

  // ---------- STAGE 1 ----------
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  acceptQuest('q_clockwork_underpass');
  out.s1Accepted = step('s1Accepted', !!player.quests.active.q_clockwork_underpass);
  await goTo('clockworkUnderpassLobby'); await settle();
  out.s1Map = step('s1Map', game.currentMap);
  const t1 = player.quests.active.q_clockwork_underpass.targetCount ?? QUESTS.q_clockwork_underpass.count;
  // Clear it the honest way: real kills through killMonster for the final few,
  // with the earlier progress granted so the run stays inside a test budget.
  player.quests.active.q_clockwork_underpass.progress = t1 - 3;
  out.s1Kill = step('s1Kill', killHere(3));
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  out.s1Done = step('s1Done', !!player.quests.completed.q_clockwork_underpass);
  out.spireUnlocked = step('spireUnlocked', !!(player.quests.unlocked && player.quests.unlocked.q_pq_spire));

  // ---------- MILO -> STAGE 2 ----------
  out.townForS2 = step('townForS2', await goTo('town')); await settle();
  out.miloOptsAtS2 = step('miloOptsAtS2', miloOptions());
  out.clickS2 = step('clickS2', clickMilo('Begin Stage 2'));
  for (let i = 0; i < 240 && game.currentMap !== 'clockworkSpire'; i++) await new Promise((res) => requestAnimationFrame(res));
  await settle();
  out.s2Map = step('s2Map', game.currentMap);
  out.s2Active = step('s2Active', !!player.quests.active.q_pq_spire);

  // ---------- STAGE 2: four chests ----------
  const pieceChests = (game.chests || []).filter((ch) => ch && ch._pqPuzzlePiece);
  out.s2Chests = step('s2Chests', pieceChests.length);
  for (const ch of pieceChests) { try { openChest(ch); } catch (e) { out.s2ChestErr = String(e).slice(0, 90); break; } }
  out.s2Pieces = step('s2Pieces', Object.keys(player._pqSpirePieces || {}).length);
  out.s2Done = step('s2Done', !!player.quests.completed.q_pq_spire);

  // ---------- STAGE 3: the Carriage auto-accepts on entry ----------
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  await goTo('tower'); await settle();
  out.s3Map = step('s3Map', game.currentMap);
  out.s3AutoAccepted = step('s3AutoAccepted', !!player.quests.active.q_pq_carriage);
  const t3 = (player.quests.active.q_pq_carriage || {}).targetCount ?? QUESTS.q_pq_carriage.count;
  out.s3Kill = step('s3Kill', killHere(t3));
  out.s3Done = step('s3Done', !!player.quests.completed.q_pq_carriage);

  // ---------- MILO -> STAGE 4 ----------
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  out.finaleUnlocked = step('finaleUnlocked', !!(player.quests.unlocked && player.quests.unlocked.q_pq_finale));
  out.townForS4 = step('townForS4', await goTo('town')); await settle();
  out.miloOptsAtS4 = step('miloOptsAtS4', miloOptions());
  out.clickS4 = step('clickS4', clickMilo('Begin Stage 4'));
  for (let i = 0; i < 240 && game.currentMap !== 'clockworkExpress'; i++) await new Promise((res) => requestAnimationFrame(res));
  await settle();
  out.s4Map = step('s4Map', game.currentMap);
  out.s4Active = step('s4Active', !!player.quests.active.q_pq_finale);

  // ---------- the chain survives a save/reload mid-flight ----------
  // saveState() DEBOUNCES behind setTimeout(_SAVE_DEBOUNCE_MS) and clears
  // game._saveTimer when the write lands. Sleeping a guessed interval instead
  // reads back the PREVIOUS save — which shows up as stages 3 and 4 missing and
  // reads exactly like the chain failing to persist. Wait for the write itself.
  try { saveState(); } catch (e) { out.saveErr = String(e).slice(0, 90); }
  for (let i = 0; i < 600 && game._saveTimer; i++) await new Promise((res) => setTimeout(res, 20));
  out.saveLanded = step('saveLanded', !game._saveTimer);
  try { loadState(); } catch (e) { out.loadErr = String(e).slice(0, 90); }
  out.afterReload = step('afterReload', {
    finaleActive: !!player.quests.active.q_pq_finale,
    s1: !!player.quests.completed.q_clockwork_underpass,
    s2: !!player.quests.completed.q_pq_spire,
    s3: !!player.quests.completed.q_pq_carriage,
  });
  // ---------- the awkward ways a real run actually goes ----------
  const clear = () => {
    for (const k of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']) {
      delete player.quests.active[k]; delete player.quests.completed[k];
      if (player.quests.unlocked) delete player.quests.unlocked[k];
    }
  };
  // Leaving a stage map and coming back must not reset or re-accept it.
  clear(); player.quests.completed.q_pq_spire = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  await goTo('tower'); await settle();
  if (player.quests.active.q_pq_carriage) player.quests.active.q_pq_carriage.progress = 5;
  await goTo('town'); await settle();
  await goTo('tower'); await settle();
  out.reentry = step('reentry', {
    progressKept: (player.quests.active.q_pq_carriage || {}).progress | 0,
    stillActive: !!player.quests.active.q_pq_carriage,
  });

  // Abandoning Stage 2 part-way and re-taking it: the path that once
  // soft-locked, because the collected pieces outlived the abandon and only
  // the uncollected chests respawned, so 4/4 became unreachable.
  clear(); player.quests.completed.q_clockwork_underpass = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  acceptQuest('q_pq_spire');
  await goTo('clockworkSpire'); await settle();
  let pc = (game.chests || []).filter((x) => x && x._pqPuzzlePiece);
  try { openChest(pc[0]); openChest(pc[1]); } catch (e) { out.edgeErr = String(e).slice(0, 80); }
  if (typeof abandonQuest === 'function') { try { abandonQuest('q_pq_spire'); } catch (e) {} }
  else { delete player.quests.active.q_pq_spire; }
  acceptQuest('q_pq_spire');
  await goTo('clockworkSpire'); await settle();
  pc = (game.chests || []).filter((x) => x && x._pqPuzzlePiece);
  for (const ch of pc) { try { openChest(ch); } catch (e) { out.edgeErr = String(e).slice(0, 80); break; } }
  out.abandonReaccept = step('abandonReaccept', {
    chestsBack: pc.length,
    finished: !!player.quests.completed.q_pq_spire,
  });

  // A kill on a PQ map with no PQ quest running must be a no-op, not a crash
  // and not a stealth accept.
  clear();
  await goTo('tower'); await settle();
  let strayErr = null;
  for (let i = 0; i < 3; i++) {
    let m = null;
    try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) { strayErr = String(e).slice(0, 70); }
    if (!m) break;
    m.currentHp = 0;
    try { killMonster(m); } catch (e) { strayErr = String(e).slice(0, 70); }
    game.monsters = [];
  }
  out.strayKill = step('strayKill', { err: strayErr, leaked: !!player.quests.active.q_pq_carriage });

  out.log = log;
  return out;
});
await browser.close();

for (const k of ['s1Map', 's1Kill', 's1Done', 'spireUnlocked', 'clickS2', 's2Map', 's2Active',
                 's2Chests', 's2Pieces', 's2Done', 's3Map', 's3AutoAccepted', 's3Kill', 's3Done',
                 'finaleUnlocked', 'clickS4', 's4Map', 's4Active']) {
  console.log(`  ${k.padEnd(16)} ${JSON.stringify(r[k])}`);
}
console.log(`  milo @stage2 : ${JSON.stringify(r.miloOptsAtS2)}`);
console.log(`  milo @stage4 : ${JSON.stringify(r.miloOptsAtS4)}`);
console.log(`  after reload : ${JSON.stringify(r.afterReload)}`);
console.log(`  errors       : ${JSON.stringify([...new Set(errs)].slice(0, 5))}`);

check(r.s1Accepted && r.s1Map === 'clockworkUnderpassLobby', 'Stage 1 accepts and its map loads', r.s1Map);
check(r.s1Kill === 'ok' && r.s1Done, 'Stage 1 completes on real kills', { kill: r.s1Kill, done: r.s1Done });
check(r.spireUnlocked, 'clearing Stage 1 unlocks Stage 2', r.spireUnlocked);
check(r.clickS2 === 'clicked', 'Milo offers a working "Begin Stage 2" button', r.clickS2);
check(r.s2Map === 'clockworkSpire' && r.s2Active,
      'and it warps to the Spire with Stage 2 active — the prereq gate did not block Milo', r);
check(r.s2Chests === 4, 'the Spire carries exactly 4 piece chests', r.s2Chests);
check(r.s2Pieces === 4 && r.s2Done, 'collecting all 4 completes Stage 2', { pieces: r.s2Pieces, done: r.s2Done });
check(r.s3Map === 'tower' && r.s3AutoAccepted, 'entering the Carriage auto-accepts Stage 3', r);
check(r.s3Kill === 'ok' && r.s3Done, 'Stage 3 completes on real kills', { kill: r.s3Kill, done: r.s3Done });
check(r.finaleUnlocked, 'clearing Stage 3 unlocks Stage 4', r.finaleUnlocked);
check(r.clickS4 === 'clicked', 'Milo offers a working "Begin Stage 4" button', r.clickS4);
check(r.s4Map === 'clockworkExpress' && r.s4Active,
      'and it opens the Express arena with the finale active', r);
check(r.saveLanded === true, 'the save actually landed before the reload was attempted', r.saveLanded);
check(r.afterReload && r.afterReload.finaleActive && r.afterReload.s1 && r.afterReload.s2 && r.afterReload.s3,
      'the whole chain survives a save and reload mid-run', r.afterReload);
check(r.reentry.progressKept === 5 && r.reentry.stillActive,
      'leaving a stage map and returning keeps progress and does not re-accept', r.reentry);
check(r.abandonReaccept.chestsBack === 4 && r.abandonReaccept.finished,
      'abandoning Stage 2 part-way and re-taking it can still be finished (no soft-lock)', r.abandonReaccept);
check(r.strayKill.err === null && r.strayKill.leaked === false,
      'a kill on a PQ map with no PQ quest running is a harmless no-op', r.strayKill);
check(errs.length === 0, 'NOTHING threw across the entire playthrough', [...new Set(errs)].slice(0, 4));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
