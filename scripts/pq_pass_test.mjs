// The v0.30.281 PQ pass, asserted end to end.
// ============================================================================
//   1. Conductor: columnStrike trait present at high damage, and a spawned
//      Conductor CLOSES on a distant player (pursuit is real movement, not a
//      trait flag).
//   2. Spire: _lxAirJumpCap() is 0 there and >=1 elsewhere; every generated
//      floor-to-floor crossing fits plain-jump reach (<=62px measured); the
//      rift shove fires on SOME damage ticks and not all (randomised).
//   3. Stage 1: _normMonsterCap(24) yields 16 on the Underpass under lowFx
//      and the full value when healthy.
// Run: node scripts/pq_pass_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11151);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
// The class-select modal is MANDATORY: while it is open the solo sim's
// update branch never runs regardless of game.paused — the dynamic
// scenarios (chase, rift ticks) need a real character in the world.
const click = async (sel, ms) => { const el = await page.$(sel); if (el && await el.isVisible().catch(() => false)) { try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) {} } return false; };
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000); await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) { const r = await page.evaluate(() => { const o = document.getElementById('class-options'); return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); }); if (r) break; if (!(await click('#cs-nav-next'))) break; await page.waitForTimeout(1000); }
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) { for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200); await page.keyboard.press('Enter').catch(() => {}); await page.waitForTimeout(2000); const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive })); if (st.p === false && !st.pro) break; }

