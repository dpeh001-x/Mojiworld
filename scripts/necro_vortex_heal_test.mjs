// Soul Vortex kills restore HP/MP — they do not inflate max HP.
//
// Per user, on a screenshot showing "+3 MaxHP" floating over every kill: "my
// neromancer skill has a skill that + 3 maxhp all the time, change it to mp and
// hp heal of about 5% instead."
//
// The old grant was PERMANENT, which is what makes this worth a regression test
// rather than a glance at the diff. getMaxHp() reads player.maxHp as its base
// and multiplies from there, so every kill inside the 30 s pool raised the
// character's ceiling for the rest of the save. A test that only asked "did HP
// go up" would pass on both the old behaviour and the new one — so the
// load-bearing assertion here is that player.maxHp is UNCHANGED across a whole
// vortex's worth of kills, which is the one the old build fails.
// Run: node scripts/necro_vortex_heal_test.mjs [file.html]
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
await page.waitForFunction(() => typeof killMonster === 'function' && typeof MAPS !== 'undefined', { timeout: 90000 });

const r = await page.evaluate(() => {
  if (typeof killMonster !== 'function') return { err: 'killMonster not found' };

  // A FIELD map, not town. Town has no spawns, so there is nothing to kill and
  // killMonster early-returns — the first draft of this test measured a zero
  // heal for that reason alone, and three of its checks passed vacuously while
  // nothing ran at all.
  const fieldId = Object.keys(MAPS).find(k => {
    const m = MAPS[k];
    return m && !m.isTown && !m.isBossArena && Array.isArray(m.spawns) && m.spawns.length;
  });
  if (!fieldId) return { err: 'no field map with spawns' };

  const sample = (opts) => {
    // Reload per sample so there are always live monsters left to kill; a
    // previous sample empties the map.
    loadMap(fieldId);
    player.cls = 'mage'; player.level = 50;
    player.buffs = player.buffs || {};
    player.buffs.necromancer = opts.vortex ? 30000 : 0;

    const maxHp0 = getMaxHp(), maxMp0 = getMaxMp();
    player.hp = Math.floor(maxHp0 * (opts.hpFrac != null ? opts.hpFrac : 0.5));
    player.mp = Math.floor(maxMp0 * (opts.mpFrac != null ? opts.mpFrac : 0.5));
    const baseMaxHp0 = player.maxHp;
    const hp0 = player.hp, mp0 = player.mp;
    game.damageNumbers = [];

    // Level-ups are held off: kill EXP legitimately raises getMaxHp() through
    // per-level growth, which has nothing to do with the necromancer branch and
    // would otherwise be read as exactly the inflation this test hunts for.
    const _lv = window._maybeLevelUp; window._maybeLevelUp = function () {};
    const _t = window.showToast; window.showToast = function () {};
    let killed = 0;
    try {
      for (let i = 0; i < (opts.kills || 1); i++) {
        const m = (game.monsters || []).find(x => x && x.currentHp > 0);
        if (!m) break;
        m.currentHp = 0; m.mojicoins = 0;
        killMonster(m); killed++;
      }
    } catch (e) { return { err: String(e).slice(0, 140) }; }
    finally { window._maybeLevelUp = _lv; window.showToast = _t; }

    return {
      killed,
      baseMaxHpDelta: player.maxHp - baseMaxHp0,
      hpGain: player.hp - hp0, mpGain: player.mp - mp0,
      wantHp: Math.floor(maxHp0 * 0.05), wantMp: Math.floor(maxMp0 * 0.05),
      texts: (game.damageNumbers || []).map(d => String(d.text)).filter(t => /HP|MP/.test(t)),
    };
  };

  return {
    one:      sample({ vortex: true,  kills: 1 }),
    twelve:   sample({ vortex: true,  kills: 12 }),
    full:     sample({ vortex: true,  kills: 3, hpFrac: 1, mpFrac: 1 }),
    noVortex: sample({ vortex: false, kills: 5 }),
  };
});

if (r.err) { console.log('SETUP FAILED — ' + r.err); await browser.close(); process.exit(1); }
for (const k of ['one', 'twelve', 'full', 'noVortex']) {
  if (r[k] && r[k].err) { console.log(`SAMPLE ${k} FAILED — ${r[k].err}`); await browser.close(); process.exit(1); }
}
console.log('\n1 kill in vortex   → ' + JSON.stringify(r.one));
console.log('12 kills in vortex → killed ' + r.twelve.killed + ', baseMaxHpDelta ' + r.twelve.baseMaxHpDelta);

console.log('\nNO PERMANENT MAX-HP INFLATION (the actual complaint)');
check(r.one.killed === 1 && r.twelve.killed === 12, 'the kills actually happened (guards a vacuous pass)',
      { one: r.one.killed, twelve: r.twelve.killed });
check(r.one.baseMaxHpDelta === 0, 'one kill does not raise base max HP', r.one.baseMaxHpDelta);
check(r.twelve.baseMaxHpDelta === 0, 'twelve kills (a whole vortex) do not raise base max HP', r.twelve.baseMaxHpDelta);
check(!r.one.texts.some(t => /MaxHP/i.test(t)), 'no "+3 MaxHP" text any more', r.one.texts);

console.log('\nHEALS 5% OF HP AND MP');
check(r.one.hpGain === r.one.wantHp, 'one kill restores floor(5% of max HP)', { want: r.one.wantHp, got: r.one.hpGain });
check(r.one.mpGain === r.one.wantMp, 'one kill restores floor(5% of max MP)', { want: r.one.wantMp, got: r.one.mpGain });
check(r.one.texts.length > 0, 'the heal is surfaced as floating text', r.one.texts);

console.log('\nNO OVERHEAL, AND QUIET WHEN FULL');
check(r.full.hpGain === 0 && r.full.mpGain === 0, 'no gain when already at full HP/MP', { hp: r.full.hpGain, mp: r.full.mpGain });
check(r.full.texts.length === 0, 'and no floating text at full — the screenshot spam', r.full.texts);

console.log('\nONLY INSIDE THE VORTEX');
check(r.noVortex.hpGain === 0 && r.noVortex.mpGain === 0, 'kills without the buff heal nothing',
      { hp: r.noVortex.hpGain, mp: r.noVortex.mpGain });
check(r.noVortex.killed === 5, 'and those kills did happen too', r.noVortex.killed);

check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(bad === 0 ? '\nALL PASS' : `\n${bad} FAILED`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
