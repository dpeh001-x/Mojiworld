// Live test: LIBRA'S SCALE LANTERNS + the slowing scale beam.
//
// Per user: "For libra boss slimes should not spawn on the same map, instead it
// should be lanternWisp, and there should be importance for libra boss fight
// mechanism with libra. Also when libra projectile touches, ensure that it
// slows player for about 3 seconds."
//
// Driven on a DETERMINISTIC clock (`game.time++; updateMonsters(16)`) through a
// really-spawned Libra, so the plates are the ones her own AI hangs, the shield
// factors are the ones the real damage path reads, and the beam is one she
// actually fired. Traps this file is built around, all paid for on this branch:
// a hand-built monster never runs the AI; requestAnimationFrame tests nothing
// because the page sits on the title screen with game.time frozen at 0; the
// arena is only ~800 px wide, so geometry is derived, not hardcoded.
//   node scripts/libra_scales_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof updateMonsters === 'function'
  && typeof updateProjectiles === 'function' && monsterTypes && monsterTypes.zodiac_libra, null, { timeout: 120000 });
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = {};
  game.paused = false;
  const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
  const reset = () => { player.maxHp = player.maxHp || maxHp; player.hp = maxHp;
    player.invulnerable = 0; player._god = false; player.blockTimer = 0; player._aegis = false;
    player.parryWindow = 0; player.vx = 0; player.vy = 0; player._lastDamageSource = null;
    player._slowTimer = 0; };
  reset();
  if (typeof MAPS !== 'undefined' && MAPS.zod_libra) {
    game.currentMap = 'zod_libra'; game.mapData = MAPS.zod_libra;
  }
  out.map = game.currentMap;
  out.isSanctuary = (typeof _lxIsSanctuary === 'function') ? _lxIsSanctuary() : null;
  const WW = (game.mapData && game.mapData.worldWidth) || 800;
  out.worldWidth = WW;
  game.monsters = []; game.projectiles = [];
  spawnMonster(Math.round(WW * 0.5), 380, 'zodiac_libra', true);
  const lib = game.monsters[0];
  if (!lib) { out.spawnFailed = true; return out; }
  const PX = Math.round(WW * 0.12);
  const park = () => { player.x = PX; player.y = 400; player.vx = 0; player.vy = 0; };
  const tick = (n) => { for (let i = 0; i < n; i++) { game.time++; park();
    player.hp = maxHp; game.paused = false; updateMonsters(16); } };

  // ---- the plates her AI hangs ----
  for (let i = 0; i < 90 && !(lib._orbA && lib._orbB); i++) tick(1);
  const A = lib._orbA, B = lib._orbB;
  out.plates = !!(A && B);
  if (!A || !B) return out;
  out.plateTypes = [A.type, B.type];
  out.plateNames = [A.name, B.name];
  out.plateFlies = [!!A.flies, !!B.flies];
  out.slimesOnMap = game.monsters.filter(x => x && x.type === 'slime').length;
  out.mapSpawnTypes = ((game.mapData && game.mapData.spawns) || []).map(s => s.type);
  out.bossMaxHp = lib.maxHp;
  out.plateHp = [A.maxHp, B.maxHp];
  out.plateSides = [Math.round((A.x + A.w / 2) - (lib.x + lib.w / 2)),
                    Math.round((B.x + B.w / 2) - (lib.x + lib.w / 2))];
  out.explodes = !!(A.traits && A.traits.explodesOnDeath);

  // ---- the shield the plates buy her ----
  out.shield2 = { on: !!lib._libraShield, factor: lib._libraShieldFactor };
  // Every measurement swings with a MISS-EXEMPT skill. Accuracy is not the
  // variable under test, and it was drowning the ones that are: a Lv 77 plate
  // against a title-screen character rolls the level-gap gate down to its 10%
  // hit floor, so hit after hit came back MISS and every shield reading was a
  // flat zero. 'thorns' is the game's own exemption for damage that is applied
  // rather than aimed - the shield multipliers downstream are untouched by it.
  const HITSKILL = 'thorns';
  const hitDelta = (mon, dmg) => { const h0 = mon.currentHp;
    hitMonster(mon, dmg, false, HITSKILL);
    const d = h0 - mon.currentHp; mon.currentHp = h0; return d; };
  // Overkill by 10x on purpose: a DARK lantern eats 75% of what you throw at
  // it, so a hit sized to exactly its remaining HP is absorbed down to a quarter
  // and the plate lives. The rule under test was quietly swallowing the kill.
  const kill = (mon) => hitMonster(mon, mon.currentHp * 10 + 99999, false, HITSKILL);
  const bossHitDelta = (dmg) => hitDelta(lib, dmg);
  out.bossDmgWith2 = bossHitDelta(4000);

  // ---- only the LIT lantern can really be broken ----
  const lit = A._libraOrbActive ? A : B, dark = A._libraOrbActive ? B : A;
  out.litDmg = hitDelta(lit, 2000);
  out.darkDmg = hitDelta(dark, 2000);

  // ---- and they swap, so you cannot camp one side ----
  const before = !!A._libraOrbActive;
  for (let i = 0; i < 600 && (!!A._libraOrbActive === before); i++) tick(1);
  out.swapped = (!!A._libraOrbActive !== before);
  out.swapTicks = null;

  // ---- breaking one pays: an EARNED stagger window ----
  lib._stagger = 0; lib._staggerCd = 0;
  kill(A);
  for (let i = 0; i < 300 && !lib._orbADead; i++) tick(1);
  out.afterA = { stagger: Math.round(lib._stagger || 0), orbADead: !!lib._orbADead,
    factor: lib._libraShieldFactor, shield: !!lib._libraShield,
    aHp: Math.round(A.currentHp), aDying: !!A._dying, aActive: !!A._libraOrbActive,
    stillLinked: lib._orbA === A, orbBLinked: lib._orbB === B, bHp: Math.round(B.currentHp) };
  out.staggerBonus = (typeof BOSS_STAGGER_BONUS === 'number') ? BOSS_STAGGER_BONUS : null;

  // A STAGGERED boss runs no AI at all - bossAI returns before dispatching to
  // the sign - so the second break is not booked until the first window lapses.
  // Tick it out rather than reading mid-stagger and calling the feature broken.
  kill(B);
  for (let i = 0; i < 300 && !lib._orbBDead; i++) tick(1);
  out.afterB = { orbBDead: !!lib._orbBDead, factor: lib._libraShieldFactor, shield: !!lib._libraShield };
  // let the earned window lapse so it cannot inflate the unshielded reading
  for (let i = 0; i < 400 && (lib._stagger || 0) > 0; i++) tick(1);
  out.bossDmgWith0 = bossHitDelta(4000);

  // ---- the beam ----
  game.projectiles = [];
  reset();
  for (let i = 0; i < 400 && !game.projectiles.some(p => p.skill === 'scale'); i++) tick(1);
  const beam = game.projectiles.find(p => p.skill === 'scale') || null;
  out.beam = beam ? { slow: beam.slow, label: beam.sourceLabel, skill: beam.skill } : null;

  // land one on the player and read the real slow
  out.speedBefore = (typeof getSpeed === 'function') ? getSpeed() : null;
  let landed = false, tries = 0;
  for (; tries < 40 && !landed; tries++) {
    game.projectiles = []; reset();
    game.projectiles.push({ x: player.x - 60, y: player.y + player.h / 2,
      vx: 10, vy: 0, w: 45, h: 18, life: 120, damage: 5,
      owner: 'enemy', skill: 'scale', color: '#ffcc66',
      slow: (beam && beam.slow) || 3000, sourceLabel: "Libra's scale beam" });
    for (let k = 0; k < 40 && !landed; k++) { game.time++; updateProjectiles(16);
      if ((player._slowTimer || 0) > 0) landed = true; }
  }
  out.landed = landed; out.landTries = tries;
  out.slowTimer = Math.round(player._slowTimer || 0);
  out.slowSource = player._lastDamageSource;
  out.speedSlowed = (typeof getSpeed === 'function') ? getSpeed() : null;

  // ---- and a projectile that does NOT declare a slow must not slow ----
  game.projectiles = []; reset();
  let plainLanded = false;
  for (let t = 0; t < 40 && !plainLanded; t++) {
    game.projectiles = []; reset();
    const hp0 = player.hp;
    game.projectiles.push({ x: player.x - 60, y: player.y + player.h / 2,
      vx: 10, vy: 0, w: 45, h: 18, life: 120, damage: 5,
      owner: 'enemy', skill: 'scale', color: '#ffcc66' });
    for (let k = 0; k < 40 && !plainLanded; k++) { game.time++; updateProjectiles(16);
      if (player.hp < hp0) plainLanded = true; }
  }
  out.plainLanded = plainLanded;
  out.plainSlow = Math.round(player._slowTimer || 0);

  game.monsters = []; game.projectiles = []; player._slowTimer = 0;
  return out;
});

