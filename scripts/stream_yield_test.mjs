// Live test: THE WORLD STREAMER YIELDS TO COMBAT.
//
// Per user: "reduce the lag of the game and ensure frame rates have minimal
// variation and is smooth". Measured before the fix: in 14 s of forest combat
// exactly one long task, 128 ms at t+10 s - the world streamer (starts 8 s after
// reveal) fetching boss frames and decode()-ing other maps' 2912x1632
// backgrounds six-wide, the JS heap jumping 28 -> 61 MB in the same instant.
//
// Two scenes, same boot recipe as the perf probes, 'longtask' observed in-page:
//   FIGHT: 28 mobs around the player from t=0; the streamer's window (t+8..)
//          must produce no long task >= 50 ms, and _lxCombatHot() reads true.
//   CALM:  nobody spawned; the streamer must PROCEED (maps preloaded grows)
//          and nothing over 40 ms may land while it does.
//   node scripts/stream_yield_test.mjs [build.html]
import { chromium } from 'playwright-core'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const _PORT = process.env.PERF_PORT || '9494';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
async function scene(fight) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto('http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html') + '?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxCombatHot === 'function', { timeout: 60000 });
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; window._lxBootGateDone = true; const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} } const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none'; try { _prologueActive = false; } catch (e) {}
    // the perf harnesses' recipe: a real map, not the prologue void (where spawns are refused)
    player.level = 60; player.cls = player.cls || 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
    try { loadMap('forest', 300); } catch (e) { try { loadMap('blockland_apex'); } catch (e2) {} }
    game.paused = false; });
  await page.waitForTimeout(7000);
  const spawned = await page.evaluate((fight) => {
    const lt = []; const t00 = performance.now();
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push({ t: +((e.startTime - t00) / 1000).toFixed(2), ms: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    window.__sy = { lt, t00, preloadedAt0: Object.keys(window._lxMapPreloaded || {}).length, streamedAt0: !!window._lxWorldStreamed, doneAt0: window._lxSpriteDone || 0 };
    game.paused = false;
    if (fight) { const types = Object.keys(monsterTypes).slice(0, 8); for (let i = 0; i < 28; i++) { try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {} } }
    else { game.monsters.length = 0; window.__sy.calmPin = setInterval(() => { game.monsters.length = 0; }, 200); }   // the forest has its own 15 spawns; calm means nobody
    // progress after the kick is measured on the sprite counter the streamer ticks per finished image
    setTimeout(() => { window.__sy.doneAtKick = window._lxSpriteDone || 0; }, 3000);
    // the gate itself is the progress signal: count every time _lxStreamCalm RESOLVES (an image released to load/decode)
    try { const o = _lxStreamCalm; window.__sy.calmResolved = 0; _lxStreamCalm = function () { return o().then((v) => { window.__sy.calmResolved++; return v; }); }; } catch (e) {}
    // the two post-boot passes, kicked explicitly (the harness bypasses the reveal path that starts them)
    setTimeout(() => { try { _lxStreamWorld(); } catch (e) {} try { _warmDecodeRegistries(true); } catch (e) {} }, 2500);
    return { map: game.currentMap, mobs: game.monsters.length, hot: _lxCombatHot(), prologue: !!window._prologueActive };
  }, fight);
  console.log((fight ? 'FIGHT' : 'CALM ') + ' scene start', JSON.stringify(spawned));
  await page.waitForTimeout(22000);
  const r = await page.evaluate(() => ({ lt: window.__sy.lt, hot: _lxCombatHot(), preloaded: Object.keys(window._lxMapPreloaded || {}).length, preloadedAt0: window.__sy.preloadedAt0, streamed: !!window._lxWorldStreamed, streamedAt0: window.__sy.streamedAt0, mobs: game.monsters.filter((m) => m && (m.currentHp === undefined || m.currentHp > 0)).length, avg: +(LX_PERF.avgFrame).toFixed(1), doneAtKick: window.__sy.doneAtKick || 0, done: window._lxSpriteDone || 0, calm: !!window.__sy.calmPin, released: window.__sy.calmResolved || 0 }));
  await page.close();
  return { ...r, errs };
}
const F = await scene(true);
console.log('FIGHT', JSON.stringify({ hot: F.hot, mobs: F.mobs, avg: F.avg, streamed: F.streamed, preloaded: F.preloadedAt0 + '->' + F.preloaded, longtasks: F.lt }));
const C = await scene(false);
console.log('CALM ', JSON.stringify({ hot: C.hot, mobs: C.mobs, avg: C.avg, streamed: C.streamed, preloaded: C.preloadedAt0 + '->' + C.preloaded, longtasks: C.lt }));
await browser.close(); try { _srv.kill(); } catch (e) {}
const after = (lt, t) => lt.filter((e) => e.t >= t);
ok('fighting: _lxCombatHot() reads true with a pack around the player', F.hot === true && F.mobs > 0, { hot: F.hot, mobs: F.mobs });
ok('fighting: no long task >= 50 ms after the streamer\'s start (was one 128 ms task at t+10 s)', after(F.lt, 3).every((e) => e.ms < 50), after(F.lt, 3));
// progress = releases through the calm gate (the sprite counter also ticks for the high-priority map-entry preload,
// and a map is marked "preloaded" the moment its pool is created, so neither isolates the streamer)
ok('fighting: the calm gate released nothing while the player fought (the passes stayed parked)', F.streamed && F.released === 0, { released: F.released, spriteDone: F.doneAtKick + '->' + F.done });
ok('calm: _lxCombatHot() reads false with nobody around', C.hot === false, { hot: C.hot, mobs: C.mobs });
ok('calm: the gate releases images and streaming proceeds', C.streamed && C.released > 0 && C.done > C.doneAtKick, { released: C.released, spriteDone: C.doneAtKick + '->' + C.done });
ok('calm: nothing over 40 ms while it streams (one image a beat, big art not decoded ahead)', after(C.lt, 3).every((e) => e.ms < 40), after(C.lt, 3));
ok('no page errors', F.errs.length + C.errs.length === 0, F.errs.concat(C.errs).slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
