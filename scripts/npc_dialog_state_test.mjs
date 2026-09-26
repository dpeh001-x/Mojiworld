// NPC DIALOG STATE (v0.30.1110, the 2026-09-26 NPC audit). Every way out of a dialog leaves it clean, and a click on
// an NPC in the world respects whatever card is already up:
//   - BOSS: Esc (closeAllModals) after the Boss Arena card, then talk to anyone: no boss silhouette on their card
//   - CONFIRM: a world click on an NPC while a confirm card is up leaves the confirm in place
//   - SWAP: Amnesiac's Talk page, click Bravo, click the Amnesiac: he opens at his top level, not the old sub-page
//   - SAME: clicking the NPC you are talking to keeps the conversation
//   - ROWS: the Amnesiac's quest rows show on his top level only, never on the story / reset pages
//   - static: the dead walk-away auto-close is gone
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/npc_dialog_state_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11381';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(!/function _checkDialogWalkAway|_activeNpcSticky\s*=/.test(src) && /_dOpen\._lxConfirm \|\| game\._activeNpc === bestNpc/.test(src), 'static: the walk-away auto-close is gone and the world click checks the open card');
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
    applyClass('warrior'); player.level = 100; player.quests = { active: {}, completed: {}, unlocked: {} };
    try { _ensureQuests(); tickQuestUnlocks(); } catch (e) {}
    try { closeAllModals(); } catch (e) {}
    loadMap('town', 300); await W8(1200); try { closeAllModals(); } catch (e) {} game.paused = false;
    const npc = (n) => game.npcs.find((x) => x.name === n), dlg = document.getElementById('dialog');
    const name = () => document.getElementById('dialog-name').textContent;
    const labels = () => [...document.querySelectorAll('#dialog-options > button')].map((b) => b.textContent.trim());
    const open = () => dlg.style.display === 'block';
    const out = {};
    // BOSS
    _openConfirmDialog('Boss Arena Ahead', 'x', 'Enter', () => {}, 'Back', () => {}, { bossSprite: 'Sprites/bosses/kingKrook.webp' });
    const had = dlg.classList.contains('boss-arena'); closeAllModals(); const activeAfterEsc = game._activeNpc;
    game.paused = false; openNPC(npc('Old Arlen')); await W8(150);
    out.boss = { had, arlen: dlg.classList.contains('boss-arena'), shade: dlg.style.getPropertyValue('--boss-shade'), activeAfterEsc: activeAfterEsc ? activeAfterEsc.name : null };
    closeDialog();
    // put Bravo and the Amnesiac on screen
    player.x = 1690; player.y = 300; game.paused = false; await W8(900);
    const clickNpc = (n) => { const c = document.getElementById('game') || document.querySelector('canvas'); const b = c.getBoundingClientRect();
      const sx = (n.x - (game.camera.x || 0)) * b.width / W, sy = (n.y + 22 - (game.camera.y || 0)) * b.height / H;
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + sx, clientY: b.top + sy })); };
    // CONFIRM
    let yes = 0; _openConfirmDialog('Leave the fight?', 'x', 'Leave', () => { yes++; closeDialog(); }, 'Stay', null);
    clickNpc(npc('Bravo')); await W8(200);
    out.confirm = { open: open(), name: name(), labels: labels() }; closeDialog();
    // SWAP
    game.paused = false; openNPC(npc('The Amnesiac')); await W8(150); const top = labels();
    const talk = [...document.querySelectorAll('#dialog-options > button')].find((b) => /Talk/.test(b.textContent)); talk && talk.click(); await W8(200); const sub = labels();
    clickNpc(npc('Bravo')); await W8(200); const bravo = name();
    // SAME
    const bravoLabels = labels(); clickNpc(npc('Bravo')); await W8(200); const bravoAgain = { name: name(), labels: labels() };
    clickNpc(npc('The Amnesiac')); await W8(200);
    out.swap = { top: top.slice(0, 2), sub: sub.slice(0, 2), bravo, back: labels().slice(0, 2), backName: name() };
    out.same = { first: bravoLabels.slice(0, 2), again: bravoAgain };
    closeDialog();
    // ROWS: unlock every quest the Amnesiac gives, then read his pages
    for (const [id, q] of Object.entries(QUESTS)) if (q.giver === 'The Amnesiac') { player.quests.unlocked[id] = true; for (const p of [].concat(q.prereq || [])) player.quests.completed[p] = true; }
    const qRow = (l) => /^(\u2757|\u2705|\ud83d\udcdc)/.test(l);
    openNPC(npc('The Amnesiac')); await W8(150); const topRows = labels().filter(qRow).length; closeDialog();
    const stageRows = [];
    for (const st of [1, 2, 3]) { game._amnesiacStage = st; openNPC(npc('The Amnesiac')); await W8(120); stageRows.push(labels().filter(qRow).length); game._amnesiacStage = st; closeDialog(); }
    game._amnesiacSagaView = true; openNPC(npc('The Amnesiac')); await W8(120); const sagaRows = labels().filter(qRow).length; closeDialog();
    out.rows = { topRows, stageRows, sagaRows };
    return out;
  });
  check(r.boss.had && !r.boss.arlen && !r.boss.shade && !r.boss.activeAfterEsc, 'BOSS: after Esc on the Boss Arena card, the next NPC card carries no boss silhouette and no active NPC is left behind', J(r.boss));
  check(r.confirm.open && r.confirm.name === 'Leave the fight?' && r.confirm.labels.length === 2, 'CONFIRM: a world click on an NPC leaves a pending confirm card in place', J(r.confirm));
  check(r.swap.bravo === 'Bravo' && r.swap.backName === 'The Amnesiac' && J(r.swap.back) === J(r.swap.top) && J(r.swap.sub) !== J(r.swap.top), 'SWAP: clicking Bravo mid-conversation closes the Amnesiac properly, so he reopens at his top level', J(r.swap));
  check(r.same.again.name === 'Bravo' && J(r.same.again.labels.slice(0, 2)) === J(r.same.first), 'SAME: clicking the NPC you are talking to keeps the conversation', J(r.same));
  check(r.rows.topRows > 0 && r.rows.stageRows.every((n) => n === 0) && r.rows.sagaRows === 0, 'ROWS: the Amnesiac\'s quest rows show on his top level and never on the story / reset pages or the saga', J(r.rows));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
