// Sage Mira appears only once her questline is done (v0.30.1862 mira-freed). Per user: "Have Mira show up only AFTER u complete the
// questline where you defeat her and aetherion". She is the woman who turned back: the Last Step (q_last_step, her distorted self) and
// the Sanctum (q_boss_aetherion, the Tearborn she became). Checks, on her two maps (the Gate, wayfarersLantern2; the foot of the
// Interdimensional Ascension):
//   1. before the Last Step: she is not on either map, and the Gate's scene she speaks in (first_gate_visit) does not play or count
//   2. with the Last Step done but Aetherion standing: still absent
//   3. with q_boss_aetherion complete: she stands on both maps, and the Gate's scene plays on that visit
//   4. a save already past the ending (epilogue seen) keeps her without the quest; no page errors
//   node scripts/mira_freed_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11563';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _playStoryBeat === 'function' && typeof STORY_BEATS === 'object' && typeof player === 'object', null, { timeout: 180000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
  });
  // one save state, then a visit: is the sage on the map, did the Gate's scene play (or count)?
  const visit = (st, id) => p.evaluate(async ({ st, id }) => {
    const seen = player._storyBeatsSeen; delete seen.first_gate_visit; delete seen.epilogue_gravitos;
    if (player.titles && typeof LX_TITLE_CONQUEROR !== 'undefined') delete player.titles[LX_TITLE_CONQUEROR];
    player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {};
    delete player.quests.completed.q_last_step; delete player.quests.completed.q_boss_aetherion;
    if (st.last) player.quests.completed.q_last_step = true;
    if (st.aeth) player.quests.completed.q_boss_aetherion = true;
    if (st.ending) seen.epilogue_gravitos = true;
    const before = Object.keys(seen).filter((k) => seen[k]).length;
    try { if (typeof closeStoryBeat === 'function') closeStoryBeat(); } catch (e) {}
    const ov0 = document.getElementById('story-beat-overlay'); if (ov0) ov0.style.display = 'none';
    loadMap(id);
    await new Promise((r) => setTimeout(r, 1200));
    const ov = document.getElementById('story-beat-overlay');
    const r = { freed: (typeof _lxMiraFreed === 'function') ? _lxMiraFreed() : null, sage: (game.npcs || []).filter((n) => n && n.role === 'sage').length, others: (game.npcs || []).length,
      gateSeen: !!seen.first_gate_visit, newlySeen: Object.keys(seen).filter((k) => seen[k]).length - before - (st.ending ? 0 : 0),
      overlay: !!(ov && getComputedStyle(ov).display !== 'none' && ov.offsetParent !== null) };
    if (ov) { try { ov.click(); ov.click(); ov.click(); } catch (e) {} ov.style.display = 'none'; }
    return r; }, { st, id });
  // 1) before the Last Step
  const g1 = await visit({}, 'wayfarersLantern2'), a1 = await visit({}, 'interdimensionalAscension');
  check(!g1.freed && g1.sage === 0 && a1.sage === 0, 'before her questline: no Sage Mira at the Gate or the foot of the Ascension', { g1, a1 });
  check(!g1.gateSeen && !g1.overlay && g1.newlySeen === 0, "the Gate's scene she speaks in does not play, and nothing marks it seen", g1);
  // 2) the Last Step done, Aetherion standing
  const g2 = await visit({ last: true }, 'wayfarersLantern2');
  check(!g2.freed && g2.sage === 0 && !g2.gateSeen, 'her distorted self defeated but Aetherion standing: still absent', g2);
  // 3) the questline complete
  const g3 = await visit({ last: true, aeth: true }, 'wayfarersLantern2'), a3 = await visit({ last: true, aeth: true }, 'interdimensionalAscension');
  check(g3.freed && g3.sage === 1 && a3.sage === 1, 'with Aetherion\'s quest complete she stands at the Gate and at the foot of the Ascension', { g3, a3 });
  check(g3.gateSeen || g3.overlay, "the Gate's scene plays on the first visit that finds her", g3);
  // 4) a save past the ending, without the quest flag
  const g4 = await visit({ ending: true }, 'wayfarersLantern2');
  check(g4.freed && g4.sage === 1, 'a save already past the ending keeps her', g4);
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
