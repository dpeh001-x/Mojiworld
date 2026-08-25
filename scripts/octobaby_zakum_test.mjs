// OCTOBABY — the arms gate the body, and they grow back (the Zakum loop).
// ============================================================================
// Per user: "improve the mechanics of octababy and the tentacles similar to how
// zakum from maplestory functions".
//
// Zakum's fight IS a loop: the body is not meaningfully hurtable while its arms
// live, you clear the arms, you burst the exposed body, the arms return.
//
// Octobaby had every part and none of the loop. Four tentacles with their own
// HP and status specials already existed, but the head's own source comment
// admitted the shape of it — "Killed legs simply die and stop firing — head
// fight continues" — so the arms were optional scenery and the head could be
// raced down with all four untouched.
//
// The multiplier checks below are measured as RATIOS against a neutral hit on
// the same monster, so DEF, traits and any global damage scaling cancel out
// instead of having to be modelled.
// Run: node scripts/octobaby_zakum_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9967);
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
await page.fill('#hero-name-input', 'Zakum');
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
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const wait = async (ms) => { const t = performance.now(); while (performance.now() - t < ms) { keepAlive(); await frame(); } };
  // Severing four arms pays out four lots of EXP, which opens a level-up modal
  // and PAUSES the game. Dismissing modals once at boot is not enough: measured,
  // bossAI stopped being called for the head after exactly 39 frames and the
  // head's stagger froze mid-decay at 455 — which read as "the break window
  // never opens" when the real cause was that nothing was updating at all.
  const keepAlive = () => {
    player.hp = getMaxHp(); player.invulnerable = 600;
    game.paused = false;
    for (let i = 0; i < 6; i++) {
      const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot();
      if (!r) break;
      r.style.display = 'none';
    }
  };
  const out = {};

  game.monsters.length = 0;
  const head = spawnMonster(player.x + 420, player.y - 40, 'octobaby', true);
  await wait(1200);                                  // let _octoInit run and spawn arms
  out.armsAtStart = Array.isArray(head._legRefs) ? head._legRefs.length : 0;
  out.armHp0 = out.armsAtStart ? head._legRefs[0].maxHp : null;

  // Keep the measurement out of the 50% enrage / submerge cutscene, and remove
  // DEF and the damage gate's neighbours as variables.
  const reset = () => {
    head.maxHp = 40000000; head.currentHp = 40000000;
    head.def = 0; head.invulnerable = 0; head._stagger = 0;
    head._virgoChanneling = false; head._dmgTakenMul = 1;
    // Defensive traits roll PER HIT and return early with zero damage on a
    // parry/dodge. A single-sample probe therefore reports 0 at random — which
    // is exactly what the first run of this test did, poisoning every ratio
    // that divided by it. Removed as a variable, and the probe takes a median
    // on top so one stray sample cannot decide a check.
    head.traits = null;
  };
  const probe = () => {
    const s = [];
    for (let k = 0; k < 5; k++) {
      reset();
      const before = head.currentHp;
      hitMonster(head, 100000, false, 'test');
      s.push(before - head.currentHp);
    }
    s.sort((a, b) => a - b);
    return s[2];
  };

  // --- multipliers, measured as ratios against a neutral hit -------------
  const savedRefs = head._legRefs;
  out.dmg4Arms = probe();                            // 4 arms alive
  head._legRefs = []; head._octoBreakT = 0;
  out.dmgNeutral = probe();                          // no arms, no window
  head._octoBreakT = 5000;
  out.dmgExposed = probe();                          // exposed window
  head._octoBreakT = 0; head._legRefs = savedRefs;   // put the arms back

  // --- the real loop: sever every arm, watch the fight change -----------
  reset();
  head._octoBroken = false; head._octoBreakT = 0; head._octoRegrowT = 0;
  // Arms carry evasion and defensive traits too, so one lethal hit is not
  // reliably lethal — the first run of this test left all four standing and
  // then reported "no break window", blaming the feature for a cull that had
  // never happened. Strip the traits and keep swinging until each is down.
  for (const leg of [...head._legRefs]) {
    leg.traits = null; leg.def = 0; leg.evasion = 0;
    for (let k = 0; k < 12 && leg.currentHp > 0; k++) hitMonster(leg, leg.maxHp + 1000, false, 'test');
  }
  // Killing the last arm makes the head REEL for 1.3s (the pre-existing
  // "a tentacle falls — Octobaby REELS" stagger), and bossAI returns early
  // while staggered — so the exposed window cannot open inside it. Sampling at
  // a flat 900ms therefore reported "the window never opens" for a window that
  // simply had not been reached yet. Wait for the state, with a ceiling.
  await wait(300);
  out.armsAfterCull = head._legRefs.length;
  const _bw = performance.now();
  while (performance.now() - _bw < 6000 && !((head._octoBreakT || 0) > 0)) { keepAlive(); await frame(); }
  out.breakOpened = (head._octoBreakT || 0) > 0;
  out.breakOpenedAfterMs = Math.round(performance.now() - _bw);
  out.dmgDuringBreak = probe();

  // Ride out the exposed window and the regrowth delay.
  const _t0 = performance.now();
  let regrown = 0, sawRegrowDelay = false;
  while (performance.now() - _t0 < 30000) {
    keepAlive(); reset();
    if ((head._octoRegrowT || 0) > 0) sawRegrowDelay = true;
    if (head._legRefs.length > 0) { regrown = head._legRefs.length; break; }
    await frame();
  }
  out.regrownCount = regrown;
  out.sawRegrowDelay = sawRegrowDelay;
  out.armGen = head._octoArmGen | 0;
  out.armHpGen1 = regrown ? head._legRefs[0].maxHp : null;
  reset();
  out.dmgAfterRegrow = probe();

  // --- the 30s mood pulse ------------------------------------------------
  // Driven by fast-forwarding the head's own cadence timer to just under the
  // threshold rather than idling for 30s of wall clock: the pulse still fires
  // through the real AI path, and the cadence VALUE is asserted separately so
  // shortening it in the source cannot pass unnoticed.
  out.ailmentMs = (typeof LX_OCTO_AILMENT_MS !== 'undefined') ? LX_OCTO_AILMENT_MS : null;
  player._poisonTimer = 0; player.freezeTimer = 0; player._skillLockTimer = 0; player.stunTimer = 0;
  head._octoMoodT = LX_OCTO_AILMENT_MS - 40;
  head._octoMoodTele = true;
  const _m0 = performance.now();
  while (performance.now() - _m0 < 4000) {
    player.hp = getMaxHp(); game.paused = false;
    if ((player._poisonTimer | 0) > 0 || (player.freezeTimer | 0) > 0
        || (player._skillLockTimer | 0) > 0 || (player.stunTimer | 0) > 0) break;
    await frame();
  }
  out.moods = {
    poison: Math.round(player._poisonTimer || 0),
    freeze: Math.round(player.freezeTimer || 0),
    silence: Math.round(player._skillLockTimer || 0),
    stun: Math.round(player.stunTimer || 0),
  };
  out.moodCount = Object.values(out.moods).filter(v => v > 0).length;

  // --- the MOOD LANCE ----------------------------------------------------
  // Fired through the real _lxOctoMaybeLance path on a live arm, then the
  // resulting projectile is inspected: every 4th shot must be the upgraded one,
  // and it must be non-homing (a homing 33% hit would be undodgeable).
  out.lanceEvery = (typeof LX_OCTO_LANCE_EVERY !== 'undefined') ? LX_OCTO_LANCE_EVERY : null;
  out.lanceFrac = (typeof LX_OCTO_LANCE_HP_FRAC !== 'undefined') ? LX_OCTO_LANCE_HP_FRAC : null;
  {
    const arm = head._legRefs[0];
    const seen = [];
    for (let k = 0; k < 8; k++) {
      const p = { vx: 2, vy: 0, w: 30, h: 30, color: '#ffee44', homing: true };
      const up = _lxOctoMaybeLance(arm, p);
      seen.push(up ? 1 : 0);
      if (up) out.lanceProj = { homing: !!p.homing, frac: p._radiance && p._radiance.frac,
                                stun: p.stunHit || 0, w: p.w, chance: p._radiance && p._radiance.chance };
    }
    out.lancePattern = seen.join('');
  }
  // What a lance actually costs the player, through the real damage path.
  {
    player._god = false;
    const before = player.hp = getMaxHp();
    const mh = getMaxHp();
    player.invulnerable = 0; player.blockTimer = 0;
    const arm = head._legRefs[0];
    const p = { x: player.x, y: player.y, w: 46, h: 46, vx: 0, vy: 0, life: 60,
                owner: 'enemy', skill: 'octoLeg', damage: 10, homing: false };
    _lxOctoMaybeLance(arm, p);            // arm shot count is already at a multiple
    for (let k = 0; k < 3 && !p._radiance; k++) _lxOctoMaybeLance(arm, p);
    game.projectiles.push(p);
    const _l0 = performance.now();
    while (performance.now() - _l0 < 2500 && player.hp >= before) { game.paused = false; await frame(); }
    out.lanceHpLost = before - player.hp;
    out.lanceHpFracActual = +(out.lanceHpLost / mh).toFixed(3);
    out.lanceStunned = (player.hitStun || 0) > 0 || (player.stunTimer || 0) > 0;
    player._god = true; player.hp = getMaxHp();
  }

  // --- CONTROL: an ordinary monster is untouched by any of this ----------
  const mob = spawnMonster(player.x + 200, player.y, 'horny', false);
  mob.def = 0; mob.maxHp = 4000000; mob.currentHp = 4000000;
  const mb = mob.currentHp; hitMonster(mob, 100000, false, 'test');
  out.dmgPlainMob = mb - mob.currentHp;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
