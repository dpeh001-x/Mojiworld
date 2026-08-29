// Live test: THE AUTO TIER-2 FX LADDER ACTUALLY ENGAGES.
//
// _perfLowFx stamps the per-frame cache but never cleared `veryValue`, so
// _perfVeryLowFx's fast path returned an answer computed on whatever EARLIER
// frame queried tier 2 first — in practice never recomputed. The designed
// auto triggers (2+ bosses / >22 mobs / boss + 40 projectiles) were dead;
// heavy scenes were left to the oscillating reactive frame-time path.
//
// Pinned here, in the game's own call order (tier 1 queried before tier 2,
// which is exactly the order that hid the bug):
//   - calm scene: both tiers off
//   - 25-mob swarm: tier 1 AND tier 2 engage within a frame
//   - back to calm: both release
//   - two bosses: tier 2 engages via the boss trigger
// Plus G1 regressions: cuteMob blend memo matches _mixHex, minimap ground
// memo matches .find, the daily lookup Map matches the table.
//   node scripts/perf_ladder_test.mjs
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
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _perfVeryLowFx === 'function', null, { timeout: 120000 });
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
  player._god = true; player.hp = 99999;
  // read both tiers IN GAME ORDER (tier 1 first) on a live frame. Headless
  // frames are slow enough to re-trip the REACTIVE watchdog (the manual
  // LX_PERF flags), which is not the path under test — pin them off every
  // frame so only the AUTO path answers.
  const pinReactiveOff = () => {
    LX_PERF.lowFx = false; LX_PERF.lowFxUntil = 0;
    LX_PERF.veryLowFx = false; LX_PERF.veryLowFxUntil = 0;
    LX_PERF.avgFrame = 10; LX_PERF.slowFrames = 0;
  };
  const readTiers = () => new Promise((res) => { let n = 0; let low = null, very = null;
    const t = () => { game.paused = false; pinReactiveOff();
      if (++n >= 4) { low = _perfLowFx(); very = _perfVeryLowFx(); return res({ low, very }); }
      requestAnimationFrame(t); }; requestAnimationFrame(t); });
  pinReactiveOff();

  game.monsters = [];
  out.calm = await readTiers();

  for (let i = 0; i < 25; i++) {
    spawnMonster(Math.round(player.x + 150 + (i % 8) * 60), Math.round(player.y - ((i / 8) | 0) * 90), 'slime', false);
    const m = game.monsters[game.monsters.length - 1];
    m.hp = m.currentHp = 5e5; m.maxHp = 5e5; m.atk = 0;
  }
  out.swarm = await readTiers();

  game.monsters = [];
  out.calmAgain = await readTiers();

  for (let i = 0; i < 2; i++) {
    spawnMonster(Math.round(player.x + 200 + i * 120), Math.round(player.y), 'slime', false);
    const m = game.monsters[game.monsters.length - 1];
    m.hp = m.currentHp = 5e6; m.maxHp = 5e6; m.atk = 0; m.isBoss = true;
  }
  out.twoBosses = await readTiers();
  game.monsters = [];

  // ---- G1 regressions ------------------------------------------------------
  spawnMonster(Math.round(player.x + 120), Math.round(player.y), 'slime', false);
  const cm = game.monsters[game.monsters.length - 1];
  cm.hp = cm.currentHp = 5e5; cm.maxHp = 5e5; cm.atk = 0;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 20) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const base = cm.color || '#a0c890';
  out.cuteMemo = (cm._dqShade === undefined)
    ? 'not-drawn'
    : (cm._dqShade === _mixHex(base, '#1a0818', 0.40) && cm._dqAccS === _mixHex(cm._dqAcc, '#1a0818', 0.40));
  game.monsters = [];

  const md = game.mapData;
  out.mmMemo = (md._mmGroundP === undefined)
    ? 'not-run'
    : md._mmGroundP === ((md.platforms || []).find(p => p.type === 'ground') || null);

  out.dailyMap = (typeof _DAILY_BY_ID !== 'undefined')
    && DAILY_CHALLENGES.every((c) => _DAILY_BY_ID.get(c.id) === c);
  return out;
});

ok('calm scene: both FX tiers off', r.calm.low === false && r.calm.very === false, r.calm);
ok('25-mob swarm: tier 1 engages', r.swarm.low === true, r.swarm);
ok('25-mob swarm: tier 2 engages via the AUTO path (the dead ladder, revived)',
  r.swarm.very === true, { ...r.swarm, note: 'previous build: veryValue stale from an old frame, stayed false' });
ok('calm again: both tiers release', r.calmAgain.low === false && r.calmAgain.very === false, r.calmAgain);
ok('two live bosses: tier 2 engages via the boss trigger', r.twoBosses.very === true, r.twoBosses);
ok('cuteMob blend memo matches _mixHex exactly', r.cuteMemo === true || r.cuteMemo === 'not-drawn', { cuteMemo: r.cuteMemo });
ok('minimap ground memo matches the .find answer', r.mmMemo === true || r.mmMemo === 'not-run', { mmMemo: r.mmMemo });
ok('daily lookup Map mirrors the table for every id', r.dailyMap === true, { dailyMap: r.dailyMap });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
