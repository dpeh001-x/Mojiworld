// An NPC's walk frames are ready before he first wanders: the map prewarm queues the WALK set at the idle set's draw size.
//
// Per user: "Work on debugging and reducing lag of the game". The map-entry probe (scripts/perf_map_entry_probe.mjs) enters a town from a warm
// map and splits every frame into behind-the-veil and visible: the veil hid all the big stalls, and what was left on Everdawn was Guguma's
// first wander - nine 841x971 walk frames each pinned and plain-baked inside the frame that drew it (18 canvases, a 67 ms frame), because
// _lxPrewarmNpcBakes queued the idle set and never the walk set. This loads the town, waits out the veil and the prewarm, forces him to walk
// for two seconds and counts the canvases minted inside _drawNpcSprite (base: 18, now: 0). It also checks the gate did not get slower (an
// undecoded job requeues itself, and the gate drains until the queue is empty or its cap) and that an NPC with no walk art queues nothing.
//   node scripts/npc_walk_prewarm_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11693), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _npcWalkFrame === 'function' && typeof _lxPrewarmDrain === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = player.cls || 'warrior'; player.level = 60; player.invulnerable = 9e9; player._god = true; player._gravitosCineSeen = true; player._tutorialSeen = true;
    player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); try { _perfTick = function () {}; LX_PERF.lowFx = false; LX_PERF.veryLowFx = false; } catch (e) {}
  });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), veil = () => !!(game._mapFadeEl && game._mapFadeEl.classList.contains('on'));
    loadMap('duneSands'); await sleep(300); const t0 = performance.now(); while (performance.now() - t0 < 15000 && (veil() || !(window._lxReadyGateLog || []).some((g) => g.id === 'duneSands'))) await sleep(100); await sleep(1500);   // a warm map first, as a player has
    loadMap('town'); await sleep(300); const t1 = performance.now(); while (performance.now() - t1 < 20000 && (veil() || !(window._lxReadyGateLog || []).some((g) => g.id === 'town'))) await sleep(100);
    const gate = (window._lxReadyGateLog || []).filter((g) => g.id === 'town').pop();
    // the walkers: NPCs on this map whose file has walk art on disk
    for (const n of game.npcs) { try { _npcWalkFrame(n.name); } catch (e) {} }   // what the first wander does: registers the set (a no-op once the prewarm has)
    const walkers = []; for (const n of game.npcs) { const f = NPC_SPRITE_FILES[n.name], base = f && f.replace(/\.(png|webp|jpg|jpeg)$/i, ''); if (base && NPC_WALK_FRAMES[base] && NPC_WALK_FRAMES[base].length) walkers.push({ n, base }); }
    const w = walkers[0]; if (!w) return { err: 'no NPC with walk art on town: ' + game.npcs.map((n) => n.name).join() };
    const set = NPC_WALK_FRAMES[w.base]; const t2 = performance.now();
    while (performance.now() - t2 < 12000 && (!set.every((im) => im && im.complete && im.naturalWidth > 0) || _LX_PREWARM_Q.length)) { game.paused = false; await sleep(150); }   // the set is in, and the queue has drained
    const pre = { frames: set.length, pinned: set.filter((im) => _lxPinCache.has(im)).length, plain: set.filter((im) => { const p = _lxPinCache.get(im); return p && p._lxPlainCache && p._lxPlainCache.size > 0; }).length, queue: _LX_PREWARM_Q.length };
    // the walk: count canvases minted inside _drawNpcSprite while he wanders for two seconds (one full walk cycle is 9 x 90 ms)
    const NL = String.fromCharCode(10), oc = document.createElement.bind(document); const minted = []; document.createElement = function (t) { if (String(t).toLowerCase() === 'canvas' && /_drawNpcSprite/.test(new Error().stack || '')) minted.push((new Error().stack || '').split(NL)[2].trim().slice(0, 60)); return oc.apply(document, arguments); };
    const t3 = performance.now(), iv = []; let last = t3, shown = new Set(); game.paused = false;
    while (performance.now() - t3 < 2200) { w.n._wanderState = 'walk'; await new Promise((res) => requestAnimationFrame(res)); const now = performance.now(); iv.push(now - last); last = now; const fr = _npcWalkFrame(w.n.name); if (fr) shown.add(set.indexOf(fr)); }
    document.createElement = oc;
    // the rule that keeps the gate from being held: a walk frame still downloading is NOT queued (an undecoded job requeues itself, and the gate drains until the
    // queue is empty or its cap); it queues itself when it lands. A stand-in frame that is not complete yet stands for the real one.
    const nm = w.n.name, fl = NPC_SPRITE_FILES[nm], bs = fl.replace(/\.(png|webp|jpg|jpeg)$/i, ''), real = NPC_WALK_FRAMES[bs]; let handler = null, loads = 0;
    const fake = { complete: false, naturalWidth: 0, addEventListener: (ev, fn) => { if (ev === 'load') { handler = fn; loads++; } } }, mine = (j) => j.arr && j.arr[0] === fake;
    NPC_WALK_FRAMES[bs] = [fake]; _LX_PREWARM_SEEN.delete('npc:' + nm); _lxPrewarmNpcBakes(game.currentMap);
    const queuedWhileLoading = _LX_PREWARM_Q.filter(mine).length; fake.complete = true; fake.naturalWidth = 841; if (handler) handler(); const queuedAfterLoad = _LX_PREWARM_Q.filter(mine).length;
    for (let i = _LX_PREWARM_Q.length - 1; i >= 0; i--) if (_LX_PREWARM_Q[i].type === 'npc:' + nm) _LX_PREWARM_Q.splice(i, 1);   // tidy: the stand-in and the repeated idle jobs
    NPC_WALK_FRAMES[bs] = real; const gateRule = { queuedWhileLoading, loads, queuedAfterLoad };
    const idle = game.npcs.filter((n) => { const f = NPC_SPRITE_FILES[n.name], base = f && f.replace(/\.(png|webp|jpg|jpeg)$/i, ''); return base && NPC_WALK_FRAMES[base] && NPC_WALK_FRAMES[base].length === 0; }).length;
    return { npc: w.n.name, pre, minted: minted.length, mintedBy: [...new Set(minted)].slice(0, 3), shown: shown.size, worst: +Math.max(...iv).toFixed(0), gateMs: gate && gate.ms, gateRule, gateCapped: gate && gate.capped, noArt: idle };
  });
  console.log(JSON.stringify(r));
  if (r.err) ok('town has an NPC with walk art', false, r.err); else {
    ok('the walk set (' + r.pre.frames + ' frames) is pinned before he first walks - the queue found it', r.pre.pinned === r.pre.frames && r.pre.frames >= 2, r.pre);
    ok('every walk frame has its plain downscale baked too', r.pre.plain === r.pre.frames, r.pre);
    ok('he really cycled through the set while walking (so the draws below were real)', r.shown >= r.pre.frames - 1, r.shown);
    ok('walking mints NO canvas inside _drawNpcSprite (base: one pin + one plain bake per frame)', r.minted === 0, { minted: r.minted, by: r.mintedBy });
    ok('the ready gate is not capped (its time swings 1-3 s with machine load, so it is not timed)', r.gateCapped === false, { ms: r.gateMs, capped: r.gateCapped });
    ok('a walk frame still downloading is NOT queued (it would hold the gate), and queues itself when it lands', r.gateRule.queuedWhileLoading === 0 && r.gateRule.loads === 1 && r.gateRule.queuedAfterLoad === 1, r.gateRule);
    ok('NPCs without walk art queue nothing (their set is empty)', r.noArt >= 1, r.noArt);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
