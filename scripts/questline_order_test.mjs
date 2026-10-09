// THE QUESTLINE READS IN ORDER (per user, 2026-10-09: "Ensure that chronologically this questline makes sense"). Two read-only readers walked the Past-the-Tear line (portal, Lyra,
// Barnaby I-IV, the Smith, the Last Step, Hourglass, the Sanctum) in every order its prerequisites allow; this pins what they found and the fixes:
//   - Lyra VI waits for the Smith (its stair is past the Forge); Barnaby I waits for the portal; Hourglass I waits for the Smith (hourglass_order_test pins that one)
//   - the Forge's far door to the Last Step is not there until The Forge That Broke is done (or the copy already fell), so the line cannot be walked past him
//   - the Smith's ashes film plays on the kill that opens the Last Step, not on Barnaby IV's
//   - the portal's hand-off names what the Smith waits on (with its level) instead of 'opens at Lv 45' with nobody to see
//   - three lines of text: the Smith's card says the Forge handed him back; his epitaph's soot is Barnaby's hands (not a Glasswind smith)
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/questline_order_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
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
    out.pre = { lyraVI: [].concat(Q.q_lyra_last.prereq), barnabyI: [].concat(Q.q_barnaby_five.prereq), hg1: [].concat(Q.q_hourglass_1.prereq || []) };
    const L5 = ['q_lyra_forge'];
    out.open = {
      lyraVI_noSmith: open('q_lyra_last', 50, L5), lyraVI_smith: open('q_lyra_last', 50, L5.concat(['q_boss_sundered_smith'])),
      barnabyI_noPortal: open('q_barnaby_five', 45, ['q_visit_lavaCavern']), barnabyI_portal: open('q_barnaby_five', 45, ['q_visit_lavaCavern', 'q_distorted_portal']),
    };
    // 2. the Forge's far door: absent until the Smith's quest is done, present after (a fresh load, and live when it completes in the Forge)
    const doors = () => (game.portals || []).filter((p) => p && p.dest === 'lastStep').length;
    fresh(); player.level = 50; game.bossDefeated = game.bossDefeated || {}; game.bestiary = game.bestiary || {}; delete game.bossDefeated.lastStep; game.bestiary._boss_miraFallen = 0;
    loadMap('sundered_forge', 300); await sleep(800);
    out.door = { before: doors(), staticDoor: !!(MAPS.sundered_forge.portals || []).find((p) => p.dest === 'lastStep') };
    const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {};
    player.quests.active.q_boss_sundered_smith = { targetCount: 1, rewardScale: 1 }; player._pqStagePaid = {}; player._pqChainRuns = 0;
    try { _completeQuest('q_boss_sundered_smith'); } catch (e) { out.door.err = String(e.message).slice(0, 100); } finally { window._maybeLevelUp = lvUp; }
    out.door.liveAfterCompletion = doors();
    loadMap('lastStep', 300); await sleep(500); loadMap('sundered_forge', 300); await sleep(800);
    out.door.afterReload = doors();
    // an old save past the copy keeps the door without the Smith quest
    fresh(); player.quests.completed.q_last_step = 1; loadMap('lastStep', 300); await sleep(400); loadMap('sundered_forge', 300); await sleep(800);
    out.door.oldSave = doors();
    // 3. the film: Barnaby IV's kill does not spend it; the main quest's kill (or no quest at all) does
    window.__played = 0; const keep = window._lxPlayKillFilm; window._lxPlayKillFilm = () => { window.__played++; };
    const f = LX_KILL_FILMS.sundered_smith, seen = player._storyBeatsSeen = player._storyBeatsSeen || {}; const try1 = (act) => { fresh(); for (const k of act) player.quests.active[k] = { targetCount: 1 }; delete seen[f.key]; const m = { type: 'sundered_smith' }; window._lxKillFilmPending = 0; _lxKillFilmKill(m); const r = !!m._kfPlayed; window._lxKillFilmPending = 0; return r; };
    out.film = { ivOnly: try1(['q_barnaby_finish']), ivAndMain: try1(['q_barnaby_finish', 'q_boss_sundered_smith']), mainOnly: try1(['q_boss_sundered_smith']), none: try1([]) };
    window._lxPlayKillFilm = keep; delete seen[f.key];
    // 4. the hand-off from the portal, at Lv 40 (level of what it waits on) and Lv 45
    fresh(); player.quests.completed.q_distorted_portal = 1; player.level = 40; out.hand = { lv40: _lxAct1Next('q_distorted_portal') };
    player.quests.completed.q_visit_lavaCavern = 1; out.hand.lv40errand = _lxAct1Next('q_distorted_portal');
    // 5. text
    out.text = { smith: Q.q_boss_sundered_smith.desc, epi: EVERDAWN_EPITAPHS.sundered_smith, lyraV: Q.q_lyra_forge.desc, hint: Q.q_boss_sundered_smith.desc.indexOf('Past it, a hammer is still ringing.') >= 0 };
    // 6. the arc has a name of its own: The Tear (per user, 2026-10-09: she is no longer a main character in it)
    const LY = ['q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin', 'q_lyra_forge', 'q_lyra_last'];
    out.arc = { names: LY.map((id) => Q[id].name), prereqs: LY.map((id) => [].concat(Q[id].prereq || [])), levels: LY.map((id) => Q[id].levelReq) };
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
    // 8. The Tear 0 is the Train to an Alternate Dimension (the Master Conductor) and The Tear V ends on the Sundered Smith (per user, 2026-10-09)
    const T0 = Q.q_lyra_aperture, TV = Q.q_lyra_forge;
    out.t0 = { name: T0.name, lv: T0.levelReq, prereq: [].concat(T0.prereq || []), kind: T0.kind, target: T0.target, boss: !!T0.bossFight, desc: T0.desc };
    out.gate = { v: TV.desc, iii: Q.q_barnaby_hands.desc, ans: (typeof _lxBarnabyWall === 'function' ? _lxBarnabyWall() : ''), bub: (typeof NPC_CHAT_LINES_OWN === 'object' && NPC_CHAT_LINES_OWN.Barnaby) ? JSON.stringify(NPC_CHAT_LINES_OWN.Barnaby) : '' };
    out.v = { name: TV.name, target: TV.target, prereq: [].concat(TV.prereq || []), desc: TV.desc };
    const PQ = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'];
    out.open2 = { t0_noRush: open('q_lyra_aperture', 30, []), t0_29: open('q_lyra_aperture', 29, PQ), t0_30: open('q_lyra_aperture', 30, PQ), v_noIV: open('q_lyra_forge', 46, ['q_lyra_kin']), v_IV: open('q_lyra_forge', 46, ['q_lyra_kin', 'q_barnaby_finish']) };
    fresh(); for (const k of PQ) player.quests.completed[k] = true; player.level = 31; tickQuestUnlocks(); acceptQuest('q_pq_finale'); acceptQuest('q_lyra_aperture'); tickQuestKill('pqConductor', true);
    out.duel = { finale: ready('q_pq_finale'), tear0: ready('q_lyra_aperture') };
    fresh(); for (const k of ['q_distorted_portal', 'q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin']) player.quests.completed[k] = true; player.level = 46; tickQuestUnlocks(); acceptQuest('q_boss_sundered_smith'); acceptQuest('q_lyra_forge'); tickQuestKill('sundered_smith', true);
    out.smith = { main: ready('q_boss_sundered_smith'), v: ready('q_lyra_forge') };
    const milo = Object.values(MAPS).flatMap((m) => m.npcs || []).find((n) => n && n.name === 'Milo');
    const miloOpts = () => { try { openNPC(milo); } catch (e) {} const o = Array.from(document.querySelectorAll('#dialog-options button')).map((x) => x.textContent.trim()); try { closeDialog(); } catch (e) {} return o; };
    fresh(); for (const k of PQ.concat(['q_pq_finale'])) player.quests.completed[k] = true; player.level = 40; player.quests.active.q_lyra_aperture = { progress: 0 }; out.milo = { found: !!milo, withT0: miloOpts() };
    delete player.quests.active.q_lyra_aperture; out.milo.without = miloOpts();
    return out;
  });
  check(R.pre.lyraVI.indexOf('q_lyra_forge') >= 0 && R.pre.lyraVI.indexOf('q_boss_sundered_smith') >= 0, 'Lyra VI needs Lyra V and the Smith', J(R.pre.lyraVI));
  check(R.open.lyraVI_noSmith === false && R.open.lyraVI_smith === true, 'Lyra VI stays shut until The Forge That Broke is done, then opens', J(R.open));
  check(R.pre.barnabyI.indexOf('q_visit_lavaCavern') >= 0 && R.pre.barnabyI.indexOf('q_distorted_portal') >= 0 && R.open.barnabyI_noPortal === false && R.open.barnabyI_portal === true, 'Barnaby I needs the portal as well as the errand, and opens once both are done', J([R.pre.barnabyI, R.open]));
  check(R.door.staticDoor === true && R.door.before === 0, "the Forge's far door to the Last Step is not in the live map until the Smith is done (it is still in the map data)", J(R.door));
  check(R.door.liveAfterCompletion === 1 && R.door.afterReload === 1, 'finishing The Forge That Broke in the Forge opens the door at once, and it is there on the next visit', J(R.door));
  check(R.door.oldSave === 1, 'a save already past the Last Step keeps the door', J(R.door));
  check(R.film.ivOnly === false && R.film.ivAndMain === true && R.film.mainOnly === true && R.film.none === true, "the Smith's ashes film is held back on Barnaby IV's kill and plays on The Forge That Broke's (or any kill with no Barnaby IV pending)", J(R.film));
  check(/waits on Recover the Forge-Key/.test(R.hand.lv40) && /Brok/.test(R.hand.lv40) && !/opens at Lv/.test(R.hand.lv40), "the portal's hand-off at Lv 40 names what the Smith waits on (no 'opens at Lv 45' with nobody to see)", R.hand.lv40);
  check(/waits on I .{1,3}Five Stories About a Smith \(Lv 45\)/.test(R.hand.lv40errand), 'with the errand done it names Barnaby I and says it opens at Lv 45', R.hand.lv40errand);
  check(/The loan was closed, and the Forge has handed him back/.test(R.text.smith) && !/Barnaby/.test(R.text.smith) && R.text.hint, "The Forge That Broke says the Forge handed him back (and keeps the portal's closing line)", R.text.smith.slice(0, 80));
  check(/the Megamall smith/.test(R.text.epi) && !/Glasswind/.test(R.text.epi), "the Smith's epitaph points at the Megamall smith (where Barnaby stands now), not at Glasswind", R.text.epi.slice(-60));
  check(R.arc.names.length === 7 && R.arc.names.every((n, i) => n.indexOf('The Tear ' + ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'][i] + ' — ') === 0), 'the seven chapters (the Lv 20 prelude and I-VI) carry the arc name: The Tear 0, I, II, III, IV, V, VI', J(R.arc.names));
  check(!R.arc.names.some((n) => /Lyra|Girl/.test(n)) && R.arc.names[1] === 'The Tear I — The Loan', 'no chapter title names her, and Chapter I (once about "the girl") is The Loan', J(R.arc.names));
  check(J(R.arc.prereqs) === J([['q_pq_carriage'], ['q_lyra_aperture'], ['q_lyra_loan'], ['q_lyra_tear'], ['q_lyra_cut'], ['q_lyra_kin', 'q_barnaby_finish'], ['q_lyra_forge', 'q_boss_sundered_smith']]) && J(R.arc.levels) === J([30, 40, 40, 40, 40, 45, 50]), 'the chain keeps its ids and order (the prelude hangs off Ticket Rush Stage 3 at Lv 30; V waits for Barnaby IV)', J(R.arc.prereqs));
  check(/The Tear III — What the Weight Left Behind/.test(R.arc.journal) && !/Lyra/.test(R.arc.journal.slice(0, 4000)), 'the Journal shows the arc name on the chapter card', R.arc.journal.slice(0, 120));
  check(R.counts.loan === 100 && R.counts.tear === 200 && R.counts.cut === 5 && R.counts.kin === 'taiger:100,lady_honk:100,willeo:100', 'The Tear I-IV ask for Harea x100, Harea x200, Elder Arlen x5 and Taiger / Lady Honk / Willeo x100 each', J(R.counts));
  check(R.run.loan99 === false && R.run.loan100 === true && R.run.tear199 === false && R.run.tear200 === true && R.run.kin99 === false && R.run.kin100 === true, 'the game really counts them: ready to hand in on the 100th / 200th kill, and only when all three captains are done', J(R.run));
  check(R.t0.name === 'The Tear 0 \u2014 The Train to an Alternate Dimension' && R.t0.lv === 30 && J(R.t0.prereq) === J(['q_pq_carriage']) && R.t0.kind === 'boss' && R.t0.target === 'pqConductor' && R.t0.boss, 'The Tear 0 is "The Train to an Alternate Dimension": a Lv 30 boss fight against the Master Conductor, after Ticket Rush Stage 3', J([R.t0.name, R.t0.lv, R.t0.prereq, R.t0.target]));
  check(/Distorted Portal/.test(R.t0.desc) && /Endless Express/.test(R.t0.desc) && /Lyra, an apprentice, copies every reading/.test(R.t0.desc) && !/Mirror Self/.test(R.t0.desc), "its story is the prologue of the Distorted Portal on the Express, keeps Lyra's readings line, and no longer talks of the Mirror Self", R.t0.desc.slice(0, 80));
  check(R.open2.t0_noRush === false && R.open2.t0_29 === false && R.open2.t0_30 === true, 'The Tear 0 opens at Lv 30 once Ticket Rush Stage 3 is done, not before', J(R.open2));
  check(R.duel.finale === true && R.duel.tear0 === true, 'one Master Conductor duel completes Ticket Rush Stage 4 and The Tear 0 together', J(R.duel));
  check(R.milo.found && R.milo.withT0.some((t) => /Face the Master Conductor again/.test(t)) && !R.milo.without.some((t) => /Face the Master Conductor again/.test(t)), "a hero who already finished the Rush gets Milo's 'Face the Master Conductor again' while The Tear 0 is open, and only then", J([R.milo.withT0, R.milo.without]));
  check(R.v.target === 'sundered_smith' && R.v.prereq.indexOf('q_lyra_kin') >= 0 && R.v.prereq.indexOf('q_barnaby_finish') >= 0 && !/Confused Vigil|the boy/.test(R.v.desc), 'The Tear V ends on the Sundered Smith (not the boy) and waits for Barnaby IV', J([R.v.target, R.v.prereq]));
  check(R.open2.v_noIV === false && R.open2.v_IV === true && R.smith.main === true && R.smith.v === true, 'The Tear V stays shut until Barnaby IV, and one Smith kill completes it together with The Forge That Broke', J([R.open2, R.smith]));
  check(R.v.name === 'The Tear V \u2014 The Gate, or the Forge' && /what happened to the gate\.$/.test(R.v.desc) && !/what happened to the wall/.test(R.v.desc), 'The Tear V is "The Gate, or the Forge" and tells the Smith what happened to the gate (not the wall)', J([R.v.name, R.v.desc.slice(-60)]));
  check(!/right wall/i.test(R.gate.v + R.gate.iii + R.gate.ans + R.gate.bub) && /He always says the gate\./.test(R.gate.v) && /chose the gate: a breach question/.test(R.gate.iii) && /The gate, I always say\./.test(R.gate.ans) && /The gate\. Probably\./.test(R.gate.bub), 'Barnaby\'s "right wall" lines are "the gate" (no "right gate"): The Tear V, Barnaby III, his own answer and his bubble', J([R.gate.ans.slice(0, 120), R.gate.bub.slice(0, 120)]));
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
