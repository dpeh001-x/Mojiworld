// Two monster traits were declared on seven mobs and read by NOTHING:
// `traits.echoStrike` (echoKnight, towerSovereign) and `traits.hourglassCharge`
// (pathsBane, towerStalker, towerArbiter, towerSovereign, pqConductor).
//
// The load-bearing check here is that each trait now has a REAL runtime effect
// keyed to its own declaration — a test that only asserted "the code contains
// the word echoStrike" would pass on the broken build too. So this drives the
// live monster AI and proves:
//   • a swinger WITH the trait lands a second hitbox, one WITHOUT it does not
//   • the echo carries the authored damage (the dmgMul was pre-cut to pay for
//     it, so a half-damage echo would silently keep echoKnight under-tuned)
//   • the echo fires at the ORIGINAL strike position, not re-aimed at the
//     player — an echo that follows you is an undodgeable follow-up
//   • a dead mob's pending echo is dropped
//   • the hourglass lunge braces dead-still for its authored ms, then commits,
//     and publishes a danger zone during the brace
//   • the lunge adds no direct damage (its threat is the contact path)
// Run: node scripts/boss_dead_traits_test.mjs [file.html]
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  const out = {};
  // A neutral arena and a player the AI can see.
  loadMap('forest');
  // A REALISTIC pool, not an invulnerable one: zone-worthiness is measured as
  // raw attack vs 30% of the player's maxHp (LX_ZONE_DMG_PCT), so parking the
  // pool at 999999 would make every attack un-marked and the drawn-lane check
  // vacuously fail. hp is topped back up each tick instead (see the run loop).
  player.cls = 'warrior'; player.level = 60; player.maxHp = 1800; player.hp = 1800;
  player.x = 700; player.y = 300; player.w = 28; player.h = 44;

  const mk = (type, x) => {
    const t = monsterTypes[type];
    const m = { type, ...JSON.parse(JSON.stringify(t)), x, y: 300,
                currentHp: t.hp, maxHp: t.hp, facing: 1, vx: 0, vy: 0 };
    m.traits = JSON.parse(JSON.stringify(t.traits || {}));
    return m;
  };
  // Drive the real per-monster AI for n ticks, tallying enemy swing hitboxes.
  const run = (m, ticks, dt) => {
    game.monsters = [m];
    game.projectiles = [];
    const swings = [];
    let braceFrames = 0, movedDuringBrace = 0, zoneSeen = 0;
    let dashFrames = 0, dashTravel = 0, lastX = m.x;
    for (let f = 0; f < ticks; f++) {
      game.time++;
      const before = game.projectiles.length;
      try { updateMonsters(dt); } catch (e) { out.err = String(e); break; }
      for (let k = before; k < game.projectiles.length; k++) {
        const p = game.projectiles[k];
        if (p && p.owner === 'enemy' && p.skill === 'swing') {
          swings.push({ f, x: Math.round(p.x), dmg: p.damage, label: p._sourceLabel, color: p.color });
        }
      }
      if (m._hgCharging && m._hgPhase === 'dash') { dashFrames++; dashTravel += Math.abs(m.x - lastX); }
      lastX = m.x;
      if (m._hgCharging && m._hgPhase === 'brace') {
        braceFrames++;
        if (Math.abs(m.vx) > 0.01) movedDuringBrace++;
        try {
          const zones = (typeof _lxAttackZones === 'function') ? _lxAttackZones() : [];
          if (zones.some(z => z && z.kind === 'dash')) zoneSeen++;
        } catch (e) {}
      }
      player.x = 700; player.y = 300;   // pin: isolate the mob's behaviour
      player.hp = player.maxHp;             // survive without inflating the pool
    }
    return { swings, braceFrames, movedDuringBrace, zoneSeen, dashFrames, dashTravel: Math.round(dashTravel) };
  };

  // ---- ECHO STRIKE ------------------------------------------------------
  const ek = mk('echoKnight', 640);
  out.echoDeclared = ek.traits.echoStrike;
  ek._bigMeleeCd = 0;                         // arm the heavy immediately
  const a = run(ek, 260, 16);
  out.echoSwings = a.swings.length;
  out.echoShots = a.swings.map(s => ({ f: s.f, x: s.x, dmg: s.dmg }));
  if (a.swings.length >= 2) {
    const [s1, s2] = a.swings;
    out.echoGapMs = (s2.f - s1.f) * 16;
    out.echoSamePos = s1.x === s2.x;
    out.echoSameDmg = s1.dmg === s2.dmg;
    out.echoLabelled = /echo/i.test(String(a.swings[1].label || ''));
  }

  // A swinger WITHOUT the trait must still fire exactly one hitbox.
  const ctrl = mk('echoKnight', 640);
  delete ctrl.traits.echoStrike;
  ctrl._bigMeleeCd = 0;
  out.noTraitSwings = run(ctrl, 260, 16).swings.length;

  // A mob that dies mid-echo must not strike from beyond the grave.
  const dead = mk('echoKnight', 640);
  dead._bigMeleeCd = 0;
  game.monsters = [dead]; game.projectiles = [];
  let firedAfterDeath = 0, killed = false;
  for (let f = 0; f < 260; f++) {
    game.time++;
    const before = game.projectiles.length;
    try { updateMonsters(16); } catch (e) {}
    // Count only from the frame AFTER the kill: the frame that STAMPS the
    // echo is also the frame the original swing fires, and counting that one
    // would fail a correct build.
    if (killed) for (let k = before; k < game.projectiles.length; k++) {
      const p = game.projectiles[k];
      if (p && p.owner === 'enemy' && p.skill === 'swing') firedAfterDeath++;
    }
    if (!killed && dead._echoT > 0) { dead.currentHp = 0; killed = true; }   // die during the echo window
    player.x = 700; player.y = 300;
  }
  out.deathCancelled = (killed && firedAfterDeath === 0);
  out.deathWindowReached = killed;

  // ---- HOURGLASS CHARGE -------------------------------------------------
  const st = mk('towerStalker', 400);
  out.hgDeclared = st.traits.hourglassCharge;
  out.stalkerOtherTraits = Object.keys(st.traits).filter(k => k !== 'hourglassCharge');
  st._hgCd = 0;                                // arm the lunge immediately
  const startX = st.x;
  const b = run(st, 400, 16);
  out.hgBraceFrames = b.braceFrames;
  out.hgBraceMs = b.braceFrames * 16;
  out.hgMovedDuringBrace = b.movedDuringBrace;
  out.hgZoneFrames = b.zoneSeen;
  out.hgTravelled = Math.round(st.x - startX);
  out.hgDashFrames = b.dashFrames;
  out.hgDashTravel = b.dashTravel;
  out.hgNoDirectDamage = b.swings.length;      // the lunge must add no hitbox
  out.hgDirTowardPlayer = (st._hgDir === 1);   // player pinned to the right
  out.stalkerZoneFrames = b.zoneSeen;          // expected 0 — non-boss, by design

  // Drawn danger lanes are a BOSS-only affordance: _lxZoneWorthy returns false
  // for any non-boss, matching the established rule that a trash mob's dash is
  // "deliberately unmarked". So the lane assertion runs against a boss holder
  // of the same trait rather than against the stalker.
  // towerSovereign, not towerArbiter: worthiness is raw atk >= 30% of the
  // player pool, and the Arbiter's 340 sits under that bar for any realistic
  // pool — correctly unmarked. The Sovereign (atk 760 vs a 540 bar) is the
  // holder whose lunge the rule says SHOULD be drawn.
  const ar = mk('towerSovereign', 400);
  // Worthiness is raw atk >= 30% of getMaxHp(), and getMaxHp() is computed
  // from the full stat stack (measured 3510 here regardless of player.level),
  // so no roster boss clears the 1053 bar in this harness. Rather than tune
  // the harness until a number happens to pass, push this instance clearly
  // over the game's OWN bar and assert the lane appears — that is the
  // integration under test: when the game deems the lunge devastating, my
  // zone block must publish it.
  ar.atk = 5000;
  ar._hgCd = 0;
  const c = run(ar, 400, 16);
  out.arbBraceFrames = c.braceFrames;
  out.arbZoneFrames = c.zoneSeen;
  out.arbDashTravel = c.dashTravel;
  out.arbWorthy = (typeof _lxZoneWorthy === 'function') ? _lxZoneWorthy(ar, 1) : null;
  return out;
});