// The harness walk clicks through auth + class select directly, which can
// leave #loading-overlay at menu-up without .fade — and loop() PARKS until
// the overlay fades (the boot gate at the top of loop()). Frozen sim =
// game.time stuck at 0 = no chase, no hazard ticks. Open the gate with the
// game's own signal.
await page.evaluate(() => {
  const o = document.getElementById("loading-overlay");
  if (o) o.classList.add("fade");
});
await page.waitForTimeout(1200);
const R = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- conductor trait + pursuit -------------------------------------------
  const ct = monsterTypes.pqConductor && monsterTypes.pqConductor.traits;
  out.column = !!(ct && ct.columnStrike && ct.columnStrike.dmgMul >= 3);
  out.columnDmgMul = ct && ct.columnStrike ? ct.columnStrike.dmgMul : null;
  try { loadMap('forest'); game.paused = false; player._god = true; player.hp = 99999; } catch (e) {}
  await sleep(600);
  game.monsters.length = 0;
  const c = spawnMonster(player.x + 620, player.y, 'pqConductor', true);
  // The boss-intro card auto-closes after 3.2s; wait it out, then measure.
  await sleep(3800); game.paused = false;
  const _simT0 = game.time;
  const d0 = c ? Math.abs((c.x + c.w / 2) - (player.x + player.w / 2)) : -1;
  // Keep the game live while he runs (a modal would freeze the sim).
  for (let i = 0; i < 30; i++) { game.paused = false; player.invulnerable = 200; await sleep(100); }
  const d1 = c ? Math.abs((c.x + c.w / 2) - (player.x + player.w / 2)) : -1;
  out.chase = { d0: Math.round(d0), d1: Math.round(d1), simTicks: game.time - _simT0, vx: +(c && c.vx || 0).toFixed(2), state: c && c.patternState, map: game.currentMap, paused: game.paused };
  game.monsters.length = 0;

  // ---- spire: jump cap + gaps ----------------------------------------------
  out.capForest = _lxAirJumpCap();
  try { loadMap('clockworkSpire'); game.paused = false; } catch (e) {}
  out.capSpire = _lxAirJumpCap();
  const plats = (game.mapData && game.mapData.platforms || []).filter((p) => p.type !== 'ground');
  const byY = [...plats].sort((a, b) => b.y - a.y);
  let maxGap = 0;
  for (let i = 0; i + 1 < byY.length; i++) {
    const a = byY[i], b = byY[i + 1];
    if (Math.abs(a.y - b.y) > 120) continue;         // consecutive floors only
    const gap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    if (gap > maxGap) maxGap = gap;
  }
  out.maxGap = Math.round(maxGap);
  out.floors = byY.length;

  // ---- rift shove: randomized, not constant --------------------------------
  // The 8 map tears spawn inside Milo's stage-warp hook (quest-gated); a
  // bare loadMap never runs it. The SHOVE lives in the hazard resolver,
  // keyed on _sourceLabel — synthesize one tear with the exact production
  // field shape and tick against it.
  out.tears = (MAPS.clockworkSpire._pqSpireHazards || []).length;
  game.hazards.push({ type: 'void_tear', x: player.x - 40, y: player.y - 10, w: 80, h: 40,
    cx: player.x, life: 60000, maxLife: 60000, atk: 60, _sourceLabel: 'a Spire void-tear' });
  const tear = game.hazards.find((h) => h.type === 'void_tear');
  let shoves = 0, ticks = 0;
  if (tear) {
    player._god = false; player.hp = 99999; player.maxHp = 99999;
    for (let i = 0; i < 40; i++) {
      player.x = tear.cx - player.w / 2;
      // feet must land INSIDE (h.y, h.y + h.h + 10) - the first attempt put
      // them exactly ON the boundary and no tick ever landed.
      player.y = tear.y + tear.h / 2 - (player.h || 48);
      player.invulnerable = 0; player.vx = 0; player.vy = 0;
      tear._tickCD = 0;
      game.paused = false;
      await sleep(70);
      ticks++;
      if (Math.abs(player.vx) > 5) shoves++;
    }
    player._god = true;
  }
  out.shove = { ticks, shoves, hpLost: 99999 - player.hp, simMoved: game.time };

  // ---- stage-1 cap relief ---------------------------------------------------
  try { loadMap('clockworkUnderpassLobby'); game.paused = false; } catch (e) {}
  const wasLow = LX_PERF.lowFx, wasUntil = LX_PERF.lowFxUntil;
  LX_PERF.lowFx = true; LX_PERF.lowFxUntil = 1e9;
  out.capLow = _normMonsterCap(24);
  // _perfLowFx() has an AUTO branch keyed on live boss/mob load — with the
  // 23-mech swarm alive it correctly reports 'struggling' even with the
  // manual flag off (the relief engaging off swarm density is the feature
  // working). For the healthy leg, clear the load so only the flag speaks.
  LX_PERF.lowFx = false; LX_PERF.lowFxUntil = 0;
  game.monsters.length = 0; game._lowFxCache = null;
  out.capHealthy = _normMonsterCap(24);
  LX_PERF.lowFx = wasLow; LX_PERF.lowFxUntil = wasUntil;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  conductor: columnStrike dmgMul ${R.columnDmgMul}, chase ${R.chase.d0}px -> ${R.chase.d1}px  [sim ${R.chase.simTicks} ticks, vx ${R.chase.vx}, state ${R.chase.state}, map ${R.chase.map}, paused ${R.chase.paused}]`);
console.log(`  spire: airJumpCap ${R.capSpire} (forest ${R.capForest}), floors ${R.floors}, max crossing gap ${R.maxGap}px, tears ${R.tears}`);
console.log(`  rift shove: ${R.shove.shoves}/${R.shove.ticks} shoved, hp lost ${R.shove.hpLost}, game.time ${R.shove.simMoved}`);
console.log(`  underpass cap(24): lowFx ${R.capLow}, healthy ${R.capHealthy}`);

ok('Conductor carries the Departure Signal (columnStrike, dmgMul >= 3)', R.column, `dmgMul ${R.columnDmgMul}`);
// d0 is sampled after the intro card settles, and the pursuit is already
// running by then — he closes ~150-200px before the window even opens. So
// assert CLOSURE (ends close, and meaningfully closer than he started),
// not the starting gap.
ok('Conductor pursues: ends within melee range, far closer than he started',
   R.chase.d1 < 350 && R.chase.d0 - R.chase.d1 > 150,
   `${R.chase.d0}px -> ${R.chase.d1}px (pre-fix: no movement of his own)`);
ok('the Spire allows exactly one jump (no air jumps)', R.capSpire === 0 && R.capForest >= 1,
   `spire ${R.capSpire}, forest ${R.capForest}`);
ok('every Spire crossing fits plain-jump reach', R.floors > 30 && R.maxGap <= 62,
   `max gap ${R.maxGap}px across ${R.floors} floors (measured plain reach 62px; pre-fix gaps ran to 80px)`);
ok('CONTROL: the Spire map bakes its rift config (warp hook spawns from it)', R.tears >= 6, `${R.tears} baked tears`);
ok('rifts shove SOMETIMES — randomised, not never, not always',
   R.shove.ticks >= 30 && R.shove.shoves >= 4 && R.shove.shoves <= R.shove.ticks - 4,
   `${R.shove.shoves}/${R.shove.ticks} (expected ~35%; 0 = feature missing, all = not random)`);
ok('Underpass swarm relief: cap 16 under lowFx, full density when healthy',
   R.capLow === 16 && R.capHealthy > 16,
   `lowFx ${R.capLow}, healthy ${R.capHealthy}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
