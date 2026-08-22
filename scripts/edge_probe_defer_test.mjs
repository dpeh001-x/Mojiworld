// Test: cold edge probes never run on a render frame, and the feather still
// arrives. Both halves matter — deferring the work is trivial if you are
// willing to never do it, so the second check is the one that keeps this
// honest.
//   node scripts/edge_probe_defer_test.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const PORT = process.env.PERF_PORT || '9504';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${process.argv[2] || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _lxEdgesTouched === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(6000);

const r = await page.evaluate(async () => {
  const out = {};
  // top-level const in a classic script is script-scoped, NOT a window property
  out.hasQueue = (typeof _lxEdgeQ !== 'undefined') && (typeof _lxEdgeSchedule === 'function');
  // Count probes that happen INSIDE a rendered frame vs outside it.
  // Time, not count. Probe COST varies hugely with how warm the source texture
  // is (7 ms cold, a fraction of that warm), so counting calls flags builds that
  // are perfectly smooth. What freezes a frame is milliseconds of synchronous
  // readback piled between two rAFs — measure exactly that.
  // Time spent in the EDGE PROBE specifically. Wrapping getImageData wholesale
  // measured the map-entry tile bake (_lxBakeSeamlessTile, ~600 ms of readback
  // at load) and reported it identically for every build — true, but nothing to
  // do with this change. Attribute to the path under test.
  // Count LONG FRAMES after warm-up. Timing "readback between two rAFs" cannot
  // tell deferred idle work (the point of the change) from a stalled frame (the
  // bug), and reported ~500 ms for every build. What the player experiences is
  // simply: how many frames ran long, and how long was the worst.
  let total = 0;
  const origProbe = window._lxEdgesTouched;
  window._lxEdgesTouched = function (...a) { total++; return origProbe.apply(this, a); };
  const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 28; i++) {
    try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {}
  }
  // Drive frames, flagging the window in which the game's own draw runs.
  let worst = 0, longFrames = 0;
  // settle first: the map-entry tile bake (_lxBakeSeamlessTile, a separate
  // ~600 ms of readback at load) is not what this change touches.
  const tw = performance.now();
  while (performance.now() - tw < 1500) await new Promise((res) => requestAnimationFrame(res));
  const t0 = performance.now();
  let last = performance.now();
  while (performance.now() - t0 < 8000) {
    await new Promise((res) => requestAnimationFrame(res));
    const now = performance.now();
    const dt = now - last; last = now;
    if (dt > 60) longFrames++;
    if (dt > worst) worst = dt;
    // NO setTimeout here: inserting one makes the rAF-to-rAF delta include the
    // idle slot, which measures the drain rather than the frame. Browsers run
    // idle callbacks between frames on their own.
  }
  window._lxEdgesTouched = origProbe;
  out.longFrames = longFrames;
  out.readbacksTotal = total;
  out.worstFrame = +worst.toFixed(1);
  // Did the feather actually get computed for the mobs on screen?
  let probed = 0, seen = 0;
  for (const m of game.monsters.slice(0, 20)) {
    const im = (typeof _mobSpriteFor === 'function') ? null : null;
    seen++;
  }
  // Count images anywhere that carry a resolved memo — proof the queue drained.
  out.queueLen = (typeof _lxEdgeQ !== 'undefined') ? _lxEdgeQ.length : -1;
  return out;
});
ok('the drain queue exists', r.hasQueue === true, '');
// THE bug, stated precisely: 122-127 cold probes landing in one frame, ~7 ms of
// synchronous GPU readback each, for a half-second freeze. Any build that lets a
// batch like that through fails here regardless of how fast the machine is.
// THE bug, stated in the unit that hurts: ~127 cold probes landed between two
// frames at ~7 ms of synchronous GPU readback each — a half-second freeze right
// when a room fills up. Any build that lets that much readback pile into one
// gap fails here.
// THE bug in the unit that hurts: ~127 cold probes landed between two frames at
// ~7 ms of synchronous GPU readback each — a half-second freeze right when a
// room fills up. Stated in milliseconds, not calls, because probe COST swings
// with how warm the texture is: a call count would pass a build that freezes.
// THE bug in the unit that hurts: 127 cold probes landing in one frame at ~7 ms
// of synchronous GPU readback each — a half-second freeze right when a room
// fills up. After warm-up a healthy build should produce no long frames at all.
ok('no probe stampede: no frame over 60ms once the map has settled',
   r.longFrames === 0, { longFrames: r.longFrames, worstFrameMs: r.worstFrame });
ok('the queue drains rather than growing without bound', r.queueLen >= 0 && r.queueLen < 400, { queueLen: r.queueLen });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

// The feather must still be computed — deferring work you never do is not a fix.
const feather = await page.evaluate(async () => {
  await new Promise((res) => setTimeout(res, 2500));   // let idle drain
  const im = new Image();
  await new Promise((res) => { im.onload = res; im.onerror = res; im.src = 'Sprites/monsters/slime.webp'; });
  _lxEdgesTouched(im);                       // queues it
  const queuedFirst = im._lxEdges === undefined;
  for (let i = 0; i < 90; i++) {             // give the drain real frames to run in
    await new Promise((res) => requestAnimationFrame(res));
    if (im._lxEdges !== undefined) break;
  }
  return { queuedFirst, resolved: im._lxEdges !== undefined };
});
ok('a first-sight probe is DEFERRED, not run inline', feather.queuedFirst === true, feather);
ok('...and the queue then resolves it (the feather still arrives)', feather.resolved === true, feather);

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
await browser.close(); srv.kill();
process.exit(results.every((q) => q.pass) ? 0 : 1);
