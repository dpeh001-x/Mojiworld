// EVERY ROAD INTO STAGE 4 ENDS WITH A CONDUCTOR TO FIGHT, AND KILLING HIM GRADUATES THE RUSH (v0.30.968).
//
// v0.30.967 fixed the one path the clip showed - the farm cooldown holding a run in progress. "Still
// bugged" earned a wider look: this drives each way a player actually reaches the duel, through Milo's
// own buttons rather than by setting flags, and then kills the boss to prove the stage closes.
//   A. Standing ON the Express (Milo rides it), finale ACTIVE, "Continue Stage 4"  - the clip's exact spot
//   B. From town, finale unlocked but not accepted, "Begin Stage 4"
//   C. From town, finale active, Milo's "Hop back on - STAGE 4" auto-router
//   D. Kill him through both phases (he comes back once at 25%): q_pq_finale completes, the tracker clears
//   E. Leave and come back mid-duel (Milo's 'Hop back on' from town): exactly one Conductor, never two
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/pq_stage4_route_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11356';
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
// quest state helpers: Stages 1-3 done, finale in the requested state
const setPQ = (finale) => page.evaluate((finale) => {
  player.quests = player.quests || {}; for (const k of ['completed', 'active', 'unlocked']) player.quests[k] = player.quests[k] || {};
  for (const id of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage']) { player.quests.completed[id] = { at: Date.now() }; delete player.quests.active[id]; }
  delete player.quests.completed.q_pq_finale; delete player.quests.active.q_pq_finale; delete player.quests.unlocked.q_pq_finale;
  if (finale === 'unlocked') player.quests.unlocked.q_pq_finale = true;
  if (finale === 'active') { player.quests.unlocked.q_pq_finale = true; player.quests.active.q_pq_finale = { progress: 0, started: Date.now() }; }
  player._pqFinaleBossPending = false;
  game.bossDefeated = game.bossDefeated || {}; delete game.bossDefeated.clockworkExpress;
  if (game._bossDefeatedAt) delete game._bossDefeatedAt.clockworkExpress;
  return true;
}, finale);
const talkMilo = (label) => page.evaluate(async (label) => {
  try { closeAllModals(); } catch (e) {}
  const milo = (game.npcs || []).find((n) => n && n.role === 'usher');
  if (!milo) return { no: 'no Milo on ' + game.currentMap };
  openNPC(milo); await new Promise((r) => setTimeout(r, 500));
  const labels = [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
  const b = [...document.querySelectorAll('#dialog-options button')].find((x) => new RegExp(label).test((x.textContent || '').trim()));
  if (!b) return { no: 'option /' + label + '/', labels };
  b.click();
  await new Promise((r) => setTimeout(r, 1800));   // the spawn is deferred 280 ms after the map load
  game.paused = false;
  const cs = (game.monsters || []).filter((m) => m && m.type === 'pqConductor' && m.currentHp > 0);
  return { labels, map: game.currentMap, conductors: cs.length, pending: !!player._pqFinaleBossPending,
    active: !!(player.quests.active && player.quests.active.q_pq_finale) };
}, label);
const goto = (map, x) => page.evaluate(async ({ map, x }) => { try { closeAllModals(); } catch (e) {} loadMap(map, x || 300); await new Promise((r) => setTimeout(r, 1200)); game.paused = false; return game.currentMap; }, { map, x });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof killMonster === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 40; player.hp = player.maxHp = 99999; game._playMs = 3600000;
  });
  // A - the clip: already on the Express, finale active, Continue
  await setPQ('active'); await goto('clockworkExpress', 300);
  const A = await talkMilo('Continue Stage 4');
  check(!A.no && A.conductors === 1 && A.map === 'clockworkExpress', 'A. on the Express already, "Continue Stage 4" spawns one Conductor', J(A.no ? A : { conductors: A.conductors, pending: A.pending }));
  // B - from town, unlocked, Begin
  await setPQ('unlocked'); await goto('town', 300);
  const B = await talkMilo('Begin Stage 4');
  check(!B.no && B.conductors === 1 && B.active, 'B. from town, "Begin Stage 4" accepts the quest and spawns him', J(B.no ? B : { conductors: B.conductors, active: B.active }));
  // C - from town, active, the auto-router's "Hop back on"
  await setPQ('active'); await goto('town', 300);
  const C = await talkMilo('Hop back on');
  check(!C.no && C.conductors === 1, 'C. "Hop back on - STAGE 4" from town spawns him', J(C.no ? C : { conductors: C.conductors, map: C.map }));
  // E - leave mid-duel and come back via Continue: still exactly one
  await goto('town', 300);
  const E = await talkMilo('Hop back on|Continue Stage 4');   // from town Milo routes you first; either button is the real path
  check(!E.no && E.conductors === 1, 'E. leave mid-duel, come back through Milo: exactly one Conductor, not two', J(E.no ? E : { conductors: E.conductors }));
  // D - kill him and the stage closes
  const D = await page.evaluate(async () => {
    window.__toasts = []; const f = window.showToast; if (f && !f.__w) { window.showToast = function (m) { try { window.__toasts.push(String(m).slice(0, 90)); } catch (e) {} return f.apply(this, arguments); }; window.showToast.__w = true; } else { window.__toasts = []; }
    // the Conductor is a TWO-PHASE duel: the first kill brings him back at 25% of max, the second ends him.
    // Kill from a timeout so the call never lands inside the monster loop (which would defer it).
    const live = () => (game.monsters || []).find((m) => m && m.type === 'pqConductor' && m.currentHp > 0);
    if (!live()) return { no: 'no conductor to kill' };
    const max0 = live().maxHp || live().hp; const phases = [];
    for (let k = 1; k <= 3 && live(); k++) {
      await new Promise((res) => setTimeout(() => { const m = live(); m.currentHp = 0; killMonster(m); res(); }, 50));
      await new Promise((r) => setTimeout(r, 1200));
      const m = live(); phases.push(m ? +(m.currentHp / max0).toFixed(2) : 0);
    }
    const again = (game.monsters || []).filter((m) => m && m.type === 'pqConductor' && m.currentHp > 0).length;
    return { completed: !!(player.quests.completed && player.quests.completed.q_pq_finale), active: !!(player.quests.active && player.quests.active.q_pq_finale),
      again, phases, toasts: window.__toasts.slice(0, 4), tracker: ((document.getElementById('quest-tracker') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 100) };
  });
  check(!D.no && D.phases.length === 2 && D.phases[0] > 0.2 && D.phases[0] < 0.3 && D.phases[1] === 0, 'D. he is a two-phase duel: back once at 25%, gone on the second kill', J(D.phases));
  check(!D.no && D.completed && !D.active, 'and that second kill completes q_pq_finale', J(D.no ? D : { completed: D.completed, active: D.active }));
  check(!D.no && D.again === 0, 'and no second Conductor rises in the arena', 'live after kill: ' + D.again);
  check(!D.no && !/STAGE 4/.test(D.tracker), 'the Stage-4 tracker line is gone', J(D.tracker));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
