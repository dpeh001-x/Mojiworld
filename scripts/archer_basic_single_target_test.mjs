// The archer's basic Z arrow is single-target: no AOE, no piercing.
//
// Per user: "archer basic attack Z projectiles should not have any AOE damage
// or piercing effect."
//
// Measured, not read: a real arrowShot() is fired into a line of four monsters
// and the HP each one loses is counted. Every archer configuration that COULD
// add pierce or splash is exercised — the Piercing Arrows and Explosive Tips
// tree talents, the Sniper job (pierce) and Ranger job (split), the Double
// Shot boon (which clones projectiles), and a maximal build stacking all of
// them at full Steady Aim.
//
// The last case is the control that keeps this honest: it strips the
// _singleTarget flag off the arrow after spawn, which is exactly the pre-
// v0.25.117 state. That run MUST show pierce/AOE — otherwise the harness
// cannot see the failure it claims to be guarding against, and every PASS
// above it is worthless.
// Run: node scripts/archer_basic_single_target_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(5000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  player.cls = 'archer'; player.level = 80; player._god = true;
  player.hp = player.maxHp = 999999; player.mp = player.maxMp = 999999;
  // A combat map: town and other hubs refuse to spawn monsters, which would
  // leave every trial measuring an empty world.
  const combat = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].isTown && !MAPS[k].isBossArena
    && (MAPS[k].platforms || []).some((p) => p.type === 'ground'));
  out.map = combat;
  loadMap(combat);
  for (let i = 0; i < 40; i++) await frame();
  game.paused = false;

  const gnd = (game.mapData.platforms || []).filter((p) => p.type === 'ground');
  const gy = gnd.length ? gnd[0].y : 480;
  const t = Object.keys(monsterTypes).find((k) => !monsterTypes[k].boss);
  out.mobType = t;

  const trial = async (setup, stripSingle) => {
    player.tree = {}; player.job = null; player.master = null; player._enh = null;
    player._steady = 0;
    if (player.mods) player.mods.multishot = 0;
    try { setup(); } catch (e) {}
    game.projectiles = []; game.monsters = [];
    player.x = 300; player.y = gy - player.h; player.facing = 1; player.vx = 0; player.vy = 0;
    const mobs = [];
    for (let i = 0; i < 4; i++) {
      let m = null;
      try { m = spawnMonster(430 + i * 46, gy - monsterTypes[t].h, t); } catch (e) {}
      if (m) { m.maxHp = m.currentHp = 5e8; mobs.push(m); }
    }
    if (mobs.length < 4) return { setupFailed: mobs.length };
    try { SKILL_FNS.arrowShot(); } catch (e) { return { err: String(e).slice(0, 120) }; }
    if (stripSingle) {
      for (const p of game.projectiles) if (p && p.skill === 'arrow') delete p._singleTarget;
    }
    let fields = null;
    for (let i = 0; i < 100; i++) {
      mobs.forEach((m) => { m.vx = 0; });
      await frame();
      const a = (game.projectiles || []).find((p) => p && p.owner === 'player' && p.skill === 'arrow');
      if (a && !fields) fields = { pierce: !!a.pierce, explode: a.explode || 0 };
    }
    const hurt = mobs.map((m) => Math.round(5e8 - m.currentHp));
    return { hurt, nHurt: hurt.filter((d) => d > 0).length, fields };
  };

  out.plain      = await trial(() => {});
  out.treePierce = await trial(() => { player.tree = { arrowPierce: true }; });
  out.treeBoom   = await trial(() => { player.tree = { explosiveArrows: true }; });
  out.sniper     = await trial(() => { player.job = 'sniper'; player._enh = JOBS.sniper; });
  out.ranger     = await trial(() => { player.job = 'ranger'; player._enh = JOBS.ranger; });
  const maximal = () => {
    player.tree = { arrowPierce: true, explosiveArrows: true, archerRange: 1.25, rapidFire: true };
    player.job = 'sniper'; player.master = 'marksman'; player._enh = JOBS.sniper;
    if (player.mods) player.mods.multishot = 1;
    player._steady = 100;
  };
  out.maximal = await trial(maximal);
  // CONTROL: same maximal build, but the single-target flag removed.
  out.control = await trial(maximal, true);
  return out;
});
await browser.close();

const CASES = [['plain', 'a plain archer'], ['treePierce', 'with Piercing Arrows unlocked'],
               ['treeBoom', 'with Explosive Tips unlocked'], ['sniper', 'as a Sniper (job grants pierce)'],
               ['ranger', 'as a Ranger (job grants arrow split)'],
               ['maximal', 'with every pierce/splash source stacked at once']];
console.log(`  map ${r.map}, dummies: ${r.mobType} x4 in a line`);
for (const [k] of CASES.concat([['control']])) {
  const v = r[k]; if (!v) continue;
  console.log(`  ${k.padEnd(11)} hurt=${JSON.stringify(v.hurt)} (${v.nHurt} of 4 hit)  arrow=${JSON.stringify(v.fields)}${v.err ? ' ERR ' + v.err : ''}${v.setupFailed !== undefined ? ' SETUP FAILED ' + v.setupFailed : ''}`);
}

check(!CASES.some(([k]) => r[k] && (r[k].setupFailed !== undefined || r[k].err)), 'all trials spawned their four dummies and fired',
      CASES.filter(([k]) => r[k] && (r[k].setupFailed !== undefined || r[k].err)).map(([k]) => k));
for (const [k, label] of CASES) {
  const v = r[k];
  check(!!v && v.nHurt === 1, `only ONE monster takes damage — ${label}`, v);
}
for (const [k, label] of CASES) {
  const v = r[k];
  check(!!v && v.fields && v.fields.pierce === false && v.fields.explode === 0,
        `and the arrow carries no pierce or explode — ${label}`, v && v.fields);
}
// Without this, every PASS above could be a harness that simply cannot see AOE.
check(!!r.control && r.control.nHurt >= 2,
      'CONTROL: stripping the single-target flag DOES produce multi-target damage, so the checks above can actually fail',
      r.control);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
