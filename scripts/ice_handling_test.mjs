// Ice handling, measured per icy map rather than tuned by feel.
//
// Per user: "left right movement hypersensitivity on icy snow areas aren't
// fixed yet". Three earlier passes tuned Frostbite Hollow and only Frostbite
// Hollow — the knobs are per-map overrides, so Frozen Peak kept the engine
// defaults (cap 18, accel x1) and stayed twice as fast with a full second of
// turn-around. This walks EVERY isIcy map and measures the three numbers the
// earlier passes were reasoning about, so a map cannot be left behind again.
//
//   peak        top speed in px/frame while a direction is held
//   glide       px travelled after the key is released, until it stops
//   turnFrames  frames from peak to a full stop when the OPPOSITE key is held
//
// Run: node scripts/ice_handling_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false; player.level = 40;
});
await page.waitForTimeout(4000);

const icyIds = await page.evaluate(() => Object.keys(MAPS).filter((id) => MAPS[id].isIcy || MAPS[id].icyIntensity));
const results = [];
for (const id of icyIds) {
  const r = await page.evaluate(async (mapId) => {
    const frame = () => new Promise((res) => requestAnimationFrame(res));
    try { loadMap(mapId); } catch (e) { return { id: mapId, err: String(e).slice(0, 80) }; }
    for (let i = 0; i < 20; i++) await frame();          // settle + land
    // Drive the REAL listener with real events. The first version poked at a
    // `k` object that is a closure variable, not a global — every reading came
    // back 0 and the suite went green having measured nothing at all.
    const send = (type, key) => window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
    const hold = (key) => send('keydown', key);
    const clear = () => { send('keyup', 'ArrowLeft'); send('keyup', 'ArrowRight'); };
    const K = { set left(v) { v ? hold('ArrowLeft') : send('keyup', 'ArrowLeft'); },
                set right(v) { v ? hold('ArrowRight') : send('keyup', 'ArrowRight'); } };
    // Pin the player on the widest ground slab and hold x there every frame.
    // Frozen Peak and the Ascension are only 800 px wide: at 14.7 px/frame the
    // player hits the far wall mid-run, the collision zeroes vx, and both the
    // glide and the turn-around measured 0 for a reason that had nothing to do
    // with ice. Freezing x measures the velocity physics itself and makes the
    // three maps comparable; glide becomes the integral of vx, which is the
    // distance it WOULD travel on a slab long enough.
    const ground = (game.mapData.platforms || [])
      .filter((p) => p.type === 'ground').sort((a, b) => b.w - a.w)[0]
      || { x: 0, y: 480, w: 800 };
    const homeX = ground.x + Math.min(120, ground.w * 0.2);
    const homeY = ground.y - (player.h || 44);
    // Clear the arena every frame. Frostbite Hollow is a frostkin farm and the
    // frostkin freeze-beam locks movement: that map measured peak 0 while the
    // other two measured 18, which reads as "the tuning works" and is actually
    // "the player was frozen". Same class of mistake as the quake test's live
    // fire jet.
    // Frostbite Hollow pops an area card on entry, which sets game.paused. No
    // physics ticked, so it measured peak 0 and PASSED every ceiling — the
    // tuned map looked perfect because it was standing still. Hidden ONCE:
    // doing three querySelectors per frame made the loop heavy enough to change
    // the readings it was taking (frostbite swung 0.40 s -> 0.82 s on identical
    // config), which is the measurement disturbing the measurement.
    for (const sel of ['#area-card', '.area-card', '#map-intro']) {
      const el = document.querySelector(sel); if (el) el.style.display = 'none';
    }
    const sterilise = () => {
      game.paused = false;
      game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
      player.invulnerable = 999999;
    };
    const settle = async (n) => { for (let i = 0; i < n; i++) { sterilise(); player.x = homeX; player.y = homeY; await frame(); } };
    clear();
    player.vx = 0;
    await settle(15);

    // --- peak: hold right until vx stops rising -----------------------------
    K.right = true;
    let peak = 0, flat = 0;
    for (let i = 0; i < 240 && flat < 15; i++) {
      sterilise(); player.x = homeX;
      await frame();
      if (player.vx > peak + 0.01) { peak = player.vx; flat = 0; } else flat++;
    }

    // --- glide: release, integrate vx until it stops -------------------------
    clear();
    let gf = 0, glidePx = 0;
    for (; gf < 400 && Math.abs(player.vx) > 0.15; gf++) {
      sterilise(); player.x = homeX;
      await frame();
      glidePx += Math.abs(player.vx);
    }
    const glide = Math.round(glidePx);

    // --- turn-around: back to peak, then hold the OPPOSITE key ---------------
    player.vx = 0;
    K.right = true;
    for (let i = 0; i < 240 && player.vx < peak - 0.15; i++) { sterilise(); player.x = homeX; await frame(); }
    const fromV = player.vx;
    K.right = false; K.left = true;
    // Wall clock, not frame count. Reporting frames/60 assumed a steady 60 fps;
    // the harness does not get one, and identical configs swung 0.40 s <-> 0.87 s
    // purely on frame-rate variance. Elapsed time is also what the player feels.
    const t0 = performance.now();
    let tf = 0;
    for (; tf < 400 && player.vx > 0; tf++) { sterilise(); player.x = homeX; await frame(); }
    const turnMs = performance.now() - t0;
    clear();
    player.vx = 0;

    const md = MAPS[mapId];
    return {
      id: mapId, name: md.name,
      peak: +peak.toFixed(2), fromV: +fromV.toFixed(2), glide, turnFrames: tf, glideFrames: gf,
      turnSec: +(turnMs / 1000).toFixed(2),
      momentumTower: !!md.momentumTower,
      cfg: { iceMaxVx: md.iceMaxVx, iceAccelMul: md.iceAccelMul, iceFriction: md.iceFriction, icyIntensity: md.icyIntensity },
    };
  }, id);
  results.push(r);
}
await browser.close();

