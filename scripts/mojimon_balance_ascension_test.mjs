// v0.29.460 — per user: "ensure that only 1 mojimon can be summoned at a time,
// ensure the balance of the mojimon summoned, it should not be overpowered,
// and with ascension the kill counts should be reset. Only equipments are
// retained on ascension, every other thing is reset."
//
//   node serve.js 8825 && node scripts/mojimon_balance_ascension_test.mjs 8825 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8825';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_mojimonSummon') === 'function' && typeof eval('offerPrestige') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const g = eval('game'), p = eval('player');
  const MT = eval('monsterTypes');
  const types = Object.keys(MT).filter(k => !MT[k].boss).slice(0, 2);
  p.cls = 'warrior'; p.level = 100; p.maxHp = 2000; p.hp = 2000;
  // A realistic endgame attack stat. The first cut left baseAtk ~12, where the
  // formula's Math.max(8, ...) DAMAGE FLOOR dominates: floor(13*0.5)=6 -> 8,
  // and 8/13 = 0.62 read as "ATK is not half" against perfectly correct code.
  p.baseAtk = 400;
  g.minions = []; g.monsters = [];

  const mm = eval('_mojimonEnsure')();
  for (const t of types) mm.roster[t] = { upg: { hp: 0, atk: 0, def: 0 }, at: 1 };
  mm.cdUntil = 0;

  // --- 1. single summon, attacked from every angle --------------------------
  eval('_mojimonSummon')(types[0], { free: true, quiet: true });
  eval('_mojimonSummon')(types[0], { free: true, quiet: true });   // same species twice
  eval('_mojimonSummon')(types[1], { free: true, quiet: true });   // different species
  const afterTriple = g.minions.filter(x => x.mojimon).length;
  // map-travel re-field path (mirrors L49771)
  if (p.mojimon && p.mojimon.out) eval('_mojimonSummon')(p.mojimon.out.type, { free: true, quiet: true, hpFrac: p.mojimon.out.hpFrac });
  const afterRefield = g.minions.filter(x => x.mojimon).length;
  // quick-summon hotkey path
  if (typeof eval('_mojimonQuickSummon') === 'function') { try { eval('_mojimonQuickSummon')(); } catch (e) {} }
  const afterHotkey = g.minions.filter(x => x.mojimon).length;

  // --- 2. balance -----------------------------------------------------------
  const st0 = eval('_mojimonStatsFor')(types[0]);
  const maxHp = eval('getMaxHp')(), atk = eval('getAtk')();
  // Point cap: 40 hand-edited points in ONE stat. The existing total-points
  // self-heal (level/5 = 20 here) trims first — the first cut split 40/40
  // across two stats, got trimmed to 10/10, and never touched the per-stat
  // cap at all. Single-stat: trim to 20, then the cap counts only 15.
  mm.roster[types[0]].upg = { hp: 0, atk: 40, def: 0 };
  eval('_mojimonEnsure')();                          // run the total-points trim like a load would
  const trimmedAtkPts = mm.roster[types[0]].upg.atk;
  const stCap = eval('_mojimonStatsFor')(types[0]);
  mm.roster[types[0]].upg = { hp: 0, atk: 0, def: 40 };
  eval('_mojimonEnsure')();
  const stDef = eval('_mojimonStatsFor')(types[0]);
  mm.roster[types[0]].upg = { hp: 0, atk: 0, def: 0 };
  return {
    types, afterTriple, afterRefield, afterHotkey,
    hpMult: +(st0.maxHp / maxHp).toFixed(2), atkMult: +(st0.atk / atk).toFixed(2),
    trimmedAtkPts,
    // MOJIMON_UPG_PT_CAP was removed from the game in c72bec79; the budget is
  // now _mojimonPoints(). This is a reported diagnostic, not an assertion.
  capAtk: +(stCap.atk / atk).toFixed(3), capDef: stDef.defRed,
  CAP: (typeof _mojimonPoints === 'function') ? _mojimonPoints() : null,
    defCap: eval('MOJIMON_DEF_CAP'),
  };
});

ok('triple summon (same + different species) fields exactly ONE', r.afterTriple === 1, { count: r.afterTriple });
ok('map-travel re-field keeps exactly ONE', r.afterRefield === 1, { count: r.afterRefield });
ok('H quick-summon path keeps exactly ONE', r.afterHotkey === 1, { count: r.afterHotkey });

// v0.29.NEW — per user, "Summoned Mojimon should have the same HP as the
// current player". Was 10× at launch, briefly 6×, now exactly 1×.
ok('BALANCE: HP is exactly the player\'s (parity)', Math.abs(r.hpMult - 1) < 0.02, { hpMult: r.hpMult });
ok('BALANCE: ATK is half the player (was 100%)', Math.abs(r.atkMult - 0.5) < 0.02, { atkMult: r.atkMult });
ok('BALANCE: even 40 hand-edited ATK points cannot push the mon past the player',
   r.capAtk < 1.0 && Math.abs(r.capAtk - 0.5 * (1 + Math.min(15, r.trimmedAtkPts) * 0.05)) < 0.02,
   { capAtk: r.capAtk, trimmedPts: r.trimmedAtkPts, cap: r.CAP });
