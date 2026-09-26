// QUEST NAVIGATION ROUTES (v0.30.1119, the 2026-09-26 NPC audit). The Journal row, the guide, Locate and the tracker
// send you to the right person with the right verb:
//   - TALK: a talk quest counts its list (1 of 3 reads 1/3, not 1/1 "ready"), and its row says Talk to <next person>
//   - GIVERLESS: a quest with no giver (a Codex study) points at its hunt, not "Accept from" an NPC who never offers it
//   - MIRROR: the Mirror Self Trial reads Accept from / Warp with your class instructor, never "no walking route"
//   - LOCATE: live progress and real names; the tracker prints no raw id for Ticket Rush Stage 2
//   - NEXT: with the Forge held back by Brok's errands, the tracker's Next line names the errand and Brok
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_nav_route_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11388';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
check(/function _lxWarpVia\(q\)/.test(readFileSync(PAGE, 'utf8')), 'static: the instructor-warp resolver exists');
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _qnavRowHtml === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(async () => {
    const W8 = (ms) => new Promise((res) => setTimeout(res, ms));
    const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    const fresh = (cls, lv) => { applyClass(cls); player.level = lv; player.job = null; player.quests = { active: {}, completed: {}, unlocked: {} }; try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {} };
    const take = (id) => { const q = QUESTS[id]; for (const p of [].concat(q.prereq || [])) player.quests.completed[p] = true; player.quests.unlocked[id] = true; return acceptQuest(id, true); };
    const out = {};
    fresh('warrior', 100); loadMap('town', 300); await W8(900); try { closeAllModals(); } catch (e) {} game.paused = false;
    // TALK
    const q1 = QUESTS.q_carried_1; out.talkAccepted = take('q_carried_1');
    _questTalkTo(q1.talkTo[0]); renderQuestTracker(); await W8(80);
    const trk = document.getElementById('quest-tracker').textContent.replace(/\s+/g, ' ');
    out.talk = { count: q1.count, list: q1.talkTo.length, why: _qnavWhy('q_carried_1'), tracker: trk.slice(trk.indexOf(q1.name), trk.indexOf(q1.name) + 60), row: strip(_qnavRowHtml('q_carried_1', false, '')).slice(0, 90), locate: _lxQuestLocateLine('q_carried_1') };
    // GIVERLESS
    const study = Object.entries(QUESTS).find(([id, q]) => q.npc && !q.giver && !q.giverByClass && !q.cls && q.kind === 'kill' && /^b_/.test(id));
    player.quests.unlocked[study[0]] = true;
    out.giverless = { id: study[0], npc: study[1].npc, row: strip(_qnavRowHtml(study[0], false, '')).slice(0, 90) };
    take(study[0]); out.giverless.locate = _lxQuestLocateLine(study[0]); out.giverless.target = study[1].target;
    // MIRROR
    fresh('rogue', 25); loadMap('town', 300); await W8(600); try { closeAllModals(); } catch (e) {}
    player.quests.unlocked.q_inner_dim_trial = true;
    const before = strip(_qnavRowHtml('q_inner_dim_trial', false, '')).slice(0, 90);
    take('q_inner_dim_trial'); const after = strip(_qnavRowHtml('q_inner_dim_trial', false, '')).slice(0, 90);
    renderQuestTracker(); await W8(80); const mtrk = document.getElementById('quest-tracker').textContent.replace(/\s+/g, ' ');
    out.mirror = { before, after, trackerHasWarp: /Warp with Taiga/.test(mtrk) };
    // LOCATE / tracker on Ticket Rush Stage 2
    fresh('warrior', 40); take('q_pq_spire'); renderQuestTracker(); await W8(80);
    out.spire = { tracker: document.getElementById('quest-tracker').textContent.replace(/\s+/g, ' ').slice(0, 200), locate: _lxQuestLocateLine('q_pq_spire') };
    // NEXT
    fresh('warrior', 50);
    for (const id of ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword', 'q_inner_dim_trial', 'q_distorted_portal', 'q_hourglass_1', 'q_hourglass_2']) player.quests.completed[id] = true;
    try { tickQuestUnlocks(); } catch (e) {}
    renderQuestTracker(); await W8(80);
    const ntrk = document.getElementById('quest-tracker').textContent.replace(/\s+/g, ' ');
    out.next = { beat: _nextStoryBeat(), errand: QUESTS.q_visit_lavaCavern.name, row: ntrk.slice(ntrk.indexOf('Next:'), ntrk.indexOf('Next:') + 80) };
    return out;
  });
  check(r.talk.count === r.talk.list && !/ready/.test(r.talk.why) && /1\/3/.test(r.talk.tracker) && /^📍 Talk to /.test(r.talk.row) && /Talk to .+\(1\/3\)/.test(r.talk.locate), 'TALK: one conversation of three reads 1/3 (not ready), and the row and Locate say Talk to the next person', J(r.talk));
  check(!/Accept from/.test(r.giverless.row) && /Hunt/.test(r.giverless.row) && !r.giverless.locate.includes(r.giverless.target) && !/turn in to/i.test(r.giverless.locate), 'GIVERLESS: a Codex study points at its hunt, and Locate names the creature (not its id) with no turn-in', J(r.giverless));
  check(/(Accept from|From) Taiga/.test(r.mirror.before) && /Warp with Taiga/.test(r.mirror.after) && !/no walking route/.test(r.mirror.after) && r.mirror.trackerHasWarp, 'MIRROR: Accept from Taiga, then Warp with Taiga (row and tracker), never "no walking route"', J(r.mirror));
  check(!/pq_piece/.test(r.spire.tracker) && !/pq_piece/.test(r.spire.locate), 'SPIRE: neither the tracker nor Locate prints the raw id for Ticket Rush Stage 2', J(r.spire));
  check(r.next.beat === 'q_boss_sundered_smith' && r.next.row.includes(r.next.errand) && /see Brok/.test(r.next.row), 'NEXT: with the Forge waiting on Brok\'s errands, the tracker names the errand and Brok', J(r.next));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
