// PAST THE TEAR - the story line after the second class advancement (per user: "There should be the quest line that continues from
// the 2nd class advancement (that is essential story line but not required for the class advancement) after defeating confused
// barnaby, to defeat the sundered smith, then distorted mira, then aetherion, ensure the storyline flows beautifully").
//   1. the line: Distorted Portal -> The Forge That Broke -> The Last Step (new) -> The Sanctum's Refusal; each opens on the one
//      before it, the three after the portal are critical story quests, the Last Step hunts the copy (miraFallen)
//   2. each card opens where the previous boss's film ends, stays under 120 words, and keeps the canon pins
//   3. the Journal's story order has the Last Step between the Smith and the Sanctum
//   4. played: the portal turn-in names the Smith (or the level it opens at) and the advancement waits on nothing else; real
//      kills of the Smith and the copy (each revives once) roll the line on, and the Sanctum starts itself at its level
//   5. an old save that already beat the copy has the Last Step done quietly (no reward), and the Sanctum opens
//   node scripts/tear_chain_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11931), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof tickQuestUnlocks === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true; player.invulnerable = 1e9;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    for (const k of ['captains_teaser', 'barnaby_fall', 'mira_ashes', 'mira_aetherion', 'aetherion_release']) player._storyBeatsSeen[k] = true;   // no films in this run
    const toasts = []; const _st = showToast; window.showToast = showToast = (m, ...a) => { toasts.push(String(m)); return _st(m, ...a); };
    const clear = () => { try { closeAllModals(); } catch (e) {} const d = document.getElementById('dialog'); if (d && d.style.display === 'block') try { closeDialog(); } catch (e) {} game.paused = false; };
    const Q = (id) => QUESTS[id] || {};
    const words = (t) => String(t || '').trim().split(/\s+/).length;
    out.def = ['q_distorted_portal', 'q_boss_sundered_smith', 'q_last_step', 'q_boss_aetherion'].map((id) => ({ id, prereq: Q(id).prereq, critical: !!Q(id).critical, story: !!Q(id).story, kind: Q(id).kind, target: Q(id).target, lv: Q(id).levelReq, giver: Q(id).giver || null, words: words(Q(id).desc), desc: Q(id).desc }));
    out.chain = _QUEST_STORY_CHAIN.slice();
    // 4. played, from the advancement on
    const fresh = () => { player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); };
    fresh();
    for (const k of _QUEST_STORY_CHAIN) { if (k === 'q_distorted_portal') break; player.quests.completed[k] = 1; }
    player.job = 'knight'; player.master = null; player.level = 40; tickQuestUnlocks(); clear();
    acceptQuest('q_distorted_portal');
    toasts.length = 0; _completeQuest('q_distorted_portal'); await sleep(300);
    out.portal = { toast: toasts.find((t) => /Quest complete/.test(t)) || '', smithActive: !!player.quests.active.q_boss_sundered_smith, adv: typeof _masterAdvancePending === 'function' ? !!_masterAdvancePending() : null, lv: player.level };
    await sleep(2400); clear();
    player.level = 45; toasts.length = 0; tickQuestUnlocks(); await sleep(200);
    out.at45 = { smithActive: !!player.quests.active.q_boss_sundered_smith, crit: toasts.filter((t) => /CRITICAL/.test(t)) };
    const killBoss = async (map, type) => {
      game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[map] = true;
      loadMap(map, 300); await sleep(1800); clear();
      let b = null; for (let i = 0; i < 40 && !b; i++) { b = game.monsters.find((q) => q.type === type && q.currentHp > 0); if (!b) await sleep(250); }
      if (!b) return { found: false };
      toasts.length = 0; let k = 0;
      for (; k < 4 && game.monsters.includes(b); k++) { b.currentHp = 0; killMonster(b); await sleep(900); clear(); }
      await sleep(600); return { found: true, kills: k, revived: !!b._revivedOnce, toast: toasts.find((t) => /Quest complete/.test(t) && /Forge That Broke|Last Step/.test(t)) || toasts.slice(0, 4).join(' || ') };
    };
    out.smithKill = await killBoss('sundered_forge', 'sundered_smith');
    out.afterSmith = { done: !!player.quests.completed.q_boss_sundered_smith, lastActive: !!player.quests.active.q_last_step, lv: player.level };
    if (player.level < 50) { player.level = 50; tickQuestUnlocks(); await sleep(200); }
    out.at50 = { lastActive: !!player.quests.active.q_last_step };
    out.miraKill = await killBoss('lastStep', 'miraFallen');
    out.afterMira = { done: !!player.quests.completed.q_last_step, aeActive: !!player.quests.active.q_boss_aetherion, aeUnlocked: !!player.quests.unlocked.q_boss_aetherion, lv: player.level };
    player.level = 60; toasts.length = 0; tickQuestUnlocks(); await sleep(200);
    out.at60 = { aeActive: !!player.quests.active.q_boss_aetherion, crit: toasts.filter((t) => /CRITICAL/.test(t)) };
    // 5. an old save past the copy
    fresh(); for (const k of _QUEST_STORY_CHAIN) { if (k === 'q_last_step') break; player.quests.completed[k] = 1; }
    game.bestiary = game.bestiary || {}; game.bestiary.miraFallen = 1; player.level = 60; const c0 = player.mojicoins;
    tickQuestUnlocks(); await sleep(200);
    out.old = { lastDone: !!player.quests.completed.q_last_step, coins: player.mojicoins - c0, aeActive: !!player.quests.active.q_boss_aetherion };
    return out;
  });
  const [P, S, L, A] = R.def;
  ok('1. the line: the Smith opens on the portal, the Last Step on the Smith, the Sanctum on the Last Step', S.prereq === 'q_distorted_portal' && L.prereq === 'q_boss_sundered_smith' && A.prereq === 'q_last_step', R.def.map((d) => d.id + '<-' + d.prereq));
  ok('1. the three after the advancement are critical story quests nobody hands out (they start themselves)', [S, L, A].every((d) => d.critical && d.story && !d.giver), R.def.map((d) => [d.id, d.critical, d.story, d.giver]));
  ok('1. the Last Step hunts the copy on the Last Step at Lv 50, between the Smith (45) and the Sanctum (60)', L.kind === 'boss' && L.target === 'miraFallen' && L.lv === 50 && S.lv === 45 && A.lv === 60, L);
  ok('2. each card picks up the last film: the Vigil breaks, the ashes drift down, the tear lands', /Past him, the tear runs on\./.test(P.desc) && /^The Vigil broke like a mirror/.test(S.desc) && /^The Smith set his hammer down, and his ashes did not fall/.test(L.desc) && /^The copy fell\. Her one tear landed/.test(A.desc), [P.desc.slice(-40), S.desc.slice(0, 40), L.desc.slice(0, 40), A.desc.slice(0, 40)]);
  ok('2. ...each under 120 words, nobody named, the canon pins kept', R.def.every((d) => d.words <= 120) && !/Mira|Barnaby|Twelve/.test(S.desc + L.desc + A.desc) && /the soul she held goes free/.test(A.desc) && /wearing that woman's face and holding her soul/.test(A.desc) && /Forge-Ember Shard/.test(S.desc) && /distorted copy of the first who turned back/.test(L.desc), R.def.map((d) => d.id + ' ' + d.words));
  const ix = (id) => R.chain.indexOf(id);
  ok('3. the Journal story order: portal, Smith, Last Step, Sanctum', ix('q_distorted_portal') < ix('q_boss_sundered_smith') && ix('q_boss_sundered_smith') + 1 === ix('q_last_step') && ix('q_last_step') < ix('q_boss_aetherion'), R.chain.slice(ix('q_distorted_portal'), ix('q_boss_aetherion') + 1));
  ok('4. the portal turn-in names the Smith and when he opens; the master advancement waits on nothing else', /Next: The Forge That Broke opens at Lv 45/.test(R.portal.toast) && !R.portal.smithActive && R.portal.adv === true, R.portal);
  ok('4. at Lv 45 the Smith starts himself (★ CRITICAL)', R.at45.smithActive && R.at45.crit.some((t) => /Forge That Broke/.test(t)), R.at45);
  ok('4. his real death (after his revive) completes it and names the Last Step', R.smithKill.found && R.smithKill.kills >= 2 && R.afterSmith.done && /Last Step/.test(R.smithKill.toast), { ...R.smithKill, ...R.afterSmith });
  ok('4. the Last Step is running by Lv 50', R.at50.lastActive, R.at50);
  ok('4. the copy\'s real death completes it and names the Sanctum', R.miraKill.found && R.miraKill.kills >= 2 && R.afterMira.done && /Sanctum's Refusal/.test(R.miraKill.toast), { ...R.miraKill, ...R.afterMira });
  ok('4. at Lv 60 the Sanctum starts itself (★ CRITICAL)', R.at60.aeActive && R.at60.crit.some((t) => /Sanctum/.test(t)), R.at60);
  ok('5. an old save that already beat the copy has the Last Step done quietly, and the Sanctum opens', R.old.lastDone && R.old.coins === 0 && R.old.aeActive, R.old);
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
