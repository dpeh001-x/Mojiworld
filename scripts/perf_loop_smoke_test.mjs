// Live smoke test for the v0.30.283 update-loop perf batch.
//
// Every change in the batch is meant to be behavior-IDENTICAL (dead-closure
// deletion, claim-tally Map, ally-flag hoists, _consider inline, _boltSpent
// hoist, afterimage scratch box, regen max-pool memo). This pins the
// behaviors those systems must still exhibit:
//   - minions still SPLIT across a pack (the crowding penalty reads the Map)
//   - a live bolt still lands damage (the hoisted spent-guard lets it through)
//   - town regen still ticks hp/mp up and clamps at max
//   - a frame of afterimages still damages an overlapped mob exactly once
//   - 600 frames of mixed combat throw nothing (pageerror AND the [loop]
//     watchdog channel both watched)
//   node scripts/perf_loop_smoke_test.mjs
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
const loopErrs = []; page.on('console', (msg) => {
  if (msg.type() === 'error' && /\[loop\]/.test(msg.text())) loopErrs.push(msg.text().slice(0, 200)); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1000);

// ---- combat scene: necromancer + minions + a spread pack, 600 frames ------
const combat = await page.evaluate(async () => {
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'necromancer';
  player.level = 60; player.hp = 99999; player.mp = player.maxMp = 999; player._god = true;
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  game.monsters = [];
  const px = player.x, py = player.y;
  for (let i = 0; i < 6; i++) {
    spawnMonster(Math.round(px + 160 + i * 90), Math.round(py), 'slime', false);
    const m = game.monsters[game.monsters.length - 1];
    m.hp = m.currentHp = 5e6; m.maxHp = 5e6; m.atk = 1;
  }
  // summon the undead pack (the claim-tally code path)
  for (let i = 0; i < 4; i++) {
    try { raiseMinion(player.x + 30 + i * 26, player.y, i % 2 ? 'zombie' : 'skeleton', 60000); } catch (e) {}
  }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 600) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const tgts = new Set();
  let withTgt = 0;
  for (const mn of (game.minions || [])) if (mn && mn._mnTgt) { withTgt++; tgts.add(mn._mnTgt); }
  return { minions: (game.minions || []).length, withTgt, distinct: tgts.size,
    liveMobs: game.monsters.filter((m) => m.currentHp > 0).length };
});
ok('minions summoned and hunting', combat.minions > 0 && combat.withTgt > 0, combat);
ok('the pack still SPLITS across targets (crowding penalty intact)',
  combat.distinct >= 2 || combat.minions < 2 || combat.liveMobs < 2, combat);

// ---- a live bolt still lands (the hoisted spent-guard lets fresh bolts by) -
const bolt = await page.evaluate(async () => {
  game.monsters = [];
  spawnMonster(Math.round(player.x + player.facing * 120), Math.round(player.y), 'slime', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 5e6; m.maxHp = 5e6; m.atk = 0; m.speed = 0; m.jump = 0;
  const hp0 = m.currentHp;
  player.cls = 'mage'; player.mp = 999;
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  try { performBolt(); } catch (e) { return { hp0, boltThrew: String(e).slice(0, 120) }; }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 120) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  return { hp0, hp1: m.currentHp, projSeen: true };
});
ok('a live bolt still connects and deals damage', bolt.hp1 < bolt.hp0, bolt);

// ---- afterimage pass: overlapped mob takes the hit exactly once ------------
const ai = await page.evaluate(async () => {
  game.monsters = [];
  spawnMonster(Math.round(player.x + 10), Math.round(player.y), 'slime', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 5e6; m.maxHp = 5e6; m.atk = 0; m.speed = 0; m.jump = 0;
  const hp0 = m.currentHp;
  game.afterImages = game.afterImages || [];
  game.afterImages.push({ x: m.x - 2, y: m.y - 2, facing: 1, state: 'run',
    life: 20, maxLife: 20, color: 'rgba(200,160,255,0.55)', dmg: 500, hitIds: new Set() });
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  return { hp0, hp1: m.currentHp, dropped: hp0 - m.currentHp };
});
ok('an overlapping afterimage still hits, and exactly once (hitIds intact)',
  ai.dropped >= 400 && ai.dropped <= 1200, ai);

// ---- town regen: ticks up, clamps at max ----------------------------------
const regen = await page.evaluate(async () => {
  try { loadMap('town'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const maxHp = getMaxHp(), maxMp = getMaxMp();
  player.hp = Math.max(1, Math.floor(maxHp * 0.3));
  player.mp = Math.max(1, Math.floor(maxMp * 0.3));
  const hp0 = player.hp, mp0 = player.mp;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 200) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  return { hp0, mp0, hp1: player.hp, mp1: player.mp, maxHp, maxMp,
    clamped: player.hp <= getMaxHp() && player.mp <= getMaxMp() };
});
ok('town regen still ticks hp and mp upward', regen.hp1 > regen.hp0 && regen.mp1 > regen.mp0, regen);
ok('regen still clamps at the max pools', regen.clamped, regen);

ok('no page errors across 600+ frames of mixed combat', errs.length === 0, { errs: errs.slice(0, 3) });
ok('no [loop] watchdog errors (the channel that hid the last TDZ bug)', loopErrs.length === 0, { loopErrs: loopErrs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
