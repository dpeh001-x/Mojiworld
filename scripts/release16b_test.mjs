// RELEASE 16b (round ten story-order playthrough) stays fixed:
//   [1] the Gate's four endings and the Sixth Crossing card name no Houses or champions ("The stars are waiting." / "the twelve fallen stars")
//   [2] The Sanctum's Refusal opens at Lv 50 and starts itself once the Last Step is done; the Journal's Next puts it after the Last Step;
//       a save whose Aetherion fall is recorded (quest unlocked or in hand) gets it completed once, with the Keystone; a kill made with the
//       quest in hand pays exactly once
//   [3] the compass ranks a critical offer above a plain one, and an auto-picked plain offer gives way; a hand pick (pin or guide key) is kept
//   [4] The Tear VI taken after the copy fell is ready to hand in to Hera and its card says the descent is done
//   [5] the Lv 40 nudge with The Distorted Portal done names the master pick, not the portal quest
//   [6] an accepted quest that falls back to its giver says "Talk to" (Ticket Rush stage 2), never "Accept from"
//   [7] Lyra's greeting follows her arc (after The Tear IV and The Tear VI)
//   [8] the early-milestone ladder's last toast says "Every milestone claimed"
//   node scripts/release16b_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15162), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('mage');
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
  });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; };
    const toasts = []; const _st = window.showToast; window.showToast = function (m) { toasts.push(String(m)); return _st.apply(this, arguments); };
    const reset = (lv, done) => { player.level = lv; player.exp = 0; player.expToNext = 1e15; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests();
      for (const id of (done || [])) player.quests.completed[id] = 1; game.bestiary = {}; game.bossDefeated = {}; player.dawnFragments = []; };
    const out = {};
    // [1] the two beats
    const last = STORY_BEATS.first_gate_visit.stanzas[STORY_BEATS.first_gate_visit.stanzas.length - 1].text;
    out.gate = ['wake', 'home', 'unsure', undefined].map((a) => last({ gate_answer: a }));
    out.sky = STORY_BEATS.arrival_sky_beyond.stanzas.map((x) => (typeof x.text === 'function' ? x.text({}) : x.text)).join(' | ');
    // [2] The Sanctum's Refusal
    const PAST = ['q_distorted_portal', 'q_barnaby_finish', 'q_boss_sundered_smith', 'q_last_step'];
    out.lv = QUESTS.q_boss_aetherion.levelReq;
    out.chain = ['q_last_step', 'q_boss_aetherion', 'q_hourglass_1'].map((id) => _QUEST_STORY_CHAIN.indexOf(id));
    reset(50, PAST); tickQuestUnlocks(); out.at50 = { active: !!player.quests.active.q_boss_aetherion, done: !!player.quests.completed.q_boss_aetherion };
    const coins = () => player.mojicoins | 0;
    reset(55, PAST); player.quests.active.q_boss_aetherion = { progress: 0 }; game.bestiary.aetherion = 1; game.bestiary._boss_aetherion = 1;   // the hunter's save: killed at 53, auto-started at 60
    let c0 = coins(); tickQuestUnlocks(); const d1 = coins() - c0; c0 = coins(); tickQuestUnlocks(); tickQuestUnlocks();
    out.oldSave = { done: !!player.quests.completed.q_boss_aetherion, keystone: player.dawnFragments.filter((f) => f === 'frag_aetherion').length, paid: d1, again: coins() - c0 };
    reset(55, PAST); game.bestiary.aetherion = 1;   // killed before the quest opened: it would unlock now
    tickQuestUnlocks(); out.unlockedFall = { done: !!player.quests.completed.q_boss_aetherion, active: !!player.quests.active.q_boss_aetherion };
    reset(55, PAST); tickQuestUnlocks(); c0 = coins();   // the normal road: quest in hand, then the kill
    tickQuestKill('aetherion', true); game.bestiary.aetherion = 1; game.bestiary._boss_aetherion = 1; tickQuestUnlocks(); tickQuestUnlocks();
    out.kill = { done: !!player.quests.completed.q_boss_aetherion, keystone: player.dawnFragments.filter((f) => f === 'frag_aetherion').length, paid: coins() - c0 };
    // [3] the compass
    reset(20, []); player.quests.unlocked.q_kill_gummy = true; player.quests.unlocked.q_inner_dim_trial = true;
    const list = _qnavGuideList(); out.nav = { gummy: list.indexOf('q_kill_gummy'), trial: list.indexOf('q_inner_dim_trial') };
    const auto = (pins, byHand) => { game.qnav = 'q_kill_gummy'; game.qnavPins = pins; game._qnavByHand = byHand; game._qnavOptOut = false; _qnavAutoTrack._t = -1e12; _qnavAutoTrack(); return game.qnav; };
    out.nav.auto = auto([], null); out.nav.pinned = auto(['q_kill_gummy'], null); out.nav.keyed = auto([], 'q_kill_gummy');
    game.qnav = null; game.qnavPins = []; game._qnavByHand = null;
    // [4] The Tear VI
    reset(55, ['q_lyra_forge', 'q_boss_sundered_smith']);
    out.t6before = QUESTS.q_lyra_last.desc;
    player.quests.completed.q_last_step = 1; game.bestiary.miraFallen = 1;
    out.t6accept = acceptQuest('q_lyra_last');
    const a6 = player.quests.active.q_lyra_last || {}; out.t6 = { ready: !!a6.readyToHandIn, desc: QUESTS.q_lyra_last.desc };
    const npcMap = (name) => Object.keys(MAPS).find((id) => (MAPS[id].npcs || []).some((n) => n && n.name === name));
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d && d.classList.contains('typing'); i++) await sleep(50); await sleep(150); };
    const talk = async (name) => { const m = npcMap(name); clear(); loadMap(m, 300); await sleep(700); game.paused = false; const n = (game.mapData.npcs || []).find((x) => x.name === name);
      if (!n) return { err: 'no ' + name }; openNPC(n); await sleep(300); await settle();
      const r = { text: text(), opts: [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim()) }; try { closeDialog(); } catch (e) {} game.paused = false; return r; };
    const hera = await talk('Hera'); out.t6hera = hera.opts ? hera.opts.filter((o) => /Turn in/.test(o)) : hera;
    // [5] the Lv 40 nudge
    reset(53, ['q_inner_dim_trial', 'q_distorted_portal']); window._lxTeaserPending = 0; toasts.length = 0;
    _promptClassAdvancement(2); await sleep(3800); out.nudge = toasts.slice();
    // [6] Ticket Rush stage 2, accepted
    reset(30, []); player.quests.active.q_pq_spire = { progress: 0 };
    { const d = _qnavDest('q_pq_spire'); out.spire = d ? { verb: d.verb, who: d.who } : null; }
    // [7] Lyra
    reset(55, []); out.lyra0 = (await talk('Lyra')).text;
    reset(55, ['q_lyra_kin']); out.lyra4 = (await talk('Lyra')).text;
    reset(55, ['q_lyra_kin', 'q_lyra_last']); out.lyra6 = (await talk('Lyra')).text;
    // [8] the milestone ladder (source)
    const src = await (await fetch(location.href.split('?')[0])).text();
    out.mile = { now: src.includes('Every milestone claimed'), old: src.includes('Every chapter claimed') };
    window.showToast = _st; clear();
    return out;
  });
  ok('[1] the Gate\'s four endings close "The stars are waiting." and name no Houses', R.gate.every((t) => /The stars are waiting\.$/.test(t) && !/Houses/i.test(t)), R.gate.map((t) => t.slice(-40)));
  ok('[1] the Sixth Crossing card speaks of the twelve fallen stars, with no houses or champions', /twelve fallen stars/.test(R.sky) && !/house|champion/i.test(R.sky), R.sky);
  ok('[2] The Sanctum\'s Refusal opens at Lv 50, after the Last Step and before Hourglass I in the Journal', R.lv === 50 && R.chain[0] >= 0 && R.chain[0] < R.chain[1] && R.chain[1] < R.chain[2], { lv: R.lv, chain: R.chain });
  ok('[2] at Lv 50 with the Last Step done it starts itself', R.at50.active && !R.at50.done, R.at50);
  ok('[2] an old save whose fall is recorded (quest in hand) completes it once, with one Keystone', R.oldSave.done && R.oldSave.keystone === 1 && R.oldSave.paid > 0 && R.oldSave.again === 0, R.oldSave);
  ok('[2] a fall made before the quest opened completes it when it unlocks (no second kill asked)', R.unlockedFall.done && !R.unlockedFall.active, R.unlockedFall);
  ok('[2] a kill made with the quest in hand pays once (same payout, one Keystone)', R.kill.done && R.kill.keystone === 1 && R.kill.paid === R.oldSave.paid, R.kill);
  ok('[3] a critical offer ranks above a plain one in the guide list', R.nav.trial >= 0 && R.nav.gummy >= 0 && R.nav.trial < R.nav.gummy, R.nav);
  ok('[3] an auto-picked plain offer gives way to the critical quest', R.nav.auto === 'q_inner_dim_trial', R.nav.auto);
  ok('[3] a hand-picked target is kept (Journal pin, guide key)', R.nav.pinned === 'q_kill_gummy' && R.nav.keyed === 'q_kill_gummy', R.nav);
  ok('[4] before the copy falls, The Tear VI still sends you down', /Go down to the Last Step/.test(R.t6before), R.t6before.slice(-160));
  ok('[4] taken after the copy fell, The Tear VI is ready to hand in and its card says the descent is done', R.t6accept && R.t6.ready && /already been to the bottom/.test(R.t6.desc) && /Go to Hera/.test(R.t6.desc) && !/Go down to the Last Step/.test(R.t6.desc), { ready: R.t6.ready, tail: R.t6.desc.slice(-120) });
  ok('[4] Hera offers the turn-in', Array.isArray(R.t6hera) && R.t6hera.some((o) => /The Tear VI/.test(o)), R.t6hera);
  ok('[5] the Lv 40 nudge after the portal names the master pick, not the portal quest', R.nudge.some((t) => /master path/.test(t)) && !R.nudge.some((t) => /Find the Talented Smith/.test(t)), R.nudge);
  ok('[6] an accepted Ticket Rush stage 2 says "Talk to" its giver', R.spire && R.spire.verb === 'Talk to', R.spire);
  ok('[7] Lyra greets a newcomer as before', /apprentice in the Academia/.test(R.lyra0), R.lyra0.slice(0, 80));
  ok('[7] after The Tear IV and The Tear VI her greeting moves on', /You put the copies down/.test(R.lyra4) && /Hera told me what is written at the bottom/.test(R.lyra6) && !/apprentice in the Academia/.test(R.lyra6), [R.lyra4.slice(0, 60), R.lyra6.slice(0, 60)]);
  ok('[8] the early-milestone ladder says "Every milestone claimed"', R.mile.now && !R.mile.old, R.mile);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
