// The Sovereign's collapse: 5 s to evade, nothing else fired, correct killer.
// ============================================================================
// Per user: "sovereign of the spire, needs more time interval to evade the
// OHKO attack, should not do any other attacks when doing the OHKO attack,
// also when dying to OHKO attack it mentions death by gravitos".
//
// A real towerSovereign is spawned and its OHKO forced due; the hazard it
// pushes and the frames that follow are inspected:
//
//   1. the collapse hazard's life (= the telegraph) is 300 frames (was 210)
//   2. the hazard carries the Sovereign's own label (baseline: none)
//   3. with the volley and drain timers ALSO due, no homing projectile and no
//      drain pillar appears while the collapse charges, and neither trait
//      attack starts (_bigMeleeFiring / _columnFiring stay false)
//      (baseline: the volley fires within the telegraph -> fails)
//   4. CONTROL for 3: after the telegraph the Sovereign attacks again - the
//      gate is a window, not a permanent silence
//   5. CONTROL for the label: a Gravitos-style push (no label) still resolves
//      to "Gravitos' Singularity Collapse" - resolved through the survivable
//      99% branch, which needs a phase-1 Gravitos present
//   6. dying to the Sovereign's collapse credits the Sovereign, not Gravitos
//      (baseline: "Gravitos' Singularity Collapse" -> fails)
// Run: node scripts/sovereign_ohko_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/sovereign_ohko_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });

const PORT = Number(process.env.PORT || 11471);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
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
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  try { loadMap('forest'); game.paused = false; player._god = true; } catch (e) {}
  await sleep(1200);
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  // stand far from any spawned boss so contact/melee range is not the variable
  const farX = player.x + 700;

  // ---- 5. CONTROL first (survivable): a Gravitos-style push with no label ----
  const gv = spawnMonster(farX, player.y, 'gravitos', true);
  await sleep(3600); game.paused = false;              // boss intro card
  if (gv) gv.phase = 1;
  player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; player._ohkoParry = 0;
  player._lastDamageSource = '';
  game.hazards.push({ type: 'gravitos_singularity', x: 0, y: 0, w: 4000, h: 2000, cx: farX, cy: player.y, life: 2, maxLife: 210, atk: 99999, safeZones: [] });
  for (let i = 0; i < 6; i++) { game.paused = false; await sleep(35); }
  out.gravLabel = player._lastDamageSource; out.gravHpAfter = player.hp;
  player._god = true; game.monsters.length = 0; game.hazards.length = 0; player.hp = getMaxHp();

  // ---- the Sovereign ---------------------------------------------------------
  const m = spawnMonster(farX, player.y, 'towerSovereign', true);
  if (!m) return { err: 'sovereign did not spawn' };
  await sleep(3600); game.paused = false;
  m._expeditionFinalBoss = true; m._sovPhase = 1;
  m._sovShielded = false; m._sovExposedUntil = 0; m._sovSpentUntil = 0;
  m.x = farX; m.y = player.y;
  const t0 = game.time | 0;
  m._sovereignOhkoTick = t0;            // due now
  m._sovereignHomingAt = t0;            // ALSO due now: would fire during the charge on the old build
  m._sovereignDrainAt = t0;
  game.hazards.length = 0; game.projectiles.length = 0;
  // let it fire
  let hz = null;
  for (let i = 0; i < 30 && !hz; i++) { game.paused = false; await sleep(35); hz = game.hazards.find((h) => h.type === 'gravitos_singularity'); }
  if (!hz) return { err: 'collapse never fired' };
  out.life = hz.maxLife; out.label = hz._sourceLabel || null;
  out.collapseUntil = m._sovCollapseUntil || null;
  // ---- 3. during the charge: count everything else the Sovereign does ---------
  let volley = 0, drains = 0, swing = false, column = false, frames = 0;
  const tEnd = t0 + Math.min(hz.maxLife, 300) - 20;   // stay inside the telegraph on either build
  while ((game.time | 0) < tEnd && frames < 400) {
    game.paused = false; m.x = farX; m.y = player.y;   // hold it at range
    await sleep(20); frames++;
    volley = Math.max(volley, game.projectiles.filter((p) => p.owner === 'enemy').length);
    drains += game.hazards.filter((h) => h.type === 'sovereign_drain_pillar').length ? 1 : 0;
    if (m._bigMeleeFiring) swing = true;
    if (m._columnFiring) column = true;
  }
  out.during = { volley, drains, swing, column, frames, tick: (game.time | 0) - t0 };
  // ---- 4. CONTROL: after the telegraph the volley is allowed again -------------
  game.hazards.length = 0; game.projectiles.length = 0;
  m._sovSpentUntil = 0; m._sovExposedUntil = 0; m._sovShielded = false;
  m._sovCollapseUntil = 0; m._sovereignHomingAt = game.time | 0;
  let after = 0;
  for (let i = 0; i < 40 && !after; i++) { game.paused = false; m.x = farX; m.y = player.y; await sleep(30); after = game.projectiles.filter((p) => p.owner === 'enemy').length; }
  out.afterVolley = after;
  // ---- 6. die to the Sovereign's collapse: who gets the credit? ----------------
  game.hazards.length = 0; game.projectiles.length = 0;
  m._sovereignOhkoTick = game.time | 0; m._sovSpentUntil = 0; m._sovCollapseUntil = 0;
  let hz2 = null;
  for (let i = 0; i < 30 && !hz2; i++) { game.paused = false; await sleep(35); hz2 = game.hazards.find((h) => h.type === 'gravitos_singularity'); }
  if (!hz2) return Object.assign(out, { err2: 'second collapse never fired' });
  player._god = false; player.hp = getMaxHp(); player.invulnerable = 0; player._ohkoParry = 0; player._lastDamageSource = '';
  hz2.safeZones = []; hz2.life = 2;                    // resolve now, nowhere safe
  for (let i = 0; i < 8; i++) { game.paused = false; await sleep(35); }
  out.deathLabel = player._lastDamageSource; out.hpAfter = player.hp;
  return out;
});
await browser.close(); server.kill();

