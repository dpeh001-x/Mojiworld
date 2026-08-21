// ELEMENTAL APOTHEOSIS — hold to charge, release the sphere.
// ============================================================================
// Per tester: "u can hold to charge, when charging, deal damage around u, then
// u let go the sphere gets launched across the map" (confirmed: the B slot).
//
// Driven through the REAL input path — tryStartClassCharge on key-down and
// tryReleaseClassCharge on key-up — because the whole change is about what
// holding a key does. Calling castSkill directly would skip the mechanic
// entirely and pass on a build that had none of it.
//
// The three properties that matter:
//   * the mage can charge this skill AT ALL (the meter was warrior/archer only)
//   * holding deals damage around the player, and a longer hold deals more
//   * releasing launches a projectile that crosses the map, scaled by charge
// Plus the guard that keeps the opening narrow: an ordinary mage spell must
// still cast instantly, or every spell in the class silently became a hold.
// Run: node scripts/apotheosis_charge_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9475;
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
await page.fill('#hero-name-input', 'ApoTest');
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
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'elementalist';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Which physical key drives the 'b' slot?
  let bKey = null;
  for (const k of Object.keys(KEY_TO_SLOT)) if (KEY_TO_SLOT[k] === 'b') { bKey = k; break; }

  const reset = () => {
    player.skillCooldowns = {}; player.mp = 999999;
    player._warCharge = null; player._releasedCharge = null;
    // The cast lock must be cleared too, not just the cooldown. isReady()
    // refuses any non-basic skill while _castLockUntil is live, and an earlier
    // section's cast (or the poll loop auto-casting a key this test held down)
    // leaves one behind -- which shows up as "the charge would not start" and
    // looks exactly like a broken mechanic.
    player._castLockUntil = 0;
    player.hitStun = 0;
    game.projectiles.length = 0; game.monsters.length = 0;
    player.x = 400;
  };
  // A punching bag that cannot die, move, or fight back.
  const dummy = (dx) => {
    const m = spawnMonster(player.x + dx, player.y, 'slime', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m.speed = 0; }
    return m;
  };
  // Hold the key for `frames` worth of real time, then release.
  // Hold until the meter reaches a TARGET POWER rather than for a fixed number
  // of milliseconds. The meter advances in game.time FRAMES and headless runs
  // at ~55 fps, so a wall-clock hold never quite reaches full charge -- the
  // first run of this test read 0.89 at 1600 ms and under-reported every
  // charge-scaling number as a result.
  const holdToPower = async (target, maxMs) => {
    game.keys[bKey] = true;
    tryStartClassCharge(bKey);
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      if (!player._warCharge) break;                    // cancelled (hit-stun)
      if (player._warCharge.power >= target) break;
      await sleep(16);
    }
    const chargedPower = player._warCharge ? player._warCharge.power : null;
    tryReleaseClassCharge(bKey);
    game.keys[bKey] = false;
    return chargedPower;
  };

  // ---- 1. the mage can start a charge on this skill ----------------------
  reset();
  game.keys[bKey] = true;
  const started = tryStartClassCharge(bKey);
  const chargingId = player._warCharge ? player._warCharge.skillId : null;
  const chargeFrames = player._warCharge ? player._warCharge.frames : null;
  await sleep(400);
  const powerMid = player._warCharge ? +player._warCharge.power.toFixed(2) : null;
  tryReleaseClassCharge(bKey); game.keys[bKey] = false;
  await sleep(200);

  // ---- 2. an ordinary mage spell must NOT become a hold ------------------
  reset();
  let qKey = null;
  for (const k of Object.keys(KEY_TO_SLOT)) if (KEY_TO_SLOT[k] === 'q') { qKey = k; break; }
  game.keys[qKey] = true;
  const qStarted = tryStartClassCharge(qKey);
  player._warCharge = null; game.keys[qKey] = false;

  // ---- 3. holding deals damage AROUND the player, and NOTHING is fired yet
  // The second half is what makes this test mean anything. Simply holding the
  // key deals damage on the OLD build too -- the poll loop auto-casts while a
  // key is down, and the old ultimate's novas hit the bystander. The property
  // that separates a charge from an instant cast is that the sphere has not
  // launched yet: damage accruing with ZERO projectiles in flight.
  reset();
  const near = dummy(200);   // inside the pulse radius, outside contact range
  const hp0 = near ? near.currentHp : 0;
  game.keys[bKey] = true;
  const t3started = tryStartClassCharge(bKey);
  const tH = Date.now();
  while (Date.now() - tH < 2600) {
    if (!player._warCharge) break;
    if (player._warCharge.power >= 0.85) break;
    await sleep(16);
  }
  const t3charge = player._warCharge ? +player._warCharge.power.toFixed(2) : null;
  const chargeDmg = near ? (hp0 - near.currentHp) : 0;
  // THE discriminator. A cast stamps its cooldown the instant it happens, so
  // "cooldown still zero while damage is landing" is true only for a charge.
  // (Counting projectiles instead does NOT work: the old ultimate scheduled its
  // beam at 1700 ms, so a sample taken at 1100 ms sees zero on both builds and
  // the check passes for a reason that has nothing to do with charging.)
  const cdDuringHold = Math.round(player.skillCooldowns['elementalist_ult'] || 0);
  const projDuringHold = game.projectiles.filter(p => p.owner === 'player').length;
  tryReleaseClassCharge(bKey); game.keys[bKey] = false;
  await sleep(160);
  const cdAfterRelease = Math.round(player.skillCooldowns['elementalist_ult'] || 0);
  const projAfterRelease = game.projectiles.filter(p => p.owner === 'player').length;
  await sleep(300);

  // ---- 4. a longer hold deals more charge damage -------------------------
  // Sampled BEFORE the release, exactly like the long hold above. Measuring
  // this one after release folded in the release nova, which made a 22% charge
  // look nearly as damaging as an 87% one (1185 vs 1761) -- an artefact of the
  // two samples being taken at different points, not a property of the skill.
  reset();
  const nearShort = dummy(200);
  const hpS0 = nearShort ? nearShort.currentHp : 0;
  game.keys[bKey] = true;
  tryStartClassCharge(bKey);
  const tS = Date.now();
  while (Date.now() - tS < 900) {
    if (!player._warCharge) break;
    if (player._warCharge.power >= 0.30) break;
    await sleep(16);
  }
  const shortCharge = player._warCharge ? +player._warCharge.power.toFixed(2) : null;
  const shortDmg = nearShort ? (hpS0 - nearShort.currentHp) : 0;
  tryReleaseClassCharge(bKey); game.keys[bKey] = false;
  await sleep(300);

  // ---- 5. release launches a sphere that crosses the map -----------------
  reset();
  player.facing = 1;
  await holdToPower(1.0, 3000);
  await sleep(60);
  const shot = game.projectiles.find(p => p.owner === 'player' && p.skill === 'voidbeam');
  const shotInfo = shot ? { w: Math.round(shot.w), dmg: Math.round(shot.damage), vx: +shot.vx.toFixed(1), life: shot.life, pierce: !!shot.pierce } : null;
  const x0 = shot ? shot.x : 0;
  await sleep(700);
  const stillAlive = shot ? (game.projectiles.indexOf(shot) >= 0) : false;
  const travelled = shot ? Math.round(Math.abs(shot.x - x0)) : 0;

  // ---- 6. charge scales the sphere ---------------------------------------
  reset(); player.facing = 1;
  await holdToPower(0.05, 200);
  await sleep(60);
  const weak = game.projectiles.find(p => p.owner === 'player' && p.skill === 'voidbeam');
  const weakDmg = weak ? Math.round(weak.damage) : 0;
  const weakW = weak ? Math.round(weak.w) : 0;

  const atk = getAtk();
  return {
    bKey, started, chargingId, chargeFrames, powerMid, qStarted,
    chargeDmg: Math.round(chargeDmg), shortDmg: Math.round(shortDmg),
    projDuringHold, projAfterRelease, cdDuringHold, cdAfterRelease, t3started, t3charge, shortCharge,
    chargeRatio: atk > 0 ? +(chargeDmg / atk).toFixed(2) : 0,
    shotInfo, travelled, stillAlive, weakDmg, weakW, atk: Math.round(atk),
    hasConst: typeof LX_APO_CHARGE_FRAMES !== 'undefined' ? LX_APO_CHARGE_FRAMES : null,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });

