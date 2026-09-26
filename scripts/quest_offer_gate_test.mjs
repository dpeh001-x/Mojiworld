// QUEST OFFER GATE (v0.30.1115, the 2026-09-26 NPC audit). One test for "can this quest be accepted now", read by the
// marker, the dialog rows, the Journal's Available list and the guide:
//   - LEFTOVERS: a wrong-class quest (class swap) is not listed; an over-level one (ascension) is listed with a lock, not an
//     Accept (v0.30.1127: the gate pill is designed); neither can be accepted or guided to. Earlier wording: not listed as
//     Available and are not guided to
//   - DISTORTED: no job -> acceptQuest refuses and Taiga shows no marker for it; with a job -> Taiga's gold marker and
//     acceptQuest takes it
//   - AGREE: an ordinary giver's marker and dialog row still agree
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_offer_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11385';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
check(/function _lxQuestOfferable\(id\)/.test(readFileSync(PAGE, 'utf8')), 'static: the shared offer test exists');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    const fresh = (cls, lv) => { applyClass(cls); player.level = lv; player.job = null; player.quests = { active: {}, completed: {}, unlocked: {} }; try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {} };
    // the Journal's cards, by quest id: every class shares the ladder titles, so a title match would find the player's own
    const journalIds = async () => { try { closeAllModals(); } catch (e) {} toggleQuestJournal(); await W8(250); const tabs = [...document.querySelectorAll('#quest-modal [data-qtab], #quest-modal .qj-tab')]; const av = tabs.find((t) => /avail/i.test(t.textContent || t.dataset.qtab || '')); if (av) { av.click(); await W8(200); } const ids = [...document.querySelectorAll('#quest-modal [data-qaccept]')].map((b) => b.dataset.qaccept); try { closeAllModals(); } catch (e) {} return ids; };
    const out = {};
    // LEFTOVERS
    fresh('rogue', 30); loadMap('town', 300); await W8(900); try { closeAllModals(); } catch (e) {}
    const wrongCls = Object.entries(QUESTS).find(([id, q]) => q.cls === 'warrior' && (q.levelReq || 1) <= 30 && !q.prereq);
    const overLv = Object.entries(QUESTS).find(([id, q]) => !q.cls && !q.prereq && q.kind !== 'boss' && (q.levelReq || 1) >= 60 && q.name);
    player.quests.unlocked[wrongCls[0]] = true; player.quests.unlocked[overLv[0]] = true;
    const jt = await journalIds(); const guide = _qnavGuideList();
    toggleQuestJournal(); await W8(250); { const tb = [...document.querySelectorAll('#quest-modal [data-qtab]')].find((t) => t.dataset.qtab === 'available'); if (tb) { tb.click(); await W8(200); } }
    const lockCard = [...document.querySelectorAll('#quest-modal .qj-card')].find((c) => (c.textContent || '').includes(overLv[1].name));
    const gateView = { overCard: !!lockCard, lock: !!(lockCard && lockCard.querySelector('.qj-btn.locked')), gatePill: !!(lockCard && lockCard.querySelector('.qj-pill.lvgate')) };
    try { closeAllModals(); } catch (e) {}
    out.leftovers = { gateView, wrongCls: wrongCls[0], overLv: overLv[0], availableCards: jt.length, listed: [wrongCls[0], overLv[0]].filter((id) => jt.includes(id)), guided: [wrongCls[0], overLv[0]].filter((id) => guide.includes(id)),
      accept: [acceptQuest(wrongCls[0], true), acceptQuest(overLv[0], true)] };
    // DISTORTED
    fresh('rogue', 40); player.quests.completed.q_inner_dim_trial = true; player.quests.unlocked.q_distorted_portal = true;
    loadMap('shadowWovenHood', 300); await W8(900); try { closeAllModals(); } catch (e) {}
    const taiga = game.npcs.find((n) => n.name === 'Taiga');
    taiga._qmCacheAt = 0; const m0 = _npcQuestMarker(taiga); const a0 = acceptQuest('q_distorted_portal', true);
    player.job = 'nightblade'; taiga._qmCacheAt = 0; const m1 = _npcQuestMarker(taiga);
    openNPC(taiga); await W8(150); const offered = [...document.querySelectorAll('#dialog-options > button')].some((b) => /Distorted Portal/.test(b.textContent)); closeDialog();
    const a1 = acceptQuest('q_distorted_portal', true);
    out.distorted = { noJob: { marker: m0 && m0.rank, accepted: a0 }, withJob: { marker: m1 && m1.rank, offered, accepted: a1 } };
    // AGREE
    fresh('warrior', 30); loadMap('town', 300); await W8(900); try { closeAllModals(); } catch (e) {}
    const arlen = game.npcs.find((n) => n.name === 'Old Arlen'); arlen._qmCacheAt = 0; const mk = _npcQuestMarker(arlen);
    openNPC(arlen); await W8(150); const rows = [...document.querySelectorAll('#dialog-options > button')].map((b) => b.textContent.trim()).filter((t) => /^(\u2757|\u2705)/.test(t)); closeDialog();
    out.agree = { marker: mk && mk.rank, rows };
    return out;
  });
  check(r.leftovers.gateView.overCard && r.leftovers.gateView.lock && r.leftovers.gateView.gatePill, 'GATED: the over-level quest stays in Open with its level-gate pill and a lock where Accept was', J(r.leftovers.gateView));
  check(r.leftovers.availableCards > 0 && r.leftovers.listed.length === 0 && r.leftovers.guided.length === 0 && r.leftovers.accept.every((a) => !a), 'LEFTOVERS: a wrong-class and an over-level quest left unlocked are neither listed as Available nor guided to (acceptQuest refuses both)', J(r.leftovers));
  check(r.distorted.noJob.marker !== 2 && r.distorted.noJob.accepted === false, 'DISTORTED: without a job, no marker over Taiga and acceptQuest refuses', J(r.distorted.noJob));
  check(r.distorted.withJob.marker === 2 && r.distorted.withJob.offered && r.distorted.withJob.accepted === true, 'DISTORTED: with a job, Taiga shows the gold marker, offers the trial, and acceptQuest takes it', J(r.distorted.withJob));
  check(r.agree.marker === 2 && r.agree.rows.length > 0, 'AGREE: an ordinary giver\'s gold marker still comes with an Accept row', J(r.agree));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
