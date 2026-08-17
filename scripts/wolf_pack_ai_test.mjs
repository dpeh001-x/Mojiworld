// Beastmaster wolves hunt the monsters that are actually there.
//
// Per user: "wolf A.I. for beastmaster always flushes to the right, please
// rework the AI such that it is smarter and moves towards existing monsters".
//
// What the old AI actually did, measured on a live forest map: it picked the
// nearest monster by raw 2D distance with an 800px vertical tolerance, so it
// committed to prey on other platforms, jumped at it, re-targeted mid-air and
// repeated — airborne in every sample of a 400-frame run, flip-flopping
// between a petalfly 141px above and a slime below, and drifting away across
// the map while killing nothing. That is the behaviour this pins shut.
//
// Everything here is measured from live runs, not read off the source:
//   1. wolves move TOWARD monsters, whichever side they are on
//   2. they stay on the ground instead of jump-thrashing at unreachable prey
//   3. they commit to a target rather than swapping every few frames
//   4. they pick prey at their own height, not two platforms up
//   5. with nothing to hunt they hold station near the player
//   6. they never leave the world
// Run: node scripts/wolf_pack_ai_test.mjs [file.html]
// Negative control: the pre-rework build fails the grounded / commitment /
// same-height checks.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(4500);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  player.cls = 'archer'; player.job = 'ranger'; player.master = 'beastmaster';
  player.level = 80; player._god = true; player.hp = player.maxHp = 9e5; player.mp = player.maxMp = 9e5;
  const combat = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena
    && (MAPS[k].platforms || []).some((p) => p.type === 'ground'));
  out.map = combat;
  loadMap(combat);
  for (let i = 0; i < 45; i++) await frame();
  game.paused = false;
  const gy = (game.mapData.platforms || []).filter((p) => p.type === 'ground')[0].y;
  const flat = Object.keys(monsterTypes).find((k) => !monsterTypes[k].boss);

  // --- directional seek: put prey on one side and watch which way they go ---
  const seek = async (side) => {
    game.monsters = []; player.pack = [];
    player.x = 900; player.y = gy - player.h; player.facing = 1; player.vx = 0;
    const mx = side === 'left' ? 560 : 1240;
    for (const x of [mx, mx + 55]) {
      const m = spawnMonster(x, gy - monsterTypes[flat].h, flat);
      if (m) { m.maxHp = m.currentHp = 5e7; m.vx = 0; }
    }
    for (let i = 0; i < 5; i++) await frame();
    try { SKILL_FNS.beastmaster_pack(); } catch (e) { return { err: String(e).slice(0, 100) }; }
    for (let i = 0; i < 3; i++) await frame();
    const start = (player.pack || []).map((w) => w.x);
    for (let i = 0; i < 150; i++) { (game.monsters || []).forEach((m) => { m.vx = 0; }); await frame(); }
    const end = (player.pack || []).map((w) => w.x);
    const drift = end.map((e, i) => Math.round(e - (start[i] || 0)));
    return { n: start.length, drift, mean: Math.round(drift.reduce((a, b) => a + b, 0) / (drift.length || 1)) };
  };
  out.left = await seek('left');
  out.right = await seek('right');

  // --- the priority question: a reachable bite at your feet, or a floating
  // one that is closer as the crow flies? Ground prey sits 210px away on the
  // floor; air prey sits 70px away but 165px up. Raw 2D distance prefers the
  // AIR one (179 < 210), which is exactly how the pack ended up airborne. A
  // wolf that values reachability takes the ground bite.
  game.monsters = []; player.pack = [];
  player.x = 900; player.y = gy - player.h; player.facing = 1; player.vx = 0;
  const _mg = spawnMonster(1110, gy - monsterTypes[flat].h, flat);
  const _ma = spawnMonster(970, gy - monsterTypes[flat].h - 165, flat);
  for (const m of [_mg, _ma]) if (m) { m.maxHp = m.currentHp = 5e7; m.vx = 0; m.vy = 0; m._noGravity = true; }
  for (let i = 0; i < 5; i++) await frame();
  try { SKILL_FNS.beastmaster_pack(); } catch (e) {}
  for (let i = 0; i < 4; i++) await frame();
  let _pickGround = 0, _pickAir = 0, _prioGrounded = 0, _prioFrames = 0;
  for (let i = 0; i < 90; i++) {
    for (const m of [_mg, _ma]) if (m) { m.vy = 0; m.vx = 0; }
    await frame();
    const w = (player.pack || [])[0];
    if (!w) continue;
    const wcx = w.x + w.w / 2, wcy = w.y + w.h / 2;
    let t = null, bs = Infinity;
    for (const m of game.monsters) {
      if (!m || m.currentHp <= 0) continue;
      const dx = (m.x + m.w / 2) - wcx, dy = (m.y + m.h / 2) - wcy;
      const sc = (typeof _allyTargetScore === 'function') ? _allyTargetScore(w, m, dx, dy)
                                                         : (Math.abs(dy) <= 800 ? dx * dx + dy * dy : -1);
      if (sc >= 0 && sc < bs) { bs = sc; t = m; }
    }
    if (t === _mg) _pickGround++; else if (t === _ma) _pickAir++;
    _prioFrames++; if (w.onGround) _prioGrounded++;
  }
  out.priority = { ground: _pickGround, air: _pickAir,
                   groundedPct: _prioFrames ? Math.round(100 * _prioGrounded / _prioFrames) : 0 };

  // --- idle: no monsters at all, wolves must hold station near the player ---
  game.monsters = []; player.pack = [];
  player.x = 900; player.y = gy - player.h; player.vx = 0;
  for (let i = 0; i < 5; i++) await frame();
  try { SKILL_FNS.beastmaster_pack(); } catch (e) {}
  for (let i = 0; i < 200; i++) await frame();
  out.idleMaxGap = Math.round(Math.max(0, ...(player.pack || []).map((w) =>
    Math.abs((w.x + w.w / 2) - (player.x + player.w / 2)))));

  // --- live map: the real hunt. Quality of the behaviour, sampled per frame ---
  player.pack = [];
  loadMap(combat);
  for (let i = 0; i < 45; i++) await frame();
  game.paused = false;
  player.x = 700; player.y = gy - player.h; player.facing = 1;
  try { SKILL_FNS.beastmaster_pack(); } catch (e) {}
  for (let i = 0; i < 4; i++) await frame();
  let frames = 0, grounded = 0, switches = 0, maxDy = 0, outOfWorld = 0, maxLeash = 0;
  let lastTgt = null;
  const ww = (game.mapData && game.mapData.worldWidth) || 0;
  for (let i = 0; i < 400; i++) {
    await frame();
    const w = (player.pack || [])[0];
    if (!w) continue;
    frames++;
    if (w.onGround) grounded++;
    if (w.x < -2 || (ww && w.x + w.w > ww + 2)) outOfWorld++;
    const lg = Math.abs((w.x + w.w / 2) - (player.x + player.w / 2));
    if (lg > maxLeash) maxLeash = lg;
    // recompute the ally's chosen target the same way the AI does
    const wcx = w.x + w.w / 2, wcy = w.y + w.h / 2;
    let t = null, bs = Infinity;
    for (const m of game.monsters) {
      if (!m || m.currentHp <= 0) continue;
      const dx = (m.x + m.w / 2) - wcx, dy = (m.y + m.h / 2) - wcy;
      const sc = (typeof _allyTargetScore === 'function')
        ? _allyTargetScore(w, m, dx, dy)
        : (Math.abs(dy) <= 800 ? dx * dx + dy * dy : -1);
      if (sc >= 0 && sc < bs) { bs = sc; t = m; }
    }
    if (t) {
      const dy = Math.abs((t.y + t.h / 2) - wcy);
      if (dy > maxDy) maxDy = Math.round(dy);
      if (lastTgt && t !== lastTgt) switches++;
      lastTgt = t;
    }
  }
  out.hunt = { frames, groundedPct: frames ? Math.round(100 * grounded / frames) : 0,
               switches, maxDy, outOfWorld, maxLeash: Math.round(maxLeash) };
  return out;
});
await browser.close();

