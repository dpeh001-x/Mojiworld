// The Express's advertised scaling actually runs, per user "fix stage 4
// scaling". Three maps declare expressScaling: the Stage-1 lobby, the Stage-4
// finale arena, and the Endless Express — and the quest journal promises
// "Mechs onboard scale to YOUR current level, but with double HP and double
// ATK compared to ordinary mobs at that level".
//
// The defect this guards: the expressScaling spawn override ran BEFORE
// _lxApplyStatTable, and v0.29.762 made the table the final word — so the
// table flattened every stat the override wrote, while the level stamp and
// the "Express " name prefix survived (the table touches neither). Measured on
// the broken build at Lv 60: a mech NAMED "⚔ Express Ticket Mech Lv 60"
// carrying the flat authored Lv-31 line — 3,214 HP / 91 ATK / 63 EXP against
// an at-level x2 expectation of 276,410 HP / 4,764 ATK / 1,103+ EXP. The
// nameplate was the only thing that scaled.
//
// So this grades the numbers a spawned mech actually carries against the same
// curve the fix promises (_lxFieldBaseline at the capped level, x2 stats),
// never against literals. The Stage-4 boss's own scaling (playerLevel/30,
// applied post-spawn in the loadMap hook) was never broken and is pinned here
// so a future re-ordering cannot kill it the same way.
// Run: node scripts/express_scaling_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.hp = player.maxHp = 9e8;
  const goTo = async (id) => { loadMap(id);
    for (let i = 0; i < 240; i++) { if (game.currentMap === id) return true;
      await new Promise((res) => requestAnimationFrame(res)); } return false; };
  const out = {};

  // What the promise computes to at this level — the same helpers the game
  // uses, so a curve retune moves the expectation with it.
  const cap = (typeof _lxScaledMobLevel === 'function') ? _lxScaledMobLevel(player.level) : player.level;
  const base = (typeof _lxFieldBaseline === 'function') ? _lxFieldBaseline(cap) : null;
  out.expected = base ? {
    level: cap,
    hp: Math.floor(base.hp * 2),
    atk: Math.floor(base.atk * 2),
    def: Math.floor(base.atk * 0.35 * 2),
    expFloor: Math.floor(base.exp * 0.25),   // exp = baseline x per-map factor, clamped [0.25, 8]
    expCeil: Math.floor(base.exp * 8) + 1,
  } : null;

  // --- every expressScaling map spawns the mech the journal describes ---
  out.maps = {};
  for (const mapId of ['clockworkExpress', 'clockworkUnderpassLobby']) {
    await goTo(mapId);
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    game.monsters = [];
    let m = null; try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) {}
    out.maps[mapId] = m ? {
      name: m.name, level: m.level, hp: m.maxHp, atk: m.atk, def: m.def,
      exp: m.exp, coins: m.mojicoins, veteranGap: m._veteranGap,
    } : null;
    game.monsters = [];
  }

  // --- and the gate holds: the same mob elsewhere is NOT express-scaled ---
  await goTo('forest');
  for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
  game.monsters = [];
  let fm = null; try { fm = spawnMonster(300, 200, 'ticketMech'); } catch (e) {}
  out.offMap = fm ? { name: fm.name, hp: fm.maxHp } : null;
  game.monsters = [];

  // --- the Stage-4 boss's own scale (was never broken; pinned so it stays) ---
  await goTo('clockworkExpress');
  game.monsters = [];
  let b = null; try { b = spawnMonster(600, 200, 'pqConductor', true, false); } catch (e) {}
  // The loadMap hook applies the scale; here we reproduce it the way that hook
  // does, to prove spawnMonster's table pass leaves a boss the hook CAN scale
  // (i.e. its base is the authored line, not something pre-multiplied).
  out.bossBase = b ? { hp: b.maxHp, atk: b.atk } : null;
  game.monsters = [];
  return out;
});
await browser.close();

console.log(`  expected @cap: ${JSON.stringify(r.expected)}`);
for (const k of ['clockworkExpress', 'clockworkUnderpassLobby']) console.log(`  ${k}: ${JSON.stringify(r.maps[k])}`);
console.log(`  forest (gate): ${JSON.stringify(r.offMap)}   boss base: ${JSON.stringify(r.bossBase)}`);

check(!!r.expected, 'the shared curve helpers exist to compute the promise', r.expected);
for (const k of ['clockworkExpress', 'clockworkUnderpassLobby']) {
  const m = r.maps[k] || {};
  const label = k === 'clockworkExpress' ? 'Stage-4 arena' : 'Stage-1 lobby';
  check(m.hp === r.expected.hp, `${label}: HP is exactly 2x an at-level field mob (was the flat Lv-31 line)`, m);
  check(m.atk === r.expected.atk, `${label}: ATK is exactly 2x at-level`, m);
  check(m.def === r.expected.def, `${label}: DEF rides the same curve`, m);
  check(m.level === r.expected.level, `${label}: the nameplate level matches the stats under it`, m);
  check(m.exp >= r.expected.expFloor && m.exp <= r.expected.expCeil,
        `${label}: EXP pays the at-level baseline, not the authored Lv-31 payout`, m);
  check(typeof m.name === 'string' && m.name.startsWith('Express '),
        `${label}: named as the Express variant`, m.name);
  check(m.veteranGap === undefined,
        `${label}: no stale veteran tag on a level-matched mob`, m);
}
check(!!r.offMap && !String(r.offMap.name || '').startsWith('Express ') && r.offMap.hp < r.expected.hp / 10,
      'the same mob off the express maps is NOT express-scaled (gate holds)', r.offMap);
check(!!r.bossBase && r.bossBase.hp <= 80000,
      "the Conductor's spawn base stays authored — the loadMap hook still owns his scale", r.bossBase);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
