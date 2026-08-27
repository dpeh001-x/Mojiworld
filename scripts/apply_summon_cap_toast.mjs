// One "Summon cap reached" notice, not a column of them.
// =============================================================================
// Per user, with a screenshot of four stacked copies: "For beast master this
// notifications keep spamming about summon cap being reached".
//
// WHY IT STACKS. The cast is refunded when the cap is full - v0.26.1030 chose
// that deliberately, so a no-op cast does not burn the cooldown or the MP. That
// is the right call and is left alone. But it means nothing rate-limits the
// player: with no cooldown consumed, every press while the pack is full is
// another cast attempt, and every attempt raised another toast. The wolves last
// 100s, so a full pack spams for as long as the player keeps pressing.
//
// showToast has no dedupe of any kind, so the symptom belongs to the caller.
// Both call sites are throttled through one helper - the Ranger's Wild Bond
// shares the cap and the exact message, so fixing only the Beastmaster would
// have left the same column of toasts on the other kit.
//
// The cast still no-ops and still refunds; only the NOTICE is rate-limited.
// The first press always speaks, so the player is never left wondering why
// nothing happened.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('_lxSummonCapToast')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchorRaw, afterRaw) => {
  const anchor = anchorRaw.split('\n').join(EOL);
  const after = afterRaw.split('\n').join(EOL);
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.replace(anchor, after);
};

// ---- the throttled notice --------------------------------------------------
sub('helper', 'function _lxSummonHp() {',
`// v0.30.x - ONE VOICE, NOT FOUR (per user: the summon-cap notice "keeps
// spamming"). A capped cast is refunded by design (v0.26.1030), so no cooldown
// is consumed and nothing rate-limits repeat presses - every one raised its own
// toast, and the wolves last 100s. showToast has no dedupe, so the throttle
// lives with the caller. Shared by the Beastmaster's pack and the Ranger's Wild
// Bond, which use the same cap and the same wording.
// The FIRST press always speaks: silence would leave the player wondering why
// the key did nothing.
const LX_SUMMON_CAP_TOAST_MS = 2500;
let _lxSummonCapToastAt = -1e9;
function _lxSummonCapToast(cap) {
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - _lxSummonCapToastAt < LX_SUMMON_CAP_TOAST_MS) return;
  _lxSummonCapToastAt = now;
  if (typeof showToast === 'function') showToast('Summon cap (' + cap + ') reached', 'rare');
}
function _lxSummonHp() {`);

// ---- both call sites -------------------------------------------------------
sub('wildBond', "      showToast('Summon cap (' + SUMMON_CAP + ') reached', 'rare');",
`      _lxSummonCapToast(SUMMON_CAP);   // v0.30.x - throttled; see _lxSummonCapToast`);

sub('beastmaster', "    if (slots <= 0) { if (typeof showToast === 'function') showToast('Summon cap (' + SUMMON_CAP + ') reached', 'rare'); return '_lxNoCast'; }   // v0.26.1030 — refund cd/MP instead of burning it on a no-op",
`    if (slots <= 0) { _lxSummonCapToast(SUMMON_CAP); return '_lxNoCast'; }   // v0.26.1030 — refund cd/MP instead of burning it on a no-op; v0.30.x — notice throttled`);

writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size <= n0) { console.error('ABORT: tmp not larger'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars`);
console.log('  both summon-cap notices now route through the throttle');
