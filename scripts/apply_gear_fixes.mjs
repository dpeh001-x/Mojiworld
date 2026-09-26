// Gear fixes from the bug hunt (2026-09-26): a class swap refreshes the gear-stat cache, unequipping honours the
// tab cap, and HP/MP never sit above a max that just dropped.
// ============================================================================
// 1) CLASS SWAP KEPT THE OLD CLASS'S GEAR STATS. getEquipBonus() caches the gear totals, and the totals depend on
//    the class twice: own-class gear x1.20 / other-class x0.75, and class-gated set bonuses. applyClass() changes
//    player.cls but never invalidated the cache, then filled HP from it: a level-60 Warrior in the Doomforged set
//    who swapped to Rogue at the Amnesiac kept ATK 675 / DEF 165 / max HP 2562 (true: 343 / 97 / 1437), HP filled
//    to 2562, the Warrior-only set bonus still on - until something else happened to clear the cache.
//    Fix: invalidate right before applyClass syncs HP/MP to the new class.
// 2) UNEQUIPPING IGNORED THE TAB CAP. The worn-slot click pushed the piece back with no check (the swap path next to
//    it, pickups and crafting all refuse a full tab), so a full Equip tab went to 43/40. Fix: the same check and the
//    same "tab is full - free a slot first" toast as the swap path.
// 3) HP ABOVE MAX while the panel stays open (the game is paused, so the per-frame clamp never ran): taking off a
//    +HP piece left "919 / 195" on the HUD. Fix: clamp HP/MP after equip and unequip.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gear-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const CLAMP = "if (player.hp > getMaxHp()) player.hp = getMaxHp(); if (player.mp > getMaxMp()) player.mp = getMaxMp();";

// 1) applyClass: refresh the gear cache before HP/MP are synced to the new class
const SYNC = J('  player.milestonesUnlocked = {};', '  // Sync HP/MP to the post-class base values.', '  player.hp = getMaxHp();', '  player.mp = getMaxMp();', '  checkMilestones();');
once(SYNC, SYNC.replace('  // Sync HP/MP', "  if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();   // v0.30.1131 gear-fixes - the gear totals depend on the class (x1.20 own / x0.75 other, class-gated sets); a swap kept the old class's" + EOL + '  // Sync HP/MP'), 'applyClass HP/MP sync');

// 2) + 3) the worn-slot click: honour the tab cap, then clamp
const UNEQ = J(
  '    el.onclick = () => {',
  '      if (it) {',
  '        player.inventory.push(it);',
  '        player.equipped[slot] = null;',
  '        invalidateEquipBonusCache();   // v0.25.792');
once(UNEQ, J(
  '    el.onclick = () => {',
  '      if (it) {',
  '        // v0.30.1131 gear-fixes - the piece goes back into its tab, so the tab must have room (as the swap path, pickups',
  '        // and crafting already demand); a full Equip tab went to 43/40 by taking three pieces off',
  "        { const _uTab = (typeof _itemTab === 'function') ? _itemTab(it) : 'equip';",
  "          const _uCap = (player.invCap && typeof player.invCap[_uTab] === 'number') ? player.invCap[_uTab] : 24;",
  "          let _uUsed = 0; for (const _x of player.inventory) if (((typeof _itemTab === 'function') ? _itemTab(_x) : 'equip') === _uTab) _uUsed++;",
  "          if (_uUsed >= _uCap) { if (typeof showToast === 'function') showToast(`${({ equip: 'Equip', use: 'Use', etc: 'Etc' })[_uTab] || 'That'} tab is full \u2014 free a slot first`, 'danger'); return; } }",
  '        player.inventory.push(it);',
  '        player.equipped[slot] = null;',
  '        invalidateEquipBonusCache();   // v0.25.792',
  '        ' + CLAMP + '   // v0.30.1131 gear-fixes - taking off a +HP piece: HP never above the new max'), 'the worn-slot unequip click');

// 3) the equip path: clamp too (swapping to a piece with less HP)
const EQ = J('        player.equipped[it.slot] = it;', '        invalidateEquipBonusCache();   // v0.25.792 — equip-bonus cache invalidation');
once(EQ, EQ + EOL + '        ' + CLAMP + '   // v0.30.1131 gear-fixes - a swap to a piece with less HP/MP', 'the equip click');

const grew = s.length - n0;
if (grew < 900 || grew > 2600) die('size moved ' + grew);
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
console.log('applied: gear-fixes (+' + grew + ' chars)');
