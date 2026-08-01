// Co-op sync fidelity test (v0.29.368). Records a REAL host fight (Taurus +
// slimes, ~20 s) through a fake ws, replays the frames into guest mode at the
// shipped 50 ms cadence, and MEASURES the sync rather than assuming it:
//   - mirror position error vs interpolated host truth (mean/p95/max px)
//   - state agreement at every frame: patternState / hp / rolled atk /
//     attack window / phase sprite
//   - mirror lifecycle: count matches every frame, all drop on empty frame
//   - zero NaN in mirrors or mirrored projectiles
// Shipped baseline to beat: mean ~1 px, p95 ~4 px, max ~16 px.
// The tick throttle is wall-clock; the sim runs faster than real time, so the
// harness forces the throttle open every 3rd game-tick (= the 50 ms cadence)
// and asserts the shipped constants directly.
//   node scripts/coop_sync_fidelity_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8922)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8922;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const r = {};
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  const MAP = game.currentMap;
  const TICKS = 1200;                                   // ~20 s at 60 fps

  // ================= HOST PHASE: record =================
  const frames = [];                                    // { tick, msg }
  let tickNow = 0;
  net.isHost = true; net.myId = 1; net.hostId = 1; net.connected = true;
  net.ws = { readyState: 1, send: (s) => { try { const m = JSON.parse(s);
    if (m.t === 'mon' || m.t === 'proj') frames.push({ tick: tickNow, msg: m }); } catch (e) {} } };
  game.monsters.length = 0;
  for (const k of ['projectiles', 'particles', 'hazards', 'minions']) if (game[k]) game[k].length = 0;
  game.keys = {};
  player.level = 200; player.maxHp = 999999; player.hp = 999999;
  player.x = ww * 0.5; player.y = gy - 80; player.vx = 0; player.vy = 0;
  player.invulnerable = 0; player._god = false;
  const boss = spawnMonster(ww * 0.5 + 300, gy - 200, 'zodiac_taurus', true);
  for (let i = 0; i < 4; i++) spawnMonster(ww * 0.4 + i * 60, gy - 60, 'slime', false);
  for (tickNow = 0; tickNow < TICKS; tickNow++) {
    boss.currentHp = Math.max(1, Math.floor(boss.maxHp * (1 - tickNow / TICKS * 0.9)));
    if (boss.hp != null) boss.hp = boss.currentHp;
    player.hp = player.maxHp;
    game.time = (game.time | 0) + 1;
    if (typeof updatePlayer === 'function') updatePlayer(16.667);
    updateMonsters(16.667); updateProjectiles(16.667);
    // The tick throttle is wall-clock; this sim runs faster than real time, so
    // force it open every 3rd game-tick — exactly the shipped 50 ms cadence.
    if (tickNow % 3 === 0) { net._coopMonAt = 0; net._coopProjAt = 0; }
    _coopTickMonsters(); _coopTickProjectiles();
  }
  r.framesRecorded = frames.length;
  r.tickMs = (typeof COOP_MON_TICK_MS !== 'undefined') ? COOP_MON_TICK_MS : -1;
  r.projTickMs = (typeof COOP_PROJ_TICK_MS !== 'undefined') ? COOP_PROJ_TICK_MS : -1;
  r.monFrames = frames.filter(f => f.msg.t === 'mon').length;

  // ================= GUEST PHASE: replay + measure =================
  game.monsters.length = 0;
  for (const k of ['projectiles', 'particles', 'hazards', 'minions']) if (game[k]) game[k].length = 0;
  net.isHost = false; net.hostId = 7; net.myId = 2;
  net.peers = { 7: { id: 7, name: 'H', map: MAP, x: 0, y: 0, _last: performance.now() } };
  player._god = true;                                    // block the contact tick; motion unaffected
  player.x = ww * 0.2; player.y = gy - 80;

  const monFrames = frames.filter(f => f.msg.t === 'mon');
  // Host truth per uid: [{tick, x, y}] from the frames themselves.
  const truth = {};
  for (const f of monFrames) for (const e of f.msg.list)
    (truth[e.u] = truth[e.u] || []).push({ tick: f.tick, x: e.x, y: e.y });

  const errsPx = []; let nan = 0, stateMismatch = 0, stateChecks = 0;
  let countMismatch = 0, projNaN = 0, maxProjMirrors = 0;
  let fi = 0;
  for (let t = 0; t <= TICKS; t++) {
    while (fi < frames.length && frames[fi].tick <= t) {
      const f = frames[fi];
      _mpHandle(Object.assign({ id: 7 }, f.msg));
      if (f.msg.t === 'mon') {
        // lifecycle: mirrors must match the frame's list exactly
        const mir = game.monsters.filter(m => m._coopMirror);
        if (mir.length !== f.msg.list.length) countMismatch++;
        // state agreement vs this frame
        for (const e of f.msg.list) {
          const m = mir.find(x => x.uid === e.u); if (!m) { countMismatch++; continue; }
          stateChecks++;
          const okPs = (e.ps || 'idle') === (m.patternState || 'idle');
          const okHp = Math.abs(m.currentHp - e.h) < 1;
          const okAtk = e.a == null || m.atk === +e.a;
          const okAa = !e.aa || (m.atkAnimUntil && m.atkAnimUntil > performance.now());
          const okSp = !e.sp || m._phaseSprite === e.sp;
          if (!(okPs && okHp && okAtk && okAa && okSp)) stateMismatch++;
        }
      }
      fi++;
    }
    game.time = (game.time | 0) + 1;
    updateMonsters(16.667); updateProjectiles(16.667);
    // positional error vs interpolated host truth
    for (const m of game.monsters) {
      if (!m._coopMirror) continue;
      if (![m.x, m.y].every(Number.isFinite)) { nan++; continue; }
      const tr = truth[m.uid]; if (!tr || tr.length < 2) continue;
      let k = 0; while (k < tr.length - 2 && tr[k + 1].tick <= t) k++;
      const a = tr[k], b = tr[k + 1];
      if (t < a.tick || t > b.tick) continue;
      const f2 = (t - a.tick) / Math.max(1, b.tick - a.tick);
      const ix = a.x + (b.x - a.x) * f2, iy = a.y + (b.y - a.y) * f2;
      errsPx.push(Math.hypot(m.x - ix, m.y - iy));
    }
    for (const p of (game.projectiles || [])) {
      if (p._coopMirror && (!Number.isFinite(p.x) || !Number.isFinite(p.vx))) projNaN++;
    }
    maxProjMirrors = Math.max(maxProjMirrors, (game.projectiles || []).filter(p => p._coopMirror).length);
  }
  // final frame: host stopped reporting -> mirrors must all drop
  _mpHandle({ t: 'mon', id: 7, map: MAP, list: [] });
  r.mirrorsAfterEmpty = game.monsters.filter(m => m._coopMirror).length;

  errsPx.sort((x, y) => x - y);
  const q = (p) => errsPx.length ? +errsPx[Math.min(errsPx.length - 1, Math.floor(errsPx.length * p))].toFixed(1) : -1;
  r.samples = errsPx.length;
  r.meanErr = errsPx.length ? +(errsPx.reduce((s, v) => s + v, 0) / errsPx.length).toFixed(1) : -1;
  r.p95Err = q(0.95); r.maxErr = errsPx.length ? +errsPx[errsPx.length - 1].toFixed(1) : -1;
  r.nan = nan; r.projNaN = projNaN; r.maxProjMirrors = maxProjMirrors;
  r.stateChecks = stateChecks; r.stateMismatch = stateMismatch; r.countMismatch = countMismatch;

  net.connected = false; net.ws = null; net.hostId = null; net.peers = {}; net.myId = null; net.isHost = false;
  player._god = false; game.monsters.length = 0;
  if (game.projectiles) game.projectiles.length = 0;
  return r;
});