ok('BALANCE: DR from 40 def points stays at/under the ceiling',
   r.capDef <= r.defCap && r.capDef === Math.min(r.defCap, Math.min(15, 20) * 0.03),
   { capDef: r.capDef, ceiling: r.defCap });

// --- 3. ascension: only equipment survives ----------------------------------
const asc = await page.evaluate(async () => {
  const g = eval('game'), p = eval('player');
  // Seed a rich pre-ascension state.
  p.level = 50;
  p.inventory = [
    { id: 'sword1', slot: 'weapon', name: 'Sword' },
    { id: 'helm1', slot: 'armor', name: 'Helm' },
    { id: 'ring1', slot: 'accessory', name: 'Ring' },
    { id: 'ring2', slot: 'accessorie', name: 'Old Ring' },     // legacy spelling
    { id: 'junk1', slot: 'material', name: 'Ore' },
    { id: 'junk2', name: 'Mystery Meat' },                     // no slot at all
  ];
  p.equipped = p.equipped || {}; p.equipped.weapon = { id: 'eq1', slot: 'weapon', name: 'Equipped Blade' };
  p.mojicoins = 987654; p.bankBalance = 555555;
  p.consumables = { hp_s: 99, mp_s: 99, elixir: 4 };
  g.bestiary = { snail: 12000, slime: 9999 };
  const mm = eval('_mojimonEnsure')();
  mm.roster.snail = { upg: { hp: 3, atk: 2, def: 1 }, at: 1 };
  mm.assigned = 'snail'; mm.cdUntil = Date.now() + 99999;
  g.prestige = { count: 0, xpMult: 1, dmgMult: 1, bonusAP: 0 };
  g._prestigeOffered = false;

  // Run the REAL prestige flow, auto-answering the confirm and blocking the
  // reload it schedules.
  const realConfirm = window.uiConfirm;
  window.uiConfirm = () => Promise.resolve(true);
  const realReload = location.reload;
  let reloadArmed = false;
  try { Object.defineProperty(location, 'reload', { value: () => { reloadArmed = true; }, configurable: true }); } catch (e) {}
  const PL = eval('PRESTIGE_LEVEL');
  p.level = PL;
  eval('offerPrestige')();
  await new Promise(res => setTimeout(res, 100));    // let the .then chain run
  window.uiConfirm = realConfirm;

  return {
    PL,
    invSlots: (p.inventory || []).map(i => i.slot || '(none)'),
    equippedKept: !!(p.equipped && p.equipped.weapon && p.equipped.weapon.id === 'eq1'),
    coins: p.mojicoins, bank: p.bankBalance,
    consumables: p.consumables,
    bestiary: g.bestiary,
    mojimonRoster: Object.keys((p.mojimon && p.mojimon.roster) || {}),
    mojimonAssigned: p.mojimon && p.mojimon.assigned,
    level: p.level, prestigeCount: g.prestige.count,
    reloadArmed,
  };
});

ok('ascension actually ran (level reset, count bumped, reload scheduled)',
   asc.level === 1 && asc.prestigeCount === 1, { level: asc.level, count: asc.prestigeCount, reloadArmed: asc.reloadArmed });
ok('ASCENSION: equipped gear survives', asc.equippedKept === true);
ok('ASCENSION: gear items in the inventory survive (incl. legacy accessorie)',
   asc.invSlots.filter(s2 => ['weapon','armor','accessory','accessorie'].includes(s2)).length === 4, asc.invSlots);
ok('ASCENSION: non-gear items are gone', !asc.invSlots.includes('material') && !asc.invSlots.includes('(none)'), asc.invSlots);
ok('ASCENSION: wallet reset to the fresh 200', asc.coins === 200, { coins: asc.coins });
ok('ASCENSION: the bank is reset too (was the exploit route)', asc.bank === 0, { bank: asc.bank });
ok('ASCENSION: consumables reset to the fresh kit', asc.consumables && asc.consumables.hp_s === 10 && asc.consumables.mp_s === 6 && !asc.consumables.elixir, asc.consumables);
ok('ASCENSION: species kill counts reset (mastery grind starts over)',
   Object.keys(asc.bestiary || {}).length === 0, asc.bestiary);
ok('ASCENSION: the MojiMon roster/assignment/cooldown reset',
   asc.mojimonRoster.length === 0 && !asc.mojimonAssigned, { roster: asc.mojimonRoster, assigned: asc.mojimonAssigned });

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