console.log(`  icy maps measured: ${results.length}\n`);
for (const r of results) {
  if (r.err) { console.log(`  ${r.id}: ERROR ${r.err}`); continue; }
  console.log(`  ${r.id.padEnd(26)} peak ${String(r.peak).padStart(6)} px/f   glide ${String(r.glide).padStart(4)} px   turn-around ${String(r.turnSec).padStart(5)} s (${r.turnFrames}f)`);
  console.log(`  ${' '.repeat(26)} cfg ${JSON.stringify(r.cfg)}`);
}

const ok = results.filter((r) => !r.err);
check(ok.length >= 2, 'more than one icy map was actually measured', ok.length);
// THE GUARD THAT MATTERS. The first version of this test drove a `k` object
// that was a closure variable, so nothing moved: every map read peak 0, glide
// 0, turn 0 — and 0 is under every ceiling below, so the whole suite went
// green having measured nothing. A speed ceiling only means something once you
// have proved the player actually moved.
check(ok.every((r) => r.peak > 3), 'the player actually accelerated on every map (0 would pass every ceiling below)',
  ok.map((r) => `${r.id}:${r.peak}`));
check(ok.every((r) => r.turnFrames > 0), 'the turn-around measurement actually ran', ok.map((r) => `${r.id}:${r.turnFrames}`));
// A map may keep the old momentum, but only by saying so out loud. The
// Ascension is a procedurally generated Icy Tower climb whose whole design is
// speed-jumping, and it was set fully slippery on an explicit request in
// v0.26.420 — so it opts out via `momentumTower` rather than being silently
// exempted here. Anything that has NOT opted out is held to the ceilings.
const towers = ok.filter((r) => r.momentumTower);
const snow = ok.filter((r) => !r.momentumTower);
console.log(`  held to the ceilings: ${snow.map((r) => r.id).join(', ') || '(none)'}`);
console.log(`  opted out (momentumTower): ${towers.map((r) => r.id).join(', ') || '(none)'}`);
check(snow.length >= 2, 'at least two maps are actually held to the ceilings (an opt-out cannot empty the test)', snow.length);
for (const r of snow) {
  check(r.peak <= 11, `${r.id}: top speed is not a rocket (<= 11 px/frame)`, r.peak);
  check(r.turnSec <= 0.55, `${r.id}: reversing takes under 0.55 s, not a full second`, { sec: r.turnSec, frames: r.turnFrames });
  // 350 from the DATA, not a guess: both tamed maps measure ~260-285 px and the
  // untamed tower ~1050, so this sits clear of the real values and still fails
  // an order-of-magnitude regression by 3x.
  check(r.glide <= 350, `${r.id}: releasing the key does not slide a sixth of the map`, r.glide);
}
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