if (R.err) ok('scenario set up', false, R.err);
else {
  console.log(`  telegraph ${R.life}f, label ${JSON.stringify(R.label)}, collapseUntil ${R.collapseUntil}`);
  console.log(`  during charge: ${JSON.stringify(R.during)}   after: volley ${R.afterVolley}`);
  console.log(`  gravitos control: ${JSON.stringify(R.gravLabel)} (hp ${R.gravHpAfter})   sovereign death: ${JSON.stringify(R.deathLabel)} (hp ${R.hpAfter})`);
  ok('the collapse telegraph is 5.0 s (300 frames)', R.life === 300, `${R.life} frames (was 210 = 3.5 s)`);
  ok('the Sovereign\'s collapse carries its own label', !!R.label && /sovereign/i.test(R.label), JSON.stringify(R.label));
  ok('no other attack fires while the collapse charges (volley due, drain due, swing + column traits)',
     R.during.volley === 0 && R.during.drains === 0 && !R.during.swing && !R.during.column,
     `volley ${R.during.volley}, drain ${R.during.drains}, swing ${R.during.swing}, column ${R.during.column} over ${R.during.tick} frames`);
  ok('CONTROL: after the telegraph the Sovereign attacks again (a window, not a silence)', R.afterVolley > 0, `${R.afterVolley} enemy projectiles after`);
  ok('CONTROL: a Gravitos-style collapse still credits Gravitos', /^Gravitos/.test(R.gravLabel || ''), JSON.stringify(R.gravLabel));
  // The kill branch sets hp = 0 and then routes through the revive chain, which
  // can leave a fresh character at 1 HP - the label is the ask; the collapse
  // landing is proven by the HP dropping to <= 1 from full.
  ok('dying to the Sovereign\'s collapse credits the Sovereign', /sovereign/i.test(R.deathLabel || '') && R.hpAfter <= 1,
     `${JSON.stringify(R.deathLabel)} (baseline: "Gravitos' Singularity Collapse")`);
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
