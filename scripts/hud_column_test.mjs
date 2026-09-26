// Live test: THE QUEST TRACKER CLEARS THE TAXI AND HOTKEYS BUTTONS (found in the art audit). The Taxi (112-142 px) and the
// Hotkeys hint (137-173 px) were raised into the tracker's old 92 px spot above the minimap and hid its rows. Measures
// the bottom-right column in the game's own 960x560 px with three quests tracked.   node scripts/hud_column_test.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net'; import { spawn } from 'node:child_process';

const OUT = 'C:/Users/dpeh0/AppData/Local/Temp/claude/C--Users-dpeh0-Mojiworld/cccfc943-3283-40e4-b3cf-d58b9676da30/scratchpad/';
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 18631; p <= 18729 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { window._perfTick = function () {}; LX_PERF.veryLowFx = false; _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = 'warrior'; player.level = 30; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('forest', 300); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
  // three active quests so the tracker is at a typical, tall-ish size
  try { const qs = (typeof QUESTS !== 'undefined' ? QUESTS : []).filter((q) => q && q.id).slice(0, 3); player.activeQuests = player.activeQuests || [];
    for (const q of qs) if (typeof acceptQuest === 'function') { try { acceptQuest(q.id); } catch (e) {} } } catch (e) {}
  try { renderQuestTracker(); } catch (e) {}
  await sleep(800); document.documentElement.classList.remove('lx-nobackdrop');
  const wrap = document.querySelector('.game-wrapper'); const wr = wrap.getBoundingClientRect(); const k = wr.width / wrap.offsetWidth;
  const box = (id) => { const e = document.getElementById(id); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect();
    return { top: Math.round((r.top - wr.top) / k), bottom: Math.round((wr.bottom - r.bottom) / k), right: Math.round((wr.right - r.right) / k), w: Math.round(r.width / k), h: Math.round(r.height / k), x0: Math.round((r.left - wr.left) / k), y0: Math.round((r.top - wr.top) / k), x1: Math.round((r.right - wr.left) / k), y1: Math.round((r.bottom - wr.top) / k) }; };
  const ids = ['minimap', 'quest-tracker', 'taxi-btn', 'hotkey-hint', 'coin-toast-zone', 'combo-meter', 'buff-row'];
  const m = Object.fromEntries(ids.map((i) => [i, box(i)]));
  const over = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = m[ids[i]], c = m[ids[j]]; if (a && c && a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1) over.push(ids[i] + ' x ' + ids[j]); }
  return { k, m, over, rows: document.querySelectorAll('#quest-tracker .qt-row, #quest-tracker > div').length };
});

await b.close(); srv.kill();
const m = R.m, T = m['quest-tracker'], X = m['taxi-btn'], H = m['hotkey-hint'], C = m['coin-toast-zone'], M = m['minimap'];
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x }); const J = (o) => JSON.stringify(o);
ok('the quest tracker is showing', !!T && T.h > 20, T);
ok('it does not overlap the Taxi or the Hotkeys hint', !R.over.includes('quest-tracker x taxi-btn') && !R.over.includes('quest-tracker x hotkey-hint'), R.over);
ok('it sits above the Hotkeys hint with a gap', T && H && T.bottom >= H.bottom + H.h + 4, { tracker: T && T.bottom, hintTop: H && H.bottom + H.h });
ok('the Taxi and the Hotkeys hint did not move (112 / 137 px)', X && H && Math.abs(X.bottom - 112) <= 3 && Math.abs(H.bottom - 137) <= 3, { taxi: X && X.bottom, hint: H && H.bottom });
ok('the coin-pickup pills ride with the tracker', C && T && C.bottom === T.bottom, { coin: C && C.bottom, tracker: T && T.bottom });
ok('the tracker stays clear of the combo meter', !R.over.includes('quest-tracker x combo-meter'), R.over);
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + J(q.x ?? '').slice(0, 200));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
