// Ticket Rush (party quest) fixes from the second bug hunt (2026-09-26).
// ============================================================================
// 1) THE STAGE 3 TRACKER AND NAVIGATOR SENT YOU TO THE WRONG MAP. Both pick "a map that spawns the target", and the
//    Stage 1 lobby spawns Ticket Mechs too (the Carriage has no inbound portal), so Stage 3 pointed at the lobby and
//    even read "Target nearby" there - where its kills count for nothing (_LX_PQ_STAGE_MAP scopes each stage to its
//    map). Both now name the stage's own map while you are anywhere else.
// 2) MILO WARPED YOU INTO A STAGE HE HAD NOT STARTED. His "Begin Stage 2 / 3 / 4" buttons ignored acceptQuest's
//    answer: below the stage's level (e.g. after an ascension) the quest was refused, yet the toast played and you
//    were loaded into the Spire / Carriage / Express for a run that counted nothing (Stage 4 even spawned the
//    Conductor). They now start the stage or say why not - and stay put.
// 3) A RESUMED SPIRE KEPT ITS PROGRESS BUT NOT ITS PIECES. Re-accepting restores the banked count ("2 already
//    counted") but every accept wiped the collected chest pieces, so the pin read 0/4 against the tracker's 2/4 -
//    and the summit exit, which opens on four PIECES, could stay shut after the quest itself completed. When a
//    banked Spire is being resumed, its pieces are kept (both Milo buttons too), so the chests, pin, tracker and
//    exit agree. A fresh Spire still starts clean.
// 4) "RESET MY PAPERS" KEPT LAST RUN'S BANKED PROGRESS. The restart cleared the chain's active and completed quests
//    but not their banked progress, so a new run's Stage 3 opened at "10 already counted". It clears the bank too.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) pq-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const each = (a, b, n, what) => { const c = s.split(a).length - 1; if (c !== n) die(what + ' matched ' + c + ' (want ' + n + ')'); s = s.split(a).join(b); };

// 1a) the tracker: a map-scoped stage names its map while you are elsewhere
once(J('    } else if (q.target) wanted.add(q.target);', '    if (wanted.size) {', '      let best = null, bd = Infinity;'), J(
  '    } else if (q.target) wanted.add(q.target);',
  '    if (wanted.size) {',
  "      // v0.30.1152 pq-fixes - a Ticket Rush stage counts only on its own map (_LX_PQ_STAGE_MAP): elsewhere, name that map, not the",
  "      // first map that spawns the target (Stage 3's Ticket Mechs also live in the Stage 1 lobby, where they count for nothing)",
  "      { const _stg = (typeof _LX_PQ_STAGE_MAP !== 'undefined') && _LX_PQ_STAGE_MAP[id]; if (_stg && _stg !== game.currentMap) return { icon: '\u2192', text: _qtMapName(_stg) }; }",
  '      let best = null, bd = Infinity;'), 'the tracker kill block');
// 1b) the navigator
once(J('  const huntDest = () => {', '    const cands = [q.target, ...((q.objectives || []).map((o) => o && o.target))];'), J(
  '  const huntDest = () => {',
  "    { const _stg = (typeof _LX_PQ_STAGE_MAP !== 'undefined') && _LX_PQ_STAGE_MAP[qid];   // v0.30.1152 pq-fixes - the stage's own map, reachable or not",
  "      if (_stg) { const hit = pick([_stg], (m) => m); if (hit) return { kind: 'hunt', qid, who: q.target, map: hit.c, x: null, y: null, hops: hopsOf(hit.d), verb: 'Hunt' }; } }",
  '    const cands = [q.target, ...((q.objectives || []).map((o) => o && o.target))];'), 'the navigator huntDest');

// 2) + 3) Milo's Begin Stage buttons start the stage or stay put; the Spire's pieces are acceptQuest's call
const REFUSE = (q) => `if (typeof acceptQuest === 'function' && !acceptQuest(${q})) { _lxPqBeginRefused(${q}); return; }   // v0.30.1152 pq-fixes - refused (level): don't warp into a stage that never started`;
each(J("          if (typeof acceptQuest === 'function') acceptQuest('q_pq_spire');", '          player._pqSpirePieces = {};'), '          ' + REFUSE("'q_pq_spire'"), 1, 'Milo (PQ map) Stage 2');
each(J("          if (typeof acceptQuest === 'function') acceptQuest(_spireId);", '          player._pqSpirePieces = {};'), '          ' + REFUSE('_spireId'), 1, 'Milo (town) Stage 2');
each("          if (typeof acceptQuest === 'function') acceptQuest('q_pq_carriage');", '          ' + REFUSE("'q_pq_carriage'"), 1, 'Milo (PQ map) Stage 3');
each("          if (typeof acceptQuest === 'function') acceptQuest(_carriageId);", '          ' + REFUSE('_carriageId'), 1, 'Milo (town) Stage 3');
each("          if (typeof acceptQuest === 'function') acceptQuest('q_pq_finale');", '          ' + REFUSE("'q_pq_finale'"), 1, 'Milo (PQ map) Stage 4');
each("          if (typeof acceptQuest === 'function') acceptQuest(_finaleId);", '          ' + REFUSE('_finaleId'), 1, 'Milo (town) Stage 4');
once('function _lxPqRestartChain() {', J(
  '// v0.30.1152 pq-fixes - Milo\'s answer when a "Begin Stage" is refused (below the stage\'s level, e.g. after an ascension)',
  'function _lxPqBeginRefused(qid) {',
  "  const q = (typeof QUESTS !== 'undefined') && QUESTS[qid];",
  "  if (typeof closeDialog === 'function') { try { closeDialog(); } catch (e) {} }",
  "  if (typeof showToast === 'function') showToast(q && (player.level | 0) < (q.levelReq | 0) ? '\\uD83C\\uDFAB Milo checks your papers: ' + (q.name || 'this stage') + ' needs Lv ' + q.levelReq + '.' : '\\uD83C\\uDFAB Milo can\\u2019t start that stage for you yet.', 'rare');",
  '}',
  'function _lxPqRestartChain() {'), 'function _lxPqRestartChain');
once("  if (id === 'q_pq_spire') player._pqSpirePieces = {};",
  "  if (id === 'q_pq_spire' && !(player._qBank && player._qBank.q_pq_spire)) player._pqSpirePieces = {};   // v0.30.1152 pq-fixes - a banked Spire being resumed keeps its pieces (the count, pin and summit exit all read them)",
  'acceptQuest Spire pieces reset');

// 4) reset my papers clears the chain's banked progress
once(J('      if (player.quests.completed) delete player.quests.completed[_id];', '      if (player.quests.active)    delete player.quests.active[_id];'), J(
  '      if (player.quests.completed) delete player.quests.completed[_id];',
  '      if (player.quests.active)    delete player.quests.active[_id];',
  '      if (player._qBank) delete player._qBank[_id];   // v0.30.1152 pq-fixes - a fresh run starts fresh (it restored last run\'s "10 already counted")'), 'the restart loop');

const grew = s.length - n0;
if (grew < 2200 || grew > 5000) die('size moved ' + grew);
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
console.log('applied: pq-fixes (+' + grew + ' chars)');
