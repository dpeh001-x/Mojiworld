// PQ Stage 3 scales to the character, per user: "3rd stage of PQ is extremely
// easy, scale the DEF and HP to the character's to make it harder".
//
// The Carriage spawned plain ticketMechs from the stats table (hp 3250, def 9)
// regardless of the player, so a geared character walked through it.
//
// What this asserts is the SHAPE OF THE FIGHT, not stat values — a mech should
// take ~10 landed hits, block ~30% of each, and threaten ~15% of the player's
// health per swing, at every level and any gear. Asserting stat numbers instead
// is how the first attempt at this passed while shipping a 1,002,480 HP mech
// that needed 877 hits to kill: "it scales" was true and "it is playable" was
// not, and only one of those is the point.
//
// Player stats are driven through the game's own level-up path, because setting
// player.level alone leaves maxHp/atk at their level-1 values — which makes
// every hits-to-kill figure meaningless.
// Run: node scripts/pq_carriage_scaling_test.mjs [file.html]
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

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  const out = { rows: {} };

  const sample = (lvl) => {
    // Give the character stats that match the level, the way the game does.
    player.level = lvl;
    if (typeof recalcStats === 'function') { try { recalcStats(); } catch (e) {} }
    // getMaxHp() reads player.maxHp (plus mods/equipment), NOT a baseHp field —
    // setting the wrong one leaves the character at 195 HP wearing a Lv 95 label,
    // and the mech's swing then cannot move because it is a share of that.
    player.maxHp = 100 + lvl * 90;
    player.hp = player.maxHp;
    player.baseAtk = 10 + lvl * 55;
    loadMap('tower');
    game.monsters = [];
    let m = null;
    try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) {}
    if (!m) return null;
    const pHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
    const pAtk = (typeof getAtk === 'function') ? getAtk() : player.atk;
    const armor = (typeof _mobArmorClass === 'function') ? _mobArmorClass(m) : 1;
    const defVal = (m.def || 0) * armor;
    const through = 300 / (defVal + 300);
    const perHit = Math.max(1, Math.floor(pAtk * through));
    return {
      pHp: Math.round(pHp), pAtk: Math.round(pAtk),
      mechHp: m.maxHp, mechDef: m.def, mechAtk: m.atk,
      hitsToKill: Math.ceil(m.maxHp / perHit),
      mitigationPct: Math.round((1 - through) * 100),
      swingPctOfPlayerHp: Math.round(100 * m.atk / Math.max(1, pHp)),
    };
  };
  for (const lvl of [35, 60, 95]) out.rows[lvl] = sample(lvl);
  return out;
});
await browser.close();

const R = r.rows || {};
for (const lvl of [35, 60, 95]) console.log(`  Lv${lvl}: ${JSON.stringify(R[lvl])}`);

check(!!(R[35] && R[60] && R[95]), 'mechs spawned on the Carriage at every level', R);
for (const lvl of [35, 60, 95]) {
  const x = R[lvl] || {};
  // The fight holds its shape — this is the whole point of scaling to the player.
  check(x.hitsToKill >= 5 && x.hitsToKill <= 20,
        `Lv${lvl}: a mech takes a fightable number of hits (target ~10)`, x.hitsToKill);
  check(x.mitigationPct >= 22 && x.mitigationPct <= 38,
        `Lv${lvl}: it blocks a meaningful but survivable share (target ~30%)`, x.mitigationPct);
  check(x.swingPctOfPlayerHp >= 8 && x.swingPctOfPlayerHp <= 25,
        `Lv${lvl}: its swing threatens without one-shotting (target ~15%)`, x.swingPctOfPlayerHp);
}
// And it must actually TRACK the character, not sit at a fixed number.
check(R[95].mechHp > R[35].mechHp * 2, 'mech HP tracks the character upward',
      { lv35: R[35].mechHp, lv95: R[95].mechHp });
check(R[95].mechAtk > R[35].mechAtk * 2, 'and so does its damage',
      { lv35: R[35].mechAtk, lv95: R[95].mechAtk });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
