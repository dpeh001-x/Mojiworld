// Live 2-client test: ENVIRONMENTAL double-sim gate -> a follower must NOT self-spawn
// timed map hazards (lava eruptions / ceiling drops) or wind gusts while following the
// host. The host's haz/hazhit broadcast is the sole source; running the local RNG too
// gave the guest ~2x hazards at positions the host never saw (unfair deaths).
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'env' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function boot(browser, name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} }, name);
  return page;
}
const ev = (p, f, a) => p.evaluate(f, a);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 80); });
// drive the timed-hazard system: inject an aggressive lava cfg + tick updateMapEvents
const runErupt = (p) => p.evaluate(() => {
  game.mapData.lavaEruptions = { minDelayMs: 1, radius: 140, warnMs: 100 };
  game._lavaEruptCD = null;
  // count only LOCALLY-spawned (non-mirror) enemy hazards
  const localEnemyHaz = () => game.hazards.filter(h => h && h.owner === 'enemy' && !h._coopMirror).length;
  // clear pre-existing local hazards so we measure only what this run spawns
  for (let i = game.hazards.length - 1; i >= 0; i--) { const h = game.hazards[i]; if (h && !h._coopMirror) game.hazards.splice(i, 1); }
  for (let i = 0; i < 8; i++) { try { updateMapEvents(300); } catch (e) {} }
  return localEnemyHaz();
});
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2000);

  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));
  ok('A is the host (not following)', await ev(A, () => net.isHost === true && _coopFollowingHost() === false));

  // HOST self-spawns the timed hazards (proving the map mechanic + cfg are valid).
  const hostSpawned = await runErupt(A);
  ok('HOST self-spawns timed lava hazards (mechanic works)', hostSpawned > 0, { hostSpawned });

  // FOLLOWER must self-spawn ZERO — the gate nulls the cfg while following.
  const followerSpawned = await runErupt(B);
  ok('FOLLOWER self-spawns ZERO timed hazards (no double-sim)', followerSpawned === 0, { followerSpawned });

  // Sanity: after the host stops being followed (simulate B leaving to a different
  // map), the follower's own eruptions resume (solo-for-this-map) — proving the gate
  // is scoped to "actively following", not a blanket disable.
  await ev(B, () => { window.__savedMap = game.currentMap; game.currentMap = '__solo_elsewhere__'; });
  const soloSpawned = await ev(B, () => {
    game.mapData.lavaEruptions = { minDelayMs: 1, radius: 140, warnMs: 100 };
    game._lavaEruptCD = null;
    for (let i = game.hazards.length - 1; i >= 0; i--) { const h = game.hazards[i]; if (h && !h._coopMirror) game.hazards.splice(i, 1); }
    for (let i = 0; i < 8; i++) { try { updateMapEvents(300); } catch (e) {} }
    const n = game.hazards.filter(h => h && h.owner === 'enemy' && !h._coopMirror).length;
    game.currentMap = window.__savedMap;
    return n;
  });
  ok('follower resumes local hazards when NOT following (solo map)', soloSpawned > 0, { soloSpawned });

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP ENVIRONMENTAL DOUBLE-SIM GATE ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