const ratio = (r.bossDmgWith0 > 0) ? r.bossDmgWith2 / r.bossDmgWith0 : null;
ok('Libra hangs two scale plates and they are LANTERN WISPS',
  r.plates && r.plateTypes && r.plateTypes.every(t => t === 'lanternWisp'),
  { types: r.plateTypes, names: r.plateNames });
ok('NO slime is left anywhere on her map', r.slimesOnMap === 0 && !(r.mapSpawnTypes || []).includes('slime'),
  { map: r.map, slimesAlive: r.slimesOnMap, mapSpawnList: r.mapSpawnTypes });
ok('they FLY, so the pans hang either side of her rather than sitting on the floor',
  r.plateFlies && r.plateFlies.every(Boolean) && r.plateSides && r.plateSides[0] < 0 && r.plateSides[1] > 0,
  { flies: r.plateFlies, offsetsFromBoss: r.plateSides });
ok('...and breaking one in your face costs you - they explode on death', r.explodes, {});
ok('a plate is sized to the fight, and never weaker than the old flat 900',
  r.plateHp && r.plateHp.every(h => h === Math.max(900, Math.floor(r.bossMaxHp * 0.05))),
  { plateHp: r.plateHp, bossMaxHp: r.bossMaxHp, pctOfBoss: r.plateHp ? (r.plateHp[0] / r.bossMaxHp * 100).toFixed(1) + '%' : null });
