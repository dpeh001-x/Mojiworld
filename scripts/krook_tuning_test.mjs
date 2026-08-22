// King Krook must be tier-appropriate: the Ember Tyrant should not be the
// weakest Lv-50 boss in the game.
//
// Per user: "make krook defense points higher, make him dish stronger damage as
// well." He was the LOWEST-ATK Lv-50 boss and the second-lowest DEF in the whole
// roster, on a monster the bestiary describes as having forge-iron hide.
//
// The DEF assertion is the interesting one. DEF does not map linearly to
// toughness — mitigation is 300/(def*2.2+300), so returns diminish fast and a
// stat bump that looks large can be nearly invisible in play. So this measures
// what a raw hit ACTUALLY lands through the game's own hitMonster, rather than
// asserting a number in a table and calling it a difficulty change.
// Run: node scripts/krook_tuning_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function' && typeof monsterTypes !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  const RAW = 100000;
  // What a raw hit actually lands on a boss, through the real damage path.
  // _defVar is pinned to 1: mob DEF carries a per-instance random spread, and
  // leaving it live would make this measurement wobble run to run.
  const landed = (type, defOverride) => {
    loadMap('town');
    const t = monsterTypes[type];
    const m = { ...t, type, x: 400, y: 300, w: t.w, h: t.h,
                maxHp: 1e12, currentHp: 1e12, isBoss: true, boss: true,
                def: (defOverride != null ? defOverride : t.def),
                stunTimer: 0, evasion: 0, _defVar: 1 };
    game.monsters = [m];
    const before = m.currentHp;
    try { hitMonster(m, RAW, false, 'probe'); } catch (e) { return null; }
    return before - m.currentHp;
  };
  const S = (id) => { const m = monsterTypes[id]; return { atk: m.atk, def: m.def, hp: m.hp, lv: m.level }; };
  return {
    krook: S('kingKrook'), octo: S('octobaby'), smith: S('sundered_smith'), lego: S('legosaurus'),
    landedNow:  landed('kingKrook'),
    landedAt29: landed('kingKrook', 29),    // the old value, same build = a fair A/B
    landedLego: landed('kingKrook', 120),   // legosaurus DEF on the same body
  };
});

const pct = (a, b) => +(((a / b) - 1) * 100).toFixed(1);
console.log(`\nKrook   atk ${r.krook.atk}  def ${r.krook.def}   (Lv ${r.krook.lv})`);
console.log(`peers   octobaby Lv50 atk ${r.octo.atk}/def ${r.octo.def} · sundered_smith Lv48 atk ${r.smith.atk}/def ${r.smith.def} · legosaurus Lv59 atk ${r.lego.atk}/def ${r.lego.def}`);
console.log(`\n100k raw hit lands: ${r.landedNow}  (at the old def 29: ${r.landedAt29}, ${pct(r.landedNow, r.landedAt29)}%)`);

console.log('\nDEFENCE IS HIGHER — AND MEASURABLY SO');
check(r.krook.def > 29, 'DEF was raised above the old 29', r.krook.def);
check(r.krook.def >= r.smith.def, 'at least the Lv-48 sundered_smith (63)', { krook: r.krook.def, smith: r.smith.def });
check(r.krook.def > r.octo.def, 'above his Lv-50 peer octobaby', { krook: r.krook.def, octobaby: r.octo.def });
check(r.landedNow < r.landedAt29 * 0.90,
      'a raw hit lands at least 10% less than at def 29 (a felt change, not a table edit)',
      { now: r.landedNow, at29: r.landedAt29, delta: pct(r.landedNow, r.landedAt29) + '%' });
check(r.krook.def <= r.lego.def, 'but not past legosaurus, who is nine levels higher', { krook: r.krook.def, lego: r.lego.def });

console.log('\nHITS HARDER');
check(r.krook.atk > 270, 'ATK was raised above the old 270', r.krook.atk);
check(r.krook.atk > r.octo.atk, 'now the hardest-hitting Lv-50 boss (above octobaby)', { krook: r.krook.atk, octobaby: r.octo.atk });
check(r.krook.atk > r.smith.atk, 'above the Lv-48 sundered_smith', { krook: r.krook.atk, smith: r.smith.atk });
check(r.krook.atk < r.lego.atk, 'still under legosaurus, nine levels later', { krook: r.krook.atk, lego: r.lego.atk });

console.log('\nNOTHING ELSE MOVED');
check(r.krook.hp === 2520000, 'HP is unchanged — this was a DEF/ATK pass, not a rework', r.krook.hp);
check(r.krook.lv === 50, 'still Lv 50', r.krook.lv);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