console.log('\nECHO STRIKE (echoKnight)');
check(r.echoDeclared === 500, 'trait declared at 500ms', r.echoDeclared);
check(r.echoSwings === 2, 'one heavy swing produces TWO hitboxes', r.echoShots);
check(r.echoGapMs >= 450 && r.echoGapMs <= 600, 'echo lands ~500ms later', r.echoGapMs);
check(r.echoSamePos === true, 'echo strikes the original position, not re-aimed', r.echoShots);
check(r.echoSameDmg === true, 'echo carries full authored damage (dmgMul was pre-cut for it)', r.echoShots);
check(r.echoLabelled === true, 'echo is attributed distinctly in the damage source');
check(r.noTraitSwings === 1, 'same mob WITHOUT the trait fires exactly one', r.noTraitSwings);
check(r.deathWindowReached === true, 'death-during-echo case was actually exercised');
check(r.deathCancelled === true, 'a dead mob fires no pending echo');

console.log('\nHOURGLASS CHARGE (towerStalker)');
check(r.hgDeclared === 2200, 'trait declared at 2200ms', r.hgDeclared);
check(r.stalkerOtherTraits.length === 0, 'this mob has NO other trait — stripping would leave it inert', r.stalkerOtherTraits);
check(r.hgBraceMs >= 2000 && r.hgBraceMs <= 2400, 'braces for its authored duration', r.hgBraceMs);
check(r.hgBraceFrames > 0 && r.hgMovedDuringBrace === 0, 'dead still during the brace — the tell is honest', { braceFrames: r.hgBraceFrames, moved: r.hgMovedDuringBrace });
check(r.stalkerZoneFrames === 0, 'non-boss lunge is deliberately UNMARKED (matches the lateralDash rule)', r.stalkerZoneFrames);
check(r.hgDashFrames > 0 && r.hgDashTravel > 300, 'commits to a real lunge (measured in the DASH phase, not walk drift)', { dashFrames: r.hgDashFrames, dashTravel: r.hgDashTravel });
check(r.hgDirTowardPlayer === true, 'lunges toward the player', r.hgDirTowardPlayer);
check(r.hgDashFrames > 0 && r.hgNoDirectDamage === 0, 'lunge adds no direct hitbox (contact path only)', { dashFrames: r.hgDashFrames, swings: r.hgNoDirectDamage });

console.log('\nHOURGLASS CHARGE — boss holder (towerSovereign)');
check(r.arbBraceFrames > 0, 'boss holder also braces', r.arbBraceFrames);
check(r.arbWorthy === true, 'the game deems this lunge zone-worthy (precondition)', r.arbWorthy);
check(r.arbZoneFrames > 0, 'a zone-worthy lunge PUBLISHES a drawn danger lane while bracing', r.arbZoneFrames);
check(r.arbDashTravel > 300, 'boss lunge commits its authored distance', r.arbDashTravel);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
if (r.err) check(false, 'no AI exception', r.err);
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
