// SCORPIO — the Venomlord gets a signature that attacks the FLOOR.
// ============================================================================
// Per user: "further work on scorpio boss mechanics and generate necessary
// sprites especially for signature move".
//
// Her signature was the GENERIC one: _sigMove hands taurus, sagittarius,
// aquarius and scorpio the same columnStrike. Her two bespoke mechanics
// (Stinger Execute, Burrow Ambush) both aim at the tile the player stands on,
// so the arena never mattered.
//
// The checks below care about the two things that make the Deluge a DODGE
// rather than a tax: the pools are telegraphed before they land, and there is
// always exactly one gap, never at an outer edge (an edge gap can be walled off
// by arena geometry; an interior one is reachable from two sides).
// Run: node scripts/scorpio_deluge_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9977);

// Art first — a signature move whose sprites are missing degrades to coloured
// ellipses, and the in-page checks below would not notice.
const art = [];
for (const f of ['Sprites/vfx/scorpio_venompool.webp', 'Sprites/vfx/scorpio_deluge.webp',
                 ...Array.from({ length: 9 }, (_, i) => `Sprites/vfx/anim/scorpio_venompool_${i}.webp`)]) {
  try { await access(path.join(ROOT, f)); art.push([f, true]); } catch { art.push([f, false]); }
}

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Venom');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const keepAlive = () => {
    player.hp = getMaxHp(); game.paused = false;
    for (let i = 0; i < 6; i++) {
      const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot();
      if (!r) break; r.style.display = 'none';
    }
  };
  keepAlive();
  const out = {
    hasMove: typeof _lxScorpioDeluge === 'function',
    cd: (typeof LX_SCORPIO_DELUGE_CD !== 'undefined') ? LX_SCORPIO_DELUGE_CD : null,
    tele: (typeof LX_SCORPIO_DELUGE_TELE !== 'undefined') ? LX_SCORPIO_DELUGE_TELE : null,
    slots: (typeof LX_SCORPIO_DELUGE_SLOTS !== 'undefined') ? LX_SCORPIO_DELUGE_SLOTS : null,
    vfxKeys: (typeof LX_VFX !== 'undefined') ? ['scorpioVenomPool', 'scorpioDeluge'].filter(k => !!LX_VFX[k]) : [],
  };
  if (!out.hasMove) return out;

  game.monsters.length = 0; game.hazards.length = 0;
  const boss = { type: 'scorpio', zodiacId: 'scorpio', x: player.x + 260, y: player.y, w: 120, h: 90,
                 atk: 400, currentHp: 9e6, maxHp: 9e6, patternState: 'idle' };
  game.monsters.push(boss);

  // Drive the move through its real entry point.
  boss._delugeCd = 0;
  _lxScorpioDeluge(boss, 20);
  out.teleArmed = (boss._delugeTele || 0) > 0;
  out.warnMarkers = game.hazards.filter(h => h.type === 'meteor_warn' && h._sourceLabel === "Scorpio's Venom Deluge").length;
  out.poolsBeforeLand = game.hazards.filter(h => h.type === 'venom_pool').length;

  // Run the telegraph out.
  let guard = 0;
  while ((boss._delugeTele || 0) > 0 && guard++ < 400) _lxScorpioDeluge(boss, 20);
  const pools = game.hazards.filter(h => h.type === 'venom_pool');
  out.pools = pools.length;
  out.bursts = game.hazards.filter(h => h.type === 'venom_burst').length;
  out.poolXs = pools.map(h => Math.round(h.cx)).sort((a, b) => a - b);

  // Where is the gap? Slot spacing is uniform, so the one oversized stride
  // between consecutive pools IS the gap.
  const gaps = [];
  for (let i = 1; i < out.poolXs.length; i++) gaps.push(out.poolXs[i] - out.poolXs[i - 1]);
  const minStride = Math.min(...gaps);
  out.gapIndex = gaps.findIndex(g => g > minStride * 1.6);
  out.gapCount = gaps.filter(g => g > minStride * 1.6).length;

  // Standing in venom must hurt AND poison; standing in the gap must not.
  //
  // The boss is pulled OUT of game.monsters for these two measurements. Left in,
  // its contact damage lands every frame (the loops force invulnerable to 0 so
  // the pool's own chip is not gated by i-frames), and the first run of this
  // test charged that to the venom: the pool and the GAP both reported exactly
  // -116 HP, an identical number that was never coming from the floor.
  // Damage is also attributed by _lastDamageSource rather than inferred from a
  // bare HP delta, so "the gap is safe" cannot pass or fail on someone else's hit.
  //
  // She is MOVED, not removed. Emptying game.monsters fires the pools' own
  // owner-scrub — venom dies with the Venomlord — so the second run of this test
  // deleted every pool before the player could stand in one and then reported
  // "the venom does nothing". The game was right both times; the harness was
  // destroying the thing it was about to measure.
  boss.x = player.x + 6000;
  const stand = async (x, y, ms) => {
    player._god = false; player.blockTimer = 0;
    player._poisonTimer = 0; player._slowTimer = 0;
    player._lastDamageSource = null;
    player.hp = getMaxHp();
    const hp0 = player.hp;
    // Sampled INSIDE the loop. Reading _poisonTimer once at the end says only
    // what survived the final frame, not whether the pool ever applied it —
    // and the pool refreshes and the tick decays in the same frame.
    let maxPoison = 0, maxSlow = 0, srcSeen = null;
    const t = performance.now();
    while (performance.now() - t < ms) {
      player.x = x - player.w / 2;
      if (y != null) { player.y = y; player.vy = 0; }
      player.invulnerable = 0; game.paused = false;
      await frame();
      if ((player._poisonTimer | 0) > maxPoison) maxPoison = player._poisonTimer | 0;
      if ((player._slowTimer | 0) > maxSlow) maxSlow = player._slowTimer | 0;
      if (player._lastDamageSource) srcSeen = player._lastDamageSource;
    }
    const r = { lost: hp0 - player.hp, src: srcSeen,
                poison: maxPoison, slow: maxSlow };
    player._god = true; player.hp = getMaxHp();
    return r;
  };
  const poolMid = pools.length ? pools[Math.floor(pools.length / 2)] : null;
  if (poolMid) {
    const r = await stand(poolMid.cx, poolMid.y - player.h + 12, 2200);
    out.poolHpLost = r.lost; out.poolSrc = r.src;
    out.poolPoisoned = r.poison; out.poolSlowed = r.slow;
  }
  // The gap: park the player in the empty slot and confirm it is safe.
  if (out.gapIndex >= 0 && poolMid) {
    const gx = (out.poolXs[out.gapIndex] + out.poolXs[out.gapIndex + 1]) / 2;
    const r = await stand(gx, poolMid.y - player.h + 12, 1600);
    out.gapHpLost = r.lost; out.gapSrc = r.src; out.gapPoison = r.poison;
    out.gapX = Math.round(gx);
  }

  // Death must take her venom with it.
  boss.currentHp = 0;
  game.monsters.length = 0;
  const t2 = performance.now();
  while (performance.now() - t2 < 900) { keepAlive(); await frame(); }
  out.poolsAfterDeath = game.hazards.filter(h => h.type === 'venom_pool').length;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });

