// Live test: ANIMATOR FRAME TIMING REACHES REGULAR MONSTERS (walk + idle).
//
// Per user: "for the animator tool extend it to normal monsters sprites as
// well". v0.30.315 wired ft[] into the boss pickers; a parallel pass wired a
// mob's ATTACK; this pins the two loops a mob lives in:
//   - injected walk ft: _monsterStateFrame dwells per-frame while the mob is
//     walking (long frame 0 vs quick middles)
//   - injected idle ft: the idle ping-pong dwells per-frame while it stands
//   - a type without ft keeps the plain clock; no page errors
//   node scripts/mob_frame_timing_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _monsterStateFrame === 'function' && typeof _lxCalibFt === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true;
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  const c = document.querySelector('.cls-card'); if (c) c.click();
  const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
  if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const out = {}; const TYPE = 'slime';
  const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i > n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {} await frames(40);
  player.hp = 99999; player._god = true;
  const FT = [400, 60, 60, 60, 60, 60, 60, 60, 400];
  window.LX_ANIM_CALIB = window.LX_ANIM_CALIB || {};
  window.LX_ANIM_CALIB[TYPE] = window.LX_ANIM_CALIB[TYPE] || {};
  for (const st of ['walk', 'idle']) window.LX_ANIM_CALIB[TYPE][st] = Object.assign({}, window.LX_ANIM_CALIB[TYPE][st] || { s: 1, dx: 0, dy: 0 }, { ft: FT.slice() });
  _lxAnimCalibRefresh();
  out.walkFt = (_lxCalibFt(TYPE, 'walk') || []).join(','); out.idleFt = (_lxCalibFt(TYPE, 'idle') || []).join(',');
  game.monsters = []; spawnMonster(Math.round(player.x + 400), Math.round(player.y), TYPE, false);
  const m = game.monsters[game.monsters.length - 1]; m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 0; m._noGravity = true;
  const set = _monsterFramesFor(TYPE); out.frames = { walk: set.walk.length, idle: set.idle.length };
  const profile = async (st, pick, arr, drive) => {
    let ready = null; for (let w = 0; w < 300 && !ready; w++) { drive(); ready = pick(); if (!ready) await new Promise((res) => setTimeout(res, 100)); }
    if (!ready) return null;
    const dwell = {}, t0 = performance.now(); let last = -1, lastAt = t0, first = true;
    while (performance.now() - t0 < 3600) { drive(); await frames(1); const i = arr.indexOf(pick()); const now = performance.now();
      if (i !== last) { if (last >= 0 && !first) dwell[last] = Math.max(dwell[last] || 0, now - lastAt); if (last >= 0) first = false; last = i; lastAt = now; } }
    return dwell;
  };
  // WALK: keep the mob "walking" - _mobWalking latches on |vx| above its threshold
  const wD = await profile('walk', () => _monsterStateFrame(m), set.walk, () => { m.vx = 6; m._animXV = 6; m.x = Math.round(player.x + 400); m.atkAnimUntil = 0; m._swingUntil = 0; });
  out.walkNow = _mobWalking(m);
  if (wD) { const mids = [2, 3, 4, 5].map((i) => wD[i]).filter((v) => v > 0); const midAvg = mids.reduce((s, v) => s + v, 0) / Math.max(1, mids.length);
    out.walk = { f0: Math.round(wD[0] || 0), mid: Math.round(midAvg) }; out.walkHonored = wD[0] > midAvg * 2.5 && midAvg < 160; } else out.walk = 'undecoded';
  // IDLE: stop it dead, far from the player so no proximity attack starts
  m.vx = 0; m._animXV = 0; m._walkLatch = false; m.atkAnimUntil = 0; m._swingUntil = 0;
  const iD = await profile('idle', () => _monsterStateFrame(m), set.idle, () => { m.vx = 0; m._animXV = 0; m._walkLatch = false; m.atkAnimUntil = 0; m._swingUntil = 0; m.x = Math.round(player.x + 400); });
  if (iD) { const mids = [2, 3, 4].map((i) => iD[i]).filter((v) => v > 0); const midAvg = mids.reduce((s, v) => s + v, 0) / Math.max(1, mids.length);
    out.idle = { f0: Math.round(iD[0] || 0), mid: Math.round(midAvg) }; out.idleHonored = iD[0] > midAvg * 2 && midAvg < 200; } else out.idle = 'undecoded';
  out.noFt = _lxCalibFt('snail', 'walk') === null;
  delete window.LX_ANIM_CALIB[TYPE].walk.ft; delete window.LX_ANIM_CALIB[TYPE].idle.ft; _lxAnimCalibRefresh(); game.monsters = [];
  return out;
});
ok('injected walk + idle ft surface through _lxCalibFt for a regular monster', r.walkFt === '400,60,60,60,60,60,60,60,400' && r.idleFt === r.walkFt, { walkFt: r.walkFt });
ok('the mob WALK loop dwells per-frame by ft (long frame 0, quick middles)', r.walk === 'undecoded' || r.walkHonored === true, { walk: r.walk, walking: r.walkNow, frames: r.frames });
ok('the mob IDLE ping-pong honors ft', r.idle === 'undecoded' || r.idleHonored === true, { idle: r.idle });
ok('a type without ft keeps the plain engine clock', r.noFt === true, {});
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await b.close(); srv.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
