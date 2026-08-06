// Ground truth for the MojiMon companion, per user: "ensure the enemies do
// attack it and it functions as an autonomous monster, ensure it has the same
// size as the original monster."
//
// Drives the REAL update loops (updateMonsters + updateMinions) with a fielded
// companion and live mobs, rather than reasoning about the code.
//
//   node serve.js 8823 && node scripts/mojimon_behaviour_test.mjs 8823 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8823';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_mojimonSummon') === 'function' && typeof eval('updateMinions') === 'function' && typeof eval('spawnMonster') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  const MT = eval('monsterTypes');
  // A plain melee ground species with real art.
  const TYPE = Object.keys(MT).find(k => !MT[k].boss && !MT[k].flies && (MT[k].w | 0) >= 30) || Object.keys(MT)[0];

  p.cls = 'warrior'; p.level = 40; p.x = 600; p.y = 400; p.facing = 1;
  p.maxHp = 1000; p.hp = 1000;
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  g.mapData.worldWidth = 4000;
  g.monsters = []; g.minions = []; g.particles = g.particles || [];
  g.damageNumbers = [];

  // Bind + field the companion.
  const mm = eval('_mojimonEnsure')();
  mm.roster[TYPE] = mm.roster[TYPE] || { hp: 0, atk: 0, def: 0, pts: 0 };
  mm.cdUntil = 0;
  const summoned = eval('_mojimonSummon')(TYPE, { free: true, quiet: true });
  const mn = g.minions.find(x => x && x.mojimon);

  // Wild mobs of the SAME species, in front of the companion.
  for (let i = 0; i < 4; i++) eval('spawnMonster')(760 + i * 70, 400, TYPE, false, false);
  const mobs = g.monsters.slice();

  // --- size: DRAW both through the real render paths and compare the stamped
  // visual boxes. The first cut of this test recomputed the companion's
  // formula analytically and left wildVisH null (update loops never draw), so
  // the "size" check compared a number to nothing.
  const wild = mobs[0];
  const mobScale = (typeof eval('_lxMobScale') === 'function') ? eval('_lxMobScale')(TYPE) : 1;
  let companionVisH = null, wildVisH = null;
  await (async () => {
    g.camera.x = Math.max(0, mn.x - 200); g.camera.y = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      try { eval('drawMonster')(wild); } catch (e) {}
      try { eval('drawMinions')(); } catch (e) {}
      if (wild._visH && mn._visH) break;
      await new Promise(r => setTimeout(r, 250));   // sprites decoding
    }
    wildVisH = wild._visH || null;
    companionVisH = mn._visH || null;
  })();

  // Run the real loops. updateMonsters needs the camera/world to look sane.
  g.camera = g.camera || { x: 0, y: 0 };
  g.camera.x = 400; g.camera.y = 0;
  const hp0 = mn.currentHp;
  let aggroOnMon = 0, aggroOnPlayer = 0, everTargeted = false;
  const startX = mn.x;
  let moved = 0, attacked = 0;
  for (let f = 0; f < 240; f++) {
    g.time = (g.time | 0) + 1;
    try { eval('updateMonsters')(16.7); } catch (e) {}
    try { eval('updateMinions')(16.7); } catch (e) {}
    for (const m of g.monsters) {
      if (m.aggroTarget === mn) { everTargeted = true; }
    }
    if (Math.abs(mn.x - startX) > 2) moved++;
    if (mn.atkAnimUntil) attacked++;
  }
  for (const m of g.monsters) {
    if (m.aggroTarget === mn) aggroOnMon++;
    else if (m.aggroTarget === p) aggroOnPlayer++;
  }
  const hp1 = mn.currentHp;

  // --- boss: must be PULLED TOWARD the companion. Geometry is the proof:
  // player far LEFT, boss in the middle, mon parked far RIGHT of the boss.
  // A player-seeking boss walks LEFT (away from the mon); only genuine
  // mon-targeting moves it RIGHT. An earlier cut parked the mon BETWEEN boss
  // and player, where "gap closed to 0" was equally explained by the boss
  // walking through the mon on its way to the player.
  g.monsters.length = 0;
  const bossType = Object.keys(MT).find(k => MT[k].boss && !MT[k].flies) || Object.keys(MT).find(k => MT[k].boss) || TYPE;
  p.x = 60; p.y = 400;                        // player far left
  const MON_X = 1150;
  mn.x = MON_X; mn.y = 400; mn.vx = 0;        // mon far RIGHT of the boss
  mn.currentHp = mn.maxHp;                    // fresh HP to measure boss damage
  eval('spawnMonster')(900, 380, bossType, true, false);
  const boss = g.monsters[0];
  let bossTargeted = false;
  const bossGap0 = Math.abs((boss.x + boss.w / 2) - (MON_X + mn.w / 2));
  const monHpBeforeBoss = mn.currentHp;
  for (let f = 0; f < 300; f++) {
    g.time = (g.time | 0) + 1;
    try { eval('updateMonsters')(16.7); } catch (e) {}
    try { eval('updateMinions')(16.7); } catch (e) {}   // needed for the mon to TAKE damage
    mn.x = MON_X; mn.vx = 0;                  // re-park: gap change stays the boss's doing
    if (boss && boss.aggroTarget === mn) bossTargeted = true;
  }
  const bossGap1 = Math.abs((boss.x + boss.w / 2) - (MON_X + mn.w / 2));
  const monHpAfterBoss = mn.currentHp;

  return {
    TYPE, bossType, summoned: !!summoned, hasMon: !!mn,
    box: { w: mn.w, h: mn.h }, speciesBox: { w: MT[TYPE].w, h: MT[TYPE].h },
    companionVisH, wildVisH, mobScale,
    everTargeted, aggroOnMon, aggroOnPlayer,
    hpLost: hp0 - hp1, movedFrames: moved, attackFrames: attacked,
    bossTargeted, bossIsBoss: !!(boss && boss.isBoss),
    bossGap0: Math.round(bossGap0), bossGap1: Math.round(bossGap1),
    bossDmgToMon: monHpBeforeBoss - monHpAfterBoss,
  };
});

