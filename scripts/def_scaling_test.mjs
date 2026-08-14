// Level-aware DEF + the lower contact floor, measured.
//
// Per user: "higher DEF should reduce damage even more on higher levels,
// reduce the damage taken floor." The checks:
//   1. the absorb curve is LEVEL-AWARE: the same DEF absorbs more at Lv 90
//      than at Lv 10 (K 500 -> 320 across Lv 30..90)
//   2. the cap eases 0.90 -> 0.94 across Lv 50..90 (still never immune)
//   3. the early game is untouched: Lv 10 and Lv 30 share the old curve
//   4. the contact floor binds at 0.25x, not 0.40x — measured on a real mob
//      touching a max-DEF player, not read off the source
// Run: node scripts/def_scaling_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
// The three no-throttle flags matter more than anything inside the page:
// Chrome throttles requestAnimationFrame for unfocused/occluded windows, and a
// looped or parallel test run never has focus — the game loop stalls, contact
// samples starve, and the suite fails with perfect data and too few samples.
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _defAbsorbMul === 'function' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(2500);

const _suite = async () => {
  const out = {};
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  // getDef is a global function declaration, so it is reassignable — pin it so
  // the curve is tested at exact DEF values instead of whatever gear rolls.
  const realGetDef = getDef;
  const mulAt = (lv, def) => {
    player.level = lv; window.getDef = () => def;
    const v = _defAbsorbMul();
    window.getDef = realGetDef;
    return +v.toFixed(4);
  };
  // --- 1/2/3. the curve -------------------------------------------------------
  out.lv10_d1000 = mulAt(10, 1000);      // 1 - 1000/1500 = 0.3333
  out.lv30_d1000 = mulAt(30, 1000);      // identical — ease starts ABOVE 30
  out.lv90_d1000 = mulAt(90, 1000);      // 1 - 1000/1320 = 0.2424
  out.lv90_d2000 = mulAt(90, 2000);      // 1 - 2000/2320 = 0.1379
  out.lv90_dHuge = mulAt(90, 500000);    // cap: 1 - 0.94 = 0.06
  out.lv50_dHuge = mulAt(50, 500000);    // cap unchanged at 50: 0.10
  out.lv90_d0 = mulAt(90, 0);            // no DEF, no reduction

  // --- 4. the contact floor, measured on a live mob ----------------------------
  // Withering Tide (Lv 44), not forest: a Lv-1 snail's atkBase is 2, where
  // max(2, x0.25) and max(2, x0.40) are the SAME number - the first run of
  // this test could not tell the floors apart. At Lv 44 they differ ~60%.
  // Bone Graveyard, same Lv-43 roster tier but DRY. Withering Tide's drowning
  // dealt maxHp-1 to both samples (it ignores DEF entirely), flipping the
  // ratio to 1 whenever the air timer crossed during sampling.
  // The map can roll NIGHTMARE-TOUCHED on load (the v0.29.60 cursed gamble) -
  // a standing state whose hex clamps the player to 1 HP all run, DEF-blind,
  // which survived every monster-side pin because no monster does it. Reroll
  // until the map loads clean; body.map-cursed is the load-time tell.
  for (let _t = 0; _t < 8; _t++) {
    try { loadMap('boneGraveyard'); } catch (e) {}
    for (let i = 0; i < 6; i++) { game.paused = false; await frame(); }
    if (!document.body.classList.contains('map-cursed') && !game._curseHex) break;
  }
  for (let i = 0; i < 40; i++) { game.paused = false; await frame(); }
  // `let`, and picked by a function: the poisoned-attempt reroll below reloads
  // the map, which rebuilds game.monsters — an orphaned mob reference never
  // collides again (the projectile/touch loops read the live array).
  let mob = null;
  const pickMob = () => {
    mob = game.monsters.find((m) => m && m.currentHp > 0 && !m.isBoss) || null;
    if (mob) for (const m of game.monsters) if (m !== mob) m.currentHp = 0;
    return mob;
  };
  if (!pickMob()) return Object.assign(out, { noMob: true });
  game.projectiles.length = 0; game.hazards.length = 0;
  // Same level as the mob so the level-gap multiplier is 1 and the expected
  // floor is computable in-page from the same helpers the game uses.
  const mobLv = (typeof _mobLevel === 'function') ? _mobLevel(mob) : (mob.level || 1);
  player.level = mobLv;
  player.cls = 'mage'; player.blockTimer = 0; player._aegis = false;
  // Pin BOTH bodies to a ground slab. The 999998-loss run was the player
  // FALLING into Withering Tide's water while the mob was glued to them -
  // a fall clamp to 1 HP reads as a monstrous "hit" in both samples.
  const _ground = (game.mapData.platforms || []).filter((q) => q.type === 'ground').sort((x, y) => y.w - x.w)[0] || { x: 0, y: 480 };
  const _hx = _ground.x + 200, _hy = _ground.y - (player.h || 44);
  player.maxHp = 999999; player.hp = 999999;
  // Measure as a RATIO of max-DEF touch to zero-DEF touch on the same mob.
  // The first version derived atkBase by hand and compared absolutes — and
  // read 8 identical hits of 179 with no +rand jitter, i.e. it was sampling a
  // mob ATTACK (hazard/swing), not contact at all. Now: hazards, projectiles
  // and swings are cleared EVERY frame so only touch can land, and the ratio
  // cancels whatever the touch anchor computes. At max DEF the absorb (capped
  // 0.90 here) undercuts the floor, so the floor binds: ratio ≈ the floor.
  const sample = async (defVal) => {
    window.getDef = () => defVal;
    const hits = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 6000 && hits.length < 8) {
      game.paused = false;
      game.projectiles.length = 0; game.hazards.length = 0;
      // Cull respawns EVERY frame: the map replenishes spawns mid-sample, and
      // a fresh off-screen caster can fire the 1-HP Soul Drain clamp while a
      // living neighbour inflates touch via the pack bonus (868 vs 720 hits).
      for (const _o of game.monsters) if (_o !== mob) _o.currentHp = 0;
      if (game.swings) game.swings.length = 0;
      player.x = _hx; player.y = _hy; player.vx = 0; player.vy = 0;
      mob.x = player.x; mob.y = player.y; mob.vx = 0; mob.vy = 0;
      mob.currentHp = Math.max(mob.currentHp, 1000);
      mob._attackTimer = 9999; mob.attackCooldown = 9999;   // touch only
      // Soul Drain guard: graveyard-tier casters clamp the player to 1 HP at
      // patternTimer 1500 (the 999998-loss runs, DEF-blind by design). Pinning
      // the timer at 0 keeps the wind-up permanently short of firing.
      mob.patternTimer = 0; mob._drainFired = false;
      player.invulnerable = 0;
      const before = player.hp;
      await frame();
      const loss = before - player.hp;
      // A loss on the scale of maxHp is a scripted 1-HP clamp (Soul Drain, the
      // nightmare hex, Gravitos PHASED — three distinct sources found so far),
      // never contact. Chasing their state fields across builds is a losing
      // game: flag the attempt poisoned and let the outer loop reroll the map.
      if (loss > 1e5) { hits._poisoned = true; break; }
      if (loss > 0) hits.push(loss);
      player.hp = 999999;
    }
    window.getDef = realGetDef;
    hits.sort((a, b) => a - b);
    return hits;
  };
  let hitsMax = [], hitsZero = [];
  for (let _try = 0; _try < 4; _try++) {
    hitsMax = await sample(1e6);
    if (!hitsMax._poisoned && hitsMax.length) hitsZero = await sample(0);
    // < 3 on either side, matching the assertion below exactly — an earlier
    // cut retried only on EMPTY, so a 1-sample starved run sailed through the
    // retry and then failed the >=3 check it was supposed to prevent.
    const _bad = hitsMax._poisoned || hitsZero._poisoned || hitsMax.length < 3 || hitsZero.length < 3;
    if (!_bad) break;
    // poisoned or starved (rAF can stall under parallel Chrome load):
    // reroll the whole map state and go again with a FRESH mob
    try { loadMap('boneGraveyard'); } catch (e) {}
    for (let i = 0; i < 12; i++) { game.paused = false; await frame(); }
    player.x = _hx; player.y = _hy; player.hp = 999999; player.cls = 'mage'; player.blockTimer = 0;
    if (!pickMob()) break;
  }
  const med = (a) => (a.length ? a[Math.floor(a.length / 2)] : 0);
  out.mobType = mob.type; out.mobLv = mobLv;
  out.hitsMax = hitsMax.slice(0, 8); out.hitsZero = hitsZero.slice(0, 8);
  out.medMax = med(hitsMax); out.medZero = med(hitsZero);
  out.ratio = out.medZero > 0 ? +(out.medMax / out.medZero).toFixed(3) : -1;
  return out;
};
let r = await page.evaluate(_suite);
// A bad BOOT roll (start-menu/prologue variant) leaves gameplay never running:
// the pure-function curve checks pass while every contact sample comes back
// empty for the whole run. One full page reload covers it, whatever the roll.
if (!r.noMob && (!(r.hitsMax || []).length || !(r.hitsZero || []).length)) {
  console.log("  (empty floor samples — reloading the page once and re-measuring)");
  await page.goto(URL + "?dev=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof _defAbsorbMul === "function" && typeof loadMap === "function", { timeout: 60000 });
  await page.evaluate(() => {
    const o = document.getElementById("loading-overlay"); if (o) o.style.display = "none";
    window._lxBootGateDone = true;
    const c = document.querySelector("#class-select-modal .cls-card");
    if (c && !player.cls) { try { c.click(); } catch (e) {} }
    const g = document.getElementById("class-select-modal"); if (g) g.style.display = "none";
  });
  await page.waitForTimeout(2500);
  r = await page.evaluate(_suite);
}
await browser.close();

console.log(`  curve: lv10/1000 ${r.lv10_d1000} | lv30 ${r.lv30_d1000} | lv90 ${r.lv90_d1000} | lv90/2000 ${r.lv90_d2000} | caps ${r.lv50_dHuge}/${r.lv90_dHuge}`);
console.log(`  floor: ${r.mobType} Lv${r.mobLv}; maxDEF hits ${JSON.stringify(r.hitsMax)} zeroDEF ${JSON.stringify(r.hitsZero)} -> ratio ${r.ratio}`);

check(r.lv10_d1000 === 0.3333, 'Lv 10 curve unchanged (1000 DEF -> x0.3333)', r.lv10_d1000);
check(r.lv30_d1000 === 0.3333, 'Lv 30 curve unchanged (the ease starts above 30)', r.lv30_d1000);
check(r.lv90_d1000 === 0.2424, 'the same 1000 DEF absorbs MORE at Lv 90 (x0.2424, was x0.3333)', r.lv90_d1000);
check(r.lv90_d2000 === 0.1379, '2000 DEF at Lv 90 -> x0.1379 (was x0.20)', r.lv90_d2000);
check(r.lv50_dHuge === 0.1 && r.lv90_dHuge === 0.06, 'the cap eases 90% -> 94% across Lv 50..90, never to immunity', { lv50: r.lv50_dHuge, lv90: r.lv90_dHuge });
check(r.lv90_d0 === 1, 'zero DEF still means zero reduction', r.lv90_d0);
check(!r.noMob && r.hitsMax.length >= 3 && r.hitsZero.length >= 3, 'the floor measurement actually sampled real contact hits both ways', { max: r.hitsMax, zero: r.hitsZero });
// Floored max-DEF touch over unmitigated touch = the floor fraction (+rand
// noise). New floor 0.25 -> ratio in [0.20, 0.32]; the old 0.40 lands ~0.42,
// far outside, so the same window fails the pre-change build.
check(r.ratio >= 0.20 && r.ratio <= 0.32, 'contact damage binds at the 0.25x floor, not the old 0.40x', r.ratio);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
