// Streak guard: each login-streak milestone pays once per save, and a Zodiac Sigil respects the Etc tab's cap
// (combat / economy audit, 2026-09-26).
// ============================================================================
//   1) THE STREAK MILESTONES COULD BE FARMED WITH THE PC CLOCK. The 14 / 30 / 60 / 100-day bonuses paid whenever the
//      streak counter reached the number. Stepping the clock forward a day at a time walked the streak to 100 (all four
//      milestones), a two-day skip reset it to 1, and walking it up again paid all four again: +120,287 coins per cycle in
//      the audit. Setting the clock back more than 30 days is "healed" (the stored day re-based to today, streak kept) once
//      per save, which let the player return to the real date between cycles.
//      Now the save remembers which milestones have been paid (and the best streak ever claimed), and a milestone already
//      paid pays nothing. A save from before this fix counts every milestone its streak had already passed as paid.
//      The daily login bonus, the challenge and the Postal Wisp parcel are unchanged: a real new day still pays them.
//   2) A ZODIAC SIGIL IGNORED THE BAG. The kill pushed the sigil into the inventory with no tab-cap check, so a sigil
//      earned with a full Etc tab sat past the last visible slot. Every other grant (quest reward, chest, pickup, craft)
//      checks the cap; the sigil now does too, and a full tab drops it at the hero's feet (the pickup holds it on the
//      ground until a slot is free), with the toast saying so.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxStreakMilestone(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the ledger is saved
once("  '_cursedChestOpened','_echoGearAt','_dailyClockHealed',   // v0.30.861 loops", J(
  "  '_cursedChestOpened','_echoGearAt','_dailyClockHealed',   // v0.30.861 loops",
  "  '_dailyMilesPaid','_dailyBestStreak',   // v0.30.1176 streak-guard - the login-streak milestones already paid + the best streak ever claimed"),
  'GAME_SAVE_FIELDS loops line');

// 1) the ledger helper, ahead of checkDaily
once('function checkDaily() {', J(
  '// v0.30.1176 streak-guard - EACH LOGIN-STREAK MILESTONE PAYS ONCE PER SAVE. The 14 / 30 / 60 / 100-day bonuses paid whenever the',
  '// streak counter reached the number, and the PC clock could walk it there again and again (forward a day at a time, let it',
  '// lapse, walk it up again: +120,287 coins a cycle in the audit). game._dailyMilesPaid remembers each milestone paid (the day',
  '// index it paid on) and game._dailyBestStreak the best streak ever claimed; a milestone in the ledger pays nothing. A save',
  '// from before the ledger counts every milestone its streak (or best streak) had already passed as paid.',
  'function _lxStreakMilestone(streak, table, prev, day) {',
  "  if (!game._dailyMilesPaid || typeof game._dailyMilesPaid !== 'object') {",
  '    game._dailyMilesPaid = {};',
  '    const had = Math.max((prev && prev.streak) | 0, game._dailyBestStreak | 0);',
  '    for (const k in table) if (+k <= had) game._dailyMilesPaid[k] = true;',
  '  }',
  '  game._dailyBestStreak = Math.max(game._dailyBestStreak | 0, streak | 0);',
  '  if (!table[streak] || game._dailyMilesPaid[streak]) return 0;',
  '  game._dailyMilesPaid[streak] = day || true;',
  '  return table[streak];',
  '}',
  'function checkDaily() {'), 'checkDaily head');

// 1) checkDaily asks the ledger
once('    const _mileBonus = _streakMiles[streak] || 0;',
  '    const _mileBonus = _lxStreakMilestone(streak, _streakMiles, prev, day);   // v0.30.1176 streak-guard - once per save, not once per lap',
  'the milestone lookup');

// 2) the sigil helper, beside the other sigil helpers
once('function _lxSigilCount() {', J(
  "// v0.30.1176 streak-guard - A ZODIAC SIGIL RESPECTS THE ETC TAB'S CAP like every other grant (quest reward, chest, pickup, craft):",
  '// it was pushed into the bag unconditionally, past the last visible slot when the tab was full. A full tab drops it at the',
  "// hero's feet on the quest-reward life; the pickup's own cap check keeps it on the ground until a slot is free. True = bagged.",
  'function _lxGiveSigil(it) {',
  '  if (!Array.isArray(player.inventory)) player.inventory = [];',
  "  const tabOf = (x) => (typeof _itemTab === 'function') ? _itemTab(x) : 'etc';",
  "  const tab = tabOf(it), cap = (player.invCap && typeof player.invCap[tab] === 'number') ? player.invCap[tab] : 24;",
  '  let used = 0;',
  '  for (const x of player.inventory) if (x && tabOf(x) === tab) used++;',
  '  if (used < cap) { player.inventory.push(it); return true; }',
  '  if (!Array.isArray(game.drops)) game.drops = [];',
  "  game.drops.push({ x: (player.x || 0) + (player.w || 28) / 2, y: (player.y || 0) + (player.h || 44) / 2, vy: -6, type: 'item', item: it, life: 150000, _questReward: true });",
  '  return false;',
  '}',
  'function _lxSigilCount() {'), '_lxSigilCount head');

// 2) the kill grants through it
once(J('      if (!player.inventory) player.inventory = [];', '      player.inventory.push({', '        name: `${_lxZodiacSign(_sign)} Sigil`'), J(
  '      if (!player.inventory) player.inventory = [];',
  "      const _bagged = _lxGiveSigil({   // v0.30.1176 streak-guard - through the Etc tab's cap (a full tab drops it at your feet)",
  '        name: `${_lxZodiacSign(_sign)} Sigil`'), 'the sigil push');
once(" ${_lxZodiacSign(_sign)} Sigil obtained!`, 'legendary');",
  " ${_lxZodiacSign(_sign)} Sigil obtained!${_bagged ? '' : ' Etc tab full \\u2014 it dropped at your feet, pick it up!'}`, 'legendary');   // v0.30.1176 streak-guard",
  'the sigil toast');

const grew = s.length - n0;
if (grew < 2500 || grew > 5500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: streak-guard (+' + grew + ' chars)');
