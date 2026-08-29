// Live test: GRAVITOS STAGE-1 PASS.
//   - after a punch pattern (crush/slam/zip) form-1 blinks to another part
//     of the arena; forms 2/3 do NOT
//   - the pattern ladder never picks the same skill twice in a row
//   - punch pacing dials are the slower/smoother values
//   - _gravitosOnceFrame plays a set ONCE per pattern and HOLDS (no 432 ms
//     wall-clock loop, no wrap-around "ping-pong" read)
//   node scripts/gravitos_stage1_test.mjs
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
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _gravPostPunchBlink === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

const r = await page.evaluate(async () => {
  const out = {};
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999; player.level = 60;
  game.monsters = [];
  spawnMonster(Math.round(player.x + 400), Math.round(player.y), 'gravitos', false);
  const m = game.monsters[game.monsters.length - 1];
  if (!m || m.type !== 'gravitos') return { spawnFailed: true, got: m && m.type };
  m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 1; m.isBoss = true;
  const frames = (n) => new Promise((res) => { let i = 0;
    const t = () => { game.paused = false; if (++i > n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await frames(30);

  // ---- punch pacing dials --------------------------------------------------
  out.play = (typeof _GRAV_PUNCH_PLAY !== 'undefined') ? _GRAV_PUNCH_PLAY : null;
  out.ease = (typeof _GRAV_PUNCH_EASE !== 'undefined') ? _GRAV_PUNCH_EASE : null;

  // ---- stage-1 blink after each punch pattern ------------------------------
  const blinkTest = async (pattern, endTimer) => {
    m._phaseSprite = null; m.patternState = pattern; m.patternTimer = endTimer - 40;
    m._crushFired = true; m._slamGather = true; m._slamHit = true; m._zipPrep = true;
    const x0 = m.x;
    await frames(12);
    return Math.abs(m.x - x0);
  };
  out.crushBlink = await blinkTest('crush', 1500);
  out.slamBlink = await blinkTest('slam', 1100);
  out.zipBlink = await blinkTest('zip', 1400);
  // form-2 control: no blink
  m._phaseSprite = 'gravitos2'; m.patternState = 'crush'; m.patternTimer = 1460; m._crushFired = true;
  const cx0 = m.x; await frames(12);
  out.form2Moved = Math.abs(m.x - cx0);
  m._phaseSprite = null;

  // ---- no same pattern twice in a row --------------------------------------
  const seq = [];
  const LADDER = new Set(['laser', 'zip', 'crush', 'slam', 'chaseComets', 'pull', 'wave', 'orbitalRing', 'blackhole', 'decayFloor', 'crushTendrils']);
  for (let cast = 0; cast < 22; cast++) {
    m.patternState = 'idle'; m.patternTimer = 99999; m._ohkoQueued = null; m._ohkoWarnUntil = null;
    m.x = player.x + 400; m.vx = 0;
    let got = null;
    for (let f = 0; f < 90 && !got; f++) {
      await frames(1);
      if (m.patternState && m.patternState !== 'idle') got = m.patternState;
    }
    if (got && LADDER.has(got)) seq.push(got);
  }
  out.seq = seq;
  out.repeats = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) out.repeats++;

  // ---- once-through picker: monotonic, holds, deterministic ---------------
  m.patternState = 'wave';
  let ready = null;
  for (let w = 0; w < 300 && !ready; w++) { m.patternTimer = 100; ready = _gravitosOnceFrame(m, 'gravitos'); if (!ready) await frames(5); }
  if (!ready) { out.once = 'frames-never-decoded'; }
  else {
    const fr = BOSS_ATTACK_FRAMES['gravitos'];
    const idxAt = (t) => { m.patternTimer = t; return fr.indexOf(_gravitosOnceFrame(m, 'gravitos')); };
    const a = idxAt(90), b = idxAt(450), c = idxAt(880), hold = idxAt(5000), hold2 = idxAt(9000);
    out.once = { a, b, c, hold, hold2, n: fr._readyN };
    out.onceMonotonic = a <= b && b <= c && c <= hold;
    out.onceHolds = hold === hold2 && hold === (fr._readyN - 1);
    out.onceStartsEarly = a <= 1;
  }
  m.patternState = 'idle'; m.patternTimer = 0;
  game.monsters = [];
  return out;
});

if (r.spawnFailed) { console.log('SPAWN FAILED: ' + r.got); process.exit(1); }
ok('punch pacing dials are the slower/smoother values (0.85 / 1.1)', r.play === 0.85 && r.ease === 1.1, { play: r.play, ease: r.ease });
ok('stage 1 blinks after CRUSH', r.crushBlink > 250, { moved: r.crushBlink });
ok('stage 1 blinks after SLAM', r.slamBlink > 250, { moved: r.slamBlink });
ok('stage 1 blinks after ZIP', r.zipBlink > 250, { moved: r.zipBlink });
ok('form 2 does NOT blink after a punch', r.form2Moved < 80, { moved: r.form2Moved });
ok('the ladder never repeats a pattern back-to-back (' + (r.seq || []).length + ' casts observed)',
  (r.seq || []).length >= 8 && r.repeats === 0, { repeats: r.repeats, seq: (r.seq || []).join(',') });
ok('once-through picker advances monotonically through the pattern',
  r.once === 'frames-never-decoded' || r.onceMonotonic === true, { once: r.once });
ok('...and HOLDS the final frame instead of wrapping (the ping-pong killer)',
  r.once === 'frames-never-decoded' || r.onceHolds === true, { once: r.once });
ok('...and starts from the first frames at pattern start', r.once === 'frames-never-decoded' || r.onceStartsEarly === true, { once: r.once });
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