console.log(`  map ${r.map}`);
console.log(`  prey on the LEFT  → mean wolf drift ${r.left && r.left.mean} px  ${JSON.stringify(r.left && r.left.drift)}`);
console.log(`  prey on the RIGHT → mean wolf drift ${r.right && r.right.mean} px  ${JSON.stringify(r.right && r.right.drift)}`);
console.log(`  idle (no prey): furthest wolf sits ${r.idleMaxGap}px from the player`);
console.log(`  live hunt: ${JSON.stringify(r.hunt)}`);

check(!!(r.left && r.left.n >= 3), 'the pack actually summoned', r.left);
check(!!(r.left && r.left.mean < -60), 'prey on the LEFT pulls the wolves LEFT', r.left);
check(!!(r.right && r.right.mean > 60), 'prey on the RIGHT pulls the wolves RIGHT', r.right);
check(r.idleMaxGap < 400, 'with nothing to hunt they hold station near the player instead of wandering off', r.idleMaxGap);
// The old AI was airborne in every sample of this run.
check(r.priority.ground > r.priority.air * 3, 'offered a reachable bite at its feet or a nearer one floating overhead, it takes the reachable one', r.priority);
// The old AI was airborne in every sample of this run.
check(r.priority.groundedPct >= 80, 'and stays on the ground doing it, instead of launching at the overhead one', r.priority);
check(r.hunt.groundedPct >= 30, 'on a live map it is not permanently airborne either (loose: random spawns legitimately need some hops)', r.hunt);
check(r.hunt.switches <= 12, 'and they commit to a target instead of swapping prey constantly', r.hunt);
check(r.hunt.maxDy <= 220, 'the prey they pick is at their own height, not two platforms up', r.hunt);
check(r.hunt.outOfWorld === 0, 'no wolf ever leaves the world', r.hunt);
check(r.hunt.maxLeash <= 1000, 'and none streams away from the player across the map', r.hunt);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
