// Four underwater maps carry `isVerticalTower: true` purely so the camera
// follows on both axes — and that one flag was also arming the v0.25.470 fall
// damage block on all of them. None override the tuning, so the free window
// was the flat default (20 floors x 70 px = 1400 px) while the shafts are
// 2100-2400 px tall: swimming down one landed a hit plus 400 ms of hitstun.
//
// The load-bearing part of this test is that it drives the REAL player update
// loop. A test that only asserted "the source contains isUnderwater" would
// pass on the broken build too. So for each map it:
//   • asserts the map really is BOTH underwater and a vertical tower — without
//     that the fall-damage block never ran and the check would be vacuous
//   • asserts the drop really does exceed that map's own free window, so the
//     unfixed build genuinely would have charged for it
//   • drops the player its full world height and reads hp + damage numbers
//
// And it keeps a NON-underwater tower (Frozen Peak) in the same harness as a
// control: an over-broad fix that killed fall damage everywhere would pass
// every underwater check and fail that one.
// Run: node scripts/underwater_fall_damage_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof updatePlayer === 'function', { timeout: 90000 });

const UNDERWATER = ['coralReef', 'abyssalTrench', 'kelpForest', 'bubbleGrotto'];
const CONTROL = 'frozenPeak';

const r = await page.evaluate(({ UNDERWATER, CONTROL }) => {
  const out = {};

  // Drop the player the full height of the map and report what it cost.
  //
  // The apex tracker is seeded directly rather than by simulating the whole
  // descent: underwater vy is pinned to 3, so a real 2400 px sink is 800 ticks
  // of nothing, and the only frame that matters is the landing one. Seeding is
  // faithful because the in-air branch only ever LOWERS _fallApexY (higher
  // altitude), so a seeded apex survives exactly as a real one would.
  const drop = (mapId) => {
    loadMap(mapId);
    const md = game.mapData;
    const res = {
      isUnderwater: !!md.isUnderwater,
      isVerticalTower: !!md.isVerticalTower,
      floorPx: md.fallFloorPx || 70,
      freeFloors: md.fallFreeFloors || 20,
      worldHeight: md.worldHeight || 0,
    };

    // Lowest authored ground = the floor the player would actually land on.
    let groundY = null;
    for (const p of (md.platforms || [])) {
      if (p.type !== 'ground') continue;
      if (groundY === null || p.y > groundY) groundY = p.y;
    }
    res.groundY = groundY;
    if (groundY === null) { res.noGround = true; return res; }

    const dropPx = res.worldHeight;
    res.dropPx = dropPx;
    res.dropFloors = Math.floor(dropPx / res.floorPx);
    // Precondition: this fall MUST exceed the free window, or a "no damage"
    // result proves nothing at all.
    res.exceedsFreeWindow = res.dropFloors > res.freeFloors;

    game.monsters = [];
    game.projectiles = [];
    game.damageNumbers = [];

    player.level = 60;
    player.x = 200;
    player.y = groundY - (player.h || 44) - 40;   // just above the floor, airborne
    player.vx = 0;
    player.vy = 1;
    player.onGround = false;
    player.invulnerable = 0;
    player.hitStun = 0;
    player._god = false;
    // Read the pool, do NOT assign it back: getMaxHp() derives from player.maxHp,
    // so writing the result into it compounds on every subsequent map.
    const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
    player.hp = maxHp;
    res.maxHp = maxHp;

    // Seed the apex as though they fell the whole shaft.
    player._fallApexY = player.y - dropPx;

    // Measure the worst SINGLE-tick hp drop rather than the net change across
    // the descent: updatePlayer also ticks regen, which on a short sink can
    // out-heal a real fall hit and make a broken build look clean.
    let landedAt = -1, worstDrop = 0;
    const tick = () => {
      game.monsters = [];
      game.projectiles = [];
      const hpBefore = player.hp;
      updatePlayer(16);
      const d = hpBefore - player.hp;
      if (d > worstDrop) worstDrop = d;
    };
    for (let f = 0; f < 400; f++) {
      try { tick(); } catch (e) { res.err = String(e); break; }
      if (player.onGround && landedAt < 0) { landedAt = f; break; }
    }
    // One more tick after touchdown so a landing-frame effect can't hide.
    try { tick(); } catch (e) { res.err = res.err || String(e); }

    res.landedAt = landedAt;
    res.hpLost = worstDrop;
    res.fallNumbers = (game.damageNumbers || [])
      .filter((d) => d && typeof d.text === 'string' && d.text.indexOf('(fall)') !== -1)
      .map((d) => d.text);
    res.hitStun = player.hitStun || 0;
    return res;
  };

  out.water = {};
  for (const id of UNDERWATER) out.water[id] = drop(id);
  out.control = drop(CONTROL);
  return out;
}, { UNDERWATER, CONTROL });

console.log('\nUNDERWATER MAPS — no fall damage');
for (const id of UNDERWATER) {
  const m = r.water[id];
  console.log(`\n  ${id}  (${m.worldHeight} px tall, floor y=${m.groundY})`);
  check(!m.err, 'update loop ran clean', m.err);
  check(m.isUnderwater, 'declared isUnderwater');
  // Without isVerticalTower the fall block never ran and "no damage" is vacuous.
  check(m.isVerticalTower, 'ALSO a vertical tower — so the fall block did run (else this check is vacuous)');
  check(m.landedAt >= 0, 'player actually landed', m.landedAt);
  check(m.exceedsFreeWindow,
    `the drop clears this map's free window (${m.dropFloors} floors vs ${m.freeFloors} free) — the unfixed build would have charged`,
    { dropFloors: m.dropFloors, freeFloors: m.freeFloors });
  check(m.hpLost === 0, `took NO fall damage (worst single-tick hp drop, regen excluded)`, { worstTickDrop: m.hpLost, maxHp: m.maxHp });
  check(m.fallNumbers.length === 0, 'no "(fall)" damage number was raised', m.fallNumbers);
  check(m.hitStun === 0, 'no landing hitstun', m.hitStun);
}

console.log(`\nCONTROL — ${CONTROL} is a tower but NOT underwater, so fall damage must SURVIVE`);
{
  const c = r.control;
  check(!c.err, 'update loop ran clean', c.err);
  check(c.isVerticalTower && !c.isUnderwater, 'is a non-underwater vertical tower',
    { isVerticalTower: c.isVerticalTower, isUnderwater: c.isUnderwater });
  check(c.landedAt >= 0, 'player actually landed', c.landedAt);
  check(c.exceedsFreeWindow, 'the drop clears its free window',
    { dropFloors: c.dropFloors, freeFloors: c.freeFloors });
  check(c.hpLost > 0, 'STILL takes fall damage (guards against an over-broad fix)',
    { worstTickDrop: c.hpLost, maxHp: c.maxHp });
  check(c.fallNumbers.length > 0, 'raised a "(fall)" damage number', c.fallNumbers);
}

console.log('');
check(errs.length === 0, 'no page errors', errs.slice(0, 3));

console.log(bad ? `\n${bad} FAILED` : '\nALL PASS');
await browser.close();
process.exit(bad ? 1 : 0);
