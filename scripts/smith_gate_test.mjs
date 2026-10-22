// THE SMITH WAITS FOR THE FORGE-KEY (one spine, v0.30.1851, per user: one fight per boss). Was "the Smith waits for Barnaby IV" (2026-10-09): Barnaby I-IV are
// retired, their lore folded into The Forge That Broke's card. Now: The Forge That Broke needs the portal AND Brok's Forge-Key (q_visit_lavaCavern); the Journal lists
// the portal, the Smith, then the Last Step with no Barnaby chapter between; a hand-off that cannot start the Smith names what it waits on; and no hand-in respawns a
// felled boss. Reads the levels and lines from the game; it does not pin them.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/smith_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '12091';
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
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestUnlocks === 'function' && typeof tickQuestVisit === 'function' && typeof _lxAct1Next === 'function' && typeof _QUEST_STORY_CHAIN === 'object' && typeof _completeQuest === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.job = 'knight'; player.master = null;
    const Q = QUESTS, C = _QUEST_STORY_CHAIN, out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const B = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish'];   // one spine: all four retired
    out.def = { smith: Q.q_boss_sundered_smith.prereq, smithCrit: !!Q.q_boss_sundered_smith.critical, retired: B.map((id) => Q[id] === undefined && _LX_RETIRED_QUESTS.includes(id)),
      smithKind: Q.q_boss_sundered_smith.kind, smithTarget: Q.q_boss_sundered_smith.target, smithDesc: Q.q_boss_sundered_smith.desc, portalTarget: Q.q_distorted_portal.target,
      lv: ['q_distorted_portal', 'q_boss_sundered_smith', 'q_last_step'].map((id) => Q[id].levelReq) };   // one spine: Portal -> Smith -> Last Step
    out.idx = {}; for (const id of ['q_distorted_portal'].concat(B, ['q_boss_sundered_smith', 'q_last_step'])) out.idx[id] = C.indexOf(id);
    const fresh = () => { player.quests = { active: {}, completed: {}, unlocked: {}, progress: {} }; _ensureQuests(); };
    const base = () => { fresh(); for (const k of C) { if (k === 'q_distorted_portal') break; player.quests.completed[k] = 1; } player.quests.completed.q_distorted_portal = 1; player.level = 45; };
    // the gate: portal done, Lv 45, no Forge-Key -> the Smith stays shut; recover the key -> he opens   // one spine: was Barnaby IV
    base(); delete player.quests.completed.q_visit_lavaCavern; tickQuestUnlocks(); await sleep(150);
    out.gate = { noKey: !!(player.quests.unlocked.q_boss_sundered_smith || player.quests.active.q_boss_sundered_smith) };
    player.quests.completed.q_visit_lavaCavern = 1; tickQuestUnlocks(); await sleep(250);
    out.gate.withKey = !!(player.quests.unlocked.q_boss_sundered_smith || player.quests.active.q_boss_sundered_smith);
    // the hand-off from the portal names what the Smith waits on
    base(); delete player.quests.completed.q_visit_lavaCavern; out.hand = {};
    out.hand.none = _lxAct1Next('q_distorted_portal');
    player.quests.completed.q_visit_lavaCavern = 1; out.hand.errandDone = _lxAct1Next('q_distorted_portal');
    // no hand-in puts a felled boss back in his arena (one spine: was "Barnaby IV respawns the Smith")
    const hand = (id, map) => { fresh(); const q = Q[id]; player.level = 45; player.exp = 0; player.expToNext = _lxLevelCost(45); player.quests.active[id] = { targetCount: q.count || 1, rewardScale: 1 }; player._pqStagePaid = {}; player._pqChainRuns = 0;
      game.bossDefeated = game.bossDefeated || {}; game._bossDefeatedAt = game._bossDefeatedAt || {}; game.bossDefeated[map] = true; game._bossDefeatedAt[map] = game._playMs || 0;
      const lvUp = window._maybeLevelUp; window._maybeLevelUp = function () {}; try { _completeQuest(id); } catch (e) {} finally { window._maybeLevelUp = lvUp; }
      return { standing: !game.bossDefeated[map] && game._bossDefeatedAt[map] === undefined, done: !!player.quests.completed[id] }; };
    out.respawn = { portal: hand('q_distorted_portal', 'confusedVigil'), smith: hand('q_boss_sundered_smith', 'sundered_forge') };
    return out;
  });
  const D = R.def, X = R.idx;
  check(Array.isArray(D.smith) && D.smith.indexOf('q_distorted_portal') >= 0 && D.smith.indexOf('q_visit_lavaCavern') >= 0 && !D.smith.some((p) => /barnaby/.test(p)), 'The Forge That Broke needs the portal AND the Forge-Key (no Barnaby chapter)', J(D.smith));   // one spine
  check(D.retired.every(Boolean), 'Barnaby I-IV are retired (absent from QUESTS, listed in _LX_RETIRED_QUESTS)', J(D.retired));   // one spine: was "Barnaby II is a visit"
  check(D.smithKind === 'boss' && D.smithTarget === 'sundered_smith' && D.portalTarget === 'young_confused_barnaby', 'the Portal still faces young Barnaby and The Forge That Broke still ends the Smith', J([D.portalTarget, D.smithTarget]));   // one spine
  check(/Brok's soot-grey list names Barnaby/.test(D.smithDesc) && /Before the sky fell, the woman at the gate came to his bench with one order/.test(D.smithDesc), "Barnaby I-IV's lore survives on the Smith's card (the list, the one order)", String(D.smithDesc).slice(0, 120));   // one spine
  check(X.q_distorted_portal >= 0 && ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish'].every((id) => X[id] === -1) && X.q_distorted_portal < X.q_boss_sundered_smith && X.q_boss_sundered_smith < X.q_last_step,
    'the Journal lists the portal, the Smith, then the Last Step (no Barnaby chapter)', J(X));   // one spine
  check(D.lv.every((v, i, a) => i === 0 || v >= a[i - 1]), 'the Portal, the Smith and the Last Step stay in non-decreasing level order', J(D.lv));
  check(R.gate.noKey === false && R.gate.withKey === true, 'at Lv 45 with the portal done the Smith stays shut until the Forge-Key is recovered, then opens', J(R.gate));   // one spine
  check(/waits on/.test(R.hand.none) && /Recover the Forge-Key/.test(R.hand.none) && /Brok/.test(R.hand.none), "the portal's hand-off names what the Smith waits on (the Forge-Key errand, see Brok)", R.hand.none);
  check(!/waits on/.test(R.hand.errandDone) && /The Forge That Broke/.test(R.hand.errandDone), 'with the errand done the hand-off no longer says "waits on" (the Smith starts)', R.hand.errandDone);   // one spine: no Barnaby I step
  check(R.respawn.portal.done && R.respawn.portal.standing === false && R.respawn.smith.done && R.respawn.smith.standing === false, 'handing in the Portal or the Smith leaves the felled boss felled (no respawns)', J(R.respawn));   // one spine
  check(errs.length === 0, 'no page errors', errs.join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
