// The Taxi Uncle remembers the last 3 monster areas you travelled to, per user
// ("allow taxi uncle to remember the last 3 monster areas travelled by players
// as well").
//
// The taxi serves towns only — "the camels only travel to maps WITHOUT
// monsters" — so every combat map the player had walked was refused, which
// reads as the Uncle forgetting your route rather than as a rule. What this has
// to get right is the boundary: the last 3 and no more, only maps actually
// entered, and never a way into a boss arena or an unvisited map.
// Run: node scripts/taxi_combat_memory_test.mjs [file.html]
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
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 99; player.mojicoins = 999999;
  const out = {};

  const isCombat = (id) => {
    const m = MAPS[id];
    return !!(m && !m.isBossArena && Array.isArray(m.spawns) && m.spawns.length > 0);
  };
  const combatMaps = Object.keys(MAPS).filter(isCombat);
  out.combatMapCount = combatMaps.length;

  // Mirror renderTaxi's gate so the verdict here is the same one the modal uses.
  const verdict = (id) => {
    const m = MAPS[id];
    const walk = new Set();
    for (const k in MAPS) { const ps = MAPS[k] && MAPS[k].portals;
      if (Array.isArray(ps)) for (const q of ps) if (q && q.dest) walk.add(q.dest); }
    const visitedIds = new Set(Object.keys(game.visitedMaps || {}));
    for (const k in MAPS) if (MAPS[k] && MAPS[k].taxiAccessible && !walk.has(k)) visitedIds.add(k);
    if (m.isBossArena && m.taxiAccessible !== true) return 'no taxi to bosses';
    const taxiOnly = m.taxiAccessible === true && !walk.has(id);
    const hasMobs = Array.isArray(m.spawns) && m.spawns.length > 0;
    const recent = Array.isArray(game.taxiCombatRecent) && game.taxiCombatRecent.indexOf(id) !== -1;
    if (hasMobs && !taxiOnly && !recent) return 'monsters roam there';
    if (!visitedIds.has(id)) return 'unvisited';
    return 'OK';
  };

  out.cap = (typeof TAXI_COMBAT_MEMORY !== 'undefined') ? TAXI_COMBAT_MEMORY : null;
  out.beforeAny = { list: game.taxiCombatRecent || null, verdictFirst: verdict(combatMaps[0]) };

  // Walk five combat areas in order.
  const walked = combatMaps.slice(0, 5);
  for (const id of walked) loadMap(id);
  out.walked = walked;
  out.memory = (game.taxiCombatRecent || []).slice();

  // The three most recent must be offered; the two older ones must not.
  const recent3 = walked.slice(-3).reverse();
  const dropped = walked.slice(0, walked.length - 3);
  out.recent3 = recent3;
  out.dropped = dropped;
  out.recent3Verdicts = recent3.map(verdict);
  out.droppedVerdicts = dropped.map(verdict);

  // Re-entering an older one must move it back to the front, not duplicate it.
  loadMap(walked[0]);
  out.afterRevisit = (game.taxiCombatRecent || []).slice();
  out.noDupes = new Set(out.afterRevisit).size === out.afterRevisit.length;

  // A town must not enter the combat memory.
  const town = Object.keys(MAPS).find((k) => MAPS[k] && MAPS[k].isTown && !isCombat(k));
  if (town) { loadMap(town); out.town = town; out.townInMemory = (game.taxiCombatRecent || []).indexOf(town) !== -1; }

  // A boss arena must never be admitted by this memory.
  const bossArena = Object.keys(MAPS).find((k) => MAPS[k] && MAPS[k].isBossArena && MAPS[k].taxiAccessible !== true);
  if (bossArena) {
    loadMap(bossArena);
    out.bossArena = bossArena;
    out.bossInMemory = (game.taxiCombatRecent || []).indexOf(bossArena) !== -1;
    out.bossVerdict = verdict(bossArena);
  }
  // A combat map never entered stays refused.
  const unwalked = combatMaps.find((k) => (game.taxiCombatRecent || []).indexOf(k) === -1
                                       && !(game.visitedMaps || {})[k]);
  out.unwalked = unwalked || null;
  out.unwalkedVerdict = unwalked ? verdict(unwalked) : null;

  out.persisted = (typeof GAME_SAVE_FIELDS !== 'undefined') && GAME_SAVE_FIELDS.indexOf('taxiCombatRecent') !== -1;
  return out;
});
await browser.close();

console.log(`  cap=${r.cap}  combat maps in game: ${r.combatMapCount}`);
console.log(`  walked ${JSON.stringify(r.walked)}`);
console.log(`  memory  ${JSON.stringify(r.memory)}`);
console.log(`  recent3 ${JSON.stringify(r.recent3)} -> ${JSON.stringify(r.recent3Verdicts)}`);
console.log(`  dropped ${JSON.stringify(r.dropped)} -> ${JSON.stringify(r.droppedVerdicts)}`);
console.log(`  after revisiting the oldest: ${JSON.stringify(r.afterRevisit)}`);

check(r.cap === 3, 'the memory is three deep, as asked', r.cap);
check(r.beforeAny.verdictFirst === 'monsters roam there',
      'before travelling, a monster area is still refused', r.beforeAny);
check(r.memory.length === 3, 'only three areas are remembered after walking five', r.memory);
check(JSON.stringify(r.memory) === JSON.stringify(r.recent3),
      'and they are the three most recent, newest first', { memory: r.memory, expected: r.recent3 });
check(r.recent3Verdicts.every((v) => v === 'OK'),
      'the taxi now serves all three remembered areas', r.recent3Verdicts);
check(r.droppedVerdicts.every((v) => v === 'monsters roam there'),
      'areas that fell out of memory go back to being refused', { dropped: r.dropped, v: r.droppedVerdicts });
check(r.afterRevisit[0] === r.walked[0] && r.noDupes,
      're-entering an old area moves it to the front without duplicating it', r.afterRevisit);
check(r.townInMemory === false, 'towns never take up a slot in the combat memory', r.town);
check(r.bossInMemory === false, 'a boss arena never enters the memory', r.bossArena);
check(r.bossVerdict === 'no taxi to bosses', 'and boss arenas stay walk-in only', r.bossVerdict);
check(r.unwalkedVerdict === 'monsters roam there' || r.unwalked === null,
      'a monster area you never entered is still not offered', { map: r.unwalked, v: r.unwalkedVerdict });
check(r.persisted === true, 'the memory is saved, so it survives a reload', r.persisted);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
