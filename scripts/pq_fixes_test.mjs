// Ticket Rush (party quest) fixes from the second bug hunt (v0.30.x pq-fixes).
//   node scripts/pq_fixes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// 1) Stage 3's tracker and navigator name the Carriage, not the Stage 1 lobby; 2) Milo's "Begin Stage 2" below its
// level starts nothing and warps nowhere; 3) a resumed Spire keeps its collected pieces (and a fresh one starts clean);
// 4) "reset my papers" clears the chain's banked progress.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11081';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _questGuidance === 'function' && typeof _qnavDest === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'archer'; player.level = 60;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    _ensureQuests();
  });

  // 1) Stage 3 guidance from town and from the Stage 1 lobby
  const G = await p.evaluate(async () => {
    const now = Date.now();
    player.quests.completed.q_clockwork_underpass = now; player.quests.completed.q_pq_spire = now;
    player.quests.unlocked.q_pq_carriage = 1; delete player.quests.completed.q_pq_carriage; delete player.quests.active.q_pq_carriage;
    acceptQuest('q_pq_carriage', true);
    const a = player.quests.active.q_pq_carriage;
    const want = _qtMapName('tower');
    const town = { g: (_questGuidance('q_pq_carriage', QUESTS.q_pq_carriage, a) || {}).text, nav: (_qnavDest('q_pq_carriage') || {}).map };
    loadMap('clockworkUnderpassLobby', 300); await new Promise((s) => setTimeout(s, 1800));
    const lobby = { g: (_questGuidance('q_pq_carriage', QUESTS.q_pq_carriage, player.quests.active.q_pq_carriage) || {}).text, nav: (_qnavDest('q_pq_carriage') || {}).map };
    loadMap('town'); await new Promise((s) => setTimeout(s, 1500));
    delete player.quests.active.q_pq_carriage;
    return { want, town, lobby };
  });
  console.log('guidance', JSON.stringify(G));
  check(G.town.g === G.want && G.town.nav === 'tower', 'from town, Stage 3\'s tracker and navigator name the Carriage (not the Stage 1 lobby)', G.town);
  check(G.lobby.g === G.want && G.lobby.nav === 'tower', 'in the Stage 1 lobby they still point to the Carriage - no "Target nearby" on mobs that count for nothing', G.lobby);

  // 2) Milo's Begin Stage 2 below the Spire's level
  const M0 = await p.evaluate(async () => {
    delete player.quests.completed.q_pq_spire; delete player.quests.active.q_pq_spire; player.quests.unlocked.q_pq_spire = 1;
    player.level = 5;
    const milo = game.npcs.find((n) => n.name === 'Milo');
    if (!milo) return { err: 'no Milo in town' };
    openNPC(milo); await new Promise((s) => setTimeout(s, 500));
    const btn = [...document.querySelectorAll('#dialog-options button, #dialog-options .option, #dialog-options div')].find((b) => /Begin Stage 2/.test(b.textContent));
    if (!btn) return { err: 'no Begin Stage 2', opts: [...document.querySelectorAll('#dialog-options *')].map((b) => b.textContent).slice(0, 6) };
    btn.click(); await new Promise((s) => setTimeout(s, 1500));
    return { map: game.currentMap, active: !!player.quests.active.q_pq_spire, toast: [...document.querySelectorAll('.toast, #toast-container *')].map((t) => t.textContent).filter((t) => /Milo|papers|Lv/.test(t)).slice(-1)[0] || '' };
  });
  console.log('milo', JSON.stringify(M0));
  check(!M0.err && M0.map === 'town' && !M0.active, "below the Spire's level, Milo's Begin Stage 2 starts nothing and warps nowhere", M0);
  await p.evaluate(() => { try { closeDialog(); } catch (e) {} try { closeAllModals(); } catch (e) {} game.paused = false; player.level = 60; });

  // 3) the Spire: resumed keeps its pieces; fresh starts clean
  const S = await p.evaluate(() => {
    delete player.quests.active.q_pq_spire; delete player.quests.completed.q_pq_spire; if (player._qBank) delete player._qBank.q_pq_spire;
    player._pqSpirePieces = { 0: true };                       // stale pieces from an old run
    acceptQuest('q_pq_spire', true);
    const fresh = Object.keys(player._pqSpirePieces || {}).length;
    player._pqSpirePieces = { 0: true, 1: true };
    if (typeof _LX_PQ_STAGE_MAP !== 'undefined' && _LX_PQ_STAGE_MAP.q_pq_spire) game.currentMap = _LX_PQ_STAGE_MAP.q_pq_spire;
    tickQuestVisit('pq_piece'); tickQuestVisit('pq_piece');
    abandonQuest('q_pq_spire', true); acceptQuest('q_pq_spire', true);
    return { fresh, resumedPieces: Object.keys(player._pqSpirePieces || {}).length, resumedProgress: player.quests.active.q_pq_spire ? player.quests.active.q_pq_spire.progress | 0 : null };
  });
  console.log('spire', JSON.stringify(S));
  check(S.fresh === 0, 'a fresh Spire starts with no pieces', S);
  check(S.resumedPieces === 2 && S.resumedProgress === 2, 'a resumed Spire keeps its 2 pieces alongside its restored 2/4 - the pin, tracker and summit exit agree', S);

  // 4) reset my papers clears the chain's bank
  const R = await p.evaluate(async () => {
    player._qBank = player._qBank || {}; player._qBank.q_pq_carriage = { progress: 10 };
    _lxPqRestartChain(); await new Promise((s) => setTimeout(s, 1500));
    return { bank: !!(player._qBank && player._qBank.q_pq_carriage), stage1: !!player.quests.active.q_clockwork_underpass };
  });
  console.log('restart', JSON.stringify(R));
  check(!R.bank && R.stage1, '"Reset my papers" clears last run\'s banked stage progress (Stage 3 no longer opens at 10 already counted)', R);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
