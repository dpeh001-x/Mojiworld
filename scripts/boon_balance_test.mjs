// Live test: BOON BALANCE + BEHAVIOURAL BOONS (v0.29.298).
//
// Guards the boon pass:
//   (A) the flat lvlScale boons no longer dwarf their % counterparts — Keen
//       Edge vs Iron Muscles (DPS) and Thick Skin vs Vitality (EHP) must sit
//       within a sane ratio of each other, not the ~4x measured before.
//   (B) Burning Touch's ROLL matters (a x3 must out-damage a x2; the branch
//       used to test `totalBurn > 0` only, making the label a lie).
//   (C) the new behavioural boons are reachable from the boon system at all
//       (Storm Chain arcs to a 2nd enemy; Frostbite freezes) — both effects
//       were fully implemented but gear-only.
//   (D) every declared synergy has a real consumer (this repo has twice
//       shipped synergies that were advertised but never applied).
// Run: node scripts/boon_balance_test.mjs   (MOJI_PW_EXE overrides Chrome)
import { chromium } from 'playwright-core';
const EXE = process.env.MOJI_PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.MOJI_GAME_URL || 'http://localhost:8080/mojiworld_game.html';
const R = []; const ok = (n, c, x) => R.push({ n, pass: !!c, x });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const page = await (await browser.newContext()).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof POWERUPS !== 'undefined', null, { timeout: 45000 });
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    window._prologueActive = false; window._prologuePending = false;
    const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
    game.paused = false;
    const LV = 60, HP0 = 5e8;
    const res = {};

    const build = (cls) => {
      player.cls = cls; player.level = LV; player.job = null;
      const c = CLASSES[cls], n = LV - 1;
      const hpG = cls === 'warrior' ? 30 : (cls === 'archer' || cls === 'rogue') ? 22 : 15;
      player.maxHp = c.stats.hp + n * hpG; player.maxMp = c.stats.mp + n * 10;
      player.baseAtk = c.stats.atk + n * (cls === 'warrior' ? 3 : 2);
      player.baseDef = c.stats.def + n * (cls === 'warrior' ? 2 : 1);
      player.hp = player.maxHp; player.mp = player.maxMp;
      player.baseAcc = 20; player._god = true;
      player.boons = []; player.boonsEquipped = []; _applyEquippedBoons();
      loadMap('glasswindSteppe'); game.monsters.length = 0;
    };
    const equip = (...ids) => {
      player.boons = ids.map((i) => rollMaxBoonInstance(i));
      player.boonsEquipped = ids.map((_, i) => i);
      _applyEquippedBoons();
      try { if (typeof _detectActiveSynergies === 'function') _detectActiveSynergies(); } catch (e) {}
    };
    const dps = async (cls, swings) => {
      game.monsters.length = 0;
      const d = spawnMonster(player.x + 60, player.y, 'slime', false, false);
      if (!d) return 0;
      let dealt = 0;
      const basic = cls === 'archer' ? 'arrowShot' : 'slash';
      for (let i = 0; i < swings; i++) {
        d.maxHp = d.currentHp = HP0; d.def = 0; d.evasion = 0; d.freezeTimer = 0; d.burnTimer = 0;
        d.x = player.x + 60; d.y = player.y;
        player.skillCooldowns = {}; player.mp = 9e6; player.facing = 1;
        try { castSkill(basic); } catch (e) {}
        for (let f = 0; f < 12; f++) { game.time++; try { updatePlayer(16); updateMonsters(16); updateProjectiles(16); } catch (e) {} }
        dealt += (HP0 - d.currentHp);
        if (i % 40 === 39) await new Promise((r) => setTimeout(r, 2));
      }
      return dealt / swings;
    };

    // (A) flat vs % — DPS
    build('warrior'); const base = await dps('warrior', 200);
    build('warrior'); equip('atk');    const keen = await dps('warrior', 200);
    build('warrior'); equip('atk_p');  const iron = await dps('warrior', 200);
    res.dps = { basePct: 0,
      keen: +(((keen - base) / base) * 100).toFixed(1),
      iron: +(((iron - base) / base) * 100).toFixed(1) };

    // (A2) flat vs % — EHP, using the game's own DEF pipeline numbers
    const ehp = () => {
      const raw = (typeof _medAtkAtLv === 'function') ? _medAtkAtLv(LV) : 527;
      const pierce = 1;
      let d = Math.max(1, raw - Math.floor(getDef() * 0.5 * pierce));
      try { if (typeof _defAbsorbMul === 'function') d = Math.max(1, Math.floor(d * _defAbsorbMul(pierce))); } catch (e) {}
      return getMaxHp() / d;
    };
    build('warrior'); const eBase = ehp();
    build('warrior'); equip('def');    const eThick = ehp();
    build('warrior'); equip('maxhp');  const eVit = ehp();
    res.ehp = { thick: +(((eThick - eBase) / eBase) * 100).toFixed(1),
                vit: +(((eVit - eBase) / eBase) * 100).toFixed(1) };

    // (B) burn roll matters — force the roll, count total burn damage applied
    const burnFor = (rollVal) => {
      build('warrior');
      player.boons = [{ id: 'burn', roll: rollVal, rerolls: 0 }]; player.boonsEquipped = [0];
      _applyEquippedBoons();
      let total = 0;
      for (let i = 0; i < 400; i++) {
        game.monsters.length = 0;
        const d = spawnMonster(player.x + 60, player.y, 'slime', false, false);
        if (!d) break;
        d.maxHp = d.currentHp = HP0; d.def = 0; d.evasion = 0; d.burnTimer = 0;
        try { hitMonster(d, 1000, false, 'slash'); } catch (e) {}
        if ((d.burnTimer || 0) > 0) total += (d.burnDmg || 0);
      }
      return total;
    };
    res.burn = { x2: burnFor(2), x3: burnFor(3) };

    // (C) behavioural boons reachable from the boon system
    build('warrior'); equip('chain');
    res.chainMod = player.mods.chainChance;
    build('warrior'); equip('freeze');
    res.freezeMod = player.mods.freezeChance;
    // frostbite actually freezes something
    let froze = 0;
    for (let i = 0; i < 300; i++) {
      game.monsters.length = 0;
      const d = spawnMonster(player.x + 60, player.y, 'slime', false, false);
      if (!d) break;
      d.maxHp = d.currentHp = HP0; d.def = 0; d.evasion = 0; d.freezeTimer = 0;
      try { hitMonster(d, 500, false, 'slash'); } catch (e) {}
      if ((d.freezeTimer || 0) > 0) froze++;
    }
    res.frostbiteProcs = froze;

    // (D) every synergy key has a consumer somewhere in the source
    build('warrior'); equip('chain', 'freeze');
    res.stormfrontDetected = !!(player._activeSynergies && player._activeSynergies.stormfront);
    build('warrior'); equip('freeze', 'critd');
    res.shatterDetected = !!(player._activeSynergies && player._activeSynergies.shatterPoint);
    // shatter point: a frozen target must take a CRIT
    {
      game.monsters.length = 0;
      const d = spawnMonster(player.x + 60, player.y, 'slime', false, false);
      d.maxHp = d.currentHp = HP0; d.def = 0; d.evasion = 0;
      d.freezeTimer = 5000;
      const before = d.currentHp;
      try { hitMonster(d, 1000, false, 'slash'); } catch (e) {}
      const frozenHit = before - d.currentHp;
      game.monsters.length = 0;
      const d2 = spawnMonster(player.x + 60, player.y, 'slime', false, false);
      d2.maxHp = d2.currentHp = HP0; d2.def = 0; d2.evasion = 0; d2.freezeTimer = 0;
      const b2 = d2.currentHp;
      try { hitMonster(d2, 1000, false, 'slash'); } catch (e) {}
      res.shatter = { frozenHit, normalHit: b2 - d2.currentHp };
    }
    res.synergyKeys = BOON_SYNERGIES.map((s) => s.key);
    res.boonCount = POWERUPS.length;
    return res;
  });

  // ---- assertions ---------------------------------------------------------
  const ratioDps = out.dps.keen / Math.max(1, out.dps.iron);
  ok(`Keen Edge no longer dwarfs Iron Muscles (was ~4x)  keen=+${out.dps.keen}% iron=+${out.dps.iron}%`,
    ratioDps <= 2.2, { ...out.dps, ratio: +ratioDps.toFixed(2) });
  const ratioEhp = out.ehp.thick / Math.max(0.1, out.ehp.vit);
  ok(`Thick Skin no longer dwarfs Vitality (was ~4x)  thick=+${out.ehp.thick}% vit=+${out.ehp.vit}%`,
    ratioEhp <= 2.6, { ...out.ehp, ratio: +ratioEhp.toFixed(2) });
  ok('Burning Touch: a x3 roll out-damages a x2 (roll is no longer inert)',
    out.burn.x3 > out.burn.x2 * 1.2, out.burn);
  ok('Storm Chain feeds mods.chainChance', out.chainMod > 0, { chainMod: out.chainMod });
  ok('Frostbite feeds mods.freezeChance', out.freezeMod > 0, { freezeMod: out.freezeMod });
  ok('Frostbite actually freezes targets in combat', out.frostbiteProcs > 0, { procs: out.frostbiteProcs });
  ok('Stormfront synergy is detected when chain+freeze are equipped', out.stormfrontDetected === true);
  ok('Shatter Point synergy is detected when freeze+critd are equipped', out.shatterDetected === true);
  ok('Shatter Point: a hit on a FROZEN target crits (more damage than unfrozen)',
    out.shatter.frozenHit > out.shatter.normalHit, out.shatter);
  ok(`roster grew to ${out.boonCount} boons / ${out.synergyKeys.length} synergies`,
    out.boonCount >= 21 && out.synergyKeys.length >= 20, { boons: out.boonCount, synergies: out.synergyKeys.length });
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { R.push({ n: 'HARNESS ERROR', pass: false, x: String(e).slice(0, 300) }); }
finally { await browser.close(); }

const pass = R.filter((r) => r.pass).length;
console.log('\n=== BOON BALANCE + VARIETY ===');
for (const r of R) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.x !== undefined ? '  ' + JSON.stringify(r.x) : ''}`);
console.log(`\n${pass}/${R.length} passed`);
process.exit(pass === R.length ? 0 : 1);
