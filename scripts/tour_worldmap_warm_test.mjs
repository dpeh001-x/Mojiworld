// TOUR WORLD-MAP PRE-WARM (v0.30.1483, per user: "pre-warm the world map during the tour"). The first renderWorldMap() of a
// session costs ~400 ms (every later one ~20 ms) and the tour sends every player through W. The step before the W step
// draws the map in an idle slice, once, so pressing W does not freeze. Pins: nothing is drawn on earlier steps, one draw
// at the step before W, none on a revisit, and W's own open is then cheap and still ticks the step.
//   [MOJI_GAME_FILE=<build.html>] node scripts/tour_worldmap_warm_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11484';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0; const check = (ok, what, info) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => typeof loadMap === 'function' && typeof startTutorial === 'function', null, { timeout: 150000 });
const r = await p.evaluate(async () => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
  window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 10;
  try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
  (player._storyBeatsSeen = player._storyBeatsSeen || {}).everdawn_welcome = true;
  loadMap('town'); await new Promise((s) => setTimeout(s, 4500));
  const s = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {}; let draws = 0;
  const orig = window.renderWorldMap; let depth = 0;
  window.renderWorldMap = function () { if (depth === 0) draws++; depth++; try { return orig.apply(this, arguments); } finally { depth--; } };
  startTutorial(); await s(600);
  const wm = TUTORIAL_STEPS.findIndex((x) => x.detect === 'worldmap'); out.wm = wm;
  for (let i = 0; i < wm - 1; i++) { _tutStep = i; _renderTutorialStep(); } await s(1200); out.drawsEarlier = draws;
  _tutStep = wm - 1; _renderTutorialStep(); await s(2500); out.drawsAtStepBefore = draws;
  _tutStep = wm; _renderTutorialStep(); await s(300);
  const t0 = performance.now(); toggleWorldMap(); out.openMs = Math.round(performance.now() - t0);
  out.ticked = !!TUTORIAL_STEPS[wm]._done; out.drawn = document.getElementById('worldmap-grid').querySelectorAll('svg').length > 0;
  closeAllModals(); await s(300);
  const d1 = draws; _tutStep = wm - 1; _renderTutorialStep(); await s(1500); out.reWarm = draws - d1;
  return out;
});
check(r.wm > 0, 'the tour has a world-map step', r);
check(r.drawsEarlier === 0, 'no map is drawn on the earlier steps', r);
check(r.drawsAtStepBefore === 1, 'the step before W draws the map once, ahead of time', r);
check(r.openMs < 150, `pressing W is cheap after the warm (${r.openMs} ms; a cold first open is ~400 ms)`, r);
check(r.ticked && r.drawn, 'W still ticks the step and shows the map', r);
check(r.reWarm === 0, 'a revisit does not draw it again', r);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `${bad} FAILED` : 'all passed');
await browser.close(); srv.kill(); process.exit(bad ? 1 : 0);
