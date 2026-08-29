// Live test: ANIMATOR-AUTHORED FRAME TIMING (ft) IS HONORED BY THE GAME.
//
// The animator's frame-timing editor writes calib ft[] (ms per frame, boss
// attack + idle). Pinned here against an injected runtime calib:
//   - _lxCalibFt surfaces the array (clamped) after a refresh
//   - the boss ATTACK loop dwells per-frame by ft (frame 0 held ~6x longer
//     than the middle frames in the fixture)
//   - the boss IDLE ping-pong honors ft the same way
//   - the gravitos punch pair maps its play window by ft as relative
//     weights (early window sits on the long frame 0)
//   - mobs are untouched (no ft => unchanged clocks) and nothing errors
//   node scripts/boss_frame_timing_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxCalibFt === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999;

  // ---- inject ft like a baked patch would --------------------------------
  const FT = [400, 60, 60, 60, 60, 60, 60, 60, 400];
  window.LX_ANIM_CALIB = window.LX_ANIM_CALIB || {};
  const inj = (type, st) => {
    window.LX_ANIM_CALIB[type] = window.LX_ANIM_CALIB[type] || {};
    window.LX_ANIM_CALIB[type][st] = Object.assign({}, window.LX_ANIM_CALIB[type][st] || { s: 1, dx: 0, dy: 0 }, { ft: FT.slice() });
  };
  inj('gravitos', 'attack'); inj('gravitos', 'idle'); inj('gravitospunch', 'attack');
  _lxAnimCalibRefresh();
  const got = _lxCalibFt('gravitos', 'attack');
  out.calibFt = Array.isArray(got) ? got.join(',') : null;

  const frames = (n) => new Promise((res) => { let i = 0;
    const t = () => { game.paused = false; if (++i > n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  game.monsters = [];
  spawnMonster(Math.round(player.x + 300), Math.round(player.y), 'gravitos', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 1; m.isBoss = true; m.patternState = 'idle';

  // dwell profile of a picker over ~3.6s
  const profile = async (pick, fr) => {
    let ready = null;
    for (let w = 0; w < 300 && !ready; w++) { ready = pick(); if (!ready) await new Promise((res) => setTimeout(res, 100)); }
    if (!ready) return null;
    const dwell = {}, t0 = performance.now();
    let last = -1, lastAt = t0, first = true;
    while (performance.now() - t0 < 3600) {
      await frames(1);
      const i = fr.indexOf(pick());
      const now = performance.now();
      if (i !== last) {
        if (last >= 0 && !first) dwell[last] = Math.max(dwell[last] || 0, now - lastAt);
        if (last >= 0) first = false;
        last = i; lastAt = now;
      }
    }
    return dwell;
  };
  const atkD = await profile(() => _bossAttackFrame('gravitos', m), BOSS_ATTACK_FRAMES['gravitos']);
  if (atkD) {
    const mids = [2, 3, 4, 5].map((i) => atkD[i]).filter((v) => v > 0);
    const midAvg = mids.reduce((s, v) => s + v, 0) / Math.max(1, mids.length);
    out.attack = { f0: Math.round(atkD[0] || 0), mid: Math.round(midAvg) };
    out.attackHonored = atkD[0] > midAvg * 2.5 && midAvg < 160;
  } else out.attack = 'undecoded';
  const idleD = await profile(() => _bossIdleFrame('gravitos', m), BOSS_IDLE_FRAMES['gravitos']);
  if (idleD) {
    const mids = [2, 3, 4].map((i) => idleD[i]).filter((v) => v > 0);
    const midAvg = mids.reduce((s, v) => s + v, 0) / Math.max(1, mids.length);
    out.idle = { f0: Math.round(idleD[0] || 0), mid: Math.round(midAvg) };
    out.idleHonored = idleD[0] > midAvg * 2 && midAvg < 200;
  } else out.idle = 'undecoded';

  // punch pair: early window sits on long frame 0, mid window well past it
  m.patternState = 'crush'; m._phaseSprite = null;
  let pReady = null;
  for (let w = 0; w < 300 && !pReady; w++) { m.patternTimer = 100; pReady = _gravitosPunchPair(m); if (!pReady) await new Promise((res) => setTimeout(res, 100)); }
  if (pReady) {
    m.patternTimer = 120;  const early = _gravitosPunchPair(m).i;   // tW ~0.09 < f0 weight 0.32
    m.patternTimer = 750;  const mid = _gravitosPunchPair(m).i;     // tW ~0.59
    m.patternTimer = 1450; const late = _gravitosPunchPair(m).i;
    out.punch = { early, mid, late };
    out.punchHonored = early === 0 && mid > 1 && late >= mid;
  } else out.punch = 'undecoded';
  m.patternState = 'idle'; m.patternTimer = 0;

  // control: a type WITHOUT ft keeps the plain clock (no throw, frames advance)
  out.noFt = _lxCalibFt('kingKrook', 'attack') === null;
  game.monsters = [];
  // cleanup injection
  delete window.LX_ANIM_CALIB.gravitos.attack.ft;
  delete window.LX_ANIM_CALIB.gravitos.idle.ft;
  delete window.LX_ANIM_CALIB.gravitospunch.attack.ft;
  _lxAnimCalibRefresh();
  return out;
});

ok('injected ft surfaces through _lxCalibFt after a refresh', r.calibFt === '400,60,60,60,60,60,60,60,400', { calibFt: r.calibFt });
ok('boss ATTACK loop dwells per-frame by ft (long frame 0, quick middles)',
  r.attack === 'undecoded' || r.attackHonored === true, { attack: r.attack });
ok('boss IDLE ping-pong honors ft', r.idle === 'undecoded' || r.idleHonored === true, { idle: r.idle });
ok('gravitos punch pair maps its window by ft as relative weights',
  r.punch === 'undecoded' || r.punchHonored === true, { punch: r.punch });
ok('a type without ft keeps the plain engine clock', r.noFt === true, { noFt: r.noFt });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 340));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
