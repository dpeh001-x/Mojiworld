// STAGE 4 SPAWNS ITS BOSS FOR A RUN IN PROGRESS (v0.30.967).
//
// The Master Conductor's Stage 4 spawn sat behind the generic ten-minute boss cooldown (v0.30.412,
// against 'hop back on' shard farming). 'Run the Ticket Rush again' deletes the quests but not
// bossDefeated.clockworkExpress or its timestamp, so re-running the Rush inside ten minutes of play put
// the tracker on Stage 4 and the game on "The Master Conductor is still recovering". Per user, with a clip.
//
// Three states, one rule - the cooldown gates REFIGHTS, never the run:
//   1. finale NOT completed, Conductor killed a moment ago  -> he spawns   (the bug; base fails this)
//   2. finale completed, killed a moment ago                -> still gated  (the farm case, unchanged)
//   3. finale completed, killed eleven minutes ago          -> he spawns   (cooldown served)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pq_stage4_spawn_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11355';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
// arm Stage 4 the way Milo's 'Continue Stage 4' does, with the Conductor's last death stamped `agoMs` ago
const arrive = (finaleDone, agoMs) => page.evaluate(async ({ finaleDone, agoMs }) => {
  try { closeAllModals(); } catch (e) {}
  loadMap('town', 300); await new Promise((r) => setTimeout(r, 800));
  player.quests = player.quests || {}; player.quests.completed = player.quests.completed || {}; player.quests.active = player.quests.active || {};
  if (finaleDone) player.quests.completed.q_pq_finale = { at: Date.now() }; else delete player.quests.completed.q_pq_finale;
  game.bossDefeated = game.bossDefeated || {}; game.bossDefeated.clockworkExpress = true;
  game._bossDefeatedAt = game._bossDefeatedAt || {}; game._bossDefeatedAt.clockworkExpress = (game._playMs || 0) - agoMs;
  player._pqFinaleBossPending = true;
  window.__toasts = []; const f = window.showToast; if (f && !f.__w) { window.showToast = function (m) { try { window.__toasts.push(String(m).slice(0, 90)); } catch (e) {} return f.apply(this, arguments); }; window.showToast.__w = true; } else { window.__toasts = []; }
  loadMap('clockworkExpress', 100); await new Promise((r) => setTimeout(r, 1500)); game.paused = false;
  return { conductor: (game.monsters || []).some((m) => m && m.type === 'pqConductor' && m.currentHp > 0),
    recovering: window.__toasts.some((t) => /still recovering/.test(t)),
    pending: !!player._pqFinaleBossPending, map: game.currentMap };
}, { finaleDone, agoMs });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; game._playMs = 60 * 60 * 1000;   // an hour into the session
  });
  const run = await arrive(false, 30 * 1000);
  check(run.map === 'clockworkExpress', 'the Express loads for the duel', run.map);
  check(run.conductor === true && !run.recovering, 'a RUN in progress gets its Conductor, even 30 s after the last one fell', J(run));
  check(run.pending === false, 'and the pending flag is committed with the spawn', 'pending ' + run.pending);
  const farm = await arrive(true, 30 * 1000);
  check(farm.conductor === false && farm.recovering === true && farm.pending === true, 'a REFIGHT 30 s after the kill is still held by the cooldown, flag left armed', J(farm));
  const later = await arrive(true, 11 * 60 * 1000);
  check(later.conductor === true && !later.recovering, 'and served after eleven minutes of play', J(later));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
