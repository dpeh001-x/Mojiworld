// Batch 3 runtime verify — v2, after reading the implementations.
// Two harness bugs fixed from v1:
//   1. bigMelee/columnStrike require _bmOnScreen — the mob must be inside the
//      CAMERA viewport or the telegraph never starts. v1 never set the camera.
//   2. wrong detector fields: the real ones are _bigMeleeFiring/_bigMeleeT and
//      _dashing/_dashCharging/_dashPhase/_dashT (v1 watched _bigMeleeTel).
// Also: melee kits need close range while volleyShot rides the normal shoot
// cycle (needs shooting distance), so each mob is run at BOTH 70px and 250px
// and the results unioned.
import { chromium } from 'playwright-core';
const EXE = process.env.MOJI_PW_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
await page.goto('http://localhost:8080/mojiworld_game.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes !== 'undefined', null, { timeout: 45000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  game.paused = false;
  player.cls = 'warrior'; player.level = 45; player._god = true; player.baseAcc = 40;
  player.maxHp = 4000; player.hp = 4000; player.baseAtk = 200; player.baseDef = 120;
  loadMap('glasswindSteppe');
  const IDS = ['mushroom','sproutle','tidefish','tideling','gummy','cookie','cloudbun','frog',
    'blockPopo','blockHupo','horny','axolotl','fatLizard','blockEle','ticketMech',
    'expressTicketMech','clownfish','thunderMole','blockRhirhi','conductorMech',
    'jellyfish','pufferfish','seahorse'];
  const res = {};

  const runAt = async (id, dx) => {
    const hit = { tel: false, dash: false, proj: 0, hid: false, phased: false, moved: 0 };
    game.monsters.length = 0; game.projectiles.length = 0;
    const m = spawnMonster(600 + dx, 300, id, false, false);
    if (!m) return null;
    m.maxHp = m.currentHp = 400000;
    const x0 = m.x;
    for (let f = 0; f < 420; f++) {
      player.x = m.x - dx; player.y = m.y;
      // keep BOTH on camera — the on-screen guard gates bigMelee/columnStrike
      game.camera.x = Math.max(0, Math.min(player.x, m.x) - 200); game.camera.y = 0;
      game.time++;
      try { updatePlayer(16); updateMonsters(16); updateProjectiles(16); } catch (e) { return { err: String(e).slice(0, 80) }; }
      if (m._bigMeleeFiring || (m._bigMeleeT | 0) > 0) hit.tel = true;
      if (m._dashing || (m._dashCharging | 0) > 0 || (m._dashT | 0) > 0 || m._dashPhase || m._lateralDashing) hit.dash = true;
      if ((m.invulnerable | 0) > 0) hit.phased = true;
      if (m._hiding || (m._hideT | 0) > 0) hit.hid = true;
      hit.proj = Math.max(hit.proj, game.projectiles.filter((p) => p && p.owner === 'enemy').length);
      if (f % 60 === 59) await new Promise((r) => setTimeout(r, 4));
    }
    hit.moved = Math.abs(m.x - x0);
    hit.m = m;
    return hit;
  };

  for (const id of IDS) {
    const t = (monsterTypes[id] && monsterTypes[id].traits) || {};
    // dashCharge lives in MONSTER_SKILLS, not traits — include it so these
    // mobs aren't silently skipped now that the inert trait entries are gone.
    const sk = (typeof MONSTER_SKILLS !== 'undefined' && MONSTER_SKILLS[id]) || null;
    const declared = Object.keys(t).concat(sk ? ['skill:' + sk.kind] : []);
    res[id] = { declared, fired: [], err: null };
    if (!declared.length) continue;
    const near = await runAt(id, 70);
    const far = await runAt(id, 250);
    if (!near || !far) { res[id].err = 'spawn failed'; continue; }
    if (near.err || far.err) { res[id].err = near.err || far.err; continue; }
    const any = (k) => near[k] || far[k];
    const maxProj = Math.max(near.proj, far.proj);
    const maxMoved = Math.max(near.moved, far.moved);

    if (t.bigMelee && any('tel')) res[id].fired.push('bigMelee');
    if (t.lateralDash && (any('dash') || maxMoved > 40)) res[id].fired.push('lateralDash');
    if (sk && sk.kind === 'dashCharge' && any('dash')) res[id].fired.push('dashCharge(skill)');
    if (t.diveBomb) res[id].fired.push('diveBomb(flier)');
    if ((t.volleyShot || t.aimLead) && maxProj > 0) res[id].fired.push('ranged x' + maxProj);
    if (t.phasesOut && any('phased')) res[id].fired.push('phasesOut');

    // wounded-state traits need their own trigger
    if (t.lowHpHide) {
      const m = far.m; let hid = any('hid');
      m.currentHp = Math.floor(m.maxHp * 0.12);
      for (let f = 0; f < 260; f++) { game.time++; try { updateMonsters(16); } catch (e) {} if (m._hiding || (m._hideT | 0) > 0 || (m.invulnerable | 0) > 0) hid = true; if (f % 60 === 59) await new Promise((r) => setTimeout(r, 3)); }
      if (hid) res[id].fired.push('lowHpHide');
    }
    if (t.explodesOnDeath) {
      const m = far.m; const nP = game.particles.length;
      m.currentHp = 1; try { hitMonster(m, 9e6, false, 'slash'); } catch (e) {}
      for (let f = 0; f < 40; f++) { game.time++; try { updateMonsters(16); } catch (e) {} }
      if (game.particles.length > nP) res[id].fired.push('explodesOnDeath');
    }
  }
  return res;
});
let ok = 0, quiet = 0;
console.log('=== BATCH 3 RUNTIME VERIFY (v2: camera set, real fields, 2 distances) ===');
for (const [id, r] of Object.entries(out)) {
  const st = r.err ? 'ERR ' + r.err : (r.fired.length ? 'fired: ' + r.fired.join(',') : 'NO OBSERVABLE EFFECT');
  if (r.fired.length) ok++; else if (!r.err) quiet++;
  console.log(`  ${id.padEnd(20)} [${r.declared.join(',')}] -> ${st}`);
}
console.log(`\n${ok} fired, ${quiet} quiet`);
console.log('PAGE ERRORS:', errs.slice(0, 3));
await browser.close();
