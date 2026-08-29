// v0.30.277 — the multikill stall: per-kill DOM work now coalesces per frame.
// =============================================================================
// Per user: "laggy when i multikill, boss fights and late game".
//
// MEASURED, not guessed. The combat probe kills 40 mobs in one synchronous
// task through the real killMonster pipeline (what a screen-clear skill does)
// and profiles it with the V8 sampler at 100us:
//
//   wipe task: ~55ms.  Top self-time inside it:
//     26-34ms  get offsetWidth      <- forced synchronous reflow, per kill
//      5.0ms   showKillToast        <- innerHTML parse + append, per kill
//      4.0ms   _renderMasteryBar    <- the function DOING the offsetWidth reads
//      2.8ms   killMonster          <- everything else it does, combined
//   (saveState / quests / achievements: ~0. The stall is DOM, not game logic.)
//
// Worst frame during the wipe: 83-86ms on a fast headless machine; the
// reporting user's machine runs ~3.5x slower, putting the same wipe at
// ~200-300ms — one long visible freeze per multikill. Canvas-side systems
// measured clean (boss fight: 147fps, worst 33ms), and the static perf-pass's
// 15 findings were audited one by one: 13 already shipped in earlier passes
// or parallel sessions, 2 dead on the current tree. This is what remained.
//
// THE MECHANISM. _renderMasteryBar runs once per kill and does
// `void el.offsetWidth` (deliberately, to replay its pop-in animation) right
// after writing textContent/innerHTML/style — so every kill in the wipe pays
// write -> forced-layout on a dirty tree. 40 kills = 40 reflows in one task.
// showKillToast mints a DOM toast per kill (40 innerHTML parses), of which
// the 4-toast cap immediately evicts 36 unseen.
//
// THE FIX — coalesce per frame; nothing a player can see changes:
//   mastery bar  the reflow + pop replay run once per game.time. Nothing
//                paints between same-frame calls, so the replays being
//                skipped were invisible by definition. Kills on later frames
//                replay the pop exactly as before. The DOM writes (numbers,
//                fill width) still run every call, so the LAST kill's totals
//                are what the frame shows.
//   kill toast   same-frame kills merge into one toast showing the SUMS —
//                40 stacked "+9 XP" slivers become "+360 XP" (more readable,
//                and 39 fewer innerHTML parses + appends + evictions).
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

for (const c of s) { const cc = c.charCodeAt(0); if (cc >= 0xD800 && cc <= 0xDBFF) continue; }
if (s.includes('_mbFrame') || s.includes('_lxAgg')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- A. mastery bar: one reflow + pop replay per frame ----------------------
sub('mastery reflow',
  J("  el.style.display = 'block';",
    "  // Force a reflow so re-triggering .mb-show on consecutive kills replays the",
    "  // pop-in instead of being coalesced away by the transition.",
    "  void el.offsetWidth;",
    "  el.classList.add('mb-show');",
    "  if (starUp) {",
    "    el.classList.remove('mb-pop'); void el.offsetWidth; el.classList.add('mb-pop');",
    "  }"),
  J("  el.style.display = 'block';",
    "  // Force a reflow so re-triggering .mb-show on consecutive kills replays the",
    "  // pop-in instead of being coalesced away by the transition.",
    "  // v0.30.277 — ONCE PER FRAME. This runs per kill, and the forced reflow",
    "  // lands right after the DOM writes above — so a 40-kill wipe paid 40",
    "  // write->layout cycles in ONE task, profiled at 26-34ms of `get",
    "  // offsetWidth` inside a ~55ms multikill stall (the largest line in it).",
    "  // Nothing paints between same-frame calls, so the skipped replays were",
    "  // invisible by definition; kills on later frames replay exactly as",
    "  // before. The number/fill writes above still run every call, so the",
    "  // frame shows the LAST kill's totals.",
    "  const _mbNow = (typeof game !== 'undefined' && game && game.time) || 0;",
    "  if (el._mbFrame !== _mbNow) {",
    "    el._mbFrame = _mbNow;",
    "    void el.offsetWidth;",
    "    el.classList.add('mb-show');",
    "    if (starUp) {",
    "      el.classList.remove('mb-pop'); void el.offsetWidth; el.classList.add('mb-pop');",
    "    }",
    "  } else if (starUp && !el.classList.contains('mb-pop')) {",
    "    // A same-frame star-up still pops: first add needs no reflow trick.",
    "    el.classList.add('mb-pop');",
    "  }"));

// ---- B. kill toast: same-frame kills merge into one -------------------------
sub('toast aggregate',
  J("function showKillToast(expGain, mojicoinGain) {",
    "  const host = document.getElementById('coin-toast-zone');",
    "  if (!host) return;"),
  J("function showKillToast(expGain, mojicoinGain) {",
    "  const host = document.getElementById('coin-toast-zone');",
    "  if (!host) return;",
    "  // v0.30.277 — same-frame kills merge into ONE toast showing the sums. A",
    "  // 40-kill wipe minted 40 toasts in one task (40 innerHTML parses +",
    "  // appends) and the 4-toast cap evicted 36 of them unseen; the merged",
    "  // toast reads better anyway. Later-frame kills toast exactly as before.",
    "  const _tNow = (typeof game !== 'undefined' && game && game.time) || 0;",
    "  const _ag = host._lxAgg;",
    "  if (_ag && _ag.t === _tNow && _ag.el && _ag.el.parentNode) {",
    "    _ag.exp += Math.max(0, Math.floor(expGain || 0));",
    "    _ag.moj += Math.max(0, Math.floor(mojicoinGain || 0));",
    "    const _ksA = (typeof game !== 'undefined' && (game.mapKillStreak | 0) >= 25)",
    "      ? `<span class=\"kill-sep\">·</span><span class=\"kill-streak\">💀${(game.mapKillStreak | 0).toLocaleString()}</span>` : '';",
    "    _ag.el.innerHTML =",
    "      `<span class=\"kill-exp\">+${_ag.exp}<span class=\"kill-exp-tag\"> XP</span></span>` +",
    "      `<span class=\"kill-sep\">·</span>` +",
    "      `<span class=\"coin-amt\">+${_ag.moj}</span><span class=\"coin-icon\">🪙</span>` + _ksA;",
    "    return;",
    "  }"));

// Anchored through showKillToast's own innerHTML tail — the bare
// appendChild+setTimeout pair also exists verbatim in the sibling coin toast,
// where _tNow/_exp/_moj are not in scope.
sub('toast agg memo',
  '` + _ks;' + EOL + '  host.appendChild(t);',
  '` + _ks;' + EOL + '  host.appendChild(t);' + EOL
    + "  host._lxAgg = { t: _tNow, el: t, exp: _exp, moj: _moj };   // v0.30.277 — same-frame merge target");

// ---- version bump -----------------------------------------------------------
sub('version', "GAME_VERSION = 'v0.30.276'", "GAME_VERSION = 'v0.30.277'");

const grew = s.length - n0;
if (grew < 1200 || grew > 3600) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +2300`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: per-frame coalescing for mastery-bar reflow + kill toast, v0.30.277 (${n0} -> ${s.length} chars, +${grew})`);