const rNeutral = R.dmgNeutral || 1;
const r4 = R.dmg4Arms / rNeutral, rExp = R.dmgExposed / rNeutral, rBreak = R.dmgDuringBreak / rNeutral;

console.log(`  arms at start ${R.armsAtStart} (each ${R.armHp0} HP)`);
console.log(`  head damage — 4 arms ${R.dmg4Arms} (${r4.toFixed(3)}x) · neutral ${R.dmgNeutral} (1.000x) · exposed ${R.dmgExposed} (${rExp.toFixed(3)}x)`);
console.log(`  after severing all 4: ${R.armsAfterCull} left, break window ${R.breakOpened ? 'OPEN' : 'closed'}, damage ${rBreak.toFixed(3)}x`);
console.log(`  moods: ${JSON.stringify(R.moods)} on a ${R.ailmentMs}ms cadence, arms ${R.armHp0} HP each`);
console.log(`  regrowth: ${R.regrownCount} arms, generation ${R.armGen}, ${R.armHpGen1} HP each (gen0 was ${R.armHp0})`);

ok('the fight starts with 4 arms', R.armsAtStart === 4, `${R.armsAtStart} arms`);
ok('living arms gate the body — the head sheds most damage', r4 < 0.2,
   `${(r4 * 100).toFixed(1)}% gets through with 4 arms up (was 100% — arms were optional)`);
