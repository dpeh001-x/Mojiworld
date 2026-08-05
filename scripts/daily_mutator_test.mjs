// Daily World Mutators — determinism, every effect channel measured through
// real spawns, boss exemption, reward bonus, and the announce path.
import { createRequire } from 'node:module';
const req = createRequire('file:///C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = req('playwright-core');
import { spawn } from 'node:child_process';
const PORT = 8994;
const server = spawn(process.execPath, ['C:/Users/dpeh0/Mojiworld/serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(() => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  player.cls = 'warrior'; player.level = 40; player.hp = 9999; player.maxHp = 9999;

  // ---- 1. determinism --------------------------------------------------
  // NOTE: pinning game._timeHW into the future does NOT work here — the
  // v0.26.1033 clock-rollback self-heal snaps a >6h-future mark back to now
  // (verified: it froze this test's 30 "days" onto one day). That guard doing
  // its job is itself worth recording:
  delete game._mutForce;
  game._timeHW = Date.now() + 30 * 86400000;
  _monoNow();
  ok('anti-cheat: future clock mark self-heals', game._timeHW <= Date.now() + 6 * 3600000,
     'HW snapped back');
  // Determinism is a property of the roll given a day number, so drive the
  // day directly by overriding dailyIndex (a reassignable global).
  const origDailyIndex = window.dailyIndex;
  window.dailyIndex = () => 20833;
  _mutCache = { day: -1, list: [] };
  const a = activeMutators().map(m => m.id).join(',');
  _mutCache = { day: -1, list: [] };
  const b = activeMutators().map(m => m.id).join(',');
  ok('same day rolls the same pair', a === b && a.split(',').length === 2, a);
  const pairs = new Set(); let dupBad = 0;
  for (let d = 0; d < 30; d++) {
    window.dailyIndex = () => 20833 + d;
    _mutCache = { day: -1, list: [] };
    const ids = activeMutators().map(m => m.id);
    if (ids.length !== 2 || ids[0] === ids[1]) dupBad++;
    pairs.add(ids.join(','));
  }
  window.dailyIndex = origDailyIndex;
  _mutCache = { day: -1, list: [] };
  ok('30 days: always 2 distinct mutators', dupBad === 0, `${dupBad} bad days`);
  ok('30 days: real variety (>=8 different pairs)', pairs.size >= 8, `${pairs.size} distinct pairs`);

  // ---- 2. effect channels through REAL spawns --------------------------
  loadMap('forest'); game.paused = false;
  // A rich mob, not slime: slime's post-multiplier rewards are single-digit
  // (coins 11, exp 2), so Math.floor turns a x1.40 into 11->16 = x1.4545 and
  // the ratio assertions drown in rounding. cosmicMochi (289 coins, 613 exp)
  // keeps floor noise under 1%.
  const T = 'cosmicMochi';
  const base = monsterTypes[T];
  // Mean over PLAIN spawns only: the ~13% natural-elite promotion triples HP
  // at random, which swamps a 20% signal (one unlucky batch measured x1.345).
  const meanHp = (n) => {
    let s = 0, k = 0;
    for (let i = 0; i < n; i++) {
      game.monsters.length = 0;
      const m = spawnMonster(400, 300, T, false);
      if (m.isElite || m.isMiniBoss) continue;
      s += m.maxHp; k++;
    }
    return s / k;
  };
  game._mutForce = [];                                   // baseline: no mutators
  const hp0 = meanHp(80);
  game._mutForce = ['surge'];                            // +20% HP
  const hp1 = meanHp(80);
  const hpRatio = hp1 / hp0;
  ok('surge lifts HP ~20% (spawn-measured)', hpRatio > 1.14 && hpRatio < 1.26, hpRatio.toFixed(3));

  // Plain (non-promoted) spawn, retried past the ~13% elite roll — a promoted
  // spawn multiplies coins/exp by tier and would poison any single-spawn ratio.
  const plainSpawn = () => {
    for (let i = 0; i < 60; i++) {
      game.monsters.length = 0;
      const m = spawnMonster(400, 300, T, false);
      if (!m.isElite && !m.isMiniBoss) return m;
    }
    throw new Error('60 straight elite promotions?');
  };
  game._mutForce = [];
  let m = plainSpawn();
  const c0 = m.mojicoins, s0 = m.speed, e0 = m.exp;
  game._mutForce = ['goldrush'];                         // +40% coins, weight 0
  const c1 = plainSpawn().mojicoins;
  ok('goldrush: coins x1.40', Math.abs(c1 / c0 - 1.40) < 0.03, `${c0} -> ${c1}`);
  game._mutForce = ['haste'];                            // +20% speed, weight 2
  m = plainSpawn();
  const s1 = m.speed, e1 = m.exp;
  ok('haste: speed x1.20', Math.abs(s1 / s0 - 1.20) < 0.02, `${s0} -> ${s1}`);
  // weight 2 -> reward bonus 1.24 on exp even though haste has no exp field
  ok('weight pays the contract bonus (exp x1.24 on haste day)',
     Math.abs(e1 / e0 - 1.24) < 0.05, `${e0} -> ${e1} (${(e1 / e0).toFixed(3)})`);
  game._mutForce = ['ferocity', 'haste'];                // weight 4 -> x1.48 coins
  const c2 = plainSpawn().mojicoins;
  ok('stacked weight 4: coins x1.48', Math.abs(c2 / c0 - 1.48) < 0.05, `${c0} -> ${c2} (${(c2 / c0).toFixed(3)})`);

  // ---- 3. bosses exempt from hostile channels --------------------------
  const bossType = Object.keys(monsterTypes).find(k => monsterTypes[k].boss && monsterTypes[k].speed > 0);
  if (bossType) {
    game._mutForce = [];
    game.monsters.length = 0;
    const b0 = spawnMonster(400, 300, bossType, true);
    const bAtk0 = b0 ? b0.atk : null, bSpd0 = b0 ? b0.speed : null;
    game._mutForce = ['ferocity', 'haste'];
    game.monsters.length = 0;
    const b1 = spawnMonster(400, 300, bossType, true);
    ok('boss ATK exempt from ferocity', b1 && b1.atk === bAtk0, `${bossType}: ${bAtk0} vs ${b1 && b1.atk}`);
    ok('boss speed exempt from haste', b1 && b1.speed === bSpd0, `${bSpd0} vs ${b1 && b1.speed}`);
  } else {
    ok('boss exemption (no speed>0 boss found to test)', true, 'skipped');
  }

  // ---- 4. announce path ------------------------------------------------
  delete game._mutForce;
  game._mutAnnounced = false;
  let toasts = [];
  const origToast = window.showToast;
  window.showToast = (msg, tier) => { toasts.push(String(msg)); };
  try { checkDaily(); } catch (e) { ok('checkDaily runs clean', false, String(e).slice(0, 120)); }
  window.showToast = origToast;
  ok('mutator roll is announced', toasts.some(t => t.includes('Today’s world')), toasts.length + ' toasts');
  game._mutAnnounced = false;
  ok('announce names both mutators',
     activeMutators().every(m => toasts.some(t => t.includes(m.name))),
     activeMutators().map(m => m.name).join(','));
  // second call same boot: no re-announce
  toasts = [];
  game._mutAnnounced = true;
  window.showToast = (msg) => { toasts.push(String(msg)); };
  try { checkDaily(); } catch (e) {}
  window.showToast = origToast;
  ok('no duplicate announce within a boot', !toasts.some(t => t.includes('Today’s world')), toasts.length + ' toasts');
  delete game._mutForce;
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
