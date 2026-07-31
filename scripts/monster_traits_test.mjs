// Verify all 10 previously-dead traits now FIRE, each driven through its
// real trigger condition. One page, ten scenarios.
import { chromium } from 'playwright-core';
const EXE = 'C:\\Users\\dpeh0\\Mojiworld\\scripts'.length ? (process.env.MOJI_PW_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') : '';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
await page.goto('http://localhost:8080/mojiworld_game.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 45000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  game.paused = false;
  player.cls = 'warrior'; player.level = 75; player.baseAcc = 40;
  player.maxHp = 99999; player.hp = 99999; player.baseAtk = 300; player.baseDef = 100;
  loadMap('glasswindSteppe');
  const R = {};
  const fresh = (type, dx = 200) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(player.x + dx, player.y, type, false, false);
    if (m) { m.maxHp = m.currentHp = 1e6; }
    return m;
  };
  const tick = async (n, yieldEvery = 60) => {
    for (let f = 0; f < n; f++) {
      game.time++;
      try { updatePlayer(16); updateMonsters(16); updateProjectiles(16); } catch (e) { R._tickErr = String(e).slice(0, 120); }
      if (f % yieldEvery === yieldEvery - 1) await new Promise((r) => setTimeout(r, 4));
    }
  };

  // Count trait markers directly (evasion zeroed) so the roll is isolated
  // from the accuracy/evasion miss — the first version conflated the two
  // (hare evasion 230 pushed "negated" to 66 and masked the dodge count),
  // and a ±46px random walk can land back at start, so "moved" was flaky.
  const rollCount = (type, marker) => {
    const m = fresh(type); m.evasion = 0;
    const n0 = game.damageNumbers.length;
    for (let i = 0; i < 120; i++) hitMonster(m, 500, false, 'slash');
    return game.damageNumbers.slice(n0).filter((d) => d.text === marker).length;
  };
  // 1. parryChance 0.20 (bonebosn) — expect ~24/120 parry markers
  { const n = rollCount('bonebosn', '⚔ PARRY');
    R.parryChance = { parries: n, ok: n >= 10 && n <= 45 }; }
  // 2. phantomDodge 0.20 (glasswindHare) — expect ~24/120 dodge markers
  { const n = rollCount('glasswindHare', 'DODGE');
    R.phantomDodge = { dodges: n, ok: n >= 10 && n <= 45 }; }

  // 3. armorShield (smithgolem) — frontal hits should land ~half of flank hits
  { const m = fresh('smithgolem'); m.facing = -1;           // facing the player (player is left)
    let front = 0; for (let i = 0; i < 30; i++) { const h0 = m.currentHp; hitMonster(m, 1000, false, 'slash'); front += h0 - m.currentHp; }
    m.facing = 1;                                            // now facing away -> flank
    let flank = 0; for (let i = 0; i < 30; i++) { const h0 = m.currentHp; hitMonster(m, 1000, false, 'slash'); flank += h0 - m.currentHp; }
    R.armorShield = { front, flank, ratio: +(front / Math.max(1, flank)).toFixed(2), ok: front < flank * 0.75 }; }

  // 4. splitsOnHit (mirageStalker) — first strike spawns 2 mirages, no re-split
  { const m = fresh('mirageStalker'); const n0 = game.monsters.length;
    hitMonster(m, 500, false, 'slash'); const n1 = game.monsters.length;
    for (const o of game.monsters) if (o !== m && o.currentHp > 0) hitMonster(o, 100, false, 'slash');
    const n2 = game.monsters.length;
    R.splitsOnHit = { before: n0, after: n1, afterHittingMirages: n2, ok: n1 === n0 + 2 && n2 === n1 }; }

  // 5. phasesOut (boneWraith) — invulnerable windows appear over time
  { const m = fresh('boneWraith'); let invulnSeen = 0;
    for (let f = 0; f < 700; f++) { game.time++; updateMonsters(16); if ((m.invulnerable | 0) > 0) invulnSeen++; }
    R.phasesOut = { invulnFrames: invulnSeen, ok: invulnSeen > 10 }; }

  // 6. heatAura (forgewight) — standing beside it burns through iframes off
  { const m = fresh('forgewight', 80); player.x = m.x - 80; player.y = m.y; player._god = false; player.invulnerable = 0;
    const hp0 = player.hp; await tick(200, 40);
    R.heatAura = { lost: hp0 - player.hp, ok: player.hp < hp0 }; player.hp = 99999; }

  // 7. groundSpikes (shardlich) — STRICT attribution: the previous check
  // exited on ANY hp loss, so a stray melee/projectile hit could pass the
  // test with the spike never firing (seen live: lost=336, telFired=false).
  // Now positions are pinned EVERY frame (out of melee reach, inside spike
  // range), and the pass requires damage in the frames straddling an
  // ERUPTION (the _spikeFiring -> false transition).
  { const m = fresh('shardlich', 320); player.y = m.y;
    let spikeHit = false, eruptions = 0, wasFiring = false;
    for (let f = 0; f < 1400 && !spikeHit; f++) {
      player.x = m.x - 320; player.invulnerable = 0; player._god = false;
      const hpF = player.hp;
      game.time++;
      try { updatePlayer(16); updateMonsters(16); updateProjectiles(16); } catch (e) {}
      const firing = !!m._spikeFiring;
      if (wasFiring && !firing) { eruptions++; if (player.hp < hpF) spikeHit = true; }
      wasFiring = firing;
      if (f % 60 === 59) await new Promise((r) => setTimeout(r, 4));
    }
    R.groundSpikes = { eruptions, spikeHit, ok: eruptions >= 1 && spikeHit }; player.hp = 99999; }

  // 8. packCall (drownedCur) — aggro'd cur summons up to 2 allies
  { const m = fresh('drownedCur', 300); player.x = m.x - 300;
    await tick(400, 50);
    const curs = game.monsters.filter((o) => o.type === 'drownedCur').length;
    R.packCall = { curs, called: m._packCalled || 0, ok: curs >= 2 }; }

  // 9. summonsHounds (tombKeeper) — hounds rise on first engage
  { const m = fresh('tombKeeper', 300); player.x = m.x - 300;
    await tick(120, 40);
    const hounds = game.monsters.filter((o) => o.type === 'sepulchreHound').length;
    R.summonsHounds = { hounds, done: !!m._houndsDone, ok: hounds === 2 }; }

  // 10. packHunter (sepulchreHound) — bonus appears with 2+ packmates, decays alone
  { game.monsters.length = 0;
    const a = spawnMonster(player.x + 200, player.y, 'sepulchreHound', false, false);
    const b = spawnMonster(player.x + 260, player.y, 'sepulchreHound', false, false);
    const c = spawnMonster(player.x + 320, player.y, 'sepulchreHound', false, false);
    for (const m of [a, b, c]) if (m) { m.maxHp = m.currentHp = 1e6; }
    await tick(120, 40);
    const packed = a ? a._packBonus : 0;
    if (b) b.currentHp = 0; if (c) c.currentHp = 0;
    await tick(140, 40);
    R.packHunter = { packed, alone: a ? a._packBonus : 0, ok: packed === 1.35 && (a ? a._packBonus : 0) === 1 }; }

  return R;
});
let pass = 0, fail = 0;
console.log('=== DEAD-TRAIT IMPLEMENTATION VERIFY (10 traits) ===');
for (const [k, v] of Object.entries(out)) {
  if (k === '_tickErr') { console.log('TICK ERR:', v); continue; }
  const { ok, ...d } = v; ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${k.padEnd(14)} ${JSON.stringify(d)}`);
}
console.log(`\n${pass}/${pass + fail} traits fire correctly`);
console.log('PAGE ERRORS:', errs.slice(0, 4));
await browser.close();
process.exit(fail ? 1 : 0);
