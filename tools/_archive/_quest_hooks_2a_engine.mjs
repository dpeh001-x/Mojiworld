// Phase 2a — quest-giver turn-in engine + NPC dialog injection.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const FUNCS = `// v0.26.823 — QUEST-GIVER TURN-IN SYSTEM. Quests tagged \`handIn:true\` + \`giver:<NPC name>\`
// do NOT auto-complete on the final kill; instead they flag \`readyToHandIn\` and the
// player returns to the giver NPC to claim the reward (see _injectGiverQuests). Quests
// without \`handIn\` keep the legacy auto-complete-on-final-kill behaviour.
function _questGoalMet(id) {
  const q = QUESTS[id]; if (!q) return;
  const a = player.quests && player.quests.active && player.quests.active[id];
  if (q.handIn && q.giver && a) {
    if (!a.readyToHandIn) {
      a.readyToHandIn = true;
      if (typeof showToast === 'function') showToast('✅ Objectives complete — return to ' + q.giver + ' to claim your reward!', 'legendary');
      if (typeof flash === 'function') flash(0.2);
    }
    return;
  }
  _completeQuest(id);
}
// v0.26.823 — Inject quest offer / turn-in / progress options for a giver NPC.
// Called once at the openNPC render point so EVERY role benefits without per-branch
// edits. Quests bind to an NPC by matching q.giver === npc.name.
function _injectGiverQuests(npc, opts) {
  if (!npc || !npc.name || typeof QUESTS !== 'object' || !Array.isArray(opts)) return;
  if (typeof _ensureQuests === 'function') _ensureQuests();
  const Q = player.quests || {};
  const active = Q.active || {}, completed = Q.completed || {}, unlocked = Q.unlocked || {};
  const turnIns = [], offers = [], inProgress = [];
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (!q || q.giver !== npc.name || completed[id]) continue;
    const a = active[id];
    if (a) { (a.readyToHandIn ? turnIns : inProgress).push({ id, q, a }); }
    else if (unlocked[id] && (player.level || 0) >= (q.levelReq || 1) &&
             (!q.prereq || completed[q.prereq]) && (!q.cls || q.cls === player.cls)) {
      offers.push({ id, q });
    }
  }
  const built = [];
  for (const { id, q } of turnIns) {
    built.push({ t: '✅ Turn in: ' + q.name, cb: () => { closeDialog(); if (typeof _completeQuest === 'function') _completeQuest(id); } });
  }
  for (const { id, q } of offers) {
    built.push({ t: '❗ Accept: ' + q.name, cb: () => {
      if (typeof acceptQuest === 'function') acceptQuest(id);
      closeDialog();
      if (typeof showToast === 'function') showToast('📜 Quest accepted: ' + q.name, 'epic');
    } });
  }
  for (const { id, q, a } of inProgress) {
    const tot = (a.targetCount != null) ? a.targetCount : (q.count || 1);
    const prog = Math.min(a.progress || 0, tot);
    built.push({ t: '📜 ' + q.name + ' (' + prog + '/' + tot + ')', cb: () => {
      const el = document.getElementById('dialog-text');
      if (el) el.textContent = '*' + npc.name + ' glances at your tally.*\\n\\nStill on it? ' + prog + ' of ' + tot + ' done. Finish the job and come back — I\\'ll see you right.';
    } });
  }
  for (let i = built.length - 1; i >= 0; i--) opts.unshift(built[i]);
}

function tickQuestKill(monsterType, isBoss) {`;

const reps = [
  // 1) inject the two new functions just before tickQuestKill
  { old: `function tickQuestKill(monsterType, isBoss) {`, neu: FUNCS },
  // 2) multi-objective completion -> _questGoalMet
  { old: `      if (q.objectives.every(o => (a.objProgress[o.target] || 0) >= o.count)) {
        _completeQuest(id);
        granted = true;
      }`,
    neu: `      if (q.objectives.every(o => (a.objProgress[o.target] || 0) >= o.count)) {
        _questGoalMet(id);
        granted = true;
      }` },
  // 3) single-target completion -> _questGoalMet
  { old: `    if (a.progress >= _completionTarget) {
      _completeQuest(id);
      granted = true;
    }`,
    neu: `    if (a.progress >= _completionTarget) {
      _questGoalMet(id);
      granted = true;
    }` },
  // 4) dialog render — inject giver quest options before the Leave button
  { old: `  // The amnesiac manages its own options (the script authors them per stage)
  if (npc.role !== 'amnesiac') {
    opts.push({ t:'Leave', cb: closeDialog });
  }`,
    neu: `  // v0.26.823 — Quest-giver hook: offer / turn in / progress for quests bound to this NPC by name.
  if (typeof _injectGiverQuests === 'function') _injectGiverQuests(npc, opts);
  // The amnesiac manages its own options (the script authors them per stage)
  if (npc.role !== 'amnesiac') {
    opts.push({ t:'Leave', cb: closeDialog });
  }` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error(`FAIL: expected 1, got ${c} for: ${old.slice(0, 60)}...`); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log(`OK: ${n} engine edits applied.`);