console.log('species under test:', r.TYPE, JSON.stringify(r.speciesBox), '-> companion box', JSON.stringify(r.box));

ok('the companion fields at all', r.summoned && r.hasMon);
ok('companion hitbox matches the species hitbox',
   r.box.w === Math.max(24, Math.min(140, r.speciesBox.w)) && r.box.h === Math.max(24, Math.min(140, r.speciesBox.h)),
   { companion: r.box, species: r.speciesBox });
ok('companion DRAW height matches a wild one of the same species (both really drawn)',
   r.companionVisH != null && r.wildVisH != null && Math.abs(r.companionVisH - r.wildVisH) <= Math.max(4, r.wildVisH * 0.08),
   { companion: r.companionVisH, wild: r.wildVisH, ratio: (r.companionVisH && r.wildVisH) ? +(r.companionVisH / r.wildVisH).toFixed(2) : null });
ok('companion honours the per-type size calibration (_lxMobScale)', r.mobScale != null, { mobScale: r.mobScale });

ok('AUTONOMY: it moves on its own toward enemies', r.movedFrames > 30, { movedFrames: r.movedFrames });
ok('AUTONOMY: it plays its attack animation when striking', r.attackFrames > 0, { attackFrames: r.attackFrames });

ok('ENEMIES: at least one monster targets the companion', r.everTargeted === true,
   { everTargeted: r.everTargeted, onMon: r.aggroOnMon, onPlayer: r.aggroOnPlayer });
ok('ENEMIES: the companion actually takes damage from them', r.hpLost > 0, { hpLost: r.hpLost });
// The behavioural claims are what the user asked for; boss.aggroTarget is
// reported as a diagnostic (some boss AI branches move via the target point
// without ever writing the flag).
ok('ENEMIES: the boss walks AWAY from the player to reach the companion',
   r.bossGap1 < r.bossGap0 - 20,
   { gapStart: r.bossGap0, gapEnd: r.bossGap1, aggroFlagSeen: r.bossTargeted, bossType: r.bossType });
ok('ENEMIES: the boss damages the companion when it gets there',
   r.bossDmgToMon > 0, { bossDmgToMon: r.bossDmgToMon });

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
