// Progress fixes from the bug hunt (2026-09-26): a resumed multi-step quest counts on from where it was, and the
// Jump lane respects a master's jump bonus.
// ============================================================================
// 1) "PROGRESS RESTORED", THEN THROWN AWAY. acceptQuest restores a re-accepted quest's banked progress onto the quest
//    and toasts it ("Progress restored - 2 already counted", tracker 2/4), but tickQuestVisit counts multi-step
//    quests (the Spire's four chests) from a side table that the accept had just cleared - so the next chest set it
//    to 1/4, and three chests later it sat at 3/4, not done. It now counts on from whichever is higher.
// 2) DRAGOON'S +2 JUMP. The Jump lane's cap assumed jump starts at the class base, but the Dragoon master adds +2
//    on top: a Dragoon could buy 18 ranks where only 14 can add anything (apply() quietly clamps at 20), 8 SP for
//    nothing - and Reset Stats, which takes back 0.5 a rank and floors at the class base, then deleted the Dragoon's
//    +2 for good. The cap is now "ranks bought + ranks that can still add", and the reset floors at class base plus
//    any job / master jump bonus.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) progress-fixes/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) tickQuestVisit counts on from the restored progress
once('      const _next = (player.quests.progress[id] || 0) + 1;', J(
  "      // v0.30.1136 progress-fixes - count on from whichever is higher, the side table or the quest's own progress: a re-accepted",
  '      // quest gets its banked progress restored onto it while the side table is cleared, so the next step threw it away',
  '      // ("Progress restored - 2 already counted", then 1/4).',
  "      const _aqp = (player.quests.active[id] && (player.quests.active[id].progress | 0)) || 0;",
  '      const _next = Math.max(player.quests.progress[id] || 0, _aqp) + 1;'), 'tickQuestVisit _next');

// 2a) the Jump lane's cap: ranks bought + ranks that can still add before the 20 ceiling
once("get cap() { return Math.max(0, (20 - ((typeof CLASSES !== 'undefined' && player.cls && CLASSES[player.cls] && CLASSES[player.cls].stats && CLASSES[player.cls].stats.jump) || 10)) * 2); }",
  "get cap() { /* v0.30.1136 progress-fixes - ranks bought + ranks that can still add (a master's +jump counts: Dragoon) */ const _jSp = (player._levelUpSpent && player._levelUpSpent.jump) | 0; return _jSp + Math.max(0, Math.floor((20 - (player.baseJump || 10)) * 2 + 1e-9)); }",
  'the Jump lane cap');

// 2b) Reset Stats floors jump at class base + job / master jump bonus
once('        player.baseJump  = Math.max(_cs.jump  || 0, player.baseJump  || 0);',
  "        player.baseJump  = Math.max((_cs.jump  || 0) + ((player.job && typeof JOBS !== 'undefined' && JOBS[player.job] && JOBS[player.job].stats && JOBS[player.job].stats.jump) || 0) + ((player.master && typeof MASTERS !== 'undefined' && MASTERS[player.master] && MASTERS[player.master].stats && MASTERS[player.master].stats.jump) || 0), player.baseJump  || 0);   // v0.30.1136 progress-fixes - a job / master's +jump (Dragoon) is not the lane's to take back",
  'the Reset Stats jump floor');

const grew = s.length - n0;
if (grew < 700 || grew > 1800) die('size moved ' + grew);
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
console.log('applied: progress-fixes (+' + grew + ' chars)');
