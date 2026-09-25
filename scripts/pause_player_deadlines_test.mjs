// Player deadlines on game.time hold while a solo game is paused.
// Per the 2026-09-26 bug hunt: game.time counts on while a solo game is paused (so the co-op clock never forks), and the
// pause shift in loop() carries each deadline that would otherwise be waited out behind a menu. 32 of the player's
// game.time deadlines were not in it - among them the Storm Pact (a paid 60 s buff) and the ultimate and skill windows
// (Rampage, Rift Surge, Quantum Echo, the fire / ice rings, Waltz, flow stacks, Second Wind): pausing mid-window ate it.
//   node scripts/pause_player_deadlines_test.mjs [page] [port]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require2 = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require2('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html', PORT = String(process.argv[3] || 9975);
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const b = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'load', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof game === 'object', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const FIELDS = ['_spawnBoostUntil', '_rampUntil', '_riftSurgeUntil', '_quantumEchoUntil', '_fireRingUntil', '_iceRingUntil',
  '_waltzUntil', '_flowStackExpiry', '_secondWindExpiry', '_secondWindCD', '_classSkillMulExpires', '_gbStackUntil',
  '_flameTrailUntil', '_levitateUntil', '_mirrorGate', '_heavyStunUntil'];
const r = await page.evaluate(async (FIELDS) => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  loadMap('forest', 300); game.paused = false;
  const steps = async (n) => { const t0 = game.time | 0; const g = performance.now(); while ((game.time | 0) - t0 < n && performance.now() - g < 20000) await new Promise((z) => setTimeout(z, 16)); return (game.time | 0) - t0; };
  await steps(10);
  const run = async (paused) => {
    for (const f of FIELDS) player[f] = (game.time | 0) + 600;
    game.paused = paused;
    const n = await steps(120);
    game.paused = false;
    const left = {}; for (const f of FIELDS) left[f] = Math.round(player[f] - (game.time | 0));
    for (const f of FIELDS) player[f] = 0;
    return { n, left };
  };
  const pausedRun = await run(true), liveRun = await run(false);
  // the boss attack cadences (v0.30.x): the same shift, on a live monster
  const MON = ['_barnPillarsAt', '_smithHammerAt', '_smithHeatAt', '_smithPillarsAt', '_smithTollAt', '_sovStepAt', '_vermSprayAt'];
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 300, player.y, 'slime'); if (m) { m.currentHp = m.maxHp = 9e9; }
  for (const f of MON) m[f] = (game.time | 0) + 600;
  game.paused = true; const mn = await steps(120); game.paused = false;
  const monLeft = {}; for (const f of MON) monLeft[f] = Math.round(m[f] - (game.time | 0));
  game.monsters.length = 0;
  return { pausedRun, liveRun, monLeft, mn, coop: (typeof _coopActive === 'function') && _coopActive() };
}, FIELDS);
await b.close(); srv.kill();
let pass = 0, fail = 0;
const ok = (c, n, d) => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++; };
ok(!r.coop && r.pausedRun.n >= 100, 'CONTROL: a solo game, and the clock really ran ' + r.pausedRun.n + ' steps behind the pause');
const drained = FIELDS.filter((f) => r.pausedRun.left[f] < 600 - 20);
ok(drained.length === 0, 'every player deadline holds while paused (600 steps set, 120 paused)', drained.map((f) => f + ':' + r.pausedRun.left[f]));
const held = FIELDS.filter((f) => r.liveRun.left[f] > 600 - 60);
ok(held.length === 0, 'CONTROL: unpaused, every one of them drains', held);
const monDrained = Object.keys(r.monLeft).filter((f) => r.monLeft[f] < 600 - 20);
ok(r.mn >= 100 && monDrained.length === 0, 'the boss attack cadences hold while paused too', monDrained.map((f) => f + ':' + r.monLeft[f]));
ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
