// SKY LANCE UNDERWATER — the dive must still SLAM.
// ============================================================================
// Per user: "Skylance skill does not work in underwater map, it does not slam
// down to the ground, please fix it".
//
// The cast only teleports the player to an apex and sets player.dragoonSlam;
// the dive itself is ordinary gravity, and the slam resolves when onGround is
// reached with the flag still set. Underwater maps cap fall speed at vy 3 and
// bleed it toward zero every frame (buoyancy), so from a 225 px apex the player
// SINKS rather than dives — and the chained dives re-teleport before the first
// ever lands, so the slag never fires at all.
//
// Measured on the real map, not the table: the time from cast to the slam
// resolving, the peak downward speed during it, and whether the impact
// actually deals damage. The land run is the control — it must not change.
// Run: node scripts/skylance_underwater_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9491;
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
await page.fill('#hero-name-input', 'LanceTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const runOn = async (mapKey) => {
  await page.evaluate((mk) => {
    player.level = 99; player._god = true;
    player.cls = 'warrior'; player.job = 'knight'; player.master = 'dragoon';
    loadMap(mk, 300);
  }, mapKey);
  await page.waitForTimeout(4000);
  return page.evaluate(async () => {
    game.paused = false;
    player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    player.skillCooldowns = {}; player._castLockUntil = 0; player.hitStun = 0;
    player.dragoonSlam = 0; player._slamPierceLeft = 0;
    game.monsters.length = 0;
    // Put the player on the map's REAL floor. loadMap spawns near the top and
    // the first thing under him on coralReef is a 360 px "surface" ledge at
    // y=80 -- casting from there, the 225 px apex clamps against the world
    // ceiling, the dive is 24 px long, and the test measures the ledge rather
    // than the skill. (The first run of this test reported "rose -12px" for
    // exactly that reason.) Find the lowest 'ground' platform and drop there.
    let floor = null;
    for (const pl of game.mapData.platforms) if (pl.type === 'ground' && (!floor || pl.y > floor.y)) floor = pl;
    player.x = floor.x + Math.min(600, floor.w / 2); player.y = floor.y - player.h - 2; player.vy = 0;
    game.camera.y = Math.max(0, player.y - 300);
    for (let i = 0; i < 120 && !player.onGround; i++) await sleep(16);
    const floorY = player.y;
    const tgt = spawnMonster(player.x + 60, player.y, 'slime', false);
    if (tgt) { tgt.maxHp = 1e9; tgt.currentHp = 1e9; tgt.atk = 0; tgt.speed = 0; tgt.flies = false; }
    const hp0 = tgt ? tgt.currentHp : 0;
    // wait for the target to settle too, so the apex is measured from a still mob
    await sleep(300);
    castSkill('dragoon_skylance');
    const apexY = player.y;
    // Sample on requestAnimationFrame, not a setTimeout poll: vy is rewritten
    // every game frame, and a timer that fires between frames reads whatever
    // the last frame left -- a throttled headless tab made an 8 ms poll see a
    // "peak" of exactly the buoyancy cap while the real dive hit 12 px/frame.
    const t0 = performance.now();
    let slamAt = null, peakVy = 0, landedY = null;
    for (let f = 0; f < 180; f++) {
      await new Promise(r => requestAnimationFrame(r));
      if (player.vy > peakVy) peakVy = player.vy;
      if (slamAt == null && player.dragoonSlam === 0 && player.onGround) {
        slamAt = performance.now() - t0; landedY = player.y;
      }
      if (slamAt != null && f > 100) break;
    }
    const dmg = tgt ? (hp0 - tgt.currentHp) : 0;
    return {
      underwater: !!(game.mapData && game.mapData.isUnderwater),
      apexRise: Math.round(floorY - apexY),
      slamAt: slamAt == null ? null : Math.round(slamAt),
      peakVy: +peakVy.toFixed(1),
      landedBack: landedY == null ? null : Math.abs(landedY - floorY) < 8,
      dmgRatio: +(dmg / getAtk()).toFixed(1),
    };
  });
};

const water = await runOn('coralReef');
const land = await runOn('forest');
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });
ok('the test map is actually underwater', water.underwater, `coralReef isUnderwater=${water.underwater}`);
ok('underwater: the cast lifts the player to an apex', water.apexRise > 100, `rose ${water.apexRise}px`);
// The threshold is RELATIVE to the land run, not absolute: the skill chains a
// second dive at 450 ms (which re-teleports the player mid-fall and restarts
// the descent), so the first resolved slam legitimately lands later than one
// clean drop would. What must not happen is the baseline's "never".
ok('underwater: the dive SLAMS the ground', water.slamAt != null && water.slamAt < Math.max(1800, land.slamAt * 2.5),
   water.slamAt == null ? 'never slammed in 3s' : `slammed at ${water.slamAt}ms (land ${land.slamAt}ms)`);
ok('underwater: the dive is a dive, not a sink', water.peakVy >= 8,
   `peak fall speed ${water.peakVy} px/frame (the buoyancy cap is 3)`);
ok('underwater: the impact deals slam damage', water.dmgRatio >= 3,
   `${water.dmgRatio}x ATK on the target`);
ok('land control: still slams within 1.2s', land.slamAt != null && land.slamAt < 1200,
   land.slamAt == null ? 'never' : `${land.slamAt}ms`);
ok('land control: still deals slam damage', land.dmgRatio >= 3, `${land.dmgRatio}x ATK`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
