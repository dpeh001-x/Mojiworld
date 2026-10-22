// THE QUESTLINE READS IN ORDER (per user, 2026-10-09: "Ensure that chronologically this questline makes sense"). Two read-only readers walked the Past-the-Tear line (portal, Lyra,
// Barnaby I-IV, the Smith, the Last Step, Hourglass, the Sanctum) in every order its prerequisites allow; this pins what they found and the fixes:
//   - one spine (v0.30.1851, per user): Barnaby I-IV and The Tear V/VI are retired; Portal -> The Forge That Broke (needs the Portal and Brok's Forge-Key) -> The Last Step (needs the Smith) -> Sanctum
//   - the Last Step waits for the Smith (its stair is past the Forge); the Smith waits for the portal; Hourglass I waits for the Smith (hourglass_order_test pins that one)
//   - the Forge's far door to the Last Step is not there until The Forge That Broke is done (or the copy already fell), so the line cannot be walked past him
//   - one spine: the Smith's ashes film plays on his kill once the Portal is done (Smith quest active/completed, or Portal completed), not before the Portal
//   - the portal's hand-off names what the Smith waits on (with its level) instead of 'opens at Lv 45' with nobody to see
//   - text: the Smith's card carries Barnaby's (and The Tear V's) story now; his epitaph's soot is Barnaby's hands (not a Glasswind smith)
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/questline_order_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12151';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 320) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestUnlocks === 'function' && typeof _lxAct1Next === 'function' && typeof loadMap === 'function' && typeof LX_KILL_FILMS === 'object' && typeof EVERDAWN_EPITAPHS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player.cls = 'warrior'; player.job = 'knight'; player.master = null;
    const Q = QUESTS, out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const fresh = () => { player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} }; _ensureQuests(); };
    const open = (id, lv, done) => { fresh(); for (const d of done || []) player.quests.completed[d] = true; player.level = lv; tickQuestUnlocks(); return !!(player.quests.unlocked[id] || player.quests.active[id]); };
    // 1. prerequisites
    // one spine: Lyra VI / Barnaby I are retired - the Last Step (her climax) and the Smith carry the order now
    const RET = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_forge', 'q_lyra_last'];
    out.retired = RET.filter((id) => Q[id] !== undefined);
    out.pre = { lastStep: [].concat(Q.q_last_step.prereq || []), smith: [].concat(Q.q_boss_sundered_smith.prereq || []), hg1: [].concat(Q.q_hourglass_1.prereq || []) };
    out.open = {
      last_noSmith: open('q_last_step', 50, ['q_distorted_portal', 'q_visit_lavaCavern']), last_smith: open('q_last_step', 50, ['q_distorted_portal', 'q_visit_lavaCavern', 'q_boss_sundered_smith']),
      smith_noPortal: open('q_boss_sundered_smith', 45, ['q_visit_lavaCavern']), smith_noKey: open('q_boss_sundered_smith', 45, ['q_distorted_portal']), smith_both: open('q_boss_sundered_smith', 45, ['q_visit_lavaCavern', 'q_distorted_portal']),
    };
    // 2. the Forge's far door: absent until the Smith's quest is done, present after (a fresh load, and live when it completes in the Forge)
    const doors = () => (game.portals || []).filter((p) => p && p.dest === 'lastStep').length;
    fresh(); player.level = 50; game.bossDefeated = game.bossDefeated || {}; game.bestiary = game.bestiary || {}; delete game.bossDefeated.lastStep; game.bestiary._boss_miraFallen = 0;
    loadMap('sundered_forge', 300); await sleep(800);
    out.door = { before: doors(), shut: !_lxLastStepDoorOpen(), staticDoor: !!(MAPS.sundered_forge.portals || []).find((p) => p.dest === 'lastStep') };   // release21: the door stands, shut
    const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {};
    player.quests.active.q_boss_sundered_smith = { targetCount: 1, rewardScale: 1 }; player._pqStagePaid = {}; player._pqChainRuns = 0;
    try { _completeQuest('q_boss_sundered_smith'); } catch (e) { out.door.err = String(e.message).slice(0, 100); } finally { window._maybeLevelUp = lvUp; }
    out.door.liveAfterCompletion = doors(); out.door.openAfter = _lxLastStepDoorOpen();
    loadMap('lastStep', 300); await sleep(500); loadMap('sundered_forge', 300); await sleep(800);
    out.door.afterReload = doors();
    // an old save past the copy keeps the door without the Smith quest
    fresh(); player.quests.completed.q_last_step = 1; loadMap('lastStep', 300); await sleep(400); loadMap('sundered_forge', 300); await sleep(800);
    out.door.oldSave = doors();
    // 3. the film (one spine): it plays on the Smith's kill once the Portal is done - Smith quest active or completed, or the Portal completed - and not before the Portal
    window.__played = 0; const keep = window._lxPlayKillFilm; window._lxPlayKillFilm = () => { window.__played++; };
    const f = LX_KILL_FILMS.sundered_smith, seen = player._storyBeatsSeen = player._storyBeatsSeen || {}; const try1 = (act, done) => { fresh(); for (const k of act) player.quests.active[k] = { targetCount: 1 }; for (const k of done || []) player.quests.completed[k] = true; delete seen[f.key]; const m = { type: 'sundered_smith' }; window._lxKillFilmPending = 0; _lxKillFilmKill(m); const r = !!m._kfPlayed; window._lxKillFilmPending = 0; return r; };
    out.film = { mainActive: try1(['q_boss_sundered_smith']), mainDone: try1([], ['q_boss_sundered_smith']), portalDone: try1([], ['q_distorted_portal']), portalActive: try1(['q_distorted_portal']), none: try1([]) };   // one spine: was the Barnaby IV (q_barnaby_finish) cases
    window._lxPlayKillFilm = keep; delete seen[f.key];
    // 4. the hand-off from the portal, at Lv 40 (level of what it waits on) and Lv 45
    fresh(); player.quests.completed.q_distorted_portal = 1; player.level = 40; out.hand = { lv40: _lxAct1Next('q_distorted_portal') };
    player.quests.completed.q_visit_lavaCavern = 1; out.hand.lv40errand = _lxAct1Next('q_distorted_portal');
    // 5. text
    out.text = { smith: Q.q_boss_sundered_smith.desc, epi: EVERDAWN_EPITAPHS.sundered_smith, hint: Q.q_boss_sundered_smith.desc.indexOf('Past it, a hammer is still ringing.') >= 0 };   // one spine: lyraV (The Tear V) is retired
    // 6. the arc has a name of its own: The Tear (per user, 2026-10-09: she is no longer a main character in it)
    const LY = ['q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin'];   // one spine: V (q_lyra_forge) and VI (q_lyra_last) are retired; the Last Step is the climax
    out.arc = { names: LY.map((id) => Q[id].name), prereqs: LY.map((id) => [].concat(Q[id].prereq || [])), levels: LY.map((id) => Q[id].levelReq), last: { name: Q.q_last_step.name, lv: Q.q_last_step.levelReq, prereq: [].concat(Q.q_last_step.prereq || []), target: Q.q_last_step.target } };
    fresh(); player.level = 50; for (const k of ['q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear']) player.quests.completed[k] = 1; tickQuestUnlocks(); acceptQuest('q_lyra_cut');
    toggleQuestJournal(); await sleep(400); const qm = document.getElementById('quest-modal'); out.arc.journal = qm ? qm.innerText.replace(/s+/g, ' ') : ''; try { toggleQuestJournal(); } catch (e) {}
    // 7. kill counts of The Tear I-IV (per user, 2026-10-09): Harea 100 and 200, Elder Arlen 5, Taiger / Lady Honk / Willeo 100 each - and the game really asks for them
    out.counts = { loan: Q.q_lyra_loan.count, tear: Q.q_lyra_tear.count, cut: Q.q_lyra_cut.count, kin: (Q.q_lyra_kin.objectives || []).map((o) => o.target + ':' + o.count).join(',') };
    const ready = (id) => !!(player.quests.active[id] && player.quests.active[id].readyToHandIn) || !!player.quests.completed[id];
    const go = (id, lv, pre) => { fresh(); for (const k of pre) player.quests.completed[k] = true; player.level = lv; tickQuestUnlocks(); acceptQuest(id); return player.quests.active[id]; };
    const a = go('q_lyra_loan', 40, ['q_lyra_aperture']); out.run = { loanTarget: a && a.targetCount };
    for (let i = 0; i < 99; i++) tickQuestKill('harea', false); out.run.loan99 = ready('q_lyra_loan'); tickQuestKill('harea', false); out.run.loan100 = ready('q_lyra_loan');
    go('q_lyra_tear', 40, ['q_lyra_aperture', 'q_lyra_loan']); for (let i = 0; i < 199; i++) tickQuestKill('harea', false); out.run.tear199 = ready('q_lyra_tear'); tickQuestKill('harea', false); out.run.tear200 = ready('q_lyra_tear');
    go('q_lyra_kin', 40, ['q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut']); for (let i = 0; i < 100; i++) { tickQuestKill('taiger', false); tickQuestKill('lady_honk', false); } for (let i = 0; i < 99; i++) tickQuestKill('willeo', false);
    out.run.kin99 = ready('q_lyra_kin'); tickQuestKill('willeo', false); out.run.kin100 = ready('q_lyra_kin');
    // 8. The Tear 0 is the Train to an Alternate Dimension (the Master Conductor); one spine: The Tear V is retired and its Smith ending lives on the Smith's own card
    const T0 = Q.q_lyra_aperture;
    out.t0 = { name: T0.name, lv: T0.levelReq, prereq: [].concat(T0.prereq || []), kind: T0.kind, target: T0.target, boss: !!T0.bossFight, desc: T0.desc };
    out.gate = { ans: (typeof _lxBarnabyWall === 'function' ? _lxBarnabyWall() : ''), bub: (typeof NPC_CHAT_LINES_OWN === 'object' && NPC_CHAT_LINES_OWN.Barnaby) ? JSON.stringify(NPC_CHAT_LINES_OWN.Barnaby) : '' };   // one spine: v / iii (retired cards) dropped
    const PQ = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'];
    out.open2 = { t0_noRush: open('q_lyra_aperture', 30, []), t0_29: open('q_lyra_aperture', 29, PQ), t0_30: open('q_lyra_aperture', 30, PQ) };   // one spine: The Tear V cases dropped
    fresh(); for (const k of PQ) player.quests.completed[k] = true; player.level = 31; tickQuestUnlocks(); acceptQuest('q_pq_finale'); acceptQuest('q_lyra_aperture'); tickQuestKill('pqConductor', true);
    out.duel = { finale: ready('q_pq_finale'), tear0: ready('q_lyra_aperture') };
    fresh(); for (const k of ['q_distorted_portal', 'q_visit_lavaCavern', 'q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin']) player.quests.completed[k] = true; player.level = 46; tickQuestUnlocks(); acceptQuest('q_boss_sundered_smith'); tickQuestKill('sundered_smith', true);   // one spine: Barnaby I-IV / The Tear V gone
    out.smith = { main: ready('q_boss_sundered_smith') };
    const milo = Object.values(MAPS).flatMap((m) => m.npcs || []).find((n) => n && n.name === 'Milo');
    const miloOpts = () => { try { openNPC(milo); } catch (e) {} const o = Array.from(document.querySelectorAll('#dialog-options button')).map((x) => x.textContent.trim()); try { closeDialog(); } catch (e) {} return o; };
    fresh(); for (const k of PQ.concat(['q_pq_finale'])) player.quests.completed[k] = true; player.level = 40; player.quests.active.q_lyra_aperture = { progress: 0 }; out.milo = { found: !!milo, withT0: miloOpts() };
    delete player.quests.active.q_lyra_aperture; out.milo.without = miloOpts();
    return out;
  });
  check(R.retired.length === 0, 'one spine: Barnaby I-IV and The Tear V/VI are retired (absent from QUESTS)', J(R.retired));
  check(J(R.pre.lastStep) === J(['q_boss_sundered_smith']), 'one spine: the Last Step (the arc\'s climax, was Lyra VI) needs the Smith', J(R.pre.lastStep));
  check(R.open.last_noSmith === false && R.open.last_smith === true, 'the Last Step stays shut until The Forge That Broke is done, then opens', J(R.open));
  check(R.pre.smith.indexOf('q_visit_lavaCavern') >= 0 && R.pre.smith.indexOf('q_distorted_portal') >= 0 && R.open.smith_noPortal === false && R.open.smith_noKey === false && R.open.smith_both === true, 'one spine: the Smith (was Barnaby I) needs the portal as well as the Forge-Key, and opens once both are done', J([R.pre.smith, R.open]));
  check(R.door.staticDoor === true && R.door.before === 1 && R.door.shut === true, "the Forge's far door to the Last Step stands but is shut until the Smith is done (release21, per user: it was hidden)", J(R.door));
  check(R.door.liveAfterCompletion === 1 && R.door.openAfter === true && R.door.afterReload === 1, 'finishing The Forge That Broke in the Forge opens the door at once, and it is there on the next visit', J(R.door));
  check(R.door.oldSave === 1, 'a save already past the Last Step keeps the door', J(R.door));
  check(R.film.mainActive === true && R.film.mainDone === true && R.film.portalDone === true && R.film.portalActive === false && R.film.none === false, "one spine: the Smith's ashes film plays on his kill once the Portal is done (Smith quest active or completed, or Portal completed) and not before the Portal", J(R.film));
  check(/waits on Recover the Forge-Key/.test(R.hand.lv40) && /Brok/.test(R.hand.lv40) && !/opens at Lv/.test(R.hand.lv40), "the portal's hand-off at Lv 40 names what the Smith waits on (no 'opens at Lv 45' with nobody to see)", R.hand.lv40);
  check(/The Forge That Broke opens at Lv 45/.test(R.hand.lv40errand) && !/Five Stories|Barnaby/.test(R.hand.lv40errand), 'one spine: with the errand done it names The Forge That Broke and says it opens at Lv 45 (no Barnaby chapter)', R.hand.lv40errand);
  check(/Before the sky fell, the woman at the gate came to his bench/.test(R.text.smith) && /left her forge cold/.test(R.text.smith) && /Barnaby/.test(R.text.smith) && R.text.hint, "one spine: The Forge That Broke carries Barnaby III / The Tear V's story (the woman at the gate at his bench, her forge left cold) and keeps the portal's closing line", R.text.smith.slice(0, 80));
  check(/the Megamall smith/.test(R.text.epi) && !/Glasswind/.test(R.text.epi), "the Smith's epitaph points at the Megamall smith (where Barnaby stands now), not at Glasswind", R.text.epi.slice(-60));
  check(R.arc.names.length === 5 && R.arc.names.every((n, i) => n.indexOf('The Tear ' + ['0', 'I', 'II', 'III', 'IV'][i] + ' — ') === 0), 'one spine: the five chapters (the prelude and I-IV) carry the arc name: The Tear 0, I, II, III, IV', J(R.arc.names));
  check(!R.arc.names.some((n) => /Lyra|Girl/.test(n)) && R.arc.names[1] === 'The Tear I — The Loan', 'no chapter title names her, and Chapter I (once about "the girl") is The Loan', J(R.arc.names));
  check(J(R.arc.prereqs) === J([['q_pq_carriage'], ['q_lyra_aperture'], ['q_lyra_loan'], ['q_lyra_tear'], ['q_lyra_cut']]) && J(R.arc.levels) === J([30, 40, 40, 40, 40]), 'the chain keeps its ids and order: aperture -> loan -> tear -> cut -> kin (the prelude hangs off Ticket Rush Stage 3 at Lv 30)', J([R.arc.prereqs, R.arc.levels]));
  check(R.arc.last.name === 'The Last Step' && R.arc.last.lv === 50 && J(R.arc.last.prereq) === J(['q_boss_sundered_smith']) && R.arc.last.target === 'miraFallen', "one spine: the arc's climax is The Last Step (Lv 50, after the Smith, hunts miraFallen once)", J(R.arc.last));
  check(/The Tear III — What the Blade Left Behind/.test(R.arc.journal) && !/Lyra/.test(R.arc.journal.slice(0, 4000)), 'the Journal shows the arc name on the chapter card', R.arc.journal.slice(0, 120));
  check(R.counts.loan === 100 && R.counts.tear === 200 && R.counts.cut === 5 && R.counts.kin === 'taiger:100,lady_honk:100,willeo:100', 'The Tear I-IV ask for Harea x100, Harea x200, Elder Arlen x5 and Taiger / Lady Honk / Willeo x100 each', J(R.counts));
  check(R.run.loan99 === false && R.run.loan100 === true && R.run.tear199 === false && R.run.tear200 === true && R.run.kin99 === false && R.run.kin100 === true, 'the game really counts them: ready to hand in on the 100th / 200th kill, and only when all three captains are done', J(R.run));
  check(R.t0.name === 'The Tear 0 \u2014 The Train to an Alternate Dimension' && R.t0.lv === 30 && J(R.t0.prereq) === J(['q_pq_carriage']) && R.t0.kind === 'boss' && R.t0.target === 'pqConductor' && R.t0.boss, 'The Tear 0 is "The Train to an Alternate Dimension": a Lv 30 boss fight against the Master Conductor, after Ticket Rush Stage 3', J([R.t0.name, R.t0.lv, R.t0.prereq, R.t0.target]));
  check(/Distorted Portal/.test(R.t0.desc) && /Endless Express/.test(R.t0.desc) && /Lyra, an apprentice, copies every reading/.test(R.t0.desc) && !/Mirror Self/.test(R.t0.desc), "its story is the prologue of the Distorted Portal on the Express, keeps Lyra's readings line, and no longer talks of the Mirror Self", R.t0.desc.slice(0, 80));
  check(R.open2.t0_noRush === false && R.open2.t0_29 === false && R.open2.t0_30 === true, 'The Tear 0 opens at Lv 30 once Ticket Rush Stage 3 is done, not before', J(R.open2));
  check(R.duel.finale === true && R.duel.tear0 === true, 'one Master Conductor duel completes Ticket Rush Stage 4 and The Tear 0 together', J(R.duel));
  check(R.milo.found && R.milo.withT0.some((t) => /Face the Master Conductor again/.test(t)) && !R.milo.without.some((t) => /Face the Master Conductor again/.test(t)), "a hero who already finished the Rush gets Milo's 'Face the Master Conductor again' while The Tear 0 is open, and only then", J([R.milo.withT0, R.milo.without]));
  // one spine: The Tear V is retired (pinned above); its Smith ending is the Smith's own fight, and its gate lore is on his card
  check(R.smith.main === true && !/Confused Vigil|what happened to the wall/.test(R.text.smith), 'one spine: one Smith kill completes The Forge That Broke, whose card tells of the gate (not the wall, not the Vigil)', J([R.smith, R.text.smith.slice(-60)]));
  { const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');   // Barnaby is a TALENTED SMITH, not a sentinel: he reached for a craft he could not name, and what leaked became the tear (per user, 2026-10-11)
    const here = ["name:'Young Barnaby, the Talented Smith'", "title:'The Talented'", 'Find the Talented Smith', 'a blade that could cut a curse. She led her own company up the road', 'Make it honest.', 'note: put it down.', 'what leaked grew into a mouth in the town', 'I gave her perfect', 'He tried to fuse magic into the smithing, and the steel came out perfect', 'The hammer is still coming down, in the eleventh hour of that night.', 'the young smith you set free did not walk out of it', 'a young Barnaby, still swinging at the hour he tried to fuse magic into the steel'];
    // one spine: Barnaby I-IV / The Tear V are retired - their phrases are pinned where they moved (the Smith's card, the Portal's note, Barnaby's own lines); Brok's 'I should have asked' left with Barnaby I
    const sorry = ['I should have left the unknown alone', 'Iron would have told me no', 'He turns every finished blade over once, looking for the flaw', 'I broke it once, and I would rather not say how'];
    check(here.every((p) => src.indexOf(p) >= 0), 'Barnaby is a talented smith who smithed a blade for the woman at the gate (unnamed) to cut the curse on this world, with a craft he could not name; what leaked became the tear (one spine: the Portal and Smith cards, his own lines, the boss card, the toasts)', J(here.filter((p) => src.indexOf(p) < 0)));
    check(sorry.every((p) => src.indexOf(p) >= 0), 'he is a little sorry about reaching for the unknown (the gloves, the Smith card, the confession)', J(sorry.filter((p) => src.indexOf(p) < 0)));
    const gone = ['The Confused Vigil\'', 'past the Confused Vigil', 'The Vigil broke like a mirror', "name:'Young Confused Barnaby", 'Where did you stand that night', 'We stand until. Until what', 'The gate. Probably', 'SOMEONE PUSHES', 'holding a door for climbers', 'holds a door for a return', 'posted at the Forge', 'guarding a door he forgot', 'stops guarding', 'still at his post', 'never chose where to stand', 'never picked a post', 'where I was meant to stand', 'I held the western breach', 'He always says the gate', 'chose the right place', 'only changed what he guards', 'keeps what is left unanswered', 'a man came attached', 'a young sentinel you have never met', 'the Sentinel was freed', 'The Sentinel is free', "the Sentinel's Wrath", "name:'Young Confused Barnaby, the Lost Sentinel'", "Find the Lost Sentinel', icon", "title:'The Undecided'"];
    check(gone.every((p) => src.indexOf(p) < 0), 'nothing in his story guards, holds a door, stands an oath or calls him a sentinel any more (the Bastion\'s own oath stays with Will and the Bull)', J(gone.filter((p) => src.indexOf(p) >= 0)));
    check(!/Twelve|Zodiac|Houses?\b|champion|\bMira\b/.test(here.concat(sorry).join(' ')), 'the origin names nobody: no Twelve, Zodiac, House, champion or Mira before they are met', ''); }
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
