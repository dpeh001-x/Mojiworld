// TOUR U-PANEL PRE-WARM (v0.30.1487, per user: "pre-warm the U panel too"). The first open of the U panel is a ~250 ms stall
// (layout + style + image decode; ~110 ms in one frame), and the tour's first panel step is the player's first open. The step
// before it opens the panel once, unseen: painted at 1% opacity for two frames, click-through, never paused. Pins: nothing built on earlier steps; built at the step
// before the panel step and left CLOSED, unpaused, unseen and silent (no tick recorded, no forced-modal class); then the real
// open costs almost no excess frame time and still ticks the step.
//   [MOJI_GAME_FILE=<build.html>] node scripts/tour_upanel_warm_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11488';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0; const check = (ok, what, info) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const p = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => typeof loadMap === 'function' && typeof startTutorial === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 150000 });
const r = await p.evaluate(async () => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
  window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 10;
  try { for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true; } catch (e) {}
  (player._storyBeatsSeen = player._storyBeatsSeen || {}).everdawn_welcome = true;
  loadMap('town'); await new Promise((s) => setTimeout(s, 4500));
  const s = (ms) => new Promise((r) => setTimeout(r, ms)); const raf = () => new Promise((r) => requestAnimationFrame(r)); const out = {};
  const m = document.getElementById('attributes-modal'); const built = () => !!m.querySelector('#u-tabs');
  startTutorial(); await s(600);
  const pi = TUTORIAL_STEPS.findIndex((x) => x.detect === 'panel'); out.pi = pi;
  for (let i = 0; i < pi - 1; i++) { _tutStep = i; _renderTutorialStep(); } await s(1200); out.builtEarlier = built();
  game.paused = false; let pausedSeen = false, stop = false; (async () => { while (!stop) { if (game.paused) pausedSeen = true; await raf(); } })();
  _tutStep = pi - 1; _renderTutorialStep(); await s(2500); stop = true; out.pausedSeen = pausedSeen; out.classDropped = !m.classList.contains('lx-uwarm') && m.style.opacity === '';
  out.builtAtStepBefore = built(); out.closed = m.style.display === 'none'; out.visRestored = m.style.visibility === ''; out.paused = !!game.paused;
  out.tagRecorded = !!(typeof _TUT_SEEN_TAGS !== 'undefined' && (_TUT_SEEN_TAGS.panel || _TUT_SEEN_TAGS.tab_lp)); out.stepTicked = TUTORIAL_STEPS.some((x) => x._done);
  out.forcedClass = document.body.classList.contains('forced-modal'); out.quietOff = !window._lxTutQuiet;
  _tutStep = pi; _renderTutorialStep(); await s(300);
  const t0 = performance.now(); openLevelUpPanel(); out.openMs = Math.round(performance.now() - t0);
  let last = performance.now(); const t1 = last; const fr = []; while (performance.now() - t1 < 1200) { await raf(); const n = performance.now(); fr.push(n - last); last = n; }
  out.excess = Math.round(fr.filter((f) => f > 20).reduce((a, f) => a + f - 4.2, 0)); out.worst = Math.round(Math.max(...fr));
  out.ticked = !!TUTORIAL_STEPS[pi]._done; out.shown = m.style.display === 'flex' && !!m.querySelector('#u-tabs'); out.pausedOpen = !!game.paused;
  closeAllModals(); await s(300);
  return out;
});
check(r.pi > 0, 'the tour has a U-panel step', r);
check(r.builtEarlier === false, 'the panel is not built on the earlier steps', r);
check(r.builtAtStepBefore === true, 'the step before the panel step builds it ahead of time', r);
check(r.classDropped && !r.pausedSeen, 'the warm never pauses the sim for a frame and drops its paint class again', r);
check(r.closed && r.visRestored && !r.paused && !r.forcedClass && r.quietOff, 'the warm leaves it closed, visible-ready, unpaused and with no forced-modal class', r);
check(!r.tagRecorded && !r.stepTicked, 'the warm is silent: no tick and no recorded panel tag', r);
check(r.excess < 200 && r.worst < 120, `the real open is smooth (excess ${r.excess} ms, worst frame ${r.worst} ms; a cold open measures ~330-400 / ~150-190)`, r);
check(r.ticked && r.shown && r.pausedOpen, 'U still ticks the step, shows the panel and pauses', r);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `${bad} FAILED` : 'all passed');
await browser.close(); srv.kill(); process.exit(bad ? 1 : 0);
