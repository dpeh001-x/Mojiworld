// A Tower floor's goal counts the enemies that are actually there (bug hunt 2, 2026-09-26).
// ============================================================================
// Each floor's goal is written against its authored roster ("Defeat all 40 enemies (30 Shardlings + 10 Tomb
// Hexers)"), but the on-screen monster ceiling trims what spawns - B7 put 36 on a desktop (27 + 9) and would put 22
// on a phone - and the floor clears on what spawned. So the pin and the objective toast promised enemies that never
// existed. The goal is now restated from what is on the floor once the spawn pass has run (only its numbers change:
// the total and each type's count in the breakdown, in roster order); floors that spawn their full roster read as
// before, and boss floors are untouched.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) tower-goal/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// the helper, beside the pin it refreshes
once('function _renderExpeditionQuestPin() {', J(
  "// v0.30.1157 tower-goal - restate a Tower floor's goal from the enemies actually on it: the on-screen ceiling trims the authored",
  "// roster (B7: 40 written, 36 on a desktop, 22 on a phone) and the floor clears on what spawned. Only the numbers change.",
  'function _lxTowerGoalFromSpawns(id) {',
  '  const cq = game.expedition && game.expedition.currentQuest, cfg = MAPS[id] && MAPS[id]._towerFloor;',
  '  if (!cq || cq.id !== id || !cfg || !cfg.quest || game.currentMap !== id) return;',
  '  const roster = (cfg.spawns || []).filter((sp) => sp && sp.type && !sp.boss);',
  '  if (!roster.length) return;',
  '  const counts = roster.map((sp) => (game.monsters || []).filter((m) => m && m.type === sp.type && !m.isBoss && !m.ally && m.currentHp > 0).length);',
  '  const total = counts.reduce((a, b) => a + b, 0);',
  '  if (!(total > 0)) return;',
  '  let g = String(cfg.quest.goal || \'\');',
  '  const allN = g.match(/Defeat all (\\d+) /);',
  '  if (!allN || +allN[1] === total) return;',
  "  g = g.replace(/Defeat all \\d+ /, 'Defeat all ' + total + ' ');",
  "  g = g.replace(/\\(([^)]*)\\)/, (whole, inner) => { const parts = inner.split(' + '); return parts.length === counts.length && parts.every((p) => /^\\d+ /.test(p)) ? '(' + parts.map((p, i) => p.replace(/^\\d+/, String(counts[i]))).join(' + ') + ')' : whole; });",
  '  cq.goal = g;',
  "  if (typeof _renderExpeditionQuestPin === 'function') _renderExpeditionQuestPin();",
  '}',
  'function _renderExpeditionQuestPin() {'), 'function _renderExpeditionQuestPin');

// loadMap: restate once the spawn pass has run; the objective toast reads the restated goal
once('      game.expedition.currentQuest = { id: id, title: _cfg.quest.title, goal: _cfg.quest.goal };', J(
  '      game.expedition.currentQuest = { id: id, title: _cfg.quest.title, goal: _cfg.quest.goal };',
  "      setTimeout(() => { try { _lxTowerGoalFromSpawns(id); } catch (e) {} }, 0);   // v0.30.1157 tower-goal - after the spawn pass below"),
  'the tower currentQuest line');
once("        setTimeout(() => showToast(`\uD83D\uDCDC ${_cfg.quest.title} \u2014 ${_cfg.quest.goal}`, 'rare'), 400);",
  "        setTimeout(() => showToast(`\uD83D\uDCDC ${_cfg.quest.title} \u2014 ${(game.expedition.currentQuest && game.expedition.currentQuest.id === id && game.expedition.currentQuest.goal) || _cfg.quest.goal}`, 'rare'), 400);   // v0.30.1157 tower-goal - the restated goal",
  'the tower objective toast');

const grew = s.length - n0;
if (grew < 1200 || grew > 3500) die('size moved ' + grew);
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
console.log('applied: tower-goal (+' + grew + ' chars)');