ok('severing every arm EXPOSES the body instead of ending the structure', R.breakOpened,
   'the all-arms-down state now opens a timed window rather than just going quiet');
ok('the exposed body takes bonus damage', rExp > 1.5 && rBreak > 1.5,
   `${rExp.toFixed(2)}x forced, ${rBreak.toFixed(2)}x through the real kill path`);
ok('the arms GROW BACK — the loop repeats', R.regrownCount === 4,
   `${R.regrownCount} arms returned as generation ${R.armGen}`);
ok('there is a telegraphed regrow delay, not an instant respawn', R.sawRegrowDelay,
   'the stumps-writhe window was observed before the new arms rose');
ok('each generation is weaker, so the loop converges', R.armHpGen1 != null && R.armHpGen1 < R.armHp0,
   `gen1 arms ${R.armHpGen1} HP vs gen0 ${R.armHp0}`);
// Guarded on the regrowth actually happening, and on the same <0.2 threshold as
// the opening gate check. As a bare "less than neutral" it passed on a run where
// ZERO arms had regrown — ordinary damage variance cleared the bar, so the check
// was reporting the gate re-armed when nothing had.
ok('...and the gate re-arms once they are back', R.regrownCount === 4 && (R.dmgAfterRegrow / rNeutral) < 0.2,
   `${(R.dmgAfterRegrow / rNeutral).toFixed(3)}x with ${R.regrownCount} new arms up`);
ok('the tentacles are way tankier', R.armHp0 >= 600000,
   `${R.armHp0} HP each — they were 50,000, a speed bump next to a 3.04M head`);
ok('every 4th shot from an arm is a MOOD LANCE', R.lancePattern === '00010001',
   `pattern over 8 shots: ${R.lancePattern} (1 = lance), LX_OCTO_LANCE_EVERY = ${R.lanceEvery}`);
ok('the lance is NOT homing — a 33% hit has to be dodgeable',
   !!(R.lanceProj && R.lanceProj.homing === false),
   `homing=${R.lanceProj && R.lanceProj.homing}, w=${R.lanceProj && R.lanceProj.w} (the ordinary status shot still homes)`);
ok('the lance is declared at 33% of max HP and always applies',
   !!(R.lanceProj && R.lanceProj.frac === 0.33 && R.lanceProj.chance === 1),
   `frac=${R.lanceProj && R.lanceProj.frac}, chance=${R.lanceProj && R.lanceProj.chance}`);
ok('a landed lance really costs about a third of the bar', R.lanceHpFracActual >= 0.25 && R.lanceHpFracActual <= 0.40,
   `took ${R.lanceHpLost} HP = ${(R.lanceHpFracActual * 100).toFixed(1)}% of max`);
ok('...and it stuns', R.lanceStunned, `hitStun/stunTimer set after the hit`);
ok('the mood pulse runs on a 30s cadence', R.ailmentMs === 30000, `LX_OCTO_AILMENT_MS = ${R.ailmentMs}`);
ok('every living arm inflicts its own ailment on the pulse', R.moodCount === 4,
   `${R.moodCount}/4 landed — ${JSON.stringify(R.moods)}`);
ok('CONTROL: an ordinary monster is unaffected', R.dmgPlainMob > 0 && Math.abs(R.dmgPlainMob - R.dmgNeutral) / rNeutral < 0.25,
   `plain mob took ${R.dmgPlainMob} vs the head's neutral ${R.dmgNeutral} — the gate is octobaby-only`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