ok('the mage can start a charge on Apotheosis', R.started === true && R.chargingId === 'elementalist_ult',
   `started=${R.started} skill=${R.chargingId}`);
ok('it uses the longer ultimate charge window', R.chargeFrames >= 80,
   `${R.chargeFrames} frames (warrior charge is 45)`);
ok('the charge meter actually fills while held', R.powerMid !== null && R.powerMid > 0.1,
   `power after ~400ms = ${R.powerMid}`);
ok('ordinary mage spells still cast instantly (opening stays narrow)', R.qStarted === false,
   `Q slot startCharge returned ${R.qStarted}`);
ok('holding deals damage around the player', R.chargeDmg > 0,
   `${R.chargeDmg} damage to a bystander while charging to ${R.t3charge} (${R.chargeRatio}x ATK)`);
ok('the skill has NOT been cast while the key is held (a charge, not an instant cast)',
   R.cdDuringHold === 0 && R.cdAfterRelease > 1000,
   `cooldown during the hold: ${R.cdDuringHold}ms (a cast would have stamped it); after release: ${R.cdAfterRelease}ms`);
ok('the damage during the hold comes from the CHARGE, not from an auto-cast',
   R.chargeDmg > 0 && R.cdDuringHold === 0,
   `${R.chargeDmg} damage dealt with the cooldown still at ${R.cdDuringHold}`);
ok('a longer hold deals more charge damage', R.chargeDmg > R.shortDmg * 1.5,
   `charge-only damage: ${R.chargeDmg} at ${R.t3charge} power vs ${R.shortDmg} at ${R.shortCharge}`);
ok('releasing launches a piercing sphere', !!R.shotInfo && R.shotInfo.pierce,
   R.shotInfo ? JSON.stringify(R.shotInfo) : '(no projectile)');
ok('the sphere crosses the map', R.travelled > 400 && R.stillAlive,
   `travelled ${R.travelled}px in 0.7s and is still alive`);
ok('charge scales the sphere damage', R.shotInfo && R.weakDmg > 0 && R.shotInfo.dmg > R.weakDmg * 1.5,
   `full ${R.shotInfo ? R.shotInfo.dmg : 0} vs tap ${R.weakDmg}`);
ok('charge scales the sphere size', R.shotInfo && R.weakW > 0 && R.shotInfo.w > R.weakW,
   `full ${R.shotInfo ? R.shotInfo.w : 0}px vs tap ${R.weakW}px`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
