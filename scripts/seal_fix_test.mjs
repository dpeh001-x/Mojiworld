// Seal fixes: revives pass the heal lock, and seals hold while paused.
// ============================================================================
// Found by the debugging sweep; regressions from v0.30.588 / v0.30.297.
//   1. HEAL LOCK HOLDS WHILE PAUSED: a 600-frame lock keeps its remaining time
//      across 300 paused game frames (baseline: it drains by ~300)
//   2. POTION SEAL HOLDS WHILE PAUSED: same for a 900-frame potion seal
//   3. SECOND WIND REVIVES UNDER THE HEAL LOCK: sealed, hp set to 0 -> the
//      revive restores half of max HP (baseline: stays 0, revive spent)
//   4. CONTROL: while sealed and alive, an ordinary heal is still refused
//   5. CONTROL: unpaused, the lock still counts down with the game
//   6. POTION COOLDOWN HOLDS WHILE PAUSED (the 3 s cooldown)
//   7. GRAVITOS OHKO WARNING HOLDS WHILE PAUSED
//   8. STATUS CURE WORKS UNDER THE HEAL LOCK (it restores no HP)
//   9. CONTROL: an HP potion is still refused under the lock
//  10. CO-OP PAUSED: the world step's undo of damage (ghost statue) passes the lock
//  11. CONTROL: in co-op a pause does not freeze the world, so the lock keeps draining
// Check 10 passes on the previous build only because its hp is stuck at 0 by then
// (check 3); prove it on a build with only the ghost-restore bypass reverted.
// Run: node scripts/seal_fix_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/seal_fix_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 12611);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(12000);
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const r = await page.evaluate(() => { const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
    if (r) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
  for (let i = 0; i < 45; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
  await page.waitForTimeout(1000);

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    try { loadMap('forest'); game.paused = false; } catch (e) { out.err = String(e); return out; }
    await sleep(1500);
    game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    player._god = false; player.hp = getMaxHp(); player.invulnerable = 0;
    const waitFrames = async (n, paused) => { const g0 = game.time | 0; const t0 = performance.now(); while (((game.time | 0) - g0) < n && performance.now() - t0 < 60000) { game.paused = !!paused; await sleep(16); } return (game.time | 0) - g0; };
    // 1. heal lock across a pause
    _lxHealLockApply(10000, 'a test comet');
    const hl0 = (player._healLockUntil | 0) - (game.time | 0);
    const pausedF = await waitFrames(300, true);
    game.paused = false;
    const hl1 = (player._healLockUntil | 0) - (game.time | 0);
    out.heal = { before: hl0, after: hl1, pausedFrames: pausedF, lockedAfter: _lxHealLocked() };
    // 5. control: unpaused it counts down
    const runF = await waitFrames(120, false);
    const hl2 = (player._healLockUntil | 0) - (game.time | 0);
    out.run = { before: hl1, after: hl2, frames: runF };
    // 4. control: an ordinary heal is refused while sealed and alive
    player.hp = Math.max(10, Math.floor(getMaxHp() * 0.4));
    const hpA = player.hp; player.hp = hpA + 50; out.healRefused = player.hp === hpA;
    // 3. Second Wind under the lock
    player.tree = player.tree || {}; player.tree.secondWind = true; player.tree.secondWindReady = true;
    player._god = false; player.invulnerable = 0;
    player.hp = 0;
    await waitFrames(6, false);
    out.revive = { hp: player.hp, max: getMaxHp(), dying: !!game.dying, secondWindSpent: player.tree.secondWindReady === false, sealStillOn: _lxHealLocked() };
    // 8. Status Cure passes the lock (it restores no HP); 9. an HP potion is still refused
    player.consumables = player.consumables || {};
    player.consumables.cure = 2; player._poisonTimer = 5000; player._poisonDmg = 1; player._slowTimer = 4000;
    player._potionLockUntil = 0; player._potionCdHp = 0; player._potionCdMp = 0;
    const lockedNow = _lxHealLocked();
    try { useConsumable('cure'); } catch (e) { out.cureErr = String(e); }
    const hpPot = (POTION_ITEMS.find((x) => x.type === 'hp') || {}).id;
    if (hpPot) player.consumables[hpPot] = 3;
    player.hp = Math.max(10, Math.floor(getMaxHp() * 0.4));
    const hpB = player.hp;
    try { useConsumable(hpPot); } catch (e) { out.cureErr = String(e); }
    out.cure = { locked: lockedNow, poison: player._poisonTimer | 0, slow: player._slowTimer | 0, stock: player.consumables.cure, hpPot, hpPotStock: player.consumables[hpPot], hpDelta: player.hp - hpB };
    player._poisonTimer = 0; player._slowTimer = 0;
    // 10. co-op paused: the world step's undo of damage (v0.29.674 ghost statue) passes the lock.
    //     The world step is real; only its monster pass is swapped for a plain 50-damage hit.
    const _ca = window._coopActive, _um = window.updateMonsters, _up = window.updateProjectiles;
    try {
      window._coopActive = () => true;
      window.updateMonsters = function () { player.hp = player.hp - 50; };
      window.updateProjectiles = function () {};
      player._god = false; player.invulnerable = 0;
      player.hp = Math.max(100, Math.floor(getMaxHp() * 0.6));
      const g0 = player.hp; game.paused = true;
      _lxCoopWorldStep(16.67);
      out.ghost = { locked: _lxHealLocked(), before: g0, after: player.hp };
    } catch (e) { out.ghostErr = String(e); }
    finally { window.updateMonsters = _um; window.updateProjectiles = _up; }
    // 11. control: in co-op a pause does not freeze the world, so the lock keeps draining
    try {
      const c0 = (player._healLockUntil | 0) - (game.time | 0);
      const cf = await waitFrames(60, true);
      out.coop = { before: c0, after: (player._healLockUntil | 0) - (game.time | 0), frames: cf };
    } catch (e) { out.ghostErr = String(e); }
    finally { window._coopActive = _ca; game.paused = false; }
    // 6. potion cooldown across a pause
    player._god = true; player.hp = getMaxHp();
    _setPotionCd('hp');
    const pc0 = _potionCdRemainingFrames('hp');
    const pausedF3 = await waitFrames(120, true);
    game.paused = false;
    out.pcd = { before: pc0, after: _potionCdRemainingFrames('hp'), pausedFrames: pausedF3 };
    // 7. Gravitos's one-hit-KO warning across a pause (the field on a real monster; its AI never runs while paused)
    const n0 = game.monsters.length;
    for (const ty of ['slime', 'greenSlime', 'mushroom', 'snail']) { try { spawnMonster(player.x + 420, player.y - 40, ty); } catch (e) {} if (game.monsters.length > n0) { out.ohkoType = ty; break; } }
    const om = game.monsters[game.monsters.length - 1];
    if (om) {
      om._ohkoWarnUntil = (game.time | 0) + 300;
      const ow0 = om._ohkoWarnUntil - (game.time | 0);
      const pausedF4 = await waitFrames(200, true);
      const ow1 = om._ohkoWarnUntil - (game.time | 0);
      game.paused = false;
      out.ohko = { before: ow0, after: ow1, pausedFrames: pausedF4 };
      om._ohkoWarnUntil = null; game.monsters.length = 0;
    }
    // 2. potion seal across a pause
    player._god = true; player.hp = getMaxHp();
    const t = game.time | 0;
    player._potionLockUntil = t + 900; player._potionLockMap = game.currentMap;
    const ps0 = (player._potionLockUntil | 0) - (game.time | 0);
    const pausedF2 = await waitFrames(300, true);
    game.paused = false;
    const ps1 = (player._potionLockUntil | 0) - (game.time | 0);
    out.seal = { before: ps0, after: ps1, pausedFrames: pausedF2 };
    return out;
  });
  if (R.err) console.log('  err ' + R.err);
  console.log('  heal lock across pause: ' + JSON.stringify(R.heal));
  console.log('  heal lock running:      ' + JSON.stringify(R.run));
  console.log('  potion seal across pause: ' + JSON.stringify(R.seal));
  console.log('  revive: ' + JSON.stringify(R.revive) + '   ordinary heal refused: ' + R.healRefused);
  const H = R.heal || {}, S = R.seal || {}, V = R.revive || {}, U = R.run || {};
  ok('HEAL LOCK HOLDS WHILE PAUSED: remaining time unchanged across 300 paused frames', H.pausedFrames >= 290 && Math.abs(H.after - H.before) <= 6 && H.lockedAfter, `${H.before} -> ${H.after} frames left over ${H.pausedFrames} paused frames (baseline: drains by ~300)`);
  ok('POTION SEAL HOLDS WHILE PAUSED: remaining time unchanged across 300 paused frames', S.pausedFrames >= 290 && Math.abs(S.after - S.before) <= 6, `${S.before} -> ${S.after} frames left over ${S.pausedFrames} paused frames (baseline: drains by ~300)`);
  ok('SECOND WIND REVIVES UNDER THE HEAL LOCK', V.hp >= Math.floor(V.max * 0.5) - 1 && !V.dying && V.secondWindSpent, `hp ${V.hp} of ${V.max}, spent ${V.secondWindSpent}, dying ${V.dying} (baseline: hp 0)`);
  ok('CONTROL: while sealed and alive an ordinary heal is still refused', R.healRefused === true, `refused ${R.healRefused}`);
  ok('CONTROL: unpaused, the lock still counts down with the game', U.frames >= 100 && (U.before - U.after) >= U.frames - 6, `${U.before} -> ${U.after} over ${U.frames} frames`);
  const P = R.pcd || {}, O = R.ohko || {};
  console.log('  potion cooldown across pause: ' + JSON.stringify(P) + '   OHKO warning across pause: ' + JSON.stringify(O) + ' on ' + R.ohkoType);
  ok('POTION COOLDOWN HOLDS WHILE PAUSED: the 3 s cooldown keeps its time across 120 paused frames', P.pausedFrames >= 115 && P.before >= 170 && Math.abs(P.after - P.before) <= 6, `${P.before} -> ${P.after} over ${P.pausedFrames} paused frames (baseline: drains by ~120)`);
  ok('GRAVITOS OHKO WARNING HOLDS WHILE PAUSED: time left unchanged across 200 paused frames', O.pausedFrames >= 190 && Math.abs(O.after - O.before) <= 6, `${O.before} -> ${O.after} over ${O.pausedFrames} paused frames (baseline: drains by ~200)`);
  const C = R.cure || {};
  console.log('  cure under lock: ' + JSON.stringify(C) + (R.cureErr ? '   err ' + R.cureErr : ''));
  ok('STATUS CURE WORKS UNDER THE HEAL LOCK: poison and slow cleared, one remedy spent', C.locked && C.poison === 0 && C.slow === 0 && C.stock === 1, `locked ${C.locked}, poison ${C.poison}, slow ${C.slow}, stock 2 -> ${C.stock} (baseline: refused, stock 2)`);
  ok('CONTROL: an HP potion is still refused under the lock', !!C.hpPot && C.hpPotStock === 3 && C.hpDelta <= 0, `${C.hpPot}: stock 3 -> ${C.hpPotStock}, hp change ${C.hpDelta}`);
  const G = R.ghost || {}, K = R.coop || {};
  console.log('  co-op paused undo: ' + JSON.stringify(G) + '   co-op pause drain: ' + JSON.stringify(K) + (R.ghostErr ? '   err ' + R.ghostErr : ''));
  ok('CO-OP PAUSED: THE UNDO OF DAMAGE PASSES THE HEAL LOCK', G.locked && G.after === G.before, `locked ${G.locked}, hp ${G.before} -> ${G.after} after a 50-damage world step (baseline: keeps the 50)`);
  ok('CONTROL: in co-op a pause does not freeze the world, so the lock keeps draining', K.frames >= 55 && (K.before - K.after) >= K.frames - 6, `${K.before} -> ${K.after} over ${K.frames} paused co-op frames`);
} finally {
  await browser.close().catch(() => {}); server.kill();
}
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