ok('while both scales hang, Libra takes HALF damage',
  r.shield2 && r.shield2.on === true && r.shield2.factor === 0.5
  && ratio != null && Math.abs(ratio - 0.5) < 0.08,
  { factor: r.shield2 && r.shield2.factor, dmgShielded: r.bossDmgWith2, dmgUnshielded: r.bossDmgWith0, measuredRatio: ratio == null ? null : ratio.toFixed(3) });
ok('only the LIT lantern can really be broken - the dark one eats 75%',
  r.litDmg > 0 && r.darkDmg > 0 && (r.darkDmg / r.litDmg) < 0.35,
  { litHitFor: r.litDmg, darkHitFor: r.darkDmg, ratio: r.litDmg ? (r.darkDmg / r.litDmg).toFixed(2) : null });
ok('...and the scales tilt, so you cannot camp one side', r.swapped === true, {});
ok('breaking a scale opens an EARNED punish window on Libra',
  r.afterA && r.afterA.orbADead && r.afterA.stagger > 0,
  { staggerMs: r.afterA && r.afterA.stagger, damageBonusWhileOpen: r.staggerBonus });
if (process.env.LXDEBUG) console.log("afterA", JSON.stringify(r.afterA), "afterB", JSON.stringify(r.afterB));
ok('breaking one steps her shield, breaking both drops it entirely',
  r.afterA && r.afterA.factor === 0.75 && r.afterB && r.afterB.factor === 1.0 && r.afterB.shield === false,
  { afterFirstBreak: r.afterA && r.afterA.factor, afterSecondBreak: r.afterB && r.afterB.factor });
ok('the scale beam she fires carries a 3-second slow',
  r.beam && r.beam.slow === 3000, { beam: r.beam });
ok('...and landing it really slows the player for ~3 s',
  r.landed && Math.abs(r.slowTimer - 3000) <= 60, { slowTimerMs: r.slowTimer, source: r.slowSource, triesToLand: r.landTries });
ok('...which actually halves their movement speed',
  r.speedBefore > 0 && r.speedSlowed > 0 && Math.abs(r.speedSlowed / r.speedBefore - 0.5) < 0.02,
  { speedNormal: r.speedBefore, speedSlowed: r.speedSlowed });
ok('a projectile that does NOT declare a slow still does not slow',
  r.plainLanded && r.plainSlow === 0, { landed: r.plainLanded, slowTimer: r.plainSlow });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
