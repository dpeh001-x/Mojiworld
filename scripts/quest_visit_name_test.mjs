// RECOVER THE FORGE-KEY IS CRITICAL; A VISIT QUEST NAMES ITS MAP, NEVER ITS ID (per user: "make this quest critical", "correct the
// sundered_forge (should not be seen in this format by players)" - II · The Order Book's row read "Go to sundered_forge The Sundered Forge").
//   [1] Recover the Forge-Key is critical, and abandoning it is refused (forced too); Brok still offers it (it keeps its giver)
//   [2] the Order Book's tracker / Journal row says "Go to" and "The Sundered Forge" - no "sundered_forge" anywhere in it
//   [3] its destination label is the map's name alone
//   [4] the compass key names the map
//   [5] a hunt row still names the creature and its map (Recover the Forge-Key: Emberling, Lava Cavern)
//   node scripts/quest_visit_name_test.mjs      PORT / MOJI_SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15395);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _qnavRowHtml === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    for (const i of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(i); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 50; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    loadMap('town', 300); await sleep(1500); game.paused = false;
    _ensureQuests();
    const out = { crit: !!(QUESTS.q_visit_lavaCavern && QUESTS.q_visit_lavaCavern.critical), giver: QUESTS.q_visit_lavaCavern && QUESTS.q_visit_lavaCavern.giver };
    player.quests.active.q_visit_lavaCavern = { progress: 0, objProgress: [0, 0, 0] };
    QUESTS.q_lx_visit_probe = { name: 'Visit Probe', kind: 'visit', target: 'sundered_forge', count: 1, levelReq: 1, desc: 'probe' };   // one spine: Barnaby II (the last visit-a-map quest) is retired; a stand-in drives the same row
    player.quests.active.q_lx_visit_probe = { progress: 0 };
    try { abandonQuest('q_visit_lavaCavern', true); } catch (e) {}
    out.stillActive = !!player.quests.active.q_visit_lavaCavern;
    if (!out.stillActive) player.quests.active.q_visit_lavaCavern = { progress: 0, objProgress: [0, 0, 0] };
    const txt = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.replace(/\s+/g, ' ').trim(); };
    out.row = txt(_qnavRowHtml('q_lx_visit_probe', false));
    const dest = _qnavDest('q_lx_visit_probe');
    out.label = _qnavLabel(dest);
    game.qnav = 'q_lx_visit_probe'; game.paused = false;
    try { closeAllModals(); } catch (e) {}
    const _mu = window._qnavModalUp; window._qnavModalUp = () => false;   // the fresh page's tour counts as an open panel; the key is drawn over the world
    game.paused = false;   // closing the panels can leave the world paused; the key hides then
    try { _qnavDrawKey(); } catch (e) { out.keyErr = String(e.message); } finally { window._qnavModalUp = _mu; }
    out.key = (typeof _LX_QK !== 'undefined' && _LX_QK.name) ? _LX_QK.name.textContent : null;
    out.hunt = txt(_qnavRowHtml('q_visit_lavaCavern', false));
    return out;
  });
  ok('[1] Recover the Forge-Key is critical, Brok still gives it, and abandoning it is refused', R.crit && R.giver === 'Brok' && R.stillActive, { crit: R.crit, giver: R.giver, stillActive: R.stillActive });
  ok('[2] a visit quest\'s row: "Go to" The Sundered Forge, never the id', /Go to/.test(R.row) && /The Sundered Forge/.test(R.row) && !/sundered_forge/.test(R.row), R.row);
  ok('[3] its destination label is the map\'s name', R.label === 'The Sundered Forge', R.label);
  ok('[4] the compass key names the map', R.key === 'The Sundered Forge', { key: R.key, err: R.keyErr });
  ok('[5] a hunt row still names the creature and its map', /Emberling/.test(R.hunt) && /Lava Cavern/.test(R.hunt), R.hunt);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
