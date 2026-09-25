// THREE OR MORE QUEST ROWS FOLD INTO ONE "QUESTS (N)" BUTTON (v0.30.982).
//
// Per user, with Brok's card carrying three 'Accept:' rows above his trade rows: "For some NPCs when the
// number of !Quests is 3 or more, try to group them into the button called Quests to better organise
// things neatly".
//   - a giver with three or more quest rows shows ONE '! Quests (N)' row and no 'Accept:' rows
//   - picking it opens the sub-page: the N quest rows, a Back row, Leave - and nothing else
//   - Back returns to the full card; Leave from the sub-page clears the stage (the next open is the card)
//   - a turn-in among them is announced on the button ('N ready to turn in')
//   - with two rows nothing folds: both 'Accept:' rows sit on the card as before
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_quest_group_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11364';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/const _qN = opts\.length - _qBefore;\s+if \(_qN >= 3\) \{/.test(src) && /game\._npcQuestMenu = null;\s+\/\/ v0\.30\.\d+ the folded quest list's sub-page/.test(src), 'static: the fold sits after _injectGiverQuests and its stage is in the shared reset');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const labels = () => page.evaluate(() => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim()));
const click = (re) => page.evaluate(async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => new RegExp(re).test(x.textContent)); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 350)); return true; }, re);
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openNPC === 'function' && typeof QUESTS === 'object', null, { timeout: 180000 });
  // a giver with plenty of quests, and where they stand: count quests per giver, then find the giver on a map
  const setup = await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    applyClass('warrior'); player.level = 99; player.talents = { warrior: 'x' }; player._tutorialSeen = true;
    const byGiver = {}; for (const id in QUESTS) { const q = QUESTS[id]; if (q && q.giver && !q.cls) (byGiver[q.giver] = byGiver[q.giver] || []).push(id); }
    const giver = Object.keys(byGiver).filter((g) => byGiver[g].length >= 3).sort((a, b) => byGiver[b].length - byGiver[a].length)[0];
    if (!giver) return { no: 'no giver with 3+ class-free quests' };
    // find the giver on a map: try the likely towns first
    let map = null;
    for (const m of ['everdawn_megamall', 'town', ...Object.keys(MAPS)]) {
      if (!MAPS[m]) continue;
      try { closeAllModals(); } catch (e) {}
      loadMap(m, 300); await new Promise((r) => setTimeout(r, 900)); try { closeAllModals(); } catch (e) {} game.paused = false;
      if ((game.npcs || []).some((n) => n && n.name === giver)) { map = m; break; }
      if (m === 'town') break;   // do not walk the whole world in a test; the two towns hold the givers
    }
    if (!map) return { no: 'giver ' + giver + ' not found on the towns' };
    // arm ALL of the giver's quests as offerable: unlocked, prereqs completed, none active/completed
    player.quests = player.quests || {}; for (const k of ['completed', 'active', 'unlocked']) player.quests[k] = player.quests[k] || {};
    for (const id of byGiver[giver]) { const q = QUESTS[id]; delete player.quests.active[id]; delete player.quests.completed[id]; player.quests.unlocked[id] = true; for (const p of [].concat(q.prereq || [])) player.quests.completed[p] = { at: Date.now() }; }
    window.__giver = giver; window.__ids = byGiver[giver];
    return { giver, map, n: byGiver[giver].length };
  });
  if (setup.no) throw new Error(setup.no);
  check(setup.n >= 3, `a giver with three or more quests stands on a town: ${setup.giver} (${setup.n}) on ${setup.map}`);
  await page.evaluate(async () => { const npc = (game.npcs || []).find((n) => n && n.name === window.__giver); openNPC(npc); await new Promise((r) => setTimeout(r, 400)); });
  const card = await labels();
  const folded = card.filter((l) => /Quests \(\d+\)/.test(l)), accepts = card.filter((l) => /Accept:/.test(l));
  const n = folded.length ? +(folded[0].match(/Quests \((\d+)\)/) || [])[1] : 0;
  check(folded.length === 1 && n >= 3 && accepts.length === 0, 'the card shows ONE Quests (N) row and no Accept rows', J(card));
  check(card.indexOf(folded[0]) === 0, 'the Quests row leads the card, where the quest rows used to be', 'index ' + card.indexOf(folded[0]));
  const opened = await click('Quests \\(\\d+\\)');
  const sub = await labels();
  const subAccepts = sub.filter((l) => /Accept:|Turn in:|\(\d+\/\d+\)/.test(l));
  check(opened && subAccepts.length === n && /Back/.test(sub[sub.length - 2] || '') && sub[sub.length - 1] === 'Leave' && sub.length === n + 2, 'the sub-page: the N quest rows, Back, Leave - nothing else', J(sub));
  const subText = await page.evaluate(() => { const d = document.getElementById('dialog'); if (d._twSkip) d._twSkip(); return (document.getElementById('dialog-text').textContent || '').replace(/\s+/g, ' ').trim(); });   // flush the reveal before reading
  check(new RegExp(setup.giver + ' lays the jobs out').test(subText) && new RegExp(n + ' matters').test(subText), 'the sub-page has its own short line', subText.slice(0, 80));
  await click('^\\u25c0 Back');   // anchored: a quest called "Sing Back the Depths" also contains the word
  const back = await labels();
  check(back.filter((l) => /Quests \(\d+\)/.test(l)).length === 1 && back.length === card.length, 'Back returns to the full card', J(back));
  // Leave from the sub-page clears the stage: the next open is the card, not the sub-page
  await click('Quests \\(\\d+\\)'); await click('^Leave$');
  const again = await page.evaluate(async () => { const npc = (game.npcs || []).find((n) => n && n.name === window.__giver); openNPC(npc); await new Promise((r) => setTimeout(r, 300)); const l = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent.trim()); closeDialog(); return l; });
  check(again.filter((l) => /Quests \(\d+\)/.test(l)).length === 1 && !again.some((l) => /Back/.test(l)), 'Leave from the sub-page clears the stage - the next open is the card', J(again.slice(0, 3)));
  // a turn-in among them is announced on the button
  const turnIn = await page.evaluate(async () => {
    const id = window.__ids[0]; const q = QUESTS[id];
    player.quests.active[id] = { progress: q.count || 1, targetCount: q.count || 1, readyToHandIn: true, started: Date.now() }; delete player.quests.unlocked[id];
    const npc = (game.npcs || []).find((n) => n && n.name === window.__giver); openNPC(npc); await new Promise((r) => setTimeout(r, 300));
    const l = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent.trim()); closeDialog();
    delete player.quests.active[id]; player.quests.unlocked[id] = true;
    return l;
  });
  check(turnIn.some((l) => /Quests \(\d+\) — 1 ready to turn in/.test(l)), 'a turn-in among them is announced on the button', J(turnIn.slice(0, 2)));
  // with two rows nothing folds
  const two = await page.evaluate(async () => {
    for (const id of window.__ids) { delete player.quests.active[id]; delete player.quests.unlocked[id]; }
    for (const id of window.__ids.slice(0, 2)) player.quests.unlocked[id] = true;
    const npc = (game.npcs || []).find((n) => n && n.name === window.__giver); openNPC(npc); await new Promise((r) => setTimeout(r, 300));
    const l = [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent.trim()); closeDialog(); return l;
  });
  check(two.filter((l) => /Accept:/.test(l)).length === 2 && !two.some((l) => /Quests \(\d+\)/.test(l)), 'with two quest rows nothing folds - both Accept rows sit on the card', J(two.slice(0, 3)));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
