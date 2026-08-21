// DEADEYE — a 5-second railshot window, not one rail.
// ============================================================================
// Per tester: "For 5 Seconds, shoot as many railshots as u want", with the
// class split stated outright: "Ballista - shoot arrows like machine gun /
// Bowmaster - high impact fast shot". ("Bowmaster" is the Marksman.)
//
// What the test has to pin, in both directions:
//   * MANY shots come out of one press-and-repeat, where the old skill fired
//     exactly one rail and then sat on a 22 s cooldown;
//   * the window CLOSES. This is the half that is easy to get wrong: the shots
//     cannot know which of them is last, so if the cooldown is left to the last
//     shot the skill simply stays available forever behind one short gate.
//   * it stays "high impact, not spray" -- a per-shot gate, so Marksman cannot
//     out-machine-gun Ballista, and each rail still hits hard.
// Run: node scripts/deadeye_window_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9479;
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
await page.fill('#hero-name-input', 'DeadeyeTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*archer\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'archer'; player.job = 'sniper'; player.master = 'marksman';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const reset = () => {
    player.skillCooldowns = {}; player.mp = 999999;
    player._castLockUntil = 0; player.hitStun = 0;
    player._deadeyeUntil = 0; player._warCharge = null; player._releasedCharge = null;
    game.projectiles.length = 0; game.monsters.length = 0;
    player.x = 400; player.facing = 1;
  };
  const rails = () => game.projectiles.filter(p => p.owner === 'player' && p.skill === 'oneshot').length;

  // ---- 1. how many rails does one activation yield in 5s? ----------------
  // Press whenever the game says the skill is ready, for six seconds. This is
  // exactly what a player mashing the key does.
  reset();
  let shots = 0;
  const firstMp = player.mp;
  let mpAfterFirst = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 5200) {
    if (isReady('marksman_oneshot')) {
      castSkill('marksman_oneshot');
      shots++;
      if (shots === 1) mpAfterFirst = player.mp;
      game.projectiles.length = 0;   // keep the array small; we count casts
    }
    await sleep(20);
  }
  const mpAfterWindow = player.mp;
  // ---- 2. the window must CLOSE ------------------------------------------
  await sleep(400);
  const cdAfterWindow = Math.round(player.skillCooldowns['marksman_oneshot'] || 0);
  let lateShots = 0;
  const t1 = Date.now();
  while (Date.now() - t1 < 1500) {
    if (isReady('marksman_oneshot')) { castSkill('marksman_oneshot'); lateShots++; }
    await sleep(20);
  }

  // ---- 2b. a follow-up shot inside the window must be free ---------------
  reset();
  castSkill('marksman_oneshot');            // opens the window, pays MP
  await sleep(500);                          // clear the per-shot gate
  let mpFollowUp = null;
  {
    const t2 = Date.now();
    while (Date.now() - t2 < 1500) {
      if (isReady('marksman_oneshot')) {
        const before = player.mp;
        castSkill('marksman_oneshot');
        mpFollowUp = Math.round(before - player.mp);
        break;
      }
      await sleep(20);
    }
  }

  // ---- 3. per-shot damage: heavy, not chip -------------------------------
  reset();
  const atk = getAtk();
  castSkill('marksman_oneshot');
  await sleep(50);
  const r = game.projectiles.find(p => p.owner === 'player' && p.skill === 'oneshot');
  const railInfo = r ? { dmg: Math.round(r.damage), pierce: !!r.pierce, crit: !!r.alwaysCrit, w: r.w } : null;

  // ---- 4. it must never become a hold-to-draw ----------------------------
  reset();
  let xKey = null;
  for (const k of Object.keys(KEY_TO_SLOT)) if (KEY_TO_SLOT[k] === 'x') { xKey = k; break; }
  game.keys[xKey] = true;
  const startedCharge = tryStartClassCharge(xKey);
  player._warCharge = null; game.keys[xKey] = false;

  // ---- 5. a second window is gated behind the real cooldown --------------
  reset();
  castSkill('marksman_oneshot');
  // typeof-guarded: the constant does not exist on the pre-rework build, and an
  // unguarded reference throws instead of producing a real FAIL.
  await sleep(((typeof LX_DEADEYE_MS !== 'undefined') ? LX_DEADEYE_MS : 5000) + 500);
  const cdBetweenWindows = Math.round(player.skillCooldowns['marksman_oneshot'] || 0);

  return {
    shots, lateShots, cdAfterWindow, cdBetweenWindows,
    mpFirstCost: firstMp - mpAfterFirst,
    mpWholeWindow: firstMp - mpAfterWindow, mpFollowUp,
    railInfo, atk: Math.round(atk),
    dmgRatio: railInfo && atk > 0 ? +(railInfo.dmg / atk).toFixed(2) : 0,
    windowMs: typeof LX_DEADEYE_MS !== 'undefined' ? LX_DEADEYE_MS : null,
    gateMs: typeof LX_DEADEYE_GATE_MS !== 'undefined' ? LX_DEADEYE_GATE_MS : null,
    startedCharge,
    name: SKILLS.marksman_oneshot.name,
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });

ok('one activation yields many rails, not one', R.shots >= 8,
   `${R.shots} rails fired in a 5s window (the old skill fired exactly 1)`);
ok('it is a window, not a machine gun', R.shots <= 16,
   `${R.shots} rails — a per-shot gate keeps Marksman "high impact", not Ballista's spray`);
ok('the window CLOSES and stamps the real cooldown', R.cdAfterWindow > 10000,
   `cooldown ${R.cdAfterWindow}ms once the 5s elapsed`);
ok('no shots are possible after the window closes', R.lateShots === 0,
   `${R.lateShots} shots landed in the 1.5s after it closed`);
ok('a second window waits out the full cooldown', R.cdBetweenWindows > 10000,
   `${R.cdBetweenWindows}ms`);
// Measured across ONE follow-up cast rather than across the window: MP regen
// ticks the whole time, so a window total is not a cost -- the first version of
// this check reported the whole window costing LESS than its opening shot.
ok('shots after the first are free (only the window costs MP)',
   R.mpFirstCost > 0 && R.mpFollowUp === 0,
   `opening shot ${R.mpFirstCost} MP; a follow-up inside the window ${R.mpFollowUp} MP`);
ok('each rail still hits hard and pierces', !!R.railInfo && R.railInfo.pierce && R.railInfo.crit && R.dmgRatio >= 1.5,
   R.railInfo ? `${R.railInfo.dmg} dmg (${R.dmgRatio}x ATK), pierce+autocrit` : '(no rail)');
ok('the window out-damages the old single rail', R.shots * R.dmgRatio > 12,
   `${R.shots} x ${R.dmgRatio}x = ~${Math.round(R.shots * R.dmgRatio)}x ATK vs the old ~6.5x base`);
ok('it never became a hold-to-draw', R.startedCharge === false,
   `archer charge on the X slot returned ${R.startedCharge}`);
ok('the skill is renamed to match what it now does', R.name === 'Deadeye', `name=${R.name}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
