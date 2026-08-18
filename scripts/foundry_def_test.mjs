// Magma Foundry DEF pass, per user on Furnace Deep: "just to reduce their DEF
// but make it still relatively high".
//
// Both halves of that sentence are load-bearing, so both are asserted: DEF must
// come DOWN measurably, and it must stay HIGH — this is a foundry full of
// half-forge titans, not a field of paper mobs. The measurement is the share of
// a hit the mob actually blocks, computed from the same terms the damage path
// uses (armour class, level gap, variant multipliers, then 300/(defVal+300)),
// because authored DEF alone says almost nothing: the Smithgolem's 182 became
// an effective 793 through an armour class of 2 and a miniElite x1.8.
//
// The random per-spawn terms are held fixed rather than sampled — see the
// comment on the metric below for why that is not optional here.
// Run: node scripts/foundry_def_test.mjs [file.html]
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof monsterTypes !== 'undefined', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 99;
  loadMap('magmaFoundry2');
  await new Promise((res) => setTimeout(res, 2500));

  // Reproduce the damage path's DEF terms (see hitMonster) with the RANDOM ones
  // held fixed. Spawn level and _mobDefVar are rolled per monster, and they move
  // the result by more than this whole change does — measured live, a set of
  // Forgewights that happened to roll high read as MORE armoured after their DEF
  // was cut by a third. So: a fixed reference level, variance neutralised, and
  // the variant multiplier taken from the TYPE's traits rather than from a
  // particular spawn's random elite roll. The percentages below are therefore a
  // stable comparison between builds, not the exact figure any one mob shows.
  const REF_LV = 33;   // ~ the natural level these spawns roll at in the foundry
  const blocked = (m) => {
    const t = monsterTypes[m.type];
    const armor = (typeof _mobArmorClass === 'function') ? _mobArmorClass(m) : 1;
    const mul = (typeof MONSTER_STAT_MUL !== 'undefined') ? MONSTER_STAT_MUL : 0.35;
    const rdef = Math.floor((t.def || 0) * mul * (1 + 0.10 * REF_LV));
    let defVal = rdef * armor;
    const tr = t.traits || {};
    if (tr.miniElite) defVal *= 1.8;
    if (t.boss) defVal *= 2.2;
    return { defVal, pct: (1 - 300 / (defVal + 300)) * 100 };
  };
  const acc = {};
  for (const m of game.monsters) {
    if (!monsterTypes[m.type]) continue;
    const b = blocked(m);
    (acc[m.type] = acc[m.type] || { n: 0, pct: 0, defVal: 0 });
    acc[m.type].n++; acc[m.type].pct += b.pct; acc[m.type].defVal += b.defVal;
  }
  const out = { types: {}, roster: Object.keys(acc).sort() };
  for (const t in acc) {
    out.types[t] = {
      n: acc[t].n,
      authored: monsterTypes[t].def,
      defVal: Math.round(acc[t].defVal / acc[t].n),
      blockedPct: +(acc[t].pct / acc[t].n).toFixed(1),
      armorShield: (monsterTypes[t].traits && monsterTypes[t].traits.armorShield) || null,
    };
  }
  // The sister map shares this roster; it must not have been split.
  out.sisterSpawns = (MAPS.magmaFoundry.spawns || []).map((s) => s.type).sort();
  out.thisSpawns = (MAPS.magmaFoundry2.spawns || []).map((s) => s.type).sort();
  return out;
});
await browser.close();

for (const t of r.roster) console.log(`  ${t.padEnd(12)} ${JSON.stringify(r.types[t])}`);

const T = r.types;
const have = (k) => T[k] || {};
check(r.roster.length >= 4, 'the four foundry types are on the map', r.roster);

// Came DOWN — authored values, which is what the patch actually controls.
check(have('smithgolem').authored === 90, 'Smithgolem DEF is 90 (182 -> 120 in v0.29.844, then 90 per user)', have('smithgolem').authored);
check(have('forgewight').authored === 100, 'Forgewight DEF is 100 (160 -> 110 in v0.29.844, then 100 per user)', have('forgewight').authored);
check(have('bellowsbat').authored === 47, 'Bellowsbat DEF reduced (was 68)', have('bellowsbat').authored);
check(have('cinderling').authored === 40, 'Cinderling DEF reduced (was 58)', have('cinderling').authored);

// Still HIGH — the other half of the request. Measured as damage actually blocked.
check(have('smithgolem').blockedPct >= 55 && have('smithgolem').blockedPct <= 66,
      'the Smithgolem still blocks well over half a hit (76.6% before any of this)', have('smithgolem').blockedPct);
check(have('smithgolem').armorShield === 0.5,
      'and keeps its frontal shield — the DEF cut did not quietly remove it', have('smithgolem').armorShield);
check(have('forgewight').blockedPct >= 28 && have('forgewight').blockedPct <= 38,
      'the Forgewight is still armoured (44.4% before any of this)', have('forgewight').blockedPct);
check(have('bellowsbat').blockedPct >= 14, 'the Bellowsbat is not paper', have('bellowsbat').blockedPct);
check(have('cinderling').blockedPct >= 12, 'the Cinderling is not paper', have('cinderling').blockedPct);

// The roster's shape must survive: the titan stays the tank.
const order = r.roster.slice().sort((a, b) => T[b].blockedPct - T[a].blockedPct);
check(order[0] === 'smithgolem' && order[1] === 'forgewight',
      'the tank ordering is unchanged — Smithgolem hardest, then Forgewight', order);
check(JSON.stringify(r.sisterSpawns) === JSON.stringify(r.thisSpawns),
      'Magma Foundry and Furnace Deep still share one roster (so DEF cannot differ across the portal)',
      { sister: r.sisterSpawns, here: r.thisSpawns });
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
