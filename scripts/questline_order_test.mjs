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
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