console.log(`  art: ${art.filter(a => a[1]).length}/${art.length} files present`);
console.log(`  deluge: cd ${R.cd}ms, telegraph ${R.tele}ms, ${R.slots} slots`);
console.log(`  landed ${R.pools} pools at x ${JSON.stringify(R.poolXs)} — gap at index ${R.gapIndex}`);
console.log(`  in venom: -${R.poolHpLost} HP (${R.poolSrc}), poisoned ${R.poolPoisoned} · in the gap at x${R.gapX}: -${R.gapHpLost} HP (${R.gapSrc})`);

ok('Scorpio has a signature move of her own', R.hasMove && R.cd === 13000,
   `_lxScorpioDeluge present, ${R.cd}ms cadence (she used to share columnStrike with 3 other signs)`);
ok('both Deluge sprites are registered and on disk',
   R.vfxKeys.length === 2 && art.every(a => a[1]),
   `${R.vfxKeys.join(', ')} · ${art.filter(a => a[1]).length}/${art.length} files`);
ok('every landing spot is telegraphed BEFORE the venom falls',
   R.teleArmed && R.warnMarkers === R.pools && R.poolsBeforeLand === 0,
   `${R.warnMarkers} markers up during the ${R.tele}ms rear-up, ${R.poolsBeforeLand} pools on the floor at that point`);
ok('the venom lands as a line of pools', R.pools === (R.slots - 1) && R.pools >= 4,
   `${R.pools} pools from ${R.slots} slots`);
ok('there is EXACTLY ONE gap', R.gapCount === 1, `${R.gapCount} oversized strides in ${JSON.stringify(R.poolXs)}`);
// The property that matters is that there is VENOM ON BOTH SIDES of the gap,
// so it can be entered from either direction. The first version asserted
// `gapIndex !== 0`, which is a different claim and a wrong one: skipping arena
// slot 1 leaves pools at slots 0 and 2, and that gap is pool-list index 0 while
// still having venom to its left. It failed a correct build.
ok('...the gap has venom on BOTH sides, so it is reachable either way',
   R.gapX > Math.min(...R.poolXs) && R.gapX < Math.max(...R.poolXs),
   `gap at x${R.gapX} inside the venom line ${Math.min(...R.poolXs)}..${Math.max(...R.poolXs)}`);
ok('standing in the venom hurts', R.poolHpLost > 0 && R.poolSrc === "Scorpio's Venom Deluge",
   `-${R.poolHpLost} HP over 2.2s, attributed to "${R.poolSrc}"`);
ok('...and poisons — she is the Venomlord, not a puddle', R.poolPoisoned > 0 && R.poolSlowed > 0,
   `peak poison ${R.poolPoisoned}ms, peak slow ${R.poolSlowed}ms while standing in it`);
// Judged by ATTRIBUTION, not a raw HP delta: the claim is that the gap holds no
// venom, and a delta alone would fail on any unrelated chip the arena applies.
ok('CONTROL: no venom in the gap', R.gapSrc !== "Scorpio's Venom Deluge" && R.gapPoison === 0,
   `source in the gap: ${JSON.stringify(R.gapSrc)}, peak poison ${R.gapPoison}ms — the dodge is real, not decorative`);
ok('CONTROL: her venom dies with her', R.poolsAfterDeath === 0,
   `${R.poolsAfterDeath} pools left after death (they linger 5.5s; the victory lap is seconds long)`);
ok('the burst FX fires with the landing', R.bursts === R.pools, `${R.bursts} bursts for ${R.pools} pools`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