console.log(`recorded ${o.framesRecorded} frames (${o.monFrames} mon) over ~20s of a real Taurus fight`);
console.log(`replayed into a guest: ${o.samples} position samples, ${o.stateChecks} state checks, up to ${o.maxProjMirrors} mirrored projectiles\n`);
const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('shipped cadence constants are 50ms', o.tickMs === 50 && o.projTickMs === 50, `mon ${o.tickMs}ms proj ${o.projTickMs}ms`);
ok('host emits one frame per 50ms window', o.monFrames > 350 && o.monFrames < 460, `${o.monFrames} mon frames / 20s`);
ok('mirror mean error is tight', o.meanErr >= 0 && o.meanErr < 12, `${o.meanErr}px`);
ok('mirror p95 error is tight', o.p95Err >= 0 && o.p95Err < 40, `${o.p95Err}px`);
ok('no runaway divergence', o.maxErr >= 0 && o.maxErr < 250, `max ${o.maxErr}px`);
ok('zero NaN mirrors', o.nan === 0, `${o.nan}`);
ok('zero NaN mirrored projectiles', o.projNaN === 0, `${o.projNaN}`);
ok('mirror count matches every frame', o.countMismatch === 0, `${o.countMismatch} mismatches`);
ok('state agrees at every frame (ps/hp/atk/aa/sp)', o.stateMismatch === 0, `${o.stateMismatch}/${o.stateChecks}`);
ok('mirrors drop when the host reports none', o.mirrorsAfterEmpty === 0, `${o.mirrorsAfterEmpty} left`);
for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
